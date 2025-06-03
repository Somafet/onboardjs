// src/engine/services/StateManager.ts

import { OnboardingContext, OnboardingStep } from "../types";
import { evaluateStepId } from "../utils/step-utils";
import { EventManager } from "./EventManager";
import { EngineState } from "./types";

export class StateManager<TContext extends OnboardingContext> {
  private isLoadingInternal = false;
  private isHydratingInternal = true;
  private errorInternal: Error | null = null;
  private isCompletedInternal = false;

  constructor(private eventManager: EventManager<TContext>) {}

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

    // Always notify state change listeners when setState is called
    // This ensures that step changes trigger state change notifications
    this.notifyStateChangeListeners(currentStep, context, history);

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
        ? !previousPossibleStepId && history.length === 0
        : false,
      isLastStep: currentStep ? !nextPossibleStepId : this.isCompletedInternal,
      canGoNext: !!(currentStep && nextPossibleStepId && !this.errorInternal),
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
      // Note: context needs to be passed from caller
      console.error("[StateManager] Error set:", error);
    }
  }

  setCompleted(completed: boolean): void {
    this.isCompletedInternal = completed;
  }
}
