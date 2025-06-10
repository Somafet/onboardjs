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
    let previousPossibleStepId: string | number | null | undefined;

    if (currentStep) {
      nextStepCandidate = this._findNextStep(currentStep, context);
      previousPossibleStepId = evaluateStepId(
        currentStep.previousStep,
        context,
      );
    }

    return {
      currentStep,
      context,
      isFirstStep: currentStep
        ? !previousPossibleStepId && history.length === 0
        : false,
      // The flow is on its last step if no next step can be found
      isLastStep: currentStep ? !nextStepCandidate : this.isCompletedInternal,
      // The user can go next if a valid next step exists
      canGoNext: !!(currentStep && nextStepCandidate && !this.errorInternal),
      canGoPrevious:
        !!(
          (currentStep && previousPossibleStepId) ||
          (history.length > 0 &&
            history[history.length - 1] !== (currentStep?.id ?? null))
        ) && !this.errorInternal,
      isSkippable: !!(
        currentStep &&
        currentStep.isSkippable &&
        !this.errorInternal
      ),
      isLoading: this.isLoadingInternal,
      isHydrating: this.isHydratingInternal,
      error: this.errorInternal,
      isCompleted: this.isCompletedInternal,
      nextStepCandidate: nextStepCandidate,
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
