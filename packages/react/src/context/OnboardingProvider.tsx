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

// Define the actions type based on OnboardingEngine methods
// This makes it more maintainable if engine methods change.
// Note: Return types are Promise<void> because our wrapped actions are async.
export interface OnboardingActions {
  next: (stepSpecificData?: any) => Promise<void>;
  previous: () => Promise<void>;
  skip: () => Promise<void>;
  goToStep: (stepId: string, stepSpecificData?: any) => Promise<void>;
  updateContext: (
    newContextData: Partial<CoreOnboardingContext>
  ) => Promise<void>;
  reset: (newConfig?: Partial<OnboardingEngineConfig>) => Promise<void>;
}

export interface OnboardingContextValue {
  engine: OnboardingEngine | null;
  state: EngineState | null;
  isLoading: boolean; // Combined loading state (engine + component interactions)
  setComponentLoading: (loading: boolean) => void;
  actions: OnboardingActions | null;
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

  /**
   * Optional custom function to clear persisted data.
   * If provided, this will be used INSTEAD of the default localStorage clearing logic.
   */
  customOnClearPeristedData?: () => void;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({
  children,
  steps,
  initialStepId,
  initialContext,
  onFlowComplete: passedOnFlowComplete,
  onStepChange,
  localStoragePersistence,
  customOnDataLoad,
  customOnDataPersist,
  customOnClearPeristedData, // Optional custom clear function
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
      currentStepId: string | number | null
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

  const onClearPeristedData = useCallback(() => {
    if (!localStoragePersistence || typeof window === "undefined") {
      return;
    }
    const { key } = localStoragePersistence;
    try {
      window.localStorage.removeItem(key);
      console.log(
        `[OnboardJS] Cleared localStorage (key: "${key}") on clear request.`
      );
    } catch (error) {
      console.error(
        `[OnboardJS] Error clearing localStorage (key: "${key}"):`,
        error
      );
    }
  }, [localStoragePersistence]);
  // --- End Persistence Logic ---

  const onFlowComplete = useCallback(
    (context: CoreOnboardingContext) => {
      if (passedOnFlowComplete) {
        passedOnFlowComplete(context);
      } else {
        console.warn(
          "[OnboardingProvider] No onFlowComplete handler provided. Flow completed without custom action."
        );
      }
    },
    [passedOnFlowComplete]
  );

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
      onClearPersistedData:
        customOnClearPeristedData ||
        (localStoragePersistence ? onClearPeristedData : undefined),
    };

    const newEngine = new OnboardingEngine(engineConfig);
    setEngine(newEngine);

    // The engine's constructor now calls initializeEngine, which is async
    // and calls notifyStateChangeListeners at various points (start of hydration, end of init).
    // The subscription below should pick up these notifications.
    // We can also set an initial state, but it might be the "hydrating" state.
    // The subscription is key to getting the *final* initial state after async ops.

    // Set an initial state immediately. This will likely be the "isHydrating: true" state.
    // This ensures `engineState` is not null while the engine initializes.
    setEngineState(newEngine.getState());

    const unsubscribe = newEngine.subscribeToStateChange((newState) => {
      console.log(
        "[OnboardingProvider] Engine state changed, updating React state:",
        newState
      );
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

  // Memoize the actions object
  const memoizedActions = useMemo((): OnboardingActions | null => {
    if (!engine) return null;
    return {
      next: async (data?: any) => {
        setComponentLoading(true);
        try {
          await engine.next(data);
        } finally {
          setComponentLoading(false);
        }
      },
      previous: async () => {
        setComponentLoading(true);
        try {
          await engine.previous();
        } finally {
          setComponentLoading(false);
        }
      },
      skip: async () => {
        setComponentLoading(true);
        try {
          await engine.skip();
        } finally {
          setComponentLoading(false);
        }
      },
      goToStep: async (stepId: string, data?: any) => {
        setComponentLoading(true);
        try {
          await engine.goToStep(stepId, data);
        } finally {
          setComponentLoading(false);
        }
      },
      updateContext: async (newContextData: Partial<CoreOnboardingContext>) => {
        await engine.updateContext(newContextData); // engine.updateContext is already async
      },
      reset: async (newConfig?: Partial<OnboardingEngineConfig>) => {
        setComponentLoading(true);
        try {
          await engine.reset(newConfig);
        } finally {
          // engine.reset is already async
          setComponentLoading(false);
        }
      },
    };
  }, [engine]); // Dependency is `engine` instance

  const value = useMemo(
    (): OnboardingContextValue => ({
      // Explicitly type the return of useMemo
      engine,
      state: engineState,
      isLoading,
      setComponentLoading,
      actions: memoizedActions,
    }),
    [engine, engineState, isLoading, memoizedActions, onFlowComplete] // Add memoizedActions to dependencies
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};
