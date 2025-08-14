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
  UnsubscribeFunction,
  OnboardingContext as OnboardingContextType,
  ConfigurationBuilder,
} from "@onboardjs/core";
import {
  OnboardingStep,
  StepComponentProps,
  StepComponentRegistry,
} from "../types";

// Define the actions type based on OnboardingEngine methods
export interface OnboardingActions<
  TContext extends OnboardingContextType = OnboardingContextType,
> {
  next: (stepSpecificData?: Record<string, unknown>) => Promise<void>;
  previous: () => Promise<void>;
  skip: () => Promise<void>;
  goToStep: (
    stepId: string,
    stepSpecificData?: Record<string, unknown>,
  ) => Promise<void>;
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
  /** The current error state of the engine, if any. */
  error: Error | null;

  /**
   * A convenience method to render the current step's content.
   * This can be used by consumers to render the step UI.
   */
  renderStep: () => React.ReactNode;
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
    | "loadData"
    | "persistData"
    | "clearPersistedData"
    | "onFlowComplete"
    | "steps"
  > {
  children: ReactNode;
  localStoragePersistence?: LocalStoragePersistenceOptions;
  customOnDataLoad?: DataLoadFn<TContext>;
  customOnDataPersist?: DataPersistFn<TContext>;
  customOnClearPersistedData?: () => Promise<any> | any; // Ensure it can be async
  onFlowComplete?: (context: TContext) => Promise<void> | void; // Prop for flow complete
  /**
   * Whether to enable plugin management features.
   * If true, allows installing/uninstalling plugins dynamically.
   * Note: This prop is not currently used to configure the engine directly
   * but can be used by consumers or future enhancements.
   */
  enablePluginManager?: boolean;

  /**
   * A registry mapping step types and ids to their React components.
   * This allows users to provide their own custom step components.
   * This prop is now optional and will be overridden by the `OnboardingStep.component` property
   * if defined.
   */
  componentRegistry?: StepComponentRegistry<TContext>;

  /**
   * The array of steps to initialize the onboarding flow.
   */
  steps: OnboardingStep<TContext>[];
}

export function OnboardingProvider<
  TContext extends OnboardingContextType = OnboardingContextType,
>({
  children,
  steps,
  initialStepId,
  initialContext,
  onFlowComplete: passedOnFlowComplete,
  onStepChange,
  localStoragePersistence,
  customOnDataLoad,
  customOnDataPersist,
  customOnClearPersistedData,
  plugins,
  componentRegistry,
  ...props
  // enablePluginManager is not directly used in engineConfig in this version
}: OnboardingProviderProps<TContext>) {
  const [engine, setEngine] = useState<OnboardingEngine<TContext> | null>(null);
  const [engineState, setEngineState] = useState<EngineState<TContext> | null>(
    null,
  );
  const [componentLoading, setComponentLoading] = useState(false);
  const [isEngineReadyAndInitialized, setIsEngineReadyAndInitialized] =
    useState(false);
  const [stepSpecificData, setStepSpecificData] = useState<{
    data: any;
    isValid: boolean;
  }>({ data: null, isValid: true });

  const stablePlugins = useMemo(() => plugins || [], [plugins]);

  const onDataLoadHandler = useCallback(async (): Promise<
    LoadedData<TContext> | null | undefined
  > => {
    if (customOnDataLoad) {
      const result = await customOnDataLoad();
      console.log("Result from customOnDataLoad:", result);

      return result;
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

  const renderStep = useCallback((): React.ReactNode => {
    if (!engineState?.currentStep) {
      return null;
    }

    const { currentStep, context } = engineState;

    // Look for a component by step ID first, then by type/componentKey.
    let StepComponent =
      (currentStep as OnboardingStep).component ??
      componentRegistry?.[currentStep.id];

    const typeKey =
      currentStep.type === "CUSTOM_COMPONENT"
        ? (currentStep.payload as any)?.componentKey
        : currentStep.type;

    if (!StepComponent) {
      if (typeKey) {
        StepComponent = componentRegistry?.[typeKey];
      }
    }

    if (!StepComponent) {
      console.warn(
        `[OnboardJS] No component found in registry for step ${currentStep.id}. Tried keys: "${currentStep.id}" (by ID) and "${typeKey}" (by type/componentKey).`,
      );
      return <div>Component for step "{currentStep.id}" not found.</div>; // Fallback UI
    }

    // Find initial data for the component if a dataKey is present
    const dataKey = (currentStep.payload as any)?.dataKey;
    const initialData = dataKey ? context.flowData[dataKey] : undefined;

    const props: StepComponentProps<typeof currentStep.payload, TContext> = {
      payload: currentStep.payload,
      coreContext: context,
      context,
      onDataChange: (data, isValid) => {
        setStepSpecificData({ data, isValid });
      },
      initialData,
    };

    return <StepComponent {...props} />;
  }, [engineState, componentRegistry]);

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
      ...props, // Spread the rest of the props
    };

    const validation = ConfigurationBuilder.validateConfig(engineConfig);
    if (!validation.isValid) {
      const error = new Error(
        `Invalid Onboarding Configuration: ${validation.errors.join(", ")}`,
      );
      console.error(`[OnboardingProvider] ${error.message}`);
      // Do not mark as "ready"
      setIsEngineReadyAndInitialized(false);
      return; // Abort initialization
    }

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
              (event) => {
                console.log(
                  "[OnboardingProvider] stateChange event received:",
                  event.state.currentStep?.id,
                  event.state.isLoading,
                );
                setEngineState(event.state);
              },
            );
          }
        })
        .catch((engineInitError) => {
          console.error(
            "[OnboardingProvider] Engine initialization failed:",
            engineInitError,
          );
          setIsEngineReadyAndInitialized(false); // Explicitly false on error
        });
    } catch (configError) {
      console.error(
        "[OnboardingProvider] Error creating OnboardingEngine (invalid config):",
        configError,
      );
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

  // isLoading should reflect loading between steps
  const isLoading = useMemo(
    () =>
      componentLoading ||
      (engineState?.isLoading ?? false) ||
      (engineState?.isHydrating ?? false),
    [componentLoading, engineState?.isLoading, engineState?.isHydrating],
  );

  const actions = useMemo(
    () => ({
      next: async (overrideData?: Record<string, unknown>) => {
        if (!engine || !isEngineReadyAndInitialized) return;
        const dataToPass =
          overrideData !== undefined ? overrideData : stepSpecificData.data;

        if (!stepSpecificData.isValid && overrideData === undefined) {
          console.warn(
            "[OnboardJS] `next()` called, but the current step component reports invalid state. Navigation blocked.",
          );
          return;
        }

        setComponentLoading(true);
        try {
          await engine.next(dataToPass);
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
        setStepSpecificData({ data: null, isValid: true });
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
      goToStep: async (stepId: string, data?: Record<string, unknown>) => {
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
    [engine, isEngineReadyAndInitialized, stepSpecificData],
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
      currentStep: engineState?.currentStep as OnboardingStep<TContext> | null,
      isCompleted: engineState?.isCompleted,
      error: engineState?.error ?? null,
      renderStep,
      ...actions,
    }),
    [
      engine,
      engineState,
      isLoading,
      isEngineReadyAndInitialized,
      actions,
      renderStep,
    ],
  );

  return (
    <OnboardingContext.Provider
      value={value as unknown as OnboardingContextValue<OnboardingContextType>}
    >
      {children}
    </OnboardingContext.Provider>
  );
}
