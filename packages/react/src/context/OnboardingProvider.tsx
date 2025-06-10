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
  OnboardingEngineConfig,
  DataLoadFn,
  DataPersistFn,
  LoadedData,
  OnboardingStep,
  UnsubscribeFunction,
  OnboardingContext as OnboardingContextType,
} from "@onboardjs/core";

// Define the actions type based on OnboardingEngine methods
export interface OnboardingActions<
  TContext extends OnboardingContextType = OnboardingContextType,
> {
  next: (stepSpecificData?: unknown) => Promise<void>;
  previous: () => Promise<void>;
  skip: () => Promise<void>;
  goToStep: (stepId: string, stepSpecificData?: unknown) => Promise<void>;
  updateContext: (newContextData: Partial<TContext>) => Promise<void>;
  reset: (
    newConfig?: Partial<OnboardingEngineConfig<TContext>>,
  ) => Promise<void>;
}

export interface OnboardingContextValue<TContext extends OnboardingContextType>
  extends OnboardingActions<TContext> {
  engine: OnboardingEngine<TContext> | null;
  engineInstanceId?: number | undefined;
  state: EngineState<TContext> | null;
  isLoading: boolean;
  setComponentLoading: (loading: boolean) => void;
  // Expose currentStep directly for convenience, derived from state
  currentStep: OnboardingStep<TContext> | null | undefined;
  isCompleted: boolean | undefined;
}

// Default context for backward compatibility
export const OnboardingContext = createContext<
  OnboardingContextValue<OnboardingContextType> | undefined
>(undefined);

export interface LocalStoragePersistenceOptions {
  key: string;
  ttl?: number; // Time to live in milliseconds
}

export interface OnboardingProviderProps<TContext extends OnboardingContextType>
  extends Omit<
    OnboardingEngineConfig<TContext>,
    "loadData" | "persistData" | "clearPersistedData" | "onFlowComplete" // onFlowComplete is handled separately
  > {
  children: ReactNode;
  localStoragePersistence?: LocalStoragePersistenceOptions;
  customOnDataLoad?: DataLoadFn<TContext>;
  customOnDataPersist?: DataPersistFn<TContext>;
  customOnClearPersistedData?: () => Promise<void> | void; // Ensure it can be async
  onFlowComplete?: (context: TContext) => Promise<void> | void; // Prop for flow complete
  /**
   * Whether to enable plugin management features.
   * If true, allows installing/uninstalling plugins dynamically.
   * Note: This prop is not currently used to configure the engine directly
   * but can be used by consumers or future enhancements.
   */
  enablePluginManager?: boolean;
}

export function OnboardingProvider<
  TContext extends OnboardingContextType = OnboardingContextType,
