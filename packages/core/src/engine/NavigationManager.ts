// src/engine/services/NavigationManager.ts

import {
  OnboardingContext,
  OnboardingStep,
  ChecklistStepPayload,
} from "../types";
import { findStepById, evaluateStepId } from "../utils/step-utils";
import { ChecklistManager } from "./ChecklistManager";
import { ErrorHandler } from "./ErrorHandler";
import { EventManager } from "./EventManager";
import { PersistenceManager } from "./PersistenceManager";
import { StateManager } from "./StateManager";
import { BeforeStepChangeEvent } from "./types";

export class NavigationManager<TContext extends OnboardingContext> {
  constructor(
    private steps: OnboardingStep<TContext>[],
    private eventManager: EventManager<TContext>,
    private stateManager: StateManager<TContext>,
    private checklistManager: ChecklistManager<TContext>,
    private persistenceManager: PersistenceManager<TContext>,
    private errorHandler: ErrorHandler<TContext>,
  ) {}

  async navigateToStep(
    requestedTargetStepId: string | number | null | undefined,
    direction: "next" | "previous" | "skip" | "goto" | "initial" = "goto",
    currentStep: OnboardingStep<TContext> | null,
    context: TContext,
    history: string[],
    onStepChangeCallback?: (
      newStep: OnboardingStep<TContext> | null,
      oldStep: OnboardingStep<TContext> | null,
      context: TContext,
    ) => void,
    onFlowComplete?: (context: TContext) => Promise<void> | void,
  ): Promise<OnboardingStep<TContext> | null> {
    let isCancelled = false;
    let finalTargetStepId = requestedTargetStepId;
    let redirected = false;

    // Handle beforeStepChange event
    if (this.eventManager.getListenerCount("beforeStepChange") > 0) {
      const event: BeforeStepChangeEvent<TContext> = {
        currentStep,
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
              `[NavigationManager] Navigation redirected to ${newTargetId} by beforeStepChange listener.`,
            );
          }
        },
      };

      try {
        await this.eventManager.notifyListenersSequential(
          "beforeStepChange",
          event,
        );
        if (isCancelled) {
          console.log(
            "[NavigationManager] Navigation cancelled by beforeStepChange listener.",
          );
          this.stateManager.setLoading(false);
          return currentStep;
        }
      } catch (error) {
        this.errorHandler.handleError(
          error,
          "beforeStepChange listener",
          context,
        );
        return currentStep;
      }
    }

    this.stateManager.setLoading(true);
    this.stateManager.setError(null);

    let nextCandidateStep = findStepById(this.steps, finalTargetStepId);

    // Handle conditional step skipping
    while (
      nextCandidateStep &&
      nextCandidateStep.condition &&
      !nextCandidateStep.condition(context)
    ) {
      let skipToId: string | number | null | undefined;
      const effectiveDirection = redirected ? "goto" : direction;

      if (effectiveDirection === "previous") {
        skipToId = evaluateStepId(nextCandidateStep.previousStep, context);
      } else {
        skipToId = evaluateStepId(nextCandidateStep.nextStep, context);
      }

      if (!skipToId) {
        nextCandidateStep = undefined;
        break;
      }

      finalTargetStepId = skipToId;
      nextCandidateStep = findStepById(this.steps, finalTargetStepId);
    }

    const oldStep = currentStep;
    const newCurrentStep = nextCandidateStep || null;

    if (newCurrentStep) {
      // Initialize checklist data on activation
      if (newCurrentStep.type === "CHECKLIST") {
        this.checklistManager.getChecklistItemsState(
          newCurrentStep as OnboardingStep<TContext> & {
            type: "CHECKLIST";
          },
          context,
        );
      }

      // Update history
      if (
        direction !== "previous" &&
        oldStep &&
        oldStep.id !== newCurrentStep.id
      ) {
        if (history[history.length - 1] !== oldStep.id) {
          history.push(String(oldStep.id));
        }
      }

      // Execute step activation logic
      try {
        if (newCurrentStep.onStepActive) {
          await newCurrentStep.onStepActive(context);
        }
        this.eventManager.notifyListeners(
          "stepActive",
          newCurrentStep,
          context,
        );
      } catch (error) {
        this.errorHandler.handleError(
          error,
          `onStepActive for ${newCurrentStep.id}`,
          context,
        );
      }
    } else {
      // Flow is completed
      this.stateManager.setCompleted(true);
      const finalContext = context;

      if (
        onFlowComplete &&
        direction !== "initial" &&
        (!oldStep || !evaluateStepId(oldStep.nextStep, finalContext))
      ) {
        try {
          await onFlowComplete(finalContext);
        } catch (error) {
          const processedError =
            error instanceof Error ? error : new Error(String(error));
          this.stateManager.setError(processedError);
          this.errorHandler.handleError(error, "onFlowComplete", context);
        }
      }

      this.eventManager.notifyListeners("flowComplete", finalContext);
      await this.persistenceManager.persistDataIfNeeded(
        context,
        null,
        this.stateManager.isHydrating,
      );
    }

    // Execute step change callback
    if (onStepChangeCallback) {
      try {
        onStepChangeCallback(newCurrentStep, oldStep, context);
      } catch (error) {
        this.errorHandler.handleError(error, "onStepChangeCallback", context);
      }
    }

    this.eventManager.notifyListeners(
      "stepChange",
      newCurrentStep,
      oldStep,
      context,
    );

    this.stateManager.setLoading(false);
    return newCurrentStep;
  }

  async next(
    currentStep: OnboardingStep<TContext> | null,
    stepSpecificData: any,
    context: TContext,
    history: string[],
    onStepChangeCallback?: (
      newStep: OnboardingStep<TContext> | null,
      oldStep: OnboardingStep<TContext> | null,
      context: TContext,
    ) => void,
    onFlowComplete?: (context: TContext) => Promise<void> | void,
  ): Promise<OnboardingStep<TContext> | null> {
    if (!currentStep || this.stateManager.isLoading) {
      return currentStep;
    }

    // Handle checklist completion check
    if (currentStep.type === "CHECKLIST") {
      if (
        !this.checklistManager.isChecklistStepComplete(
          currentStep as OnboardingStep<TContext> & {
            type: "CHECKLIST";
          },
          context,
        )
      ) {
        const error = new Error("Checklist criteria not met.");
        console.warn(
          `[NavigationManager] Cannot proceed from checklist step '${currentStep.id}': Not all completion criteria met.`,
        );
        this.stateManager.setError(error);
        this.eventManager.notifyListeners("error", error, context);
        return currentStep;
      }

      // Include checklist data in stepSpecificData
      const checklistPayload = currentStep.payload as ChecklistStepPayload;
      stepSpecificData = {
        ...stepSpecificData,
        [checklistPayload.dataKey]:
          context.flowData[checklistPayload.dataKey] || [],
      };
    }

    this.stateManager.setLoading(true);
    this.stateManager.setError(null);

    try {
      // Update context with step-specific data
      if (stepSpecificData && Object.keys(stepSpecificData).length > 0) {
        const newFlowData = {
          ...context.flowData,
          ...stepSpecificData,
        };
        if (JSON.stringify(context.flowData) !== JSON.stringify(newFlowData)) {
          context.flowData = newFlowData;
        }
      }

      // Execute step completion logic
      if (currentStep.onStepComplete) {
        await currentStep.onStepComplete(stepSpecificData || {}, context);
      }

      this.eventManager.notifyListeners(
        "stepComplete",
        currentStep,
        stepSpecificData || {},
        context,
      );

      // Mark step as completed
      const currentStepId = currentStep.id;
      context.flowData._internal = {
        ...context.flowData._internal,
        completedSteps: {
          ...(context.flowData._internal?.completedSteps || {}),
          [currentStepId]: Date.now(),
        },
      };

      // Determine next step
      let finalNextStepId: string | number | null | undefined;
      const definedNextStepTarget =
        currentStep.nextStep !== undefined
          ? evaluateStepId(currentStep.nextStep, context)
          : undefined;

      if (definedNextStepTarget === undefined) {
        const currentIndex = this.steps.findIndex(
          (s) => s.id === currentStep.id,
        );
        if (currentIndex !== -1 && currentIndex < this.steps.length - 1) {
          finalNextStepId = this.steps[currentIndex + 1].id;
          console.log(
            `[NavigationManager] next(): nextStep for '${currentStep.id}' was undefined, defaulting to next in array: '${finalNextStepId}'`,
          );
        } else {
          finalNextStepId = null;
          console.log(
            `[NavigationManager] next(): nextStep for '${currentStep.id}' was undefined, no next in array, completing.`,
          );
        }
      } else {
        finalNextStepId = definedNextStepTarget;
      }

      const newCurrentStep = await this.navigateToStep(
        finalNextStepId,
        "next",
        currentStep,
        context,
        history,
        onStepChangeCallback,
        onFlowComplete,
      );

      await this.persistenceManager.persistDataIfNeeded(
        context,
        newCurrentStep?.id || null,
        this.stateManager.isHydrating,
      );

      return newCurrentStep;
    } catch (error) {
      this.errorHandler.handleError(
        error,
        `next() for step ${currentStep.id}`,
        context,
      );
      this.stateManager.setLoading(false);
      return currentStep;
    }
  }

  async previous(
    currentStep: OnboardingStep<TContext> | null,
    context: TContext,
    history: string[],
    onStepChangeCallback?: (
      newStep: OnboardingStep<TContext> | null,
      oldStep: OnboardingStep<TContext> | null,
      context: TContext,
    ) => void,
    onFlowComplete?: (context: TContext) => Promise<void> | void,
  ): Promise<OnboardingStep<TContext> | null> {
    if (this.stateManager.isLoading) {
      return currentStep;
    }

    let prevStepId: string | number | null | undefined;

    if (currentStep && currentStep.previousStep) {
      prevStepId = evaluateStepId(currentStep.previousStep, context);
    } else if (history.length > 0) {
      prevStepId = history.pop();
    }

    if (prevStepId === undefined) {
      const currentIndex = this.steps.findIndex(
        (s) => s.id === currentStep?.id,
      );
      if (currentIndex > 0) {
        prevStepId = this.steps[currentIndex - 1].id;
      }
    }

    if (prevStepId) {
      return this.navigateToStep(
        prevStepId,
        "previous",
        currentStep,
        context,
        history,
        onStepChangeCallback,
        onFlowComplete,
      );
    }

    return currentStep;
  }

  async skip(
    currentStep: OnboardingStep<TContext> | null,
    context: TContext,
    history: string[],
    onStepChangeCallback?: (
      newStep: OnboardingStep<TContext> | null,
      oldStep: OnboardingStep<TContext> | null,
      context: TContext,
    ) => void,
    onFlowComplete?: (context: TContext) => Promise<void> | void,
  ): Promise<OnboardingStep<TContext> | null> {
    if (
      !currentStep ||
      !currentStep.isSkippable ||
      this.stateManager.isLoading
    ) {
      return currentStep;
    }

    let finalSkipTargetId: string | number | null | undefined;

    // Try skipToStep first
    let evaluatedSkipTarget =
      currentStep.skipToStep !== undefined
        ? evaluateStepId(currentStep.skipToStep, context)
        : undefined;

    if (evaluatedSkipTarget === undefined) {
      // Try nextStep
      evaluatedSkipTarget =
        currentStep.nextStep !== undefined
          ? evaluateStepId(currentStep.nextStep, context)
          : undefined;
    }

    if (evaluatedSkipTarget === undefined) {
      // Default to next step in array
      const currentIndex = this.steps.findIndex((s) => s.id === currentStep.id);
      if (currentIndex !== -1 && currentIndex < this.steps.length - 1) {
        finalSkipTargetId = this.steps[currentIndex + 1].id;
        console.log(
          `[NavigationManager] skip(): skipToStep/nextStep for '${currentStep.id}' was undefined, defaulting skip to next in array: '${finalSkipTargetId}'`,
        );
      } else {
        finalSkipTargetId = null;
        console.log(
          `[NavigationManager] skip(): skipToStep/nextStep for '${currentStep.id}' was undefined, no next in array, completing on skip.`,
        );
      }
    } else {
      finalSkipTargetId = evaluatedSkipTarget;
    }

    return await this.navigateToStep(
      finalSkipTargetId,
      "skip",
      currentStep,
      context,
      history,
      onStepChangeCallback,
      onFlowComplete,
    );
  }

  async goToStep(
    stepId: string,
    stepSpecificData: unknown,
    currentStep: OnboardingStep<TContext> | null,
    context: TContext,
    history: string[],
    onStepChangeCallback?: (
      newStep: OnboardingStep<TContext> | null,
      oldStep: OnboardingStep<TContext> | null,
      context: TContext,
    ) => void,
    onFlowComplete?: (context: TContext) => Promise<void> | void,
  ): Promise<OnboardingStep<TContext> | null> {
    if (this.stateManager.isLoading) {
      return currentStep;
    }

    if (stepSpecificData) {
      context.flowData = {
        ...context.flowData,
        ...stepSpecificData,
      };
    }

    return await this.navigateToStep(
      stepId,
      "goto",
      currentStep,
      context,
      history,
      onStepChangeCallback,
      onFlowComplete,
    );
  }
}
