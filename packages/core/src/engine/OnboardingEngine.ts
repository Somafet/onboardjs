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
  EventListenerMap,
} from "./types";

/**
 * Unified event listener handler with consistent error management
 */
class EventManager<TContext extends OnboardingContext = OnboardingContext> {
  private listeners: Map<keyof EventListenerMap<TContext>, Set<any>> =
    new Map();

  constructor() {
    // Initialize listener sets for each event type
    const eventTypes: (keyof EventListenerMap<TContext>)[] = [
      "stateChange",
      "beforeStepChange",
      "stepChange",
      "flowComplete",
      "stepActive",
      "stepComplete",
      "contextUpdate",
      "error",
    ];

    eventTypes.forEach((eventType) => {
      this.listeners.set(eventType, new Set());
    });
  }

  /**
   * Add an event listener with unified error handling
   */
  addEventListener<T extends keyof EventListenerMap<TContext>>(
    eventType: T,
    listener: EventListenerMap<TContext>[T]
  ): UnsubscribeFunction {
    const listenerSet = this.listeners.get(eventType);
    if (!listenerSet) {
      throw new Error(`Unknown event type: ${String(eventType)}`);
    }

    listenerSet.add(listener);
    return () => listenerSet.delete(listener);
  }

  /**
   * Notify all listeners for a specific event with consistent error handling
   */
  notifyListeners<T extends keyof EventListenerMap<TContext>>(
    eventType: T,
    ...args: Parameters<EventListenerMap<TContext>[T]>
  ): void {
    const listenerSet = this.listeners.get(eventType);
    if (!listenerSet) return;

    listenerSet.forEach((listener) => {
      try {
        const result = (listener as any)(...args);
        if (result instanceof Promise) {
          result.catch((err) => {
            // Use legacy error message format for backward compatibility
            const legacyEventName =
              eventType === "flowComplete"
                ? "async onFlowHasCompleted"
                : this.getLegacyEventName(eventType);
            console.error(`Error in ${legacyEventName} listener:`, err);
          });
        }
      } catch (err) {
        // Use legacy error message format for backward compatibility
        const legacyEventName =
          eventType === "flowComplete"
            ? "sync onFlowHasCompleted"
            : this.getLegacyEventName(eventType);
        console.error(`Error in ${legacyEventName} listener:`, err);
      }
    });
  }

  /**
   * Get legacy event name for error messages to maintain backward compatibility
   */
  private getLegacyEventName<T extends keyof EventListenerMap<TContext>>(
    eventType: T
  ): string {
    switch (eventType) {
      case "stepChange":
        return "stepChange";
      case "stateChange":
        return "stateChange";
      case "beforeStepChange":
        return "beforeStepChange";
      case "stepActive":
        return "stepActive";
      case "stepComplete":
        return "stepComplete";
      case "contextUpdate":
        return "contextUpdate";
      case "error":
        return "error";
      default:
        return String(eventType);
    }
  }

  /**
   * Notify listeners with promise resolution for sequential execution
   */
  async notifyListenersSequential<T extends keyof EventListenerMap<TContext>>(
    eventType: T,
    ...args: Parameters<EventListenerMap<TContext>[T]>
  ): Promise<void> {
    const listenerSet = this.listeners.get(eventType);
    if (!listenerSet) return;

    for (const listener of listenerSet) {
      try {
        const result = (listener as any)(...args);
        if (result instanceof Promise) {
          await result;
        }
      } catch (err) {
        console.error(
          `[OnboardingEngine] Error in sequential ${String(eventType)} listener:`,
          err
        );
        throw err; // Re-throw for beforeStepChange cancellation logic
      }
    }
  }

  /**
   * Get the number of listeners for an event type
   */
  getListenerCount<T extends keyof EventListenerMap<TContext>>(
    eventType: T
  ): number {
    return this.listeners.get(eventType)?.size || 0;
  }

