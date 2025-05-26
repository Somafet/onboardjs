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
} from "./types";

export class OnboardingEngine {
  private steps: OnboardingStep[];
  private currentStepInternal: OnboardingStep | null = null;
  private contextInternal: OnboardingContext;
  private history: string[] = []; // For previous navigation
  private isLoadingInternal: boolean = false;
  private isHydratingInternal: boolean = true;
  private errorInternal: Error | null = null;
  private isCompletedInternal: boolean = false;

  private stateChangeListeners: Set<EngineStateChangeListener> = new Set();
  private beforeStepChangeListeners: Set<BeforeStepChangeListener> = new Set();

  private onFlowComplete?: (context: OnboardingContext) => void;
  private onStepChangeCallback?: (
    newStep: OnboardingStep | null,
    oldStep: OnboardingStep | null,
    context: OnboardingContext
  ) => void;

  private onDataLoad?: DataLoadListener;
  private onDataPersist?: DataPersistListener;

  private initializationPromise: Promise<void>;
  private resolveInitialization!: () => void; // Definite assignment assertion

  constructor(config: OnboardingEngineConfig) {
    this.initializationPromise = new Promise((resolve) => {
      this.resolveInitialization = resolve;
    });
    this.steps = config.steps;
    this.contextInternal = {
      flowData: {},
      ...config.initialContext, // Initial context from config
    };
    this.onFlowComplete = config.onFlowComplete;
    this.onStepChangeCallback = config.onStepChange;
    this.onDataLoad = config.onDataLoad; // Store
    this.onDataPersist = config.onDataPersist; // Store

    // Don't notify listeners immediately, wait for potential hydration
    // this.notifyStateChangeListeners(); // Remove this initial call

    this.initializeEngine(config.initialStepId, config.initialContext).finally(
      () => {
        // This ensures resolveInitialization is called even if initializeEngine itself throws
        // though errors within initializeEngine should ideally be caught and set to errorInternal
        console.log("[OnboardingEngine] Initialization complete.");

        this.resolveInitialization?.();
      }
    );
  }

