// @onboardjs/core/src/engine/OnboardingEngine.ts

import {
  OnboardingStep,
  OnboardingContext,
  BaseOnboardingStep,
} from "../types";
import { evaluateStepId, findStepById } from "../utils/step-utils";
import {
  EngineState,
  EngineStateChangeListener,
  UnsubscribeFunction,
  OnboardingEngineConfig,
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
    this.notifyListeners();
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

    this.notifyListeners();
  }

  private async navigateToStep(
    targetStepId: string | null | undefined,
    direction: "next" | "previous" | "skip" | "goto" | "initial" = "goto"
  ): Promise<void> {
    this.setState(() => ({ isLoading: true, error: null }));

    let nextCandidateStep = findStepById(this.steps, targetStepId);

    // Handle conditional steps: if a step's condition is false, skip it
    while (
      nextCandidateStep &&
      nextCandidateStep.condition &&
      !nextCandidateStep.condition(this.contextInternal)
    ) {
      let skipToId: string | null | undefined;
      if (direction === "previous") {
        // When going back and skipping, use the previousStep of the conditional step
        skipToId = evaluateStepId(
          nextCandidateStep.previousStep,
          this.contextInternal
        );
      } else {
        // When going forward/skipping and skipping, use the nextStep of the conditional step
        skipToId = evaluateStepId(
          nextCandidateStep.nextStep,
          this.contextInternal
        );
      }
      if (!skipToId) {
        // Dead end after skipping conditional step
        nextCandidateStep = undefined;
        break;
      }
      nextCandidateStep = findStepById(this.steps, skipToId);
    }

    const oldStep = this.currentStepInternal;
    this.currentStepInternal = nextCandidateStep || null;

    if (this.currentStepInternal) {
      if (direction !== "previous" && oldStep) {
        // Add to history unless going back or it's the initial step
        if (this.history[this.history.length - 1] !== oldStep.id) {
          this.history.push(oldStep.id);
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
      // No current step means flow is completed or ended
      this.isCompletedInternal = true;
      if (
        this.onFlowComplete &&
        direction !== "initial" &&
        !oldStep?.nextStep
      ) {
        // Avoid calling on initial load if no steps
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

  public subscribe(listener: EngineStateChangeListener): UnsubscribeFunction {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  public async next(stepSpecificData?: any): Promise<void> {
    if (!this.currentStepInternal || this.isLoadingInternal) return;

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
          stepSpecificData || {},
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
      this.setState(() => ({ isLoading: false, error: e }));
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
    this.notifyListeners();
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
    this.notifyListeners();
  }
}