>({
  children,
  steps,
  initialStepId,
  initialContext,
  onFlowComplete: passedOnFlowComplete, // Renamed prop
  onStepChange,
  localStoragePersistence,
  customOnDataLoad,
  customOnDataPersist,
  customOnClearPersistedData,
  plugins,
  // enablePluginManager is not directly used in engineConfig in this version
}: OnboardingProviderProps<TContext>) {
  const [engine, setEngine] = useState<OnboardingEngine<TContext> | null>(null);
  const [engineState, setEngineState] = useState<EngineState<TContext> | null>(
    null,
  );
  const [componentLoading, setComponentLoading] = useState(false);
  const [isEngineReadyAndInitialized, setIsEngineReadyAndInitialized] =
    useState(false);

  const stablePlugins = useMemo(() => plugins || [], [plugins]);

  const onDataLoadHandler = useCallback(async (): Promise<
    LoadedData<TContext> | null | undefined
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
        const savedState = JSON.parse(savedStateRaw) as {
          timestamp?: number;
          data: LoadedData<TContext>;
        };
        if (
          ttl &&
          savedState.timestamp &&
          Date.now() - savedState.timestamp > ttl
        ) {
          console.log(
            `[OnboardJS] localStorage data for key "${key}" expired. Ignoring.`,
          );
          window.localStorage.removeItem(key);
          return null;
        }
        console.log(
          `[OnboardJS] Loaded from localStorage (key: "${key}"):`,
          savedState.data,
        );
        return savedState.data;
      }
    } catch (error) {
      console.error(
        `[OnboardJS] Error loading from localStorage (key: "${key}"):`,
        error,
      );
      window.localStorage.removeItem(key); // Clear corrupted data
    }
    return null;
  }, [customOnDataLoad, localStoragePersistence]);

  const onDataPersistHandler = useCallback(
    async (
      context: TContext,
      currentStepId: string | number | null,
    ): Promise<void> => {
      if (customOnDataPersist) {
        await customOnDataPersist(context, currentStepId);
        return;
      }
      if (!localStoragePersistence || typeof window === "undefined") {
        return;
      }
      const { key } = localStoragePersistence;
      try {
        const dataToSave: LoadedData = {
          flowData: context.flowData,
          currentStepId: currentStepId,
          // Persist other top-level context properties if needed, excluding functions or complex objects not suitable for JSON
          ...Object.fromEntries(
            Object.entries(context).filter(([k]) => k !== "flowData"),
          ),
        };
        const stateToStore = {
          timestamp: Date.now(),
          data: dataToSave,
        };
        window.localStorage.setItem(key, JSON.stringify(stateToStore));
      } catch (error) {
        console.error(
          `[OnboardJS] Error persisting to localStorage (key: "${key}"):`,
          error,
        );
      }
    },
    [customOnDataPersist, localStoragePersistence],
  );

  const onClearPersistedDataHandler = useCallback(async () => {
    if (customOnClearPersistedData) {
      await customOnClearPersistedData();
      return;
    }
    if (!localStoragePersistence || typeof window === "undefined") {
      return;
    }
    const { key } = localStoragePersistence;
    try {
      window.localStorage.removeItem(key);
      console.log(
        `[OnboardJS] Cleared localStorage (key: "${key}") on clear request.`,
      );
    } catch (error) {
      console.error(
        `[OnboardJS] Error clearing localStorage (key: "${key}"):`,
        error,
      );
    }
  }, [customOnClearPersistedData, localStoragePersistence]);

  const onFlowCompleteHandler = useCallback(
    async (context: TContext) => {
      if (passedOnFlowComplete) {
        await passedOnFlowComplete(context);
      }
      if (localStoragePersistence && typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(localStoragePersistence.key);
          console.log(
            `[OnboardJS] Cleared localStorage (key: "${localStoragePersistence.key}") on flow completion.`,
          );
        } catch (error) {
          console.error(
            `[OnboardJS] Error clearing localStorage on flow completion (key: "${localStoragePersistence.key}"):`,
            error,
          );
        }
      }
    },
    [passedOnFlowComplete, localStoragePersistence],
  );

  useEffect(() => {
    console.log(
      "[OnboardingProvider] useEffect triggered to re-initialize engine.",
    );
    setIsEngineReadyAndInitialized(false); // Mark as not ready when config changes
    setEngine(null); // Clear old engine instance
    setEngineState(null); // Reset state when re-initializing

    const engineConfig: OnboardingEngineConfig<TContext> = {
      steps,
      plugins: stablePlugins,
      initialStepId,
      initialContext,
      onFlowComplete: onFlowCompleteHandler,
      onStepChange,
      loadData: onDataLoadHandler,
      persistData: onDataPersistHandler,
      clearPersistedData: onClearPersistedDataHandler,
    };

    let currentEngine: OnboardingEngine<TContext> | null = null;
    let unsubscribeStateChange: UnsubscribeFunction | undefined;

    try {
      currentEngine = new OnboardingEngine<TContext>(engineConfig);
      setEngine(currentEngine); // Set engine instance immediately

      currentEngine
        .ready()
        .then(() => {
          if (currentEngine) {
            // Check if component is still mounted / engine is current
            console.log("[OnboardingProvider] Engine is ready.");
            setEngineState(currentEngine.getState());
            setIsEngineReadyAndInitialized(true);

            unsubscribeStateChange = currentEngine.addEventListener(
              "stateChange",
              (newState) => {
                console.log(
                  "[OnboardingProvider] stateChange event received:",
                  newState.currentStep?.id,
                  newState.isLoading,
                );
                setEngineState(newState);
              },
            );
          }
        })
        .catch((engineInitError) => {
          console.error(
            "[OnboardingProvider] Engine initialization failed:",
            engineInitError,
          );
          setEngineState({
            // Provide a default error state
            currentStep: null,
            context: (initialContext || {}) as TContext,
            isFirstStep: false,
            isLastStep: false,
            canGoNext: false,
            canGoPrevious: false,
            isSkippable: false,
            isLoading: false,
            isHydrating: false,
            error:
              engineInitError instanceof Error
                ? engineInitError
                : new Error(String(engineInitError)),
            isCompleted: false,
          });
          setIsEngineReadyAndInitialized(false); // Explicitly false on error
        });
    } catch (configError) {
      console.error(
        "[OnboardingProvider] Error creating OnboardingEngine (invalid config):",
        configError,
      );
      setEngineState({
        currentStep: null,
        context: (initialContext || {}) as TContext,
        isFirstStep: false,
        isLastStep: false,
        canGoNext: false,
        canGoPrevious: false,
        isSkippable: false,
        isLoading: false,
        isHydrating: false,
        error:
          configError instanceof Error
            ? configError
            : new Error(String(configError)),
        isCompleted: false,
      });
      setIsEngineReadyAndInitialized(false);
    }

    return () => {
      console.log("[OnboardingProvider] useEffect cleanup.");
      if (unsubscribeStateChange) {
        unsubscribeStateChange();
      }
    };
  }, [
    steps,
    initialStepId,
    initialContext,
    onFlowCompleteHandler,
    onStepChange,
    onDataLoadHandler,
    onDataPersistHandler,
    onClearPersistedDataHandler,
    stablePlugins,
  ]);

  const isLoading = useMemo(
    () =>
      componentLoading ||
      !isEngineReadyAndInitialized || // Key: loading if engine not fully ready and initialized
      (engineState?.isLoading ?? false) ||
      (engineState?.isHydrating ?? false),
    [
      componentLoading,
      isEngineReadyAndInitialized,
      engineState?.isLoading,
      engineState?.isHydrating,
    ],
  );

  const actions = useMemo(
    () => ({
      next: async (data?: unknown) => {
        if (!engine || !isEngineReadyAndInitialized) return;
        setComponentLoading(true);
        try {
          await engine.next(data);
        } finally {
          setComponentLoading(false);
        }
      },
      previous: async () => {
        if (!engine || !isEngineReadyAndInitialized) return;
        setComponentLoading(true);
        try {
          await engine.previous();
        } finally {
          setComponentLoading(false);
        }
      },
      skip: async () => {
        if (!engine || !isEngineReadyAndInitialized) return;
        setComponentLoading(true);
        try {
          await engine.skip();
        } finally {
          setComponentLoading(false);
        }
      },
      goToStep: async (stepId: string, data?: unknown) => {
        if (!engine || !isEngineReadyAndInitialized) return;
        setComponentLoading(true);
        try {
          await engine.goToStep(stepId, data);
        } finally {
          setComponentLoading(false);
        }
      },
      updateContext: async (newContextData: Partial<TContext>) => {
        if (!engine || !isEngineReadyAndInitialized) return;
        setComponentLoading(true);
        try {
          await engine.updateContext(newContextData);
        } finally {
          setComponentLoading(false);
        }
      },
      reset: async (newConfig?: Partial<OnboardingEngineConfig<TContext>>) => {
        if (!engine) return; // Allow reset even if not fully "ready" but engine instance exists
        setComponentLoading(true);
        try {
          // Resetting the engine will trigger its own async initialization.
          // The useEffect will likely re-run if config props change,
          // or the engine's internal stateChange will update the provider.
          await engine.reset(newConfig);
          // After reset, the engine re-initializes. We might need to reflect this.
          // The stateChange listener should handle updating engineState.
          // We might want to set isEngineReadyAndInitialized to false here and let ready() set it true.
          // However, engine.reset() itself re-initializes and should eventually emit state.
        } finally {
          setComponentLoading(false);
        }
      },
    }),
    [engine, isEngineReadyAndInitialized],
  );

  const value = useMemo(
    (): OnboardingContextValue<TContext> => ({
      engine: isEngineReadyAndInitialized ? engine : null,
      engineInstanceId: isEngineReadyAndInitialized
        ? engine?.instanceId
        : undefined,
      state: isEngineReadyAndInitialized ? engineState : null,
      isLoading,
      setComponentLoading,
      currentStep: engineState?.currentStep, // Derived for convenience
      isCompleted: engineState?.isCompleted, // Derived
      ...actions,
    }),
    [engine, engineState, isLoading, isEngineReadyAndInitialized, actions],
  );

  return (
    <OnboardingContext.Provider
      value={value as unknown as OnboardingContextValue<OnboardingContextType>}
    >
      {children}
    </OnboardingContext.Provider>
  );
}
