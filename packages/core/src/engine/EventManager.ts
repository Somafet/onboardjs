import { OnboardingContext } from "../types";
import { EventListenerMap, UnsubscribeFunction } from "./types";

/**
 * Unified event listener handler with consistent error management
 */
export class EventManager<
  TContext extends OnboardingContext = OnboardingContext,
> {
  private listeners: Map<keyof EventListenerMap<TContext>, Set<any>> =
    new Map();

  constructor() {
    // Initialize listener sets for each event type
    const eventTypes: (keyof EventListenerMap<TContext>)[] = [
      "stateChange",
      "beforeStepChange",
      "stepChange",
      "flowCompleted",
      "stepActive",
      "stepCompleted",
      "contextUpdate",
      "error",

      // Flow-level
      "flowStarted",
      "flowPaused",
      "flowResumed",
      "flowAbandoned",
      "flowReset",

      // Step-level
      "stepSkipped",
      "stepRetried",
      "stepValidationFailed",
      "stepHelpRequested",
      "stepAbandoned",

      // Navigation
      "navigationBack",
      "navigationForward",
      "navigationJump",

      // Interaction
      "userIdle",
      "userReturned",
      "dataChanged",

      // Performance
      "stepRenderTime",
      "persistenceSuccess",
      "persistenceFailure",

      // Checklist
      "checklistItemToggled",
      "checklistProgressChanged",

      // Plugin
      "pluginInstalled",
      "pluginError",
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
    listener: EventListenerMap<TContext>[T],
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
              eventType === "flowCompleted"
                ? "async onFlowHasCompleted"
                : this.getLegacyEventName(eventType);
            console.error(`Error in ${legacyEventName} listener:`, err);
          });
        }
      } catch (err) {
        // Use legacy error message format for backward compatibility
        const legacyEventName =
          eventType === "flowCompleted"
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
    eventType: T,
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
      case "stepCompleted":
        return "stepCompleted";
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
          err,
        );
        throw err; // Re-throw for beforeStepChange cancellation logic
      }
    }
  }

  /**
   * Get the number of listeners for an event type
   */
  getListenerCount<T extends keyof EventListenerMap<TContext>>(
    eventType: T,
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
