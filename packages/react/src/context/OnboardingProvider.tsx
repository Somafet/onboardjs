// @onboardjs/react/src/context/OnboardingProvider.tsx
"use client";

import React, {
  createContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import {
  OnboardingEngine,
  EngineState,
  // OnboardingStep, // Not directly used in this file's top-level logic
  OnboardingContext as CoreOnboardingContext,
  OnboardingEngineConfig,
  DataLoadListener,
  DataPersistListener,
  LoadedData,
} from "@onboardjs/core";

export interface OnboardingContextValue {
  engine: OnboardingEngine | null;
  state: EngineState | null;
  isLoading: boolean; // Combined loading state (engine + component interactions)
  setComponentLoading: (loading: boolean) => void;
}

export const OnboardingContext = createContext<
  OnboardingContextValue | undefined
>(undefined);

export interface LocalStoragePersistenceOptions {
  /** A unique key for storing this onboarding flow's progress in localStorage. */
  key: string;
  /**
   * Optional: Time in milliseconds after which the persisted data is considered stale and ignored.
   * If not set, data does not expire.
   */
  ttl?: number;
}

export interface OnboardingProviderProps
  extends Omit<OnboardingEngineConfig, "onDataLoad" | "onDataPersist"> {
  // Omit core persistence props
  children: ReactNode;
  /**
   * Configuration for enabling localStorage persistence.
   * If provided, the flow's progress will be saved to and loaded from localStorage.
   */
  localStoragePersistence?: LocalStoragePersistenceOptions;
  /**
   * For advanced scenarios: Directly provide your own onDataLoad function.
   * If provided, this will be used INSTEAD of localStoragePersistence.
   */
  customOnDataLoad?: DataLoadListener;
  /**
   * For advanced scenarios: Directly provide your own onDataPersist function.
   * If provided, this will be used INSTEAD of localStoragePersistence.
   */
  customOnDataPersist?: DataPersistListener;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({
  children,
  steps,
  initialStepId,
  initialContext,
  onFlowComplete,
  onStepChange,
  localStoragePersistence,
  customOnDataLoad,
  customOnDataPersist,
}) => {
  const [engine, setEngine] = useState<OnboardingEngine | null>(null);
  const [engineState, setEngineState] = useState<EngineState | null>(null);
  const [componentLoading, setComponentLoading] = useState(false);

  // --- Persistence Logic ---
  const onDataLoadHandler = useCallback(async (): Promise<
    LoadedData | null | undefined
  > => {
    if (customOnDataLoad) {
      return customOnDataLoad();
    }
    if (!localStoragePersistence || typeof window === "undefined") {
      return null;
    }
    const { key, ttl } = localStoragePersistence;
    try {
      const savedStateRaw = window.localStorage.getItem(key);
      if (savedStateRaw) {
        const savedState = JSON.parse(savedStateRaw);
        if (ttl && savedState.timestamp) {
          if (Date.now() - savedState.timestamp > ttl) {
            console.log(
              `[OnboardJS] localStorage data for key "${key}" expired. Ignoring.`
            );
            window.localStorage.removeItem(key);
            return null;
          }
        }
        console.log(
          `[OnboardJS] Loaded from localStorage (key: "${key}"):`,
          savedState.data
        );
        return savedState.data as LoadedData; // The actual LoadedData object is nested
      }
    } catch (error) {
      console.error(
        `[OnboardJS] Error loading from localStorage (key: "${key}"):`,
        error
      );
      window.localStorage.removeItem(key); // Clear corrupted data
    }
    return null;
  }, [localStoragePersistence, customOnDataLoad]);

  const onDataPersistHandler = useCallback(
    async (
      context: CoreOnboardingContext,
      currentStepId: string | null
    ): Promise<void> => {
      if (customOnDataPersist) {
        return customOnDataPersist(context, currentStepId);
      }
      if (!localStoragePersistence || typeof window === "undefined") {
        return;
      }
      const { key } = localStoragePersistence;
      try {
        const dataToSave: LoadedData = {
          flowData: context.flowData,
          currentStepId: currentStepId,
          // You could add other top-level context fields here if needed
        };
        const stateToStore = {
          timestamp: Date.now(),
          data: dataToSave,
        };
        window.localStorage.setItem(key, JSON.stringify(stateToStore));
        // console.log(`[OnboardJS] Persisted to localStorage (key: "${key}")`);
      } catch (error) {
        console.error(
          `[OnboardJS] Error persisting to localStorage (key: "${key}"):`,
          error
        );
      }
    },
    [localStoragePersistence, customOnDataPersist]
  );
  // --- End Persistence Logic ---

  useEffect(() => {
    const engineConfig: OnboardingEngineConfig = {
      steps,
      initialStepId,
      initialContext,
      onFlowComplete: (context) => {
        if (onFlowComplete) onFlowComplete(context);
        // Clear localStorage on flow completion if persistence is enabled
        if (localStoragePersistence && typeof window !== "undefined") {
          window.localStorage.removeItem(localStoragePersistence.key);
          console.log(
            `[OnboardJS] Cleared localStorage (key: "${localStoragePersistence.key}") on flow completion.`
          );
        }
      },
      onStepChange,
      onDataLoad:
        customOnDataLoad ||
        (localStoragePersistence ? onDataLoadHandler : undefined),
      onDataPersist:
        customOnDataPersist ||
        (localStoragePersistence ? onDataPersistHandler : undefined),
    };

    const newEngine = new OnboardingEngine(engineConfig);
    setEngine(newEngine);
    // Initial state is set by the engine itself after potential hydration
    // setEngineState(newEngine.getState()); // This might be too early if hydration is async

    const unsubscribe = newEngine.subscribeToStateChange((newState) => {
      // Assuming subscribeToStateChange exists
      setEngineState(newState);
    });

    // Set initial state once after engine is created and potentially hydrated
    // The engine's initializeEngine method now handles setting initial state and notifying.
    // So, we just need to ensure our listener picks up the first state.
    // If the engine notifies immediately after construction (even if hydrating), this is fine.
    // If not, we might need to grab the state once after a tick or after hydration promise.
    // For now, relying on the engine's internal notification from initializeEngine.

    return () => {
      unsubscribe();
      // newEngine.dispose(); // If you add a dispose method to the engine for cleanup
    };
  }, [
    steps,
    initialStepId,
    initialContext,
    localStoragePersistence,
    onDataLoadHandler,
    onDataPersistHandler,
    onFlowComplete,
    onStepChange,
  ]);

  const isLoading = useMemo(
    () =>
      componentLoading ||
      (engineState?.isLoading ?? false) ||
      (engineState?.isHydrating ?? false),
    [componentLoading, engineState?.isLoading, engineState?.isHydrating] // Add isHydrating
  );

  const value = useMemo(
    () => ({
      engine,
      state: engineState,
      isLoading,
      setComponentLoading,
    }),
    [engine, engineState, isLoading]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};
