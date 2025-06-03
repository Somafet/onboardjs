// @onboardjs/core/src/engine/OnboardingEngine.ts

import {
  OnboardingStep,
  OnboardingContext,
  ChecklistStepPayload,
  ChecklistItemState,
} from "../types";
import { evaluateStepId, findStepById } from "../utils/step-utils";
import { EventManager } from "./EventManager";
import {
  EngineState,
  UnsubscribeFunction,
  OnboardingEngineConfig,
  BeforeStepChangeListener,
  BeforeStepChangeEvent,
  DataLoadFn,
  DataPersistFn,
  LoadedData,
  FlowCompleteListener,
  EventListenerMap,
} from "./types";

import {
  OnboardingPlugin, // Added for 'use' method type
} from "../plugins/types"; // Added for 'use' method type
import { PluginManagerImpl } from "../plugins/PluginManager"; // Added

export class OnboardingEngine<
  TContext extends OnboardingContext = OnboardingContext,
> {
  private steps: OnboardingStep<TContext>[];
  private currentStepInternal: OnboardingStep<TContext> | null = null;
  private contextInternal: TContext;
  private history: string[] = []; // For previous navigation
  private isLoadingInternal: boolean = false;
  private isHydratingInternal: boolean = true; // Default to true until start()
  private errorInternal: Error | null = null;
  private isCompletedInternal: boolean = false;

  // Unified event manager
  private eventManager: EventManager<TContext> = new EventManager();
  // Plugin manager for handling plugins
  private pluginManager: PluginManagerImpl<TContext>;

  // Onboarding engine instance configuration
  private onFlowComplete?: FlowCompleteListener<TContext>;
  private onStepChangeCallback?: (
    newStep: OnboardingStep<TContext> | null,
    oldStep: OnboardingStep<TContext> | null,
    context: TContext,
  ) => void;

  private loadData?: DataLoadFn<TContext>;
  private persistData?: DataPersistFn<TContext>;
  private clearPersistedData?: () => Promise<void> | void;

  private initializationPromise: Promise<void>;
  private resolveInitialization!: () => void; // Definite assignment assertion
  private rejectInitialization!: (reason?: unknown) => void;
  private initialConfig: OnboardingEngineConfig<TContext>; // Store the complete initial configuration

  constructor(config: OnboardingEngineConfig<TContext>) {
    this.initialConfig = config; // Store the complete initial configuration
    this.steps = config.steps;

    this.contextInternal = {
      flowData: {},
      ...(config.initialContext || {}),
    } as TContext;
    if (!this.contextInternal.flowData) {
      this.contextInternal.flowData = {};
    }

    this.pluginManager = new PluginManagerImpl<TContext>(this);
    this.initializationPromise = new Promise((resolve, reject) => {
      this.resolveInitialization = resolve;
      this.rejectInitialization = reject;
    });

    // Automatically start the initialization process.
    // The actual outcome (success/failure) will be reflected in the initializationPromise.
    this.initializeEngine().catch((error) => {
      // This top-level catch in the constructor is a safety net.
      // initializeEngine should ideally handle its own promise rejection.
      console.error(
        "[OnboardingEngine] Unhandled error during constructor-initiated initialization:",
        error,
      );
      if (!this.initializationPromise) {
        // If promise somehow not made or already settled, this is a severe issue.
        // For robustness, ensure error state is set if possible.
        this.errorInternal =
          error instanceof Error ? error : new Error(String(error));
        this.isHydratingInternal = false;
        this.isLoadingInternal = false;
      }
    });
  }

  /**
   * Unified method to register event listeners
   */
  public addEventListener<T extends keyof EventListenerMap<TContext>>(
    eventType: T,
    listener: EventListenerMap<TContext>[T],
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener(eventType, listener);
  }

  // Plugin compatibility methods
  public addBeforeStepChangeListener(
    listener: (
      currentStep: OnboardingStep<TContext> | null,
      nextStep: OnboardingStep<TContext>,
      context: TContext,
    ) => void | Promise<void>,
  ): UnsubscribeFunction {
    // Convert to BeforeStepChangeListener format
    const wrappedListener: BeforeStepChangeListener<TContext> = async (
      event,
    ) => {
      if (event.targetStepId) {
        const nextStep = findStepById(this.steps, event.targetStepId);
        if (nextStep) {
          await listener(event.currentStep, nextStep, this.contextInternal);
        }
      }
    };

    return this.addEventListener("beforeStepChange", wrappedListener);
  }

  public addAfterStepChangeListener(
    listener: (
      previousStep: OnboardingStep<TContext> | null,
      currentStep: OnboardingStep<TContext> | null,
      context: TContext,
    ) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.addEventListener("stepChange", listener);
  }

  public addStepActiveListener(
    listener: (
      step: OnboardingStep<TContext>,
      context: TContext,
    ) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.addEventListener("stepActive", listener);
  }

  public addStepCompleteListener(
    listener: (
      step: OnboardingStep<TContext>,
      stepData: unknown,
      context: TContext,
    ) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.addEventListener("stepComplete", listener);
  }

  public addFlowCompleteListener(
    listener: (context: TContext) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.addEventListener("flowComplete", listener);
  }

  public addContextUpdateListener(
    listener: (
      oldContext: TContext,
      newContext: TContext,
    ) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.addEventListener("contextUpdate", listener);
  }

  public addErrorListener(
    listener: (error: Error, context: TContext) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.addEventListener("error", listener);
  }

  /**
   * Allow plugins to override the data loading handler
   */
  public setDataLoadHandler(handler: DataLoadFn<TContext> | undefined): void {
    this.loadData = handler;
  }

  /**
   * Allow plugins to override the data persistence handler
   */
  public setDataPersistHandler(
    handler: DataPersistFn<TContext> | undefined,
  ): void {
    this.persistData = handler;
  }

  /**
   * Allow plugins to override the data clearing handler
   */
  public setClearPersistedDataHandler(
    handler: (() => Promise<void> | void) | undefined,
  ): void {
    this.clearPersistedData = handler;
  }

  /**
   * Core initialization method. Orchestrates plugin installation,
   * data loading, and navigation to the initial step.
   * Called by the constructor.
   */
  private async initializeEngine(): Promise<void> {
    this.isHydratingInternal = true;
    this.isLoadingInternal = true;
    this.errorInternal = null;
    this.notifyStateChangeListeners();

    try {
      // 1. Install plugins
      if (this.initialConfig.plugins && this.initialConfig.plugins.length > 0) {
        // ... (plugin installation logic) ...
        for (const plugin of this.initialConfig.plugins) {
          try {
            await this.pluginManager.install(plugin);
          } catch (pluginInstallError) {
            const error =
              pluginInstallError instanceof Error
                ? pluginInstallError.message
                : String(pluginInstallError);
            const errorMessage = `Plugin installation failed for "${plugin.name}": ${error}`;
            console.error(`[OnboardingEngine] ${errorMessage}`);
            throw new Error(errorMessage);
          }
        }
      }

      // 2. Apply handlers
      this.loadData = this.loadData ?? this.initialConfig.loadData;
      this.persistData = this.persistData ?? this.initialConfig.persistData;
      this.clearPersistedData =
        this.clearPersistedData ?? this.initialConfig.clearPersistedData;
      this.onFlowComplete =
        this.onFlowComplete ?? this.initialConfig.onFlowComplete;
      this.onStepChangeCallback =
        this.onStepChangeCallback ?? this.initialConfig.onStepChange;

      const configInitialStepId = this.initialConfig.initialStepId;
      const configInitialContext =
        this.initialConfig.initialContext || ({} as Partial<TContext>);

      let loadedData: LoadedData<TContext> | null | undefined = null;
      let dataLoadError: Error | null = null;

      if (this.loadData) {
        try {
          console.log(
            "[OnboardingEngine] Attempting to load data (potentially via plugin)...",
          );
          loadedData = await this.loadData();
          // ... (logging)
        } catch (e) {
          console.error("[OnboardingEngine] Error during loadData:", e);
          const error = e instanceof Error ? e : new Error(String(e));
          dataLoadError = new Error(
            `Failed to load onboarding state: ${error.message}`,
          );
        }
      }

      // Build context (this part is fine to run always, to establish a base context)
      let newContextBase = {
        ...(configInitialContext as TContext),
        flowData: { ...(configInitialContext.flowData || {}) },
      };
      if (loadedData) {
        const {
          flowData: loadedFlowData,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          currentStepId: _loadedStepId,
          ...otherLoadedProps
        } = loadedData;
        newContextBase = {
          ...newContextBase,
          ...otherLoadedProps,
          flowData: {
            ...(newContextBase.flowData || {}),
            ...(loadedFlowData || {}),
          },
        } as TContext;
      }
      this.contextInternal = newContextBase;

      if (dataLoadError) {
        this.errorInternal = dataLoadError;
        this.currentStepInternal = null; // Correctly set to null
        this.isCompletedInternal = false; // Not completed due to error
        this.notifyErrorListeners(dataLoadError);
        // Even with a loadData error, we consider the engine "initialized"
        // but in an error state. The ready() promise will resolve.
        // If a loadData error should prevent ready() from resolving,
        // you would 'throw dataLoadError;' here to be caught by the outer catch,
        // which would then call rejectInitialization.
        // For now, let's stick to resolving but being in an error state.
        this.resolveInitialization();
      } else {
        // No data load error, proceed with normal step initialization
        const effectiveInitialStepId =
          loadedData?.currentStepId !== undefined
            ? loadedData.currentStepId
            : configInitialStepId ||
              (this.steps.length > 0 ? this.steps[0].id : null);

        console.log(
          "[OnboardingEngine] Effective initial step ID:",
          effectiveInitialStepId,
        );

        if (effectiveInitialStepId) {
          await this.navigateToStep(effectiveInitialStepId, "initial");
        } else {
          this.isCompletedInternal = this.steps.length === 0;
          if (this.steps.length > 0) {
            console.warn(
              "[OnboardingEngine] No effective initial step ID, but steps exist. Flow may not start.",
            );
          }
        }
        this.resolveInitialization(); // Signal successful initialization
      }
    } catch (e) {
      // Catches errors from plugin install or other unexpected issues
      const error = e instanceof Error ? e : new Error(String(e));
      console.error(
        "[OnboardingEngine] Critical error during engine initialization:",
        error,
      );
      this.errorInternal = error;
      if (this.errorInternal) this.notifyErrorListeners(this.errorInternal); // Ensure error is notified
      this.currentStepInternal = null; // Ensure no current step on critical failure
      this.rejectInitialization(this.errorInternal);
    } finally {
      this.isHydratingInternal = false;
      if (
        this.errorInternal ||
        this.isCompletedInternal ||
        (!this.currentStepInternal && this.isLoadingInternal) // If no step and still loading, stop loading
      ) {
        this.isLoadingInternal = false;
      }
      this.notifyStateChangeListeners();
      console.log("[OnboardingEngine] Initialization attempt finished.");
    }
  }

  /**
   * Installs a plugin into the onboarding engine.
   * Typically used for plugins not provided in the initial configuration,
   * or for adding plugins after a reset.
   */
  public async use(plugin: OnboardingPlugin<TContext>): Promise<this> {
    // Consider if engine is already initialized.
    // Plugins added late might not affect initial load but can hook into ongoing events.
    try {
      await this.pluginManager.install(plugin);
    } catch (error) {
      console.error(
        `[OnboardingEngine] Failed to install plugin "${plugin.name}" via use():`,
        error,
      );
      throw error;
    }
    return this;
  }

  /**
   * Waits for the onboarding engine to be fully initialized.
   * This promise resolves when plugins are installed, data is loaded,
   * and the initial step is determined.
   * @returns A promise that resolves when ready, or rejects on critical initialization failure.
   */
  public async ready(): Promise<void> {
    return this.initializationPromise;
  }

  private notifyStepChangeListeners(
    newStep: OnboardingStep<TContext> | null,
    oldStep: OnboardingStep<TContext> | null,
    context: TContext,
  ): void {
    this.eventManager.notifyListeners("stepChange", newStep, oldStep, context);
  }

  private notifyFlowCompleteListeners(context: TContext): void {
    console.log(
      "[OnboardingEngine] Notifying flowCompleteListeners. Count:",
      this.eventManager.getListenerCount("flowComplete"),
    );
    this.eventManager.notifyListeners("flowComplete", context);
  }

  private notifyStateChangeListeners(): void {
    const state = this.getState();
    this.eventManager.notifyListeners("stateChange", state);
  }

  private notifyStepActiveListeners(
    step: OnboardingStep<TContext>,
    context: TContext,
  ): void {
    this.eventManager.notifyListeners("stepActive", step, context);
  }

  private notifyStepCompleteListeners(
    step: OnboardingStep<TContext>,
    stepData: unknown,
    context: TContext,
  ): void {
    this.eventManager.notifyListeners("stepComplete", step, stepData, context);
  }

  private notifyContextUpdateListeners(
    oldContext: TContext,
    newContext: TContext,
  ): void {
    this.eventManager.notifyListeners("contextUpdate", oldContext, newContext);
  }

  private notifyErrorListeners(error: Error): void {
    this.eventManager.notifyListeners("error", error, this.contextInternal);
  }

  /**
   * Persists the current onboarding data if a persistence handler (`persistData`) is defined.
   */
  private async persistDataIfNeeded(): Promise<void> {
    if (this.isHydratingInternal) return; // Don't persist during initial hydration
    if (this.persistData) {
      try {
        await this.persistData(
          this.contextInternal,
          this.currentStepInternal?.id || null,
        );
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        console.error("[OnboardingEngine] Error during persistData:", error);
        this.notifyErrorListeners(error);
        // Optionally set an error state or notify, but don't block core functionality
      }
    }
  }

  // Modified setState to call persistDataIfNeeded
  private setState(
    updater: (
      prevState: EngineState<TContext>,
    ) => Partial<EngineState<TContext>>,
  ) {
    const currentState = this.getState();
    const oldContext = { ...this.contextInternal };
    const changes = updater(currentState);

    let contextChanged = false;
    if (changes.isLoading !== undefined)
      this.isLoadingInternal = changes.isLoading;
    if (changes.isHydrating !== undefined)
      this.isHydratingInternal = changes.isHydrating;
    if (changes.error !== undefined) {
      this.errorInternal = changes.error;
      if (changes.error) {
        this.notifyErrorListeners(changes.error);
      }
    }
    if (changes.isCompleted !== undefined)
      this.isCompletedInternal = changes.isCompleted;
    if (changes.context) {
      if (
        JSON.stringify(this.contextInternal) !== JSON.stringify(changes.context)
      ) {
        this.contextInternal = changes.context;
        contextChanged = true;
      }
    }

    this.notifyStateChangeListeners();

    if (contextChanged && !this.isHydratingInternal) {
      this.notifyContextUpdateListeners(oldContext, this.contextInternal);
      this.persistDataIfNeeded();
    }
  }

  private async navigateToStep(
    requestedTargetStepId: string | number | null | undefined,
    direction: "next" | "previous" | "skip" | "goto" | "initial" = "goto",
  ): Promise<void> {
    let isCancelled = false;
    let finalTargetStepId = requestedTargetStepId;
    let redirected = false;

    if (this.eventManager.getListenerCount("beforeStepChange") > 0) {
      const event: BeforeStepChangeEvent<TContext> = {
        currentStep: this.currentStepInternal,
        targetStepId: requestedTargetStepId,
        direction,
        cancel: () => {
          isCancelled = true;
        },
        redirect: (newTargetId) => {
          if (!isCancelled) {
            finalTargetStepId = newTargetId;
            redirected = true;
            console.log(
              `[OnboardingEngine] Navigation redirected to ${newTargetId} by beforeStepChange listener.`,
            );
          }
        },
      };

      try {
        // Execute listeners sequentially to allow promise resolution
        await this.eventManager.notifyListenersSequential(
          "beforeStepChange",
          event,
        );
        if (isCancelled) {
          console.log(
            "[OnboardingEngine] Navigation cancelled by beforeStepChange listener.",
          );
          this.setState(() => ({ isLoading: false })); // Ensure loading state is reset
          return;
        }
      } catch (error) {
        console.error(
          "[OnboardingEngine] Error in beforeStepChange listener:",
          error,
        );
        this.errorInternal = error as Error; // Capture error for state
        this.notifyErrorListeners(error as Error);
      }
    }

    this.setState(() => ({ isLoading: true, error: null }));

    let nextCandidateStep = findStepById(this.steps, finalTargetStepId);

    // Conditional step skipping logic
    while (
      nextCandidateStep &&
      nextCandidateStep.condition &&
      !nextCandidateStep.condition(this.contextInternal)
    ) {
      let skipToId: string | number | null | undefined;
      const effectiveDirection = redirected ? "goto" : direction;
      if (effectiveDirection === "previous") {
        skipToId = evaluateStepId(
          nextCandidateStep.previousStep,
          this.contextInternal,
        );
      } else {
        skipToId = evaluateStepId(
          nextCandidateStep.nextStep,
          this.contextInternal,
        );
      }
      if (!skipToId) {
        nextCandidateStep = undefined;
        break;
      }
      finalTargetStepId = skipToId;
      nextCandidateStep = findStepById(this.steps, finalTargetStepId);
    }

    const oldStep = this.currentStepInternal; // Capture old step before changing
    this.currentStepInternal = nextCandidateStep || null;

    if (this.currentStepInternal) {
      // Initialize checklist data on activation
      if (this.currentStepInternal.type === "CHECKLIST") {
        this.getChecklistItemsState(
          this.currentStepInternal as OnboardingStep<TContext> & {
            type: "CHECKLIST";
          },
        );
      }

      // Adjust history logic based on original direction
      if (
        direction !== "previous" &&
        oldStep &&
        oldStep.id !== this.currentStepInternal.id
      ) {
        if (this.history[this.history.length - 1] !== oldStep.id) {
          this.history.push(String(oldStep.id));
        }
      }

      try {
        if (this.currentStepInternal.onStepActive) {
          await this.currentStepInternal.onStepActive(this.contextInternal);
        }
        // Notify step active listeners
        this.notifyStepActiveListeners(
          this.currentStepInternal,
          this.contextInternal,
        );
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        this.errorInternal = error;
        this.notifyErrorListeners(error);
        console.error(
          `Error in onStepActive for ${this.currentStepInternal.id}:`,
          e,
        );
      }
    } else {
      // Flow is completed
      this.isCompletedInternal = true;
      const finalContext = this.contextInternal;
      if (
        this.onFlowComplete &&
        direction !== "initial" &&
        (!oldStep || !evaluateStepId(oldStep.nextStep, finalContext))
      ) {
        try {
          await this.onFlowComplete(finalContext);
        } catch (e) {
          console.error(
            "[OnboardingEngine] Error in config.onFlowComplete:",
            e,
          );
          this.errorInternal = e as Error;
          this.notifyErrorListeners(e as Error);
        }
      }

      // Then notify all registered listeners
      this.notifyFlowCompleteListeners(finalContext);

      // Persist on completion
      await this.persistDataIfNeeded();
    }

    if (this.onStepChangeCallback) {
      try {
        this.onStepChangeCallback(
          this.currentStepInternal,
          oldStep,
          this.contextInternal,
        );
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        console.error(
          "[OnboardingEngine] Error in onStepChangeCallback:",
          error,
        );
        this.notifyErrorListeners(error);
      }
    }

    this.notifyStepChangeListeners(
      this.currentStepInternal,
      oldStep,
      this.contextInternal,
    );

    this.setState(() => ({ isLoading: false }));
  }

  public getState(): EngineState<TContext> {
    const currentStep = this.currentStepInternal;
    const context = this.contextInternal;
    let nextPossibleStepId: string | number | null | undefined;
    let previousPossibleStepId: string | number | null | undefined;
    if (currentStep) {
      nextPossibleStepId = evaluateStepId(currentStep.nextStep, context);
      previousPossibleStepId = evaluateStepId(
        currentStep.previousStep,
        context,
      );
    }

    return {
      currentStep,
      context,
      isFirstStep: currentStep
        ? !previousPossibleStepId && this.history.length === 0
        : false,
      isLastStep: currentStep ? !nextPossibleStepId : this.isCompletedInternal,
      canGoNext: !!(currentStep && nextPossibleStepId),
      canGoPrevious: !!(
        (currentStep && previousPossibleStepId) ||
        (this.history.length > 0 &&
          this.history[this.history.length - 1] !== (currentStep?.id ?? null))
      ),
      isSkippable: !!(currentStep && currentStep.isSkippable),
      isLoading: this.isLoadingInternal,
      isHydrating: this.isHydratingInternal,
      error: this.errorInternal,
      isCompleted: this.isCompletedInternal,
    };
  }

  // Helper to manage checklist item state initialization/retrieval
  private getChecklistItemsState(
    step: OnboardingStep<TContext> & { type: "CHECKLIST" },
  ): ChecklistItemState[] {
    const { dataKey, items: itemDefinitions } = step.payload;
    let currentItemStates = this.contextInternal.flowData[dataKey] as
      | ChecklistItemState[]
      | undefined;

    if (
      !currentItemStates ||
      currentItemStates.length !== itemDefinitions.length
    ) {
      // Initialize or re-initialize if structure mismatch
      currentItemStates = itemDefinitions.map((def) => ({
        id: def.id,
        isCompleted: false, // Default to not completed
      }));
      // Persist this initial state
      this.contextInternal.flowData = {
        ...this.contextInternal.flowData,
        [dataKey]: [...currentItemStates], // Store a copy
      };
    }
    return currentItemStates;
  }

  private isChecklistStepComplete(
    step: OnboardingStep<TContext> & { type: "CHECKLIST" },
  ): boolean {
    const itemStates = this.getChecklistItemsState(step);
    const { items: itemDefinitions, minItemsToComplete } = step.payload;
    let completedCount = 0;
    let mandatoryPending = 0;

    for (const def of itemDefinitions) {
      if (def.condition && !def.condition(this.contextInternal)) {
        continue;
      }
      const state = itemStates.find((s) => s.id === def.id);
      const isMandatory = def.isMandatory !== false;
      if (state?.isCompleted) {
        completedCount++;
      } else if (isMandatory) {
        mandatoryPending++;
      }
    }
    if (typeof minItemsToComplete === "number") {
      return completedCount >= minItemsToComplete;
    } else {
      return mandatoryPending === 0;
    }
  }

  // Public method to update a checklist item's status
  public async updateChecklistItem(
    itemId: string,
    isCompleted: boolean,
    stepId?: string, // Optional: if not current step
  ): Promise<void> {
    const targetStep = stepId
      ? findStepById(this.steps, stepId)
      : this.currentStepInternal;

    if (!targetStep || targetStep.type !== "CHECKLIST") {
      const error = new Error(
        "Target step for checklist item update is invalid.",
      );
      console.error(
        `[OnboardingEngine] Cannot update checklist item: Step '${
          stepId || this.currentStepInternal?.id
        }' not found or not a CHECKLIST step.`,
      );
      this.errorInternal = error;
      this.notifyErrorListeners(error);
      this.notifyStateChangeListeners();
      return;
    }

    const payload = targetStep.payload as ChecklistStepPayload;
    const { dataKey } = payload;

    let itemStates =
      (this.contextInternal.flowData[dataKey] as
        | ChecklistItemState[]
        | undefined) || [];
    const itemIndex = itemStates.findIndex((item) => item.id === itemId);

    // Ensure item definitions exist to avoid adding arbitrary items
    const itemDefExists = payload.items.some((def) => def.id === itemId);
    if (!itemDefExists) {
      console.warn(
        `[OnboardingEngine] Attempted to update non-existent checklist item '${itemId}' for step '${targetStep.id}'.`,
      );
      return;
    }

    if (itemIndex !== -1) {
      // Create a new array for immutability
      const newItemStates = [...itemStates];
      newItemStates[itemIndex] = { ...newItemStates[itemIndex], isCompleted };
      itemStates = newItemStates;
    } else {
      // Item state doesn't exist, create it
      itemStates = [...itemStates, { id: itemId, isCompleted }];
    }

    // Update flowData
    const oldFlowDataJSON = JSON.stringify(this.contextInternal.flowData);
    this.contextInternal.flowData = {
      ...this.contextInternal.flowData,
      [dataKey]: itemStates,
    };

    if (JSON.stringify(this.contextInternal.flowData) !== oldFlowDataJSON) {
      this.notifyStateChangeListeners();
      await this.persistDataIfNeeded();
    }

    this.notifyStateChangeListeners();
  }

  public async next(stepSpecificData?: any): Promise<void> {
    if (!this.currentStepInternal || this.isLoadingInternal) return;

    // CHECKLIST COMPLETION CHECK
    if (this.currentStepInternal.type === "CHECKLIST") {
      if (
        !this.isChecklistStepComplete(
          this.currentStepInternal as OnboardingStep<TContext> & {
            type: "CHECKLIST";
          },
        )
      ) {
        const error = new Error("Checklist criteria not met.");
        console.warn(
          `[OnboardingEngine] Cannot proceed from checklist step '${this.currentStepInternal.id}': Not all completion criteria met.`,
        );
        this.errorInternal = error;
        this.notifyErrorListeners(error);
        this.notifyStateChangeListeners();
        return;
      }
      // If complete, the stepSpecificData for a checklist should be its items' state
      const checklistPayload = this.currentStepInternal
        .payload as ChecklistStepPayload;
      stepSpecificData = {
        ...stepSpecificData,
        [checklistPayload.dataKey]:
          this.contextInternal.flowData[checklistPayload.dataKey] || [],
      };
    }

    this.setState(() => ({ isLoading: true, error: null }));
    try {
      if (stepSpecificData && Object.keys(stepSpecificData).length > 0) {
        const newFlowData = {
          ...this.contextInternal.flowData,
          ...stepSpecificData,
        };
        if (
          JSON.stringify(this.contextInternal.flowData) !==
          JSON.stringify(newFlowData)
        ) {
          this.contextInternal.flowData = newFlowData;
        }
      }

      if (this.currentStepInternal!.onStepComplete) {
        await this.currentStepInternal!.onStepComplete(
          stepSpecificData || {},
          this.contextInternal,
        );
      }

      // Notify step complete listeners
      this.notifyStepCompleteListeners(
        this.currentStepInternal!,
        stepSpecificData || {},
        this.contextInternal,
      );

      const currentStepId = this.currentStepInternal!.id;
      this.contextInternal.flowData._internal = {
        ...this.contextInternal.flowData._internal,
        completedSteps: {
          ...(this.contextInternal.flowData._internal?.completedSteps || {}),
          [currentStepId]: Date.now(),
        },
      };

      let finalNextStepId: string | number | null | undefined;

      // Evaluate the defined nextStep first
      const definedNextStepTarget =
        this.currentStepInternal.nextStep !== undefined
          ? evaluateStepId(
              this.currentStepInternal.nextStep,
              this.contextInternal,
            )
          : undefined;

      if (definedNextStepTarget === undefined) {
        // If nextStep is not defined OR evaluates to undefined, default to next in array
        const currentIndex = this.steps.findIndex(
          (s) => s.id === this.currentStepInternal!.id,
        );
        if (currentIndex !== -1 && currentIndex < this.steps.length - 1) {
          finalNextStepId = this.steps[currentIndex + 1].id;
          console.log(
            `[OnboardingEngine] next(): nextStep for '${this.currentStepInternal!.id}' was undefined, defaulting to next in array: '${finalNextStepId}'`,
          );
        } else {
          finalNextStepId = null;
          console.log(
            `[OnboardingEngine] next(): nextStep for '${this.currentStepInternal!.id}' was undefined, no next in array, completing.`,
          );
        }
      } else {
        finalNextStepId = definedNextStepTarget;
      }

      await this.navigateToStep(finalNextStepId, "next");
      await this.persistDataIfNeeded();
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this.errorInternal = error;
      this.notifyErrorListeners(error);
      console.error(
        `Error in next() for step ${this.currentStepInternal.id}:`,
        e,
      );
      this.setState(() => ({ isLoading: false, error }));
    }
  }

  public async previous(): Promise<void> {
    if (this.isLoadingInternal) return;
    const current = this.currentStepInternal;
    let prevStepId: string | number | null | undefined;

    if (current && current.previousStep) {
      prevStepId = evaluateStepId(current.previousStep, this.contextInternal);
    } else if (this.history.length > 0) {
      prevStepId = this.history.pop();
    }

    if (prevStepId) {
      await this.navigateToStep(prevStepId, "previous");
    }
  }

  public async skip(): Promise<void> {
    if (
      !this.currentStepInternal ||
      !this.currentStepInternal.isSkippable ||
      this.isLoadingInternal
    ) {
      return;
    }
    let finalSkipTargetId: string | number | null | undefined;

    // 1. Try skipToStep
    let evaluatedSkipTarget =
      this.currentStepInternal.skipToStep !== undefined
        ? evaluateStepId(
            this.currentStepInternal.skipToStep,
            this.contextInternal,
          )
        : undefined;

    if (evaluatedSkipTarget === undefined) {
      // 2. If skipToStep is undefined, try nextStep
      evaluatedSkipTarget =
        this.currentStepInternal.nextStep !== undefined
          ? evaluateStepId(
              this.currentStepInternal.nextStep,
              this.contextInternal,
            )
          : undefined;
    }

    if (evaluatedSkipTarget === undefined) {
      // 3. Default to the next step in the array
      const currentIndex = this.steps.findIndex(
        (s) => s.id === this.currentStepInternal!.id,
      );
      if (currentIndex !== -1 && currentIndex < this.steps.length - 1) {
        finalSkipTargetId = this.steps[currentIndex + 1].id;
        console.log(
          `[OnboardingEngine] skip(): skipToStep/nextStep for '${this.currentStepInternal!.id}' was undefined, defaulting skip to next in array: '${finalSkipTargetId}'`,
        );
      } else {
        finalSkipTargetId = null;
        console.log(
          `[OnboardingEngine] skip(): skipToStep/nextStep for '${this.currentStepInternal!.id}' was undefined, no next in array, completing on skip.`,
        );
      }
    } else {
      finalSkipTargetId = evaluatedSkipTarget;
    }

    await this.navigateToStep(finalSkipTargetId, "skip");
  }

  public async goToStep(
    stepId: string,
    stepSpecificData?: unknown,
  ): Promise<void> {
    if (this.isLoadingInternal) return;
    if (stepSpecificData) {
      this.contextInternal.flowData = {
        ...this.contextInternal.flowData,
        ...stepSpecificData,
      };
    }
    await this.navigateToStep(stepId, "goto");
  }

  public async updateContext(newContextData: Partial<TContext>): Promise<void> {
    const oldContext = { ...this.contextInternal };
    const oldContextJSON = JSON.stringify(this.contextInternal);
    this.contextInternal = { ...this.contextInternal, ...newContextData };
    if (newContextData.flowData) {
      this.contextInternal.flowData = {
        ...(this.contextInternal.flowData || {}),
        ...newContextData.flowData,
      };
    }
    const newContextJSON = JSON.stringify(this.contextInternal);

    // Only notify and persist if something actually changed
    if (oldContextJSON !== newContextJSON) {
      this.notifyContextUpdateListeners(oldContext, this.contextInternal);
      this.notifyStateChangeListeners();
      await this.persistDataIfNeeded();
    }
  }

  public async reset(
    newConfigInput?: Partial<OnboardingEngineConfig<TContext>>,
  ): Promise<void> {
    console.log("[OnboardingEngine] Resetting engine...");

    // Capture the currently active clearPersistedData handler
    const activeClearPersistedDataHandler = this.clearPersistedData;

    // 1. Cleanup existing plugins and their event listeners/overrides.
    // Plugins might have set their own data handlers. Cleaning them up
    // ensures that after reset, we start fresh with handlers from
    // the new/current initialConfig or newly installed plugins.
    await this.pluginManager.cleanup();

    // Reset engine's own direct handlers to undefined.
    // They will be re-established by the subsequent initializeEngine call,
    // either from initialConfig or by plugins installed during that re-initialization.
    this.loadData = undefined;
    this.persistData = undefined;
    this.clearPersistedData = undefined; // Will be repopulated by initializeEngine
    this.onFlowComplete = undefined;
    this.onStepChangeCallback = undefined;

    // 2. Update initialConfig if a new one is provided.
    // This new initialConfig will be used by the subsequent initializeEngine call.
    if (newConfigInput) {
      const currentInitialContext =
        this.initialConfig.initialContext ?? ({} as TContext);
      const newInitialContextInput =
        newConfigInput.initialContext ?? ({} as TContext);
      const mergedInitialContext = {
        ...currentInitialContext,
        ...newInitialContextInput,
        flowData: {
          ...(currentInitialContext.flowData || {}),
          ...(newInitialContextInput.flowData || {}),
        },
      };
      this.initialConfig = {
        ...this.initialConfig, // Keep old values not in newConfigInput
        ...newConfigInput, // Override with newConfigInput values
        initialContext: mergedInitialContext, // Apply merged context
      };
    }
    // Ensure essential parts of initialConfig are (re)set from the potentially updated initialConfig
    this.steps = this.initialConfig.steps || [];
    this.initialConfig.initialContext =
      this.initialConfig.initialContext ||
      ({
        flowData: {},
      } as TContext);
    // If newConfigInput provided new plugins, they are now in this.initialConfig.plugins
    // and will be installed by the upcoming initializeEngine call.

    // 3. Call the captured clearPersistedData handler (if it existed at the start of reset)
    if (activeClearPersistedDataHandler) {
      try {
        console.log(
          "[OnboardingEngine] reset: Clearing persisted data using the handler active before reset...",
        );
        await activeClearPersistedDataHandler();
      } catch (e) {
        console.error(
          "[OnboardingEngine] reset: Error during clearPersistedData:",
          e,
        );
        if (e instanceof Error) this.notifyErrorListeners(e); // Notify if it's an error instance
      }
    }

    // 4. Reset internal state variables
    this.currentStepInternal = null;
    this.history = [];
    this.isLoadingInternal = false; // Will be set true by initializeEngine
    this.isHydratingInternal = true; // Will be set true by initializeEngine
    this.errorInternal = null;
    this.isCompletedInternal = false;

    // Reset context to the effective initial context from the (potentially new) initialConfig
    this.contextInternal = {
      flowData: {}, // Start fresh for flowData
      ...(this.initialConfig.initialContext || {}), // Apply other initial context fields
    } as TContext;
    // Ensure flowData object exists, potentially copying from initialConfig if structure is complex
    if (
      !this.contextInternal.flowData &&
      this.initialConfig.initialContext?.flowData
    ) {
      this.contextInternal.flowData = {
        ...this.initialConfig.initialContext.flowData,
      };
    } else if (!this.contextInternal.flowData) {
      this.contextInternal.flowData = {};
    }

    // 5. Re-create the initialization promise for the upcoming re-initialization
    this.initializationPromise = new Promise((resolve, reject) => {
      this.resolveInitialization = resolve;
      this.rejectInitialization = reject;
    });

    // 6. Re-initialize the engine. This will:
    //    - Install plugins from the (new/current) initialConfig.plugins.
    //    - Set data handlers (this.loadData, this.persistData, this.clearPersistedData etc.)
    //      from initialConfig, or as set by plugins during their new install.
    //    - Load data and navigate to the initial step.
    //    The `initializeEngine` method itself handles resolving/rejecting the new promise.
    await this.initializeEngine(); // This will also re-apply this.clearPersistedData from initialConfig

    console.log("[OnboardingEngine] Engine has been reset and re-initialized.");
  }

  // Add methods for plugin support
  public getSteps(): OnboardingStep<TContext>[] {
    return [...this.steps]; // Return a copy
  }
}
