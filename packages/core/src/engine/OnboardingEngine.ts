// @onboardjs/core/src/engine/OnboardingEngine.ts

import {
  OnboardingStep,
  OnboardingContext,
  BaseOnboardingStep,
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
} from "./types";

export class OnboardingEngine {
  private steps: OnboardingStep[];
  private currentStepInternal: OnboardingStep | null = null;
  private contextInternal: OnboardingContext;
  private history: string[] = []; // For previous navigation
  private listeners: Set<EngineStateChangeListener> = new Set();
  private isLoadingInternal: boolean = false;
  private errorInternal: Error | null = null;
  private isCompletedInternal: boolean = false;

  private stateChangeListeners: Set<EngineStateChangeListener> = new Set(); // Renamed for clarity
  private beforeStepChangeListeners: Set<BeforeStepChangeListener> = new Set();

  private onFlowComplete?: (context: OnboardingContext) => void;
  private onStepChangeCallback?: (
    newStep: OnboardingStep | null,
    oldStep: OnboardingStep | null,
    context: OnboardingContext
  ) => void;

  constructor(config: OnboardingEngineConfig) {
    this.steps = config.steps;
    this.contextInternal = {
      flowData: {},
      ...config.initialContext,
    };
    this.onFlowComplete = config.onFlowComplete;
    this.onStepChangeCallback = config.onStepChange;

    const initialStepId =
      config.initialStepId || (this.steps.length > 0 ? this.steps[0].id : null);
    if (initialStepId) {
      this.navigateToStep(initialStepId, "initial");
    } else {
      this.isCompletedInternal = true; // No steps, flow is complete
    }
    this.notifyStateChangeListeners();
  }

  private setState(updater: (prevState: EngineState) => Partial<EngineState>) {
    const currentState = this.getState();
    const changes = updater(currentState);

    if (changes.isLoading !== undefined)
      this.isLoadingInternal = changes.isLoading;
    if (changes.error !== undefined) this.errorInternal = changes.error;
    if (changes.isCompleted !== undefined)
      this.isCompletedInternal = changes.isCompleted;
    if (changes.context) this.contextInternal = changes.context;
    // currentStep is handled by navigateToStep

    this.notifyStateChangeListeners();
  }

  private async navigateToStep(
    requestedTargetStepId: string | null | undefined,
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
      let skipToId: string | null | undefined;
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
          this.history.push(oldStep.id);
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
      this.isCompletedInternal = true;
      if (
        this.onFlowComplete &&
        direction !== "initial" &&
        !oldStep?.nextStep
      ) {
        this.onFlowComplete(this.contextInternal);
      }
    }

    if (this.onStepChangeCallback) {
      this.onStepChangeCallback(
        this.currentStepInternal,
        oldStep,
        this.contextInternal
      );
    }

    this.setState(() => ({ isLoading: false }));
    // Note: notifyStateChangeListeners() is called within setState
  }

  public getState(): EngineState {
    const currentStep = this.currentStepInternal;
    const context = this.contextInternal;
    let nextPossibleStepId: string | null | undefined;
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
      error: this.errorInternal,
      isCompleted: this.isCompletedInternal,
    };
  }

  public subscribeToStateChange(
    listener: EngineStateChangeListener
  ): UnsubscribeFunction {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
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
    this.listeners.forEach((listener) => listener(state));
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
    this.contextInternal.flowData = {
      ...this.contextInternal.flowData,
      [dataKey]: itemStates,
    };

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
    try {
      if (stepSpecificData) {
        this.contextInternal.flowData = {
          ...this.contextInternal.flowData,
          ...stepSpecificData,
        };
      }
      if (this.currentStepInternal.onStepComplete) {
        await this.currentStepInternal.onStepComplete(
          stepSpecificData || {}, // Pass the (potentially augmented) stepSpecificData
          this.contextInternal
        );
      }
      const nextStepId = evaluateStepId(
        this.currentStepInternal.nextStep,
        this.contextInternal
      );
      await this.navigateToStep(nextStepId, "next");
    } catch (e: any) {
      this.errorInternal = e;
      console.error(
        `Error in next() for step ${this.currentStepInternal.id}:`,
        e
      );
      this.setState(() => ({ isLoading: false, error: e })); // Ensure state is updated
    }
  }

  public async previous(): Promise<void> {
    if (this.isLoadingInternal) return;
    const current = this.currentStepInternal;
    let prevStepId: string | null | undefined;

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

  public updateContext(newContextData: Partial<OnboardingContext>): void {
    this.contextInternal = { ...this.contextInternal, ...newContextData };
    if (newContextData.flowData) {
      // If flowData is part of the update, merge it
      this.contextInternal.flowData = {
        ...this.contextInternal.flowData,
        ...newContextData.flowData,
      };
    }
    this.notifyStateChangeListeners();
  }

  public reset(newConfig?: Partial<OnboardingEngineConfig>): void {
    this.steps = newConfig?.steps || this.steps;
    this.contextInternal = {
      flowData: {},
      ...(newConfig?.initialContext || { flowData: {} }),
    };
    this.currentStepInternal = null;
    this.history = [];
    this.isLoadingInternal = false;
    this.errorInternal = null;
    this.isCompletedInternal = false;

    const initialStepId =
      newConfig?.initialStepId ||
      (this.steps.length > 0 ? this.steps[0].id : null);

    if (initialStepId) {
      this.navigateToStep(initialStepId, "initial");
    } else {
      this.isCompletedInternal = true;
    }
    this.notifyStateChangeListeners();
  }
}
