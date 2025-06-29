import { EventManager } from "../engine/EventManager";
import { OnboardingContext, OnboardingStep } from "../types";

export class ActivityTracker<TContext extends OnboardingContext> {
  private lastActivity = Date.now();
  private idleTimeout: NodeJS.Timeout | null = null;
  private isIdle = false;
  private readonly IDLE_THRESHOLD = 30000; // 30 seconds

  constructor(
    private eventManager: EventManager<TContext>,
    private getCurrentStep: () => OnboardingStep<TContext> | null,
    private getContext: () => TContext,
  ) {
    this.setupActivityListeners();
  }

  private setupActivityListeners(): void {
    if (typeof window !== "undefined") {
      ["mousedown", "mousemove", "keypress", "scroll", "touchstart"].forEach(
        (event) => {
          document.addEventListener(
            event,
            this.handleActivity.bind(this),
            true,
          );
        },
      );
    }
  }

  private handleActivity(): void {
    const now = Date.now();
    const wasIdle = this.isIdle;

    if (wasIdle) {
      const awayDuration = now - this.lastActivity;
      const currentStep = this.getCurrentStep();
      if (currentStep) {
        this.eventManager.notifyListeners(
          "userReturned",
          currentStep,
          this.getContext(),
          awayDuration,
        );
      }
      this.isIdle = false;
    }

    this.lastActivity = now;
    this.resetIdleTimer();
  }

  private resetIdleTimer(): void {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
    }

    this.idleTimeout = setTimeout(() => {
      const currentStep = this.getCurrentStep();
      if (currentStep && !this.isIdle) {
        const idleDuration = Date.now() - this.lastActivity;
        this.eventManager.notifyListeners(
          "userIdle",
          currentStep,
          this.getContext(),
          idleDuration,
        );
        this.isIdle = true;
      }
    }, this.IDLE_THRESHOLD);
  }

  cleanup(): void {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
    }

    if (typeof window !== "undefined") {
      ["mousedown", "mousemove", "keypress", "scroll", "touchstart"].forEach(
        (event) => {
          document.removeEventListener(
            event,
            this.handleActivity.bind(this),
            true,
          );
        },
      );
    }
  }
}
