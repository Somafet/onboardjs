// src/engine/services/StateManager.ts

import { OnboardingContext, OnboardingStep } from "../types";
import { evaluateStepId, findStepById } from "../utils/step-utils";
import { EventManager } from "./EventManager";
import { EngineState } from "./types";

export class StateManager<TContext extends OnboardingContext> {
  private isLoadingInternal = false;
  private isHydratingInternal = true;
  private errorInternal: Error | null = null;
  private isCompletedInternal = false;

  constructor(
    private eventManager: EventManager<TContext>,
    private steps: OnboardingStep<TContext>[],
    private initialStepId: string | number | null,
  ) {}

  setState(
    updater: (
      prevState: EngineState<TContext>,
    ) => Partial<EngineState<TContext>>,
    currentStep: OnboardingStep<TContext> | null,
    context: TContext,
    history: string[],
    onContextChange?: (oldContext: TContext, newContext: TContext) => void,
  ): void {
    const currentState = this.getState(currentStep, context, history);
    const oldContext = { ...context };
    const changes = updater(currentState);

    let contextChanged = false;
    let stateChanged = false;

    if (
      changes.isLoading !== undefined &&
      changes.isLoading !== this.isLoadingInternal
    ) {
      this.isLoadingInternal = changes.isLoading;
      stateChanged = true;
    }
    if (
      changes.isHydrating !== undefined &&
      changes.isHydrating !== this.isHydratingInternal
    ) {
      this.isHydratingInternal = changes.isHydrating;
      stateChanged = true;
    }
    if (changes.error !== undefined && changes.error !== this.errorInternal) {
      this.errorInternal = changes.error;
      stateChanged = true;
    }
    if (
      changes.isCompleted !== undefined &&
      changes.isCompleted !== this.isCompletedInternal
    ) {
      this.isCompletedInternal = changes.isCompleted;
      stateChanged = true;
    }
    if (changes.context) {
      if (JSON.stringify(context) !== JSON.stringify(changes.context)) {
        Object.assign(context, changes.context);
        contextChanged = true;
        stateChanged = true;
      }
    }

    // Only notify if there was a meaningful change to the state object
    if (stateChanged) {
      this.notifyStateChangeListeners(currentStep, context, history);
    }

    if (contextChanged && !this.isHydratingInternal && onContextChange) {
      onContextChange(oldContext, context);
    }
  }

  notifyStateChange(
    currentStep: OnboardingStep<TContext> | null,
    context: TContext,
    history: string[],
  ): void {
    this.notifyStateChangeListeners(currentStep, context, history);
  }

  get hasError(): boolean {
    return this.errorInternal !== null;
  }

  getState(
    currentStep: OnboardingStep<TContext> | null,
    context: TContext,
    history: string[],
  ): EngineState<TContext> {
    let nextStepCandidate: OnboardingStep<TContext> | null = null;
    let previousStepCandidate: OnboardingStep<TContext> | null = null;

    if (currentStep) {
      nextStepCandidate = this._findNextStep(currentStep, context);
      previousStepCandidate = this._findPreviousStep(
        currentStep,
        context,
        history,
      );
    }

    const isFirstStep = !!currentStep && currentStep.id === this.initialStepId;

    const completedIds = new Set(
      Object.keys(context.flowData?._internal?.completedSteps || {}),
    );

    // First, determine the list of steps that are currently relevant based on conditions.
    const relevantSteps = this.steps.filter(
      (step) => !step.condition || step.condition(context),
    );

    const totalRelevantSteps = relevantSteps.length;

    // Calculate completed steps based on the relevant list.
    const completedRelevantSteps = relevantSteps.filter((step) =>
      completedIds.has(String(step.id)),
    ).length;

    const progressPercentage =
      totalRelevantSteps > 0
        ? Math.round((completedRelevantSteps / totalRelevantSteps) * 100)
        : 0;

    // Find the 0-based index of the current step within the relevant steps.
    const currentStepIndex = currentStep
      ? relevantSteps.findIndex((step) => step.id === currentStep.id)
      : -1;

    // Convert to a 1-based number for UI display, or 0 if not found/null.
    const currentStepNumber =
      currentStepIndex !== -1 ? currentStepIndex + 1 : 0;

    return {
      currentStep,
      context,
      isFirstStep,
      isLastStep: currentStep ? !nextStepCandidate : this.isCompletedInternal,
      canGoPrevious:
        !isFirstStep &&
        !!currentStep &&
        !!previousStepCandidate &&
        !this.errorInternal,
      canGoNext: !!(currentStep && nextStepCandidate && !this.errorInternal),
      isSkippable: !!(
        currentStep &&
        currentStep.isSkippable &&
        !this.errorInternal
      ),
      isLoading: this.isLoadingInternal,
      isHydrating: this.isHydratingInternal,
      error: this.errorInternal,
      isCompleted: this.isCompletedInternal,
      previousStepCandidate: previousStepCandidate,
      nextStepCandidate: nextStepCandidate,
      totalSteps: totalRelevantSteps,
      completedSteps: completedRelevantSteps,
      progressPercentage,
      currentStepNumber,
    };
  }

