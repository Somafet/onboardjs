// src/engine/EventHandlerRegistry.ts
import { OnboardingStep, OnboardingContext } from "../types";
import { EventManager } from "./EventManager";
import {
  UnsubscribeFunction,
  BeforeStepChangeListener,
  FlowCompleteListener,
  EventListenerMap,
} from "./types";

export class EventHandlerRegistry<TContext extends OnboardingContext> {
  constructor(private eventManager: EventManager<TContext>) {}

  /**
   * Unified method to register event listeners
   */
  public addEventListener<T extends keyof EventListenerMap<TContext>>(
    eventType: T,
    listener: EventListenerMap<TContext>[T],
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener(eventType, listener);
  }

  // Convenience methods for common event types
  public onStepChange(
    listener: (
      newStep: OnboardingStep<TContext> | null,
      oldStep: OnboardingStep<TContext> | null,
      context: TContext,
    ) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("stepChange", listener);
  }

  public onFlowComplete(
    listener: FlowCompleteListener<TContext>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("flowComplete", listener);
  }

  public onStepActive(
    listener: (
      step: OnboardingStep<TContext>,
      context: TContext,
    ) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("stepActive", listener);
  }

  public onStepComplete(
    listener: (
      step: OnboardingStep<TContext>,
      stepData: unknown,
      context: TContext,
    ) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("stepComplete", listener);
  }

  public onContextUpdate(
    listener: (
      oldContext: TContext,
      newContext: TContext,
    ) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("contextUpdate", listener);
  }

  public onError(
    listener: (error: Error, context: TContext) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("error", listener);
  }

  public onStateChange(
    listener: (state: any) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("stateChange", listener);
  }

  public onBeforeStepChange(
    listener: BeforeStepChangeListener<TContext>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("beforeStepChange", listener);
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
        const nextStep = this.findStepById(event.targetStepId);
        if (nextStep) {
          await listener(
            event.currentStep,
            nextStep,
            event.currentStep?.id as any,
          );
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

  // Helper method (would need to be injected or passed from engine)
  private findStepById(
    stepId: string | number | null | undefined,
  ): OnboardingStep<TContext> | undefined {
    // This would need to be provided by the engine or injected
    return undefined;
  }

  // Utility methods
  public removeAllListeners(): void {
    this.eventManager.clearAllListeners();
  }

  public getListenerCount(eventType: keyof EventListenerMap<TContext>): number {
    return this.eventManager.getListenerCount(eventType);
  }

  public hasListeners(eventType: keyof EventListenerMap<TContext>): boolean {
    return this.eventManager.getListenerCount(eventType) > 0;
  }
}
