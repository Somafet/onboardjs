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
  OnboardingContext as CoreOnboardingContext,
  OnboardingEngineConfig,
  DataLoadFn,
  DataPersistFn,
  LoadedData,
} from "@onboardjs/core";

// Define the actions type based on OnboardingEngine methods
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

export interface OnboardingContextValue extends OnboardingActions {
  engine: OnboardingEngine | null;
  state: EngineState | null;
  isLoading: boolean;
  setComponentLoading: (loading: boolean) => void;
}

export const OnboardingContext = createContext<
  OnboardingContextValue | undefined
>(undefined);

export interface LocalStoragePersistenceOptions {
  key: string;
  ttl?: number;
}

export interface OnboardingProviderProps
  extends Omit<OnboardingEngineConfig, "loadData" | "persistData"> {
  children: ReactNode;
  localStoragePersistence?: LocalStoragePersistenceOptions;
  customOnDataLoad?: DataLoadFn;
  customOnDataPersist?: DataPersistFn;
  customOnClearPeristedData?: () => void;
  /**
   * Whether to enable plugin management features.
   * If true, allows installing/uninstalling plugins dynamically.
   */
  enablePluginManager?: boolean;
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
  customOnClearPeristedData,
  plugins,
  enablePluginManager = true, // Default to enabled
}) => {
  const [engine, setEngine] = useState<OnboardingEngine | null>(null);
  const [engineState, setEngineState] = useState<EngineState | null>(null);
  const [componentLoading, setComponentLoading] = useState(false);

  // Use a stable reference for plugins to avoid unnecessary re-renders
  const stablePlugins = useMemo(() => plugins || [], [plugins]);

  // Persistence logic (unchanged)
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
        return savedState.data as LoadedData;
      }
    } catch (error) {
      console.error(
        `[OnboardJS] Error loading from localStorage (key: "${key}"):`,
        error
      );
      window.localStorage.removeItem(key);
    }
    return null;
  }, [
    localStoragePersistence?.key,
    localStoragePersistence?.ttl,
    customOnDataLoad,
  ]);

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
        };
        const stateToStore = {
          timestamp: Date.now(),
          data: dataToSave,
        };
        window.localStorage.setItem(key, JSON.stringify(stateToStore));
      } catch (error) {
        console.error(
          `[OnboardJS] Error persisting to localStorage (key: "${key}"):`,
          error
        );
      }
    },
    [localStoragePersistence?.key, customOnDataPersist]
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
  }, [localStoragePersistence?.key]);

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
      plugins,
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
      // Only set these if no plugins will override them
      loadData:
        customOnDataLoad ||
        (localStoragePersistence ? onDataLoadHandler : undefined),
      persistData:
        customOnDataPersist ||
        (localStoragePersistence ? onDataPersistHandler : undefined),
      clearPersistedData:
        customOnClearPeristedData ||
        (localStoragePersistence ? onClearPeristedData : undefined),
    };

    const newEngine = new OnboardingEngine(engineConfig);
    setEngine(newEngine);
    setEngineState(newEngine.getState());

    const unsubscribe = newEngine.addEventListener(
      "stateChange",
      (newState) => {
        setEngineState(newState);
      }
    );

    return () => unsubscribe();
  }, [
    steps,
    initialStepId,
    initialContext,
    localStoragePersistence?.key, // Only depend on the key, not the whole object
    localStoragePersistence?.ttl,
    customOnDataLoad,
    customOnDataPersist,
    customOnClearPeristedData,
    passedOnFlowComplete, // Use the original prop, not the wrapped callback
    onStepChange,
    stablePlugins,
    enablePluginManager,
    // Don't include the callback handlers themselves - they're now stable due to dependency fixes
  ]);

  const isLoading = useMemo(
    () =>
      componentLoading ||
      (engineState?.isLoading ?? false) ||
      (engineState?.isHydrating ?? false),
    [componentLoading, engineState?.isLoading, engineState?.isHydrating]
  );

  // Individual action functions (unchanged)
  const next = useCallback(
    async (data?: any) => {
      if (!engine) return;
      setComponentLoading(true);
      try {
        await engine.next(data);
      } finally {
        setComponentLoading(false);
      }
    },
    [engine]
  );

  const previous = useCallback(async () => {
    if (!engine) return;
    setComponentLoading(true);
    try {
      await engine.previous();
    } finally {
      setComponentLoading(false);
    }
  }, [engine]);

  const skip = useCallback(async () => {
    if (!engine) return;
    setComponentLoading(true);
    try {
      await engine.skip();
    } finally {
      setComponentLoading(false);
    }
  }, [engine]);

  const goToStep = useCallback(
    async (stepId: string, data?: any) => {
      if (!engine) return;
      setComponentLoading(true);
      try {
        await engine.goToStep(stepId, data);
      } finally {
        setComponentLoading(false);
      }
    },
    [engine]
  );

  const updateContext = useCallback(
    async (newContextData: Partial<CoreOnboardingContext>) => {
      if (!engine) return;
      await engine.updateContext(newContextData);
    },
    [engine]
  );

  const reset = useCallback(
    async (newConfig?: Partial<OnboardingEngineConfig>) => {
      if (!engine) return;
      setComponentLoading(true);
      try {
        await engine.reset(newConfig);
      } finally {
        setComponentLoading(false);
      }
    },
    [engine]
  );

  const value = useMemo(
    (): OnboardingContextValue => ({
      engine,
      state: engineState,
      isLoading,
      setComponentLoading,
      skip,
      next,
      reset,
      previous,
      goToStep,
      updateContext,
    }),
    [
      engine,
      engineState,
      isLoading,
      setComponentLoading,
      skip,
      next,
      reset,
      previous,
      goToStep,
      updateContext,
    ]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};