  private notifyStateChangeListeners(
    currentStep: OnboardingStep<TContext> | null,
    context: TContext,
    history: string[],
  ): void {
    const state = this.getState(currentStep, context, history);
    this.eventManager.notifyListeners("stateChange", state);
  }

  private _findNextStep(
    currentStep: OnboardingStep<TContext>,
    context: TContext,
  ): OnboardingStep<TContext> | null {
    // 1. Check for an explicit nextStep first
    const explicitNextStepId = evaluateStepId(currentStep.nextStep, context);

    if (explicitNextStepId) {
      // An explicit target is set, find it. NavigationManager will handle its condition.
      return findStepById(this.steps, explicitNextStepId) || null;
    }

    if (explicitNextStepId === null) {
      // Flow is explicitly ended
      return null;
    }

    // 2. If nextStep is undefined, fall back to array order
    if (explicitNextStepId === undefined) {
      const currentIndex = this.steps.findIndex((s) => s.id === currentStep.id);
      if (currentIndex === -1 || currentIndex >= this.steps.length - 1) {
        return null; // Not found or is the last step
      }

      // Find the next step in the array that satisfies its condition
      for (let i = currentIndex + 1; i < this.steps.length; i++) {
        const candidateStep = this.steps[i];
        if (!candidateStep.condition || candidateStep.condition(context)) {
          return candidateStep; // Found the next valid step
        }
      }
      return null; // No subsequent valid steps found
    }

    return null;
  }

  private _findPreviousStep(
    currentStep: OnboardingStep<TContext>,
    context: TContext,
    history: string[],
  ): OnboardingStep<TContext> | null {
    // --- STEP 1: Find the initial candidate ID using the 3-priority system ---
    let targetId: string | number | null | undefined = evaluateStepId(
      currentStep.previousStep,
      context,
    );

    if (targetId === undefined) {
      // Priority 2: History
      if (history.length > 0) {
        targetId = history[history.length - 1];
      } else {
        // Priority 3: Array Order (The fix for persisted state)
        const currentIndex = this.steps.findIndex(
          (s) => s.id === currentStep.id,
        );
        if (currentIndex > 0) {
          targetId = this.steps[currentIndex - 1].id;
        }
      }
    }

    if (!targetId) {
      return null; // No possible previous step from any source.
    }

    // --- STEP 2: Validate the candidate and traverse backwards if its condition fails ---
    let candidateStep = findStepById(this.steps, targetId);

    while (candidateStep) {
      // If the candidate's condition passes (or it has no condition), we've found our step.
      if (!candidateStep.condition || candidateStep.condition(context)) {
        return candidateStep;
      }

      // Condition failed. We MUST follow the explicit `previousStep` chain from here
      // to ensure a predictable backward traversal. We do not consult history or
      // array order again inside this loop.
      const nextTargetIdInChain = evaluateStepId(
        candidateStep.previousStep,
        context,
      );

      if (!nextTargetIdInChain) {
        return null; // The backward chain is broken by a failed condition.
      }
      candidateStep = findStepById(this.steps, nextTargetIdInChain);
    }

    return null; // Loop finished (e.g., a bad ID was found in the chain).
  }

  // Getters for internal state
  get isLoading(): boolean {
    return this.isLoadingInternal;
  }

  get isHydrating(): boolean {
    return this.isHydratingInternal;
  }

  get error(): Error | null {
    return this.errorInternal;
  }

  get isCompleted(): boolean {
    return this.isCompletedInternal;
  }

  // Setters for internal state
  setLoading(loading: boolean): void {
    this.isLoadingInternal = loading;
  }

  setHydrating(hydrating: boolean): void {
    this.isHydratingInternal = hydrating;
  }

  setError(error: Error | null): void {
    this.errorInternal = error;
    if (error) {
      console.error("[StateManager] Error set:", error);
    }
  }

  setCompleted(completed: boolean): void {
    this.isCompletedInternal = completed;
  }
}