  /**
   * Initializes the onboarding engine by hydrating its state from an optional data loader,
   * merging any provided initial context and step configuration, and navigating to the appropriate initial step.
   *
   * This method:
   * - Sets the engine into a hydrating state and notifies listeners.
   * - Attempts to load persisted onboarding data via `onDataLoad` if available.
   * - Merges loaded data with any provided initial context, giving precedence to loaded data.
   * - Determines the effective initial step to navigate to, prioritizing loaded data, then config, then the first step.
   * - Navigates to the determined initial step or marks the flow as complete if no steps are available.
   * - Handles errors during data loading gracefully, setting an internal error and proceeding with default initialization.
   * - Notifies listeners of state changes throughout the process.
   *
   * @param configInitialStepId - Optional step ID to use as the initial step if not provided by loaded data.
   * @param configInitialContext - Optional partial onboarding context to merge with loaded data and defaults.
   * @returns A promise that resolves when initialization is complete.
   */
  private async initializeEngine(
    configInitialStepId?: string | number,
    configInitialContext?: Partial<OnboardingContext>
  ): Promise<void> {
    this.isHydratingInternal = true;
    this.notifyStateChangeListeners(); // Notify that hydration is starting

    let loadedData: LoadedData | null | undefined = null;
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
          };
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
    };

    const effectiveInitialStepId =
      loadedData?.currentStepId !== undefined // Check if currentStepId was explicitly loaded (even if null)
        ? loadedData.currentStepId
        : configInitialStepId ||
          (this.steps.length > 0 ? this.steps[0].id : null);

    if (effectiveInitialStepId) {
      // navigateToStep will set isLoading to true, then false, and notify listeners
      await this.navigateToStep(effectiveInitialStepId, "initial");
    } else {
      this.isCompletedInternal = true;
      // If no steps and no initial step, flow is complete.
      // isLoadingInternal should be false here.
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
   * Persists the current onboarding data if a persistence handler (`onDataPersist`) is defined.
   *
   * This method attempts to call the `onDataPersist` callback with the current context and step ID.
   * If an error occurs during persistence, it logs the error but does not interrupt the main flow.
   *
   * @returns {Promise<void>} A promise that resolves when data persistence is complete or skipped.
   */
  private async persistDataIfNeeded(): Promise<void> {
    if (this.onDataPersist) {
      try {
        // console.log('[OnboardingEngine] Persisting data...');
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
  private setState(updater: (prevState: EngineState) => Partial<EngineState>) {
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
    // Or if other significant state like isCompleted changed (though persist is mainly for context)
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
      const event: BeforeStepChangeEvent = {
        currentStep: this.currentStepInternal,
        targetStepId: requestedTargetStepId,
        direction,
        cancel: () => {
          isCancelled = true;
        },
        redirect: (newTargetId) => {
          if (!isCancelled) {
            // Only allow redirect if not already cancelled
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
          // Potentially notify about cancellation or update state? For now, just stops.
          this.setState(() => ({ isLoading: false })); // Ensure loading state is reset
          return;
        }
      }
    }

    // If redirected, the direction might conceptually change, but for now, we keep the original
    // or the user of redirect needs to be aware of this.
    // For simplicity, we'll use the original direction for history management if redirected.

    this.setState(() => ({ isLoading: true, error: null }));

    let nextCandidateStep = findStepById(this.steps, finalTargetStepId);

    // ... (rest of the conditional step skipping logic - ensure it uses finalTargetStepId)
    while (
      nextCandidateStep &&
      nextCandidateStep.condition &&
      !nextCandidateStep.condition(this.contextInternal)
    ) {
      let skipToId: string | number | null | undefined;
      // ... (conditional skipping logic as before, using finalTargetStepId for context)
      const effectiveDirection = redirected ? "goto" : direction; // If redirected, treat as 'goto' for skipping logic
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
      finalTargetStepId = skipToId; // Update finalTargetStepId if skipping conditional steps
      nextCandidateStep = findStepById(this.steps, finalTargetStepId);
    }

    const oldStep = this.currentStepInternal;
    this.currentStepInternal = nextCandidateStep || null;

    if (this.currentStepInternal) {
      // --- Initialize checklist data on activation ---
      if (this.currentStepInternal.type === "CHECKLIST") {
        this.getChecklistItemsState(
          this.currentStepInternal as OnboardingStep & { type: "CHECKLIST" }
        );
        // This ensures flowData has the structure for the checklist items.
        // The actual values will be preserved if they already exist.
      }
      // --- End checklist initialization ---
      // Adjust history logic based on original direction, even if redirected
      if (
        direction !== "previous" &&
        oldStep &&
        oldStep.id !== this.currentStepInternal.id
      ) {
        if (this.history[this.history.length - 1] !== oldStep.id) {
          this.history.push(String(oldStep.id));
        }
      } else if (
        direction === "previous" &&
        this.currentStepInternal.id === this.history[this.history.length - 1]
      ) {
        // If going back to the immediate previous step in history, pop it.
        // This handles the case where `previousStep` function might jump over history.
        // This logic might need refinement based on desired history behavior with complex previousStep functions.
        // For now, if the target matches the last history entry, pop it.
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
      if (
        this.onFlowComplete &&
        direction !== "initial" &&
        (!oldStep || !evaluateStepId(oldStep.nextStep, this.contextInternal))
      ) {
        this.onFlowComplete(this.contextInternal);
      }
      // Persist on completion
      await this.persistDataIfNeeded(); // <--- ADDED PERSIST ON COMPLETION
    }

    if (this.onStepChangeCallback) {
      this.onStepChangeCallback(
        this.currentStepInternal,
        oldStep,
        this.contextInternal
      );
    }

    this.setState(() => ({ isLoading: false })); // This will notify listeners
  }

  public getState(): EngineState {
    const currentStep = this.currentStepInternal;
    const context = this.contextInternal;
    let nextPossibleStepId: string | number | null | undefined;
    if (currentStep) {
      nextPossibleStepId = evaluateStepId(currentStep.nextStep, context);
    }

    return {
      currentStep,
      context,
      isFirstStep: currentStep
        ? !evaluateStepId(currentStep.previousStep, context) &&
          this.history.length === 0
        : false,
      isLastStep: currentStep ? !nextPossibleStepId : this.isCompletedInternal,
      canGoNext: !!(currentStep && nextPossibleStepId),
      canGoPrevious: !!(
        (currentStep && evaluateStepId(currentStep.previousStep, context)) ||
        this.history.length > 0
      ),
      isSkippable: !!(currentStep && currentStep.isSkippable),
      isLoading: this.isLoadingInternal,
      isHydrating: this.isHydratingInternal,
      error: this.errorInternal,
      isCompleted: this.isCompletedInternal,
    };
  }

  public subscribeToStateChange(
    listener: EngineStateChangeListener
  ): UnsubscribeFunction {
    this.stateChangeListeners.add(listener);
    return () => this.stateChangeListeners.delete(listener);
  }

  /**
   * Registers a listener function to be called before a step change occurs in the onboarding engine.
   *
   * @param listener - The function to be invoked before the step changes. It should conform to the `BeforeStepChangeListener` type.
   * @returns An `UnsubscribeFunction` that, when called, removes the registered listener.
   */
  public onBeforeStepChange(
    listener: BeforeStepChangeListener
  ): UnsubscribeFunction {
    this.beforeStepChangeListeners.add(listener);
    return () => this.beforeStepChangeListeners.delete(listener);
  }

  private notifyStateChangeListeners(): void {
    const state = this.getState();
    this.stateChangeListeners.forEach((listener) => listener(state));
  }

  // --- Helper to manage checklist item state initialization/retrieval ---
  private getChecklistItemsState(
    step: OnboardingStep & { type: "CHECKLIST" }
  ): ChecklistItemState[] {
    const { dataKey, items: itemDefinitions } = step.payload;
    let currentItemStates = this.contextInternal.flowData[dataKey] as
      | ChecklistItemState[]
      | undefined;

    if (
      !currentItemStates ||
      currentItemStates.length !== itemDefinitions.length
    ) {
      // Initialize or re-initialize if structure mismatch (e.g., definitions changed)
      currentItemStates = itemDefinitions.map((def) => ({
        id: def.id,
        isCompleted: false, // Default to not completed
      }));
      // Persist this initial state
      this.contextInternal.flowData = {
        ...this.contextInternal.flowData,
        [dataKey]: [...currentItemStates], // Store a copy
      };
      // Consider notifying about this implicit data update if necessary
      // this.notifyStateChangeListeners(); // Or a more specific event
    }
    return currentItemStates;
  }

  private isChecklistStepComplete(
    step: OnboardingStep & { type: "CHECKLIST" }
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

  // --- Public method to update a checklist item's status ---
  public async updateChecklistItem(
    itemId: string,
    isCompleted: boolean,
    stepId?: string // Optional: if not current step, though usually for current
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
      // Item state doesn't exist, create it (should ideally be pre-initialized by getChecklistItemsState)
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

    // Call onStepComplete for the checklist step if it's now complete
    // This is a bit tricky. onStepComplete is usually called on explicit next.
    // For now, let's assume the UI layer will reflect this and the user clicks next.
    // Or, we can emit a specific event.
    // For now, just update data and notify. The `next()` method will do the check.

    // Notify about data change
    if (
      this.currentStepInternal &&
      this.currentStepInternal.id === targetStep.id &&
      this.currentStepInternal.onStepComplete
    ) {
      // This is debatable. onStepComplete is usually for *leaving* the step.
      // Let's assume the UI will handle enabling "Next" based on isChecklistStepComplete.
    }

    // Emit a specific event or rely on general state change
    // Example: this.emit('checklistItemUpdated', { stepId: targetStep.id, itemId, isCompleted });
    this.notifyStateChangeListeners(); // General state change will pick up flowData update
  }

  public async next(stepSpecificData?: any): Promise<void> {
    if (!this.currentStepInternal || this.isLoadingInternal) return;

    // --- CHECKLIST COMPLETION CHECK ---
    if (this.currentStepInternal.type === "CHECKLIST") {
      if (
        !this.isChecklistStepComplete(
          this.currentStepInternal as OnboardingStep & { type: "CHECKLIST" }
        )
      ) {
        console.warn(
          `[OnboardingEngine] Cannot proceed from checklist step '${this.currentStepInternal.id}': Not all completion criteria met.`
        );
        this.errorInternal = new Error("Checklist criteria not met.");
        this.notifyStateChangeListeners(); // Update UI with error
        return; // Prevent navigation
      }
      // If complete, the stepSpecificData for a checklist should be its items' state
      const checklistPayload = this.currentStepInternal
        .payload as ChecklistStepPayload;
      stepSpecificData = {
        ...stepSpecificData, // Allow other data to be passed
        [checklistPayload.dataKey]:
          this.contextInternal.flowData[checklistPayload.dataKey] || [],
      };
    }
    // --- END CHECKLIST COMPLETION CHECK ---

    this.setState(() => ({ isLoading: true, error: null }));
    let contextUpdated = false;
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
          contextUpdated = true;
        }
      }
      if (this.currentStepInternal!.onStepComplete) {
        // Assert currentStepInternal exists here
        await this.currentStepInternal!.onStepComplete(
          stepSpecificData || {},
          this.contextInternal
        );
        // onStepComplete might also modify contextInternal.flowData
        // We assume persistDataIfNeeded will be called after state notification
      }
      const nextStepId = evaluateStepId(
        this.currentStepInternal!.nextStep,
        this.contextInternal
      );
      await this.navigateToStep(nextStepId, "next"); // This will eventually call setState and notify

      // Persist after successful navigation and potential context update from onStepComplete
      // or if stepSpecificData was provided.
      // navigateToStep calls setState which calls notify, which should be enough if persist is in setState.
      // However, if onStepComplete modifies context directly, we might need an explicit persist here.
      // Let's rely on setState's persist call for now. If contextUpdated is true, it will persist.
      // If onStepComplete modifies context, the next getState() will reflect it.
      if (contextUpdated) {
        // If data was directly merged here
        this.persistDataIfNeeded();
      }
    } catch (e: any) {
      this.errorInternal = e;
      console.error(
        `Error in next() for step ${this.currentStepInternal.id}:`,
        e
      );
      this.setState(() => ({ isLoading: false, error: e }));
    }
    // isLoading will be set to false by navigateToStep or the catch block's setState
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
    const skipToId = evaluateStepId(
      this.currentStepInternal.skipToStep || this.currentStepInternal.nextStep,
      this.contextInternal
    );
    await this.navigateToStep(skipToId, "skip");
  }

  public async goToStep(stepId: string, stepSpecificData?: any): Promise<void> {
    if (this.isLoadingInternal) return;
    // Potentially call onStepComplete for the *current* step before jumping
    // This depends on desired behavior. For now, we just jump.
    if (stepSpecificData) {
      this.contextInternal.flowData = {
        ...this.contextInternal.flowData,
        ...stepSpecificData,
      };
    }
    await this.navigateToStep(stepId, "goto");
  }

  public async updateContext(
    newContextData: Partial<OnboardingContext>
  ): Promise<void> {
    // Made async to align with persist
    const oldContextJSON = JSON.stringify(this.contextInternal);
    this.contextInternal = { ...this.contextInternal, ...newContextData };
    if (newContextData.flowData) {
      this.contextInternal.flowData = {
        ...(this.contextInternal.flowData || {}), // Ensure flowData exists
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
    newConfig?: Partial<OnboardingEngineConfig>
  ): Promise<void> {
    // Made async
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

    // For reset, we don't persist the "empty" state immediately.
    // We re-initialize, which might load data.
    this.currentStepInternal = null;
    this.history = [];
    this.isLoadingInternal = false;
    this.errorInternal = null;
    this.isCompletedInternal = false;
    // isHydratingInternal will be set by initializeEngine

    // Re-initialize with potentially new initial context from newConfig
    // or fall back to a truly empty context if no newConfig.initialContext
    const resetInitialContext = newConfig?.initialContext || { flowData: {} };
    this.contextInternal = { flowData: {}, ...resetInitialContext };

    await this.initializeEngine(newConfig?.initialStepId, resetInitialContext);
    // initializeEngine will call notifyStateChangeListeners
  }
}
