// @onboardjs/core/src/engine/OnboardingEngine.ts

import {
  OnboardingStep,
  OnboardingContext,
  ChecklistStepPayload,
  ChecklistItemState,
} from "../types";
import { evaluateStepId, findStepById } from "../utils/step-utils";
import {
  EngineState,
  EngineStateChangeListener,
  UnsubscribeFunction,
  OnboardingEngineConfig,
  BeforeStepChangeListener,
  BeforeStepChangeEvent,
  DataLoadListener,
  DataPersistListener,
  LoadedData,
  FlowCompleteListener,
  StepChangeListener,
} from "./types";

export class OnboardingEngine<
  TContext extends OnboardingContext = OnboardingContext,
> {
  private steps: OnboardingStep<TContext>[];
  private currentStepInternal: OnboardingStep<TContext> | null = null;
  private contextInternal: TContext;
  private history: string[] = []; // For previous navigation
  private isLoadingInternal: boolean = false;
  private isHydratingInternal: boolean = true;
  private errorInternal: Error | null = null;
  private isCompletedInternal: boolean = false;

  // Listeners for state changes
  private stateChangeListeners: Set<EngineStateChangeListener<TContext>> =
    new Set();
  private beforeStepChangeListeners: Set<BeforeStepChangeListener<TContext>> =
    new Set();
  private flowCompleteListeners: Set<FlowCompleteListener<TContext>> =
    new Set();
  private stepChangeListeners: Set<StepChangeListener<TContext>> = new Set();

  // Onboarding engine instance configuration
  private onFlowComplete?: FlowCompleteListener<TContext>;
  private onStepChangeCallback?: (
    newStep: OnboardingStep<TContext> | null,
    oldStep: OnboardingStep<TContext> | null,
    context: TContext
  ) => void;

  private onDataLoad?: DataLoadListener<TContext>;
  private onDataPersist?: DataPersistListener<TContext>;
  private onClearPersistedData?: () => Promise<void> | void;

  private initializationPromise: Promise<void>;
  private resolveInitialization!: () => void; // Definite assignment assertion

  constructor(config: OnboardingEngineConfig<TContext>) {
    this.initializationPromise = new Promise((resolve) => {
      this.resolveInitialization = resolve;
    });
    this.steps = config.steps;
    this.contextInternal = {
      flowData: {},
      ...config.initialContext, // Initial context from config
    } as TContext;
    this.onFlowComplete = config.onFlowComplete;
    this.onStepChangeCallback = config.onStepChange;
    this.onDataLoad = config.onDataLoad; // Store
    this.onDataPersist = config.onDataPersist; // Store
    this.onClearPersistedData = config.onClearPersistedData;

    this.initializeEngine(config.initialStepId, config.initialContext).finally(
      () => {
        console.log("[OnboardingEngine] Initialization complete.");
        this.resolveInitialization?.();
      }
    );
  }

  /**
   * Initializes the onboarding engine by hydrating its state from an optional data loader,
   * merging any provided initial context and step configuration, and navigating to the appropriate initial step.
   */
  private async initializeEngine(
    configInitialStepId?: string | number,
    configInitialContext?: Partial<TContext>
  ): Promise<void> {
    this.isHydratingInternal = true;
    this.notifyStateChangeListeners(); // Notify that hydration is starting

    let loadedData: LoadedData<TContext> | null | undefined = null;
    let dataLoadError: Error | null = null;

    if (this.onDataLoad) {
      try {
        console.log("[OnboardingEngine] Attempting to load data...");
        loadedData = await this.onDataLoad();
        if (loadedData) {
          console.log(
            "[OnboardingEngine] Data loaded successfully:",
            loadedData
          );
          // Merge loaded flowData with initialContext.flowData, loaded takes precedence
          const initialFlowDataFromConfig =
            configInitialContext?.flowData || {};
          const loadedFlowData = loadedData.flowData || {};

          this.contextInternal = {
            ...this.contextInternal, // Keep other initial context fields
            ...configInitialContext, // Apply config initial context
            ...loadedData, // Apply all loaded data (could overwrite currentUser etc. if provided)
            flowData: {
              // Careful merge of flowData
              ...initialFlowDataFromConfig,
              ...loadedFlowData,
            },
          } as TContext;
        } else {
          console.log("[OnboardingEngine] No data returned from onDataLoad.");
        }
      } catch (e: any) {
        console.error("[OnboardingEngine] Error during onDataLoad:", e);
        dataLoadError = new Error(
          `Failed to load onboarding state: ${e.message}`
        );
        // Proceed with default initialization if loading fails
      }
    }

    this.isHydratingInternal = false;
    // At this point, contextInternal is set up either from defaults or loaded data.

    if (dataLoadError) {
      this.errorInternal = dataLoadError;
      this.currentStepInternal = null; // No current step if loading failed critically
      this.isCompletedInternal = false; // Not completed, but in an error state
      this.isLoadingInternal = false; // Not actively loading anymore
      this.notifyStateChangeListeners(); // Notify with the hydration error
      return;
    }

    // Proceed with normal initialization if onDataLoad was successful or not provided
    this.contextInternal = {
      // Ensure context is finalized after potential load
      ...this.contextInternal,
      ...configInitialContext,
      flowData: {
        ...(configInitialContext?.flowData || {}),
        ...(loadedData?.flowData || {}),
        ...(this.contextInternal.flowData || {}), // Ensure existing flowData (if any from constructor) is not lost if loadedData is sparse
      },
      // Apply other top-level loadedData fields if they exist
      ...(loadedData &&
        Object.keys(loadedData).reduce((acc, key) => {
          if (key !== "flowData" && key !== "currentStepId") {
            acc[key] = loadedData[key];
          }
          return acc;
        }, {} as any)),
    } as TContext;

    const effectiveInitialStepId =
      loadedData?.currentStepId !== undefined // Check if currentStepId was explicitly loaded (even if null)
        ? loadedData.currentStepId
        : configInitialStepId ||
          (this.steps.length > 0 ? this.steps[0].id : null);

    console.log(
      "[OnboardingEngine] Effective initial step ID:",
      effectiveInitialStepId
    );

    if (effectiveInitialStepId) {
      // navigateToStep will set isLoading to true, then false, and notify listeners
      await this.navigateToStep(effectiveInitialStepId, "initial");
    } else {
      // If no steps and no initial step, flow is complete.
      this.isCompletedInternal = true;
      this.isLoadingInternal = false;

      this.notifyStateChangeListeners(); // Notify final state after potential completion
    }
  }

  /**
   * Waits for the onboarding engine to be fully initialized and ready for use.
   * @returns A promise that resolves when the onboarding engine is fully initialized and ready for use.
   */
  public async ready(): Promise<void> {
    return this.initializationPromise;
  }

  /**
   * Registers a listener function that will be called whenever the onboarding step changes.
   */
  public addStepChangeListener(
    listener: StepChangeListener<TContext>
  ): UnsubscribeFunction {
    this.stepChangeListeners.add(listener);
    return () => this.stepChangeListeners.delete(listener);
  }

  private notifyStepChangeListeners(
    newStep: OnboardingStep<TContext> | null,
    oldStep: OnboardingStep<TContext> | null,
    context: TContext
  ): void {
    this.stepChangeListeners.forEach((listener) => {
      try {
        listener(newStep, oldStep, context);
      } catch (err) {
        console.error("[OnboardingEngine] Error in stepChange listener:", err);
      }
    });
  }

  /**
   * Registers a listener to be called when a flow has completed.
   */
  public addFlowCompletedListener(
    listener: FlowCompleteListener<TContext>
  ): UnsubscribeFunction {
    this.flowCompleteListeners.add(listener);
    return () => this.flowCompleteListeners.delete(listener);
  }

  /**
   * Notifies all registered flow completion listeners that the onboarding flow has completed.
   */
  private notifyFlowCompleteListeners(context: TContext): void {
    console.log(
      "[OnboardingEngine] Notifying flowCompleteListeners. Count:",
      this.flowCompleteListeners.size
    );
    this.flowCompleteListeners.forEach((listener) => {
      try {
        const result = listener(context);
        if (result instanceof Promise) {
          result.catch((err) =>
            console.error(
              "[OnboardingEngine] Error in async onFlowHasCompleted listener:",
              err
            )
          );
        }
      } catch (err) {
        console.error(
          "[OnboardingEngine] Error in sync onFlowHasCompleted listener:",
          err
        );
      }
    });
  }

  /**
   * Persists the current onboarding data if a persistence handler (`onDataPersist`) is defined.
   */
  private async persistDataIfNeeded(): Promise<void> {
    if (this.onDataPersist) {
      try {
        await this.onDataPersist(
          this.contextInternal,
          this.currentStepInternal?.id || null
        );
      } catch (e: any) {
        console.error("[OnboardingEngine] Error during onDataPersist:", e);
        // Optionally set an error state or notify, but don't block core functionality
      }
    }
  }

  // Modified setState to call persistDataIfNeeded
  private setState(
    updater: (
      prevState: EngineState<TContext>
    ) => Partial<EngineState<TContext>>
  ) {
    const currentState = this.getState();
    const changes = updater(currentState);

    let contextChanged = false;
    if (changes.isLoading !== undefined)
      this.isLoadingInternal = changes.isLoading;
    if (changes.isHydrating !== undefined)
      this.isHydratingInternal = changes.isHydrating;
    if (changes.error !== undefined) this.errorInternal = changes.error;
    if (changes.isCompleted !== undefined)
      this.isCompletedInternal = changes.isCompleted;
    if (changes.context) {
      // Check if context actually changed to avoid unnecessary persists
      if (
        JSON.stringify(this.contextInternal) !== JSON.stringify(changes.context)
      ) {
        this.contextInternal = changes.context;
        contextChanged = true;
      }
    }

    this.notifyStateChangeListeners();

    // Persist data if context changed and not hydrating
    if (contextChanged && !this.isHydratingInternal) {
      this.persistDataIfNeeded();
    }
  }

  private async navigateToStep(
    requestedTargetStepId: string | number | null | undefined,
    direction: "next" | "previous" | "skip" | "goto" | "initial" = "goto"
  ): Promise<void> {
    let isCancelled = false;
    let finalTargetStepId = requestedTargetStepId;
    let redirected = false;

    if (this.beforeStepChangeListeners.size > 0) {
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
              `[OnboardingEngine] Navigation redirected to ${newTargetId} by beforeStepChange listener.`
            );
          }
        },
      };
      // Execute listeners sequentially to allow promise resolution
      for (const listener of this.beforeStepChangeListeners) {
        await listener(event);
        if (isCancelled) {
          console.log(
            "[OnboardingEngine] Navigation cancelled by beforeStepChange listener."
          );
          this.setState(() => ({ isLoading: false })); // Ensure loading state is reset
          return;
        }
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
          this.contextInternal
        );
      } else {
        skipToId = evaluateStepId(
          nextCandidateStep.nextStep,
          this.contextInternal
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
          }
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
      } catch (e: any) {
        this.errorInternal = e;
        console.error(
          `Error in onStepActive for ${this.currentStepInternal.id}:`,
          e
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
            e
          );
          this.errorInternal = e as Error;
        }
      }

      // Then notify all registered listeners
      this.notifyFlowCompleteListeners(finalContext);

      // Persist on completion
      await this.persistDataIfNeeded();
    }

    if (this.onStepChangeCallback) {
      this.onStepChangeCallback(
        this.currentStepInternal,
        oldStep,
        this.contextInternal
      );
    }
    this.notifyStepChangeListeners(
      this.currentStepInternal,
      oldStep,
      this.contextInternal
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
        context
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

  public subscribeToStateChange(
    listener: EngineStateChangeListener<TContext>
  ): UnsubscribeFunction {
    this.stateChangeListeners.add(listener);
    return () => this.stateChangeListeners.delete(listener);
  }

  /**
   * Registers a listener function to be called before a step change occurs in the onboarding engine.
   */
  public onBeforeStepChange(
    listener: BeforeStepChangeListener<TContext>
  ): UnsubscribeFunction {
    this.beforeStepChangeListeners.add(listener);
    return () => this.beforeStepChangeListeners.delete(listener);
  }

  private notifyStateChangeListeners(): void {
    const state = this.getState();
    this.stateChangeListeners.forEach((listener) => listener(state));
  }

  // Helper to manage checklist item state initialization/retrieval
  private getChecklistItemsState(
    step: OnboardingStep<TContext> & { type: "CHECKLIST" }
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
    step: OnboardingStep<TContext> & { type: "CHECKLIST" }
  ): boolean {
    const itemStates = this.getChecklistItemsState(step);
    const { items: itemDefinitions, minItemsToComplete } = step.payload;

    let completedCount = 0;
    let mandatoryPending = 0;

    for (const def of itemDefinitions) {
      // Skip item if its condition is not met
      if (def.condition && !def.condition(this.contextInternal)) {
        continue;
      }

      const state = itemStates.find((s) => s.id === def.id);
      const isMandatory = def.isMandatory !== false; // Defaults to true

      if (state?.isCompleted) {
        completedCount++;
      } else if (isMandatory) {
        mandatoryPending++;
      }
    }

    if (typeof minItemsToComplete === "number") {
      return completedCount >= minItemsToComplete;
    } else {
      return mandatoryPending === 0; // All mandatory items must be completed
    }
  }

  // Public method to update a checklist item's status
  public async updateChecklistItem(
    itemId: string,
    isCompleted: boolean,
    stepId?: string // Optional: if not current step
  ): Promise<void> {
    const targetStep = stepId
      ? findStepById(this.steps, stepId)
      : this.currentStepInternal;

    if (!targetStep || targetStep.type !== "CHECKLIST") {
      console.error(
        `[OnboardingEngine] Cannot update checklist item: Step '${
          stepId || this.currentStepInternal?.id
        }' not found or not a CHECKLIST step.`
      );
      this.errorInternal = new Error(
        "Target step for checklist item update is invalid."
      );
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
        `[OnboardingEngine] Attempted to update non-existent checklist item '${itemId}' for step '${targetStep.id}'.`
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
          }
        )
      ) {
        console.warn(
          `[OnboardingEngine] Cannot proceed from checklist step '${this.currentStepInternal.id}': Not all completion criteria met.`
        );
        this.errorInternal = new Error("Checklist criteria not met.");
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
          this.contextInternal
        );
      }

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
              this.contextInternal
            )
          : undefined;

      if (definedNextStepTarget === undefined) {
        // If nextStep is not defined OR evaluates to undefined, default to next in array
        const currentIndex = this.steps.findIndex(
          (s) => s.id === this.currentStepInternal!.id
        );
        if (currentIndex !== -1 && currentIndex < this.steps.length - 1) {
          finalNextStepId = this.steps[currentIndex + 1].id;
          console.log(
            `[OnboardingEngine] next(): nextStep for '${this.currentStepInternal!.id}' was undefined, defaulting to next in array: '${finalNextStepId}'`
          );
        } else {
          finalNextStepId = null;
          console.log(
            `[OnboardingEngine] next(): nextStep for '${this.currentStepInternal!.id}' was undefined, no next in array, completing.`
          );
        }
      } else {
        finalNextStepId = definedNextStepTarget;
      }

      await this.navigateToStep(finalNextStepId, "next");
      await this.persistDataIfNeeded();
    } catch (e: any) {
      this.errorInternal = e;
      console.error(
        `Error in next() for step ${this.currentStepInternal.id}:`,
        e
      );
      this.setState(() => ({ isLoading: false, error: e }));
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
            this.contextInternal
          )
        : undefined;

    if (evaluatedSkipTarget === undefined) {
      // 2. If skipToStep is undefined, try nextStep
      evaluatedSkipTarget =
        this.currentStepInternal.nextStep !== undefined
          ? evaluateStepId(
              this.currentStepInternal.nextStep,
              this.contextInternal
            )
          : undefined;
    }

    if (evaluatedSkipTarget === undefined) {
      // 3. Default to the next step in the array
      const currentIndex = this.steps.findIndex(
        (s) => s.id === this.currentStepInternal!.id
      );
      if (currentIndex !== -1 && currentIndex < this.steps.length - 1) {
        finalSkipTargetId = this.steps[currentIndex + 1].id;
        console.log(
          `[OnboardingEngine] skip(): skipToStep/nextStep for '${this.currentStepInternal!.id}' was undefined, defaulting skip to next in array: '${finalSkipTargetId}'`
        );
      } else {
        finalSkipTargetId = null;
        console.log(
          `[OnboardingEngine] skip(): skipToStep/nextStep for '${this.currentStepInternal!.id}' was undefined, no next in array, completing on skip.`
        );
      }
    } else {
      finalSkipTargetId = evaluatedSkipTarget;
    }

    await this.navigateToStep(finalSkipTargetId, "skip");
  }

  public async goToStep(stepId: string, stepSpecificData?: any): Promise<void> {
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
      this.notifyStateChangeListeners();
      await this.persistDataIfNeeded();
    }
  }

  public async reset(
    newConfig?: Partial<OnboardingEngineConfig<TContext>>
  ): Promise<void> {
    this.steps = newConfig?.steps || this.steps;
    // Preserve persistence listeners if not overridden by newConfig
    this.onDataLoad =
      newConfig?.onDataLoad !== undefined
        ? newConfig.onDataLoad
        : this.onDataLoad;
    this.onDataPersist =
      newConfig?.onDataPersist !== undefined
        ? newConfig.onDataPersist
        : this.onDataPersist;
    this.onFlowComplete =
      newConfig?.onFlowComplete !== undefined
        ? newConfig.onFlowComplete
        : this.onFlowComplete;
    this.onStepChangeCallback =
      newConfig?.onStepChange !== undefined
        ? newConfig.onStepChange
        : this.onStepChangeCallback;

    if (this.onClearPersistedData) {
      try {
        console.log("[OnboardingEngine] reset: Clearing persisted data...");
        await this.onClearPersistedData();
      } catch (e) {
        console.error(
          "[OnboardingEngine] reset: Error during onClearPersistedData:",
          e
        );
      }
    }

    // Set a truly fresh context before calling initializeEngine
    const resetInitialContext =
      newConfig?.initialContext || ({ flowData: {} } as Partial<TContext>);
    this.contextInternal = { flowData: {}, ...resetInitialContext } as TContext;

    this.currentStepInternal = null;
    this.history = [];
    this.isLoadingInternal = false;
    this.errorInternal = null;
    this.isCompletedInternal = false;

    await this.initializeEngine(newConfig?.initialStepId, resetInitialContext);
  }

  // Add methods for plugin support
  public getSteps(): OnboardingStep<TContext>[] {
    return [...this.steps]; // Return a copy
  }

  // Plugin listener methods (these would be implemented based on your plugin system needs)
  public addBeforeStepChangeListener(
    listener: (
      currentStep: OnboardingStep<TContext> | null,
      nextStep: OnboardingStep<TContext>,
      context: TContext
    ) => void | Promise<void>
  ): () => void {
    // Convert to BeforeStepChangeListener format
    const wrappedListener: BeforeStepChangeListener<TContext> = async (
      event
    ) => {
      if (event.targetStepId) {
        const nextStep = findStepById(this.steps, event.targetStepId);
        if (nextStep) {
          await listener(event.currentStep, nextStep, this.contextInternal);
        }
      }
    };

    this.beforeStepChangeListeners.add(wrappedListener);
    return () => this.beforeStepChangeListeners.delete(wrappedListener);
  }

  public addAfterStepChangeListener(
    listener: (
      previousStep: OnboardingStep<TContext> | null,
      currentStep: OnboardingStep<TContext> | null,
      context: TContext
    ) => void | Promise<void>
  ): () => void {
    return this.addStepChangeListener(listener);
  }

  public addStepActiveListener(
    listener: (
      step: OnboardingStep<TContext>,
      context: TContext
    ) => void | Promise<void>
  ): () => void {
    const wrappedListener: StepChangeListener<TContext> = (
      newStep,
      oldStep,
      context
    ) => {
      if (newStep && newStep !== oldStep) {
        try {
          const result = listener(newStep, context);
          if (result instanceof Promise) {
            result.catch((err) =>
              console.error(
                "[OnboardingEngine] Error in step active listener:",
                err
              )
            );
          }
        } catch (err) {
          console.error(
            "[OnboardingEngine] Error in step active listener:",
            err
          );
        }
      }
    };

    this.stepChangeListeners.add(wrappedListener);
    return () => this.stepChangeListeners.delete(wrappedListener);
  }

  public addStepCompleteListener(
    listener: (
      step: OnboardingStep<TContext>,
      stepData: any,
      context: TContext
    ) => void | Promise<void>
  ): () => void {
    // This would need to be implemented based on when you consider a step "complete"
    // For now, return a no-op
    return () => {};
  }

  public addFlowCompleteListener(
    listener: (context: TContext) => void | Promise<void>
  ): () => void {
    return this.addFlowCompletedListener(listener);
  }

  public addContextUpdateListener(
    listener: (
      oldContext: TContext,
      newContext: TContext
    ) => void | Promise<void>
  ): () => void {
    // This would need to be implemented to track context changes
    // For now, return a no-op
    return () => {};
  }

  public addErrorListener(
    listener: (error: Error, context: TContext) => void | Promise<void>
  ): () => void {
    // This would need to be implemented to track errors
    // For now, return a no-op
    return () => {};
  }
}
