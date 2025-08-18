import { OnboardingStep, OnboardingContext } from "@onboardjs/core";
import { ChurnRiskFactors } from "../types";

export class ChurnDetectionManager<TContext extends OnboardingContext> {
  private stepStartTimes = new Map<string, number>();
  private churnTimeouts = new Map<string, NodeJS.Timeout>();
  private userActivity = new Map<
    string,
    {
      backNavigationCount: number;
      errorCount: number;
      validationFailures: number;
      lastActivity: number;
    }
  >();

  constructor(
    private churnTimeoutMs: number = 300000, // 5 minutes
    private churnRiskThreshold: number = 0.7,
  ) {}

  startStepTimer(stepId: string | number): void {
    this.stepStartTimes.set(stepId.toString(), Date.now());
  }

  setupChurnTimeout(
    step: OnboardingStep<TContext>,
    context: TContext,
    onChurnDetected: (
      step: OnboardingStep<TContext>,
      context: TContext,
      riskFactors: ChurnRiskFactors,
    ) => void,
  ): void {
    const stepKey = step.id.toString();

    // Clear existing timeout
    this.clearChurnTimeout(stepKey);

    const timeout = setTimeout(() => {
      const riskFactors = this.calculateChurnRiskFactors(step, context);
      onChurnDetected(step, context, riskFactors);
    }, this.churnTimeoutMs);

    this.churnTimeouts.set(stepKey, timeout);
  }

  clearChurnTimeout(stepId: string): void {
    const timeout = this.churnTimeouts.get(stepId);
    if (timeout) {
      clearTimeout(timeout);
      this.churnTimeouts.delete(stepId);
    }
  }

  recordBackNavigation(userId: string): void {
    const activity = this.getUserActivity(userId);
    activity.backNavigationCount++;
    activity.lastActivity = Date.now();
  }

  recordError(userId: string): void {
    const activity = this.getUserActivity(userId);
    activity.errorCount++;
    activity.lastActivity = Date.now();
  }

  recordValidationFailure(userId: string): void {
    const activity = this.getUserActivity(userId);
    activity.validationFailures++;
    activity.lastActivity = Date.now();
  }

  calculateChurnRisk(
    step: OnboardingStep<TContext>,
    context: TContext,
  ): number {
    const riskFactors = this.calculateChurnRiskFactors(step, context);

    // Weighted risk calculation
    const timeWeight = 0.3;
    const navigationWeight = 0.2;
    const errorWeight = 0.3;
    const idleWeight = 0.2;

    const timeRisk = Math.min(riskFactors.timeOnStep / this.churnTimeoutMs, 1);
    const navigationRisk = Math.min(riskFactors.backNavigationCount / 5, 1);
    const errorRisk = Math.min(riskFactors.errorCount / 3, 1);
    const idleRisk = Math.min(riskFactors.idleTime / 60000, 1); // 1 minute idle = max risk

    return (
      timeRisk * timeWeight +
      navigationRisk * navigationWeight +
      errorRisk * errorWeight +
      idleRisk * idleWeight
    );
  }

  /**
   * Checks if a step is considered high churn risk.
   * @param step The onboarding step to evaluate.
   * @param context The onboarding context.
   * @returns True if the step is high churn risk, false otherwise.
   */
  isHighChurnRisk(step: OnboardingStep<TContext>, context: TContext): boolean {
    const riskScore = this.calculateChurnRisk(step, context);
    return riskScore >= this.churnRiskThreshold;
  }

  // Method to get the threshold
  getChurnRiskThreshold(): number {
    return this.churnRiskThreshold;
  }

  // Method to update threshold dynamically
  setChurnRiskThreshold(threshold: number): void {
    this.churnRiskThreshold = Math.max(0, Math.min(1, threshold)); // Clamp between 0 and 1
  }

  private calculateChurnRiskFactors(
    step: OnboardingStep<TContext>,
    context: TContext,
  ): ChurnRiskFactors {
    const stepKey = step.id.toString();
    const userId = context.currentUser?.id || "anonymous";
    const startTime = this.stepStartTimes.get(stepKey) || Date.now();
    const activity = this.getUserActivity(userId);

    return {
      timeOnStep: Date.now() - startTime,
      backNavigationCount: activity.backNavigationCount,
      errorCount: activity.errorCount,
      idleTime: Date.now() - activity.lastActivity,
      validationFailures: activity.validationFailures,
    };
  }

  private getUserActivity(userId: string) {
    if (!this.userActivity.has(userId)) {
      this.userActivity.set(userId, {
        backNavigationCount: 0,
        errorCount: 0,
        validationFailures: 0,
        lastActivity: Date.now(),
      });
    }
    return this.userActivity.get(userId)!;
  }

  cleanup(): void {
    // Clear all timeouts
    this.churnTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.churnTimeouts.clear();
    this.stepStartTimes.clear();
    this.userActivity.clear();
  }
}
