// src/engine/EventHandlerRegistry.ts
import { OnboardingStep, OnboardingContext } from "../types";
import { EventManager } from "./EventManager";
import {
  UnsubscribeFunction,
  EventListenerMap,
  FlowCompletedEvent,
  StepChangeEvent,
  StepActiveEvent,
  StepCompletedEvent,
  ContextUpdateEvent,
  EngineState,
  ErrorEvent,
  BeforeStepChangeEvent,
  FlowStartedEvent,
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
    listener: (event: StepChangeEvent<TContext>) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("stepChange", listener);
  }

  public onFlowCompleted(
    listener: (event: FlowCompletedEvent<TContext>) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("flowCompleted", listener);
  }

  public onStepActive(
    listener: (event: StepActiveEvent<TContext>) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("stepActive", listener);
  }

  public onStepCompleted(
    listener: (event: StepCompletedEvent<TContext>) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("stepCompleted", listener);
  }

  public onContextUpdate(
    listener: (event: ContextUpdateEvent<TContext>) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("contextUpdate", listener);
  }

  public onError(
    listener: (event: ErrorEvent<TContext>) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("error", listener);
  }

  public onStateChange(
    listener: (event: { state: EngineState<TContext> }) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("stateChange", listener);
  }

  public onBeforeStepChange(
    listener: (event: BeforeStepChangeEvent<TContext>) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("beforeStepChange", listener);
  }

  // Flow-level events
  public onFlowStarted(
    listener: (event: FlowStartedEvent<TContext>) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("flowStarted", listener);
  }

  public onFlowPaused(
    listener: (event: any) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("flowPaused", listener);
  }

  public onFlowResumed(
    listener: (event: any) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("flowResumed", listener);
  }

  public onFlowAbandoned(
    listener: (event: any) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("flowAbandoned", listener);
  }

  public onFlowReset(
    listener: (event: any) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("flowReset", listener);
  }

  // Step-level events
  public onStepStarted(
    listener: (event: any) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("stepStarted", listener);
  }

  public onStepSkipped(
    listener: (event: any) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("stepSkipped", listener);
  }

  public onStepRetried(
    listener: (event: any) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("stepRetried", listener);
  }

  public onStepValidationFailed(
    listener: (event: any) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("stepValidationFailed", listener);
  }

  public onStepHelpRequested(
    listener: (event: any) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("stepHelpRequested", listener);
  }

  public onStepAbandoned(
    listener: (event: any) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("stepAbandoned", listener);
  }

  // Navigation events
  public onNavigationBack(
    listener: (event: any) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("navigationBack", listener);
  }

  public onNavigationForward(
    listener: (event: any) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("navigationForward", listener);
  }

  public onNavigationJump(
    listener: (event: any) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("navigationJump", listener);
  }

  // Interaction events
  public onUserIdle(
    listener: (event: any) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("userIdle", listener);
  }

  public onUserReturned(
    listener: (event: any) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("userReturned", listener);
  }

  public onDataChanged(
    listener: (event: any) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("dataChanged", listener);
  }

  // Performance events
  public onStepRenderTime(
    listener: (event: any) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("stepRenderTime", listener);
  }

  public onPersistenceSuccess(
    listener: (event: any) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("persistenceSuccess", listener);
  }

  public onPersistenceFailure(
    listener: (event: any) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("persistenceFailure", listener);
  }

  // Checklist events
  public onChecklistItemToggled(
    listener: (event: any) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("checklistItemToggled", listener);
  }

  public onChecklistProgressChanged(
    listener: (event: any) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener(
      "checklistProgressChanged",
      listener,
    );
  }

  // Plugin events
  public onPluginInstalled(
    listener: (event: any) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("pluginInstalled", listener);
  }

  public onPluginError(
    listener: (event: any) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventManager.addEventListener("pluginError", listener);
  }

  // Plugin compatibility methods
  public addBeforeStepChangeListener(
    listener: (event: BeforeStepChangeEvent<TContext>) => void | Promise<void>,
  ): UnsubscribeFunction {
    // Convert to BeforeStepChangeListener format
    const wrappedListener: (
      event: BeforeStepChangeEvent<TContext>,
    ) => void | Promise<void> = async (event) => {
      if (event.targetStepId) {
        const nextStep = this.findStepById(event.targetStepId);
        if (nextStep) {
          await listener(event);
        }
      }
    };

    return this.addEventListener("beforeStepChange", wrappedListener);
  }

  public addAfterStepChangeListener(
    listener: (event: StepChangeEvent<TContext>) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.addEventListener("stepChange", listener);
  }

  public addStepActiveListener(
    listener: (event: StepActiveEvent<TContext>) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.addEventListener("stepActive", listener);
  }

  public addStepCompletedListener(
    listener: (event: StepCompletedEvent<TContext>) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.addEventListener("stepCompleted", listener);
  }

  public addFlowCompletedListener(
    listener: (event: FlowCompletedEvent<TContext>) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.addEventListener("flowCompleted", listener);
  }

  public addContextUpdateListener(
    listener: (event: ContextUpdateEvent<TContext>) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.addEventListener("contextUpdate", listener);
  }

  public addErrorListener(
    listener: (event: ErrorEvent<TContext>) => void | Promise<void>,
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