  /**
   * Clear all listeners
   */
  clearAllListeners(): void {
    this.listeners.forEach((listenerSet) => listenerSet.clear());
  }
}

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

  // Unified event manager
  private eventManager: EventManager<TContext> = new EventManager();

  // Onboarding engine instance configuration
  private onFlowComplete?: FlowCompleteListener<TContext>;
  private onStepChangeCallback?: (
    newStep: OnboardingStep<TContext> | null,
    oldStep: OnboardingStep<TContext> | null,
    context: TContext
  ) => void;

  private loadData?: DataLoadListener<TContext>;
  private persistData?: DataPersistListener<TContext>;
  private clearPersistedData?: () => Promise<void> | void;

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
    this.loadData = config.loadData; // Store
    this.persistData = config.persistData; // Store
    this.clearPersistedData = config.clearPersistedData;

    this.initializeEngine(config.initialStepId, config.initialContext).finally(
      () => {
        console.log("[OnboardingEngine] Initialization complete.");
        this.resolveInitialization?.();
      }
    );
  }

  /**
   * Unified method to register event listeners
   */
  public addEventListener<T extends keyof EventListenerMap<TContext>>(
    eventType: T,
    listener: EventListenerMap<TContext>[T]
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener(eventType, listener);
  }

  // Plugin compatibility methods
  public addBeforeStepChangeListener(
    listener: (
      currentStep: OnboardingStep<TContext> | null,
      nextStep: OnboardingStep<TContext>,
      context: TContext
    ) => void | Promise<void>
  ): UnsubscribeFunction {
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

    return this.addEventListener("beforeStepChange", wrappedListener);
  }

  public addAfterStepChangeListener(
    listener: (
      previousStep: OnboardingStep<TContext> | null,
      currentStep: OnboardingStep<TContext> | null,
      context: TContext
    ) => void | Promise<void>
  ): UnsubscribeFunction {
    return this.addEventListener("stepChange", listener);
  }

  public addStepActiveListener(
    listener: (
      step: OnboardingStep<TContext>,
      context: TContext
    ) => void | Promise<void>
  ): UnsubscribeFunction {
    return this.addEventListener("stepActive", listener);
  }

  public addStepCompleteListener(
    listener: (
      step: OnboardingStep<TContext>,
      stepData: any,
      context: TContext
    ) => void | Promise<void>
  ): UnsubscribeFunction {
    return this.addEventListener("stepComplete", listener);
  }

  public addFlowCompleteListener(
    listener: (context: TContext) => void | Promise<void>
  ): UnsubscribeFunction {
    return this.addEventListener("flowComplete", listener);
  }

  public addContextUpdateListener(
    listener: (
      oldContext: TContext,
      newContext: TContext
    ) => void | Promise<void>
  ): UnsubscribeFunction {
    return this.addEventListener("contextUpdate", listener);
  }

  public addErrorListener(
    listener: (error: Error, context: TContext) => void | Promise<void>
  ): UnsubscribeFunction {
    return this.addEventListener("error", listener);
  }

  /**
   * Allow plugins to override the data loading handler
   */
  public setDataLoadHandler(
    handler: DataLoadListener<TContext> | undefined
  ): void {
    this.loadData = handler;
  }

  /**
   * Allow plugins to override the data persistence handler
   */
  public setDataPersistHandler(
    handler: DataPersistListener<TContext> | undefined
  ): void {
    this.persistData = handler;
  }

  /**
   * Allow plugins to override the data clearing handler
   */
  public setClearPersistedDataHandler(
    handler: (() => Promise<void> | void) | undefined
  ): void {
    this.clearPersistedData = handler;
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

    if (this.loadData) {
      try {
        console.log("[OnboardingEngine] Attempting to load data...");
        loadedData = await this.loadData();
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
          console.log("[OnboardingEngine] No data returned from loadData.");
        }
      } catch (e: any) {
        console.error("[OnboardingEngine] Error during loadData:", e);
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
      this.notifyErrorListeners(dataLoadError);
      this.notifyStateChangeListeners(); // Notify with the hydration error
      return;
    }

    // Proceed with normal initialization if loadData was successful or not provided
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

  private notifyStepChangeListeners(
    newStep: OnboardingStep<TContext> | null,
    oldStep: OnboardingStep<TContext> | null,
    context: TContext
  ): void {
    this.eventManager.notifyListeners("stepChange", newStep, oldStep, context);
  }

  private notifyFlowCompleteListeners(context: TContext): void {
    console.log(
      "[OnboardingEngine] Notifying flowCompleteListeners. Count:",
      this.eventManager.getListenerCount("flowComplete")
    );
    this.eventManager.notifyListeners("flowComplete", context);
  }

  private notifyStateChangeListeners(): void {
    const state = this.getState();
    this.eventManager.notifyListeners("stateChange", state);
  }

  private notifyStepActiveListeners(
    step: OnboardingStep<TContext>,
    context: TContext
  ): void {
    this.eventManager.notifyListeners("stepActive", step, context);
  }

  private notifyStepCompleteListeners(
    step: OnboardingStep<TContext>,
    stepData: any,
    context: TContext
  ): void {
    this.eventManager.notifyListeners("stepComplete", step, stepData, context);
  }

  private notifyContextUpdateListeners(
    oldContext: TContext,
    newContext: TContext
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
    if (this.persistData) {
      try {
        await this.persistData(
          this.contextInternal,
          this.currentStepInternal?.id || null
        );
      } catch (e: any) {
        console.error("[OnboardingEngine] Error during persistData:", e);
        this.notifyErrorListeners(e);
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
      // Check if context actually changed to avoid unnecessary persists
      if (
        JSON.stringify(this.contextInternal) !== JSON.stringify(changes.context)
      ) {
        this.contextInternal = changes.context;
        contextChanged = true;
      }
    }

    this.notifyStateChangeListeners();

    // Notify context update listeners if context changed
    if (contextChanged && !this.isHydratingInternal) {
      this.notifyContextUpdateListeners(oldContext, this.contextInternal);
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
              `[OnboardingEngine] Navigation redirected to ${newTargetId} by beforeStepChange listener.`
            );
          }
        },
      };

      try {
        // Execute listeners sequentially to allow promise resolution
        await this.eventManager.notifyListenersSequential(
          "beforeStepChange",
          event
        );
        if (isCancelled) {
          console.log(
            "[OnboardingEngine] Navigation cancelled by beforeStepChange listener."
          );
          this.setState(() => ({ isLoading: false })); // Ensure loading state is reset
          return;
        }
      } catch (error) {
        console.error(
          "[OnboardingEngine] Error in beforeStepChange listener:",
          error
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
        // Notify step active listeners
        this.notifyStepActiveListeners(
          this.currentStepInternal,
          this.contextInternal
        );
      } catch (e: any) {
        this.errorInternal = e;
        this.notifyErrorListeners(e);
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
          this.contextInternal
        );
      } catch (e: any) {
        console.error("[OnboardingEngine] Error in onStepChangeCallback:", e);
        this.notifyErrorListeners(e);
      }
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
      const error = new Error(
        "Target step for checklist item update is invalid."
      );
      console.error(
        `[OnboardingEngine] Cannot update checklist item: Step '${
          stepId || this.currentStepInternal?.id
        }' not found or not a CHECKLIST step.`
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
        const error = new Error("Checklist criteria not met.");
        console.warn(
          `[OnboardingEngine] Cannot proceed from checklist step '${this.currentStepInternal.id}': Not all completion criteria met.`
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
          this.contextInternal
        );
      }

      // Notify step complete listeners
      this.notifyStepCompleteListeners(
        this.currentStepInternal!,
        stepSpecificData || {},
        this.contextInternal
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
      this.notifyErrorListeners(e);
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

    console.log("Old context:", oldContextJSON);
    console.log("New context:", newContextJSON);
    console.log("isSame:", oldContextJSON === newContextJSON);

    // Only notify and persist if something actually changed
    if (oldContextJSON !== newContextJSON) {
      this.notifyContextUpdateListeners(oldContext, this.contextInternal);
      this.notifyStateChangeListeners();
      await this.persistDataIfNeeded();
    }
  }

  public async reset(
    newConfig?: Partial<OnboardingEngineConfig<TContext>>
  ): Promise<void> {
    this.steps = newConfig?.steps || this.steps;
    // Preserve persistence listeners if not overridden by newConfig
    this.loadData =
      newConfig?.loadData !== undefined ? newConfig.loadData : this.loadData;
    this.persistData =
      newConfig?.persistData !== undefined
        ? newConfig.persistData
        : this.persistData;
    this.onFlowComplete =
      newConfig?.onFlowComplete !== undefined
        ? newConfig.onFlowComplete
        : this.onFlowComplete;
    this.onStepChangeCallback =
      newConfig?.onStepChange !== undefined
        ? newConfig.onStepChange
        : this.onStepChangeCallback;

    if (this.clearPersistedData) {
      try {
        console.log("[OnboardingEngine] reset: Clearing persisted data...");
        await this.clearPersistedData();
      } catch (e) {
        console.error(
          "[OnboardingEngine] reset: Error during clearPersistedData:",
          e
        );
        this.notifyErrorListeners(e as Error);
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
}
