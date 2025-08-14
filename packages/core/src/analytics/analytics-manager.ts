// src/engine/analytics/AnalyticsManager.ts
import { Logger } from "../services/Logger";
import { OnboardingContext, OnboardingStep } from "../types";
import {
  AnalyticsEvent,
  AnalyticsProvider,
  AnalyticsConfig,
  AnalyticsEventPayload,
} from "./types";

export class AnalyticsManager<TContext extends OnboardingContext = OnboardingContext> {
  private providers: AnalyticsProvider[] = [];
  private config: AnalyticsConfig;
  private sessionId: string;
  private logger: Logger;
  private flowInfo: {
    flowId?: string;
    flowName?: string;
    flowVersion?: string;
    flowMetadata?: Record<string, unknown>;
    instanceId?: number;
  } = {};
  private progressMilestones = new Set<number>();
  private stepStartTimes = new Map<string | number, number>();
  private userActivityState: {
    isIdle: boolean;
    lastActivityTime: number;
    awayDuration: number;
  } = {
    isIdle: false,
    lastActivityTime: Date.now(),
    awayDuration: 0,
  };
  private performanceMetrics: {
    stepRenderTimes: Map<string | number, number>;
    navigationTimes: Map<string, number>;
    memoryUsage?: number;
  } = {
    stepRenderTimes: new Map(),
    navigationTimes: new Map(),
  };

  constructor(config: AnalyticsConfig = {}, logger?: Logger) {
    this.config = {
      enabled: true,
      samplingRate: 1.0,
      autoTrack: true,
      enableProgressMilestones: true,
      enablePerformanceTracking: true,
      enableChurnDetection: true,
      milestonePercentages: [25, 50, 75, 100],
      performanceThresholds: {
        slowStepMs: 3000,
        slowRenderMs: 2000,
      },
      ...config,
    };

    this.sessionId =
      config.sessionId || `session_${Math.random().toString(36).slice(2)}`;
    this.logger =
      logger ||
      new Logger({ debugMode: config.debug, prefix: "AnalyticsManager" });

    if (config.providers) {
      this.providers.push(...config.providers);
    }
  }

  registerProvider(provider: AnalyticsProvider): void {
    this.providers.push(provider);
    this.logger.debug(`Registered analytics provider: ${provider.name}`);
  }

  get providerCount(): number {
    return this.providers.length;
  }

  trackEvent(eventType: string, properties: Record<string, any> = {}): void {
    // Create a mutable copy of the properties object to add new data
    const augmentedProperties: AnalyticsEventPayload = {
      ...properties,
      // Add flow identification to all events
      ...this.flowInfo,
    };

    // Capture the URL if in a browser environment (client-side)
    // and add it to the event's properties.
    if (
      typeof window !== "undefined" &&
      window.location &&
      window.location.href
    ) {
      augmentedProperties.pageUrl = window.location.href;
    }

    // Add session and performance data
    this.enrichEventWithSessionData(augmentedProperties);
    this.enrichEventWithPerformanceData(augmentedProperties);

    // 1. Construct the full event object
    const event: AnalyticsEvent = {
      type: eventType,
      timestamp: Date.now(),
      properties: augmentedProperties,
      sessionId: this.sessionId,
      userId: this.config.userId, // Use userId from config
      flowId: this.config.flowId || this.flowInfo.flowId, // Use flowId from config or flowInfo
      flowName: this.flowInfo.flowName,
      flowVersion: this.flowInfo.flowVersion,
      instanceId: this.flowInfo.instanceId,
    };

    // 2. Log the event if debug mode is enabled
    this.logger.debug(`[AnalyticsManager] Event: "${eventType}"`, event);

    // 3. Check if analytics is enabled and if there are any providers to send to
    if (!this.config.enabled || this.providers.length === 0) {
      return; // If not enabled or no providers, stop here
    }

    // 4. Apply sampling *before* dispatching to providers
    if (
      this.config.samplingRate !== undefined &&
      this.config.samplingRate < 1.0 &&
      Math.random() > this.config.samplingRate
    ) {
      this.logger.debug(
        `[AnalyticsManager] Event "${eventType}" skipped due to sampling.`,
      );
      return;
    }

    // 5. Dispatch to all registered providers
    for (const provider of this.providers) {
      try {
        provider.trackEvent(event);
      } catch (error) {
        this.logger.error(
          `[AnalyticsManager] Error in analytics provider "${provider.name}":`,
          error,
        );
      }
    }
  }

  trackStepViewed(step: OnboardingStep<TContext>, context: TContext): void {
    this.stepStartTimes.set(step.id, Date.now());

    this.trackEvent("step_viewed", {
      stepId: step.id,
      stepType: step.type,
      stepIndex: this.getStepIndex(step, context),
      isFirstStep: this.isFirstStep(step, context),
      isLastStep: this.isLastStep(step, context),
      flowProgressPercentage: this.calculateFlowProgress(context),
      previousStepId: this.getPreviousStepId(context),
      hasCondition: !!step.condition,
      isSkippable: !!step.isSkippable,
      hasValidation: this.hasValidation(step),
      payloadKeys: Object.keys(step.payload || {}),
      payloadSize: JSON.stringify(step.payload || {}).length,
    });

    // Check progress milestones
    if (this.config.enableProgressMilestones) {
      this.checkProgressMilestones(context);
    }
  }

  trackStepCompleted(
    step: OnboardingStep<TContext>,
    context: TContext,
    duration: number,
    stepData?: Record<string, any>,
  ): void {
    const stepStartTime = this.stepStartTimes.get(step.id);
    const actualDuration = stepStartTime
      ? Date.now() - stepStartTime
      : duration;

    this.trackEvent("step_completed", {
      stepId: step.id,
      stepType: step.type,
      duration: actualDuration,
      stepData: this.sanitizeStepData(stepData || {}),
      flowProgressPercentage: this.calculateFlowProgress(context),
      completionMethod: this.getCompletionMethod(stepData),
      timeOnStep: actualDuration,
      stepIndex: this.getStepIndex(step, context),
    });

    // Track slow steps if performance tracking is enabled
    if (
      this.config.enablePerformanceTracking &&
      actualDuration > (this.config.performanceThresholds?.slowStepMs || 3000)
    ) {
      this.trackSlowStep(step, context, actualDuration);
    }

    this.stepStartTimes.delete(step.id);
  }

  trackFlowStarted(
    context: TContext,
    startMethod: "fresh" | "resumed" = "fresh",
  ): void {
    this.trackEvent("flow_started", {
      startMethod,
      isResumed: startMethod === "resumed",
      totalSteps: this.getTotalSteps(context),
      flowStartTime: Date.now(),
      initialFlowDataSize: JSON.stringify(context.flowData).length,
      flowData: this.sanitizeContext(context),
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      screenResolution:
        typeof screen !== "undefined"
          ? `${screen.width}x${screen.height}`
          : undefined,
      viewportSize:
        typeof window !== "undefined"
          ? `${window.innerWidth}x${window.innerHeight}`
          : undefined,
    });
  }

  trackFlowCompleted(context: TContext): void {
    const duration = this.getFlowCompletionTime(context);
    const completedStepsCount = this.getCompletedStepsCount(context);
    const totalSteps = this.getTotalSteps(context);

    this.trackEvent("flow_completed", {
      duration,
      totalSteps,
      completedSteps: completedStepsCount,
      skippedSteps: totalSteps - completedStepsCount,
      completionRate:
        totalSteps > 0
          ? Math.round((completedStepsCount / totalSteps) * 100)
          : 0,
      finalFlowDataSize: JSON.stringify(context.flowData).length,
      flowData: this.sanitizeContext(context),
    });

    // Clean up tracking data
    this.progressMilestones.clear();
    this.stepStartTimes.clear();
  }

  trackFlowPaused(context: TContext, reason: string = "user_action"): void {
    this.trackEvent("flow_paused", {
      reason,
      currentStepId: this.getCurrentStepId(context),
      flowProgressPercentage: this.calculateFlowProgress(context),
      timeInFlow: this.getFlowCompletionTime(context),
    });
  }

  trackFlowResumed(context: TContext, resumePoint: string): void {
    this.trackEvent("flow_resumed", {
      resumePoint,
      currentStepId: this.getCurrentStepId(context),
      flowProgressPercentage: this.calculateFlowProgress(context),
      timeAwayFromFlow: this.userActivityState.awayDuration,
    });
  }

  trackFlowAbandoned(
    context: TContext,
    abandonmentReason: string = "unknown",
  ): void {
    this.trackEvent("flow_abandoned", {
      abandonmentReason,
      currentStepId: this.getCurrentStepId(context),
      flowProgressPercentage: this.calculateFlowProgress(context),
      timeInFlow: this.getFlowCompletionTime(context),
      completedSteps: this.getCompletedStepsCount(context),
      totalSteps: this.getTotalSteps(context),
    });
  }

  trackFlowReset(context: TContext, resetReason: string = "user_action"): void {
    this.trackEvent("flow_reset", {
      resetReason,
      previousProgress: this.calculateFlowProgress(context),
      completedStepsBeforeReset: this.getCompletedStepsCount(context),
    });

    // Clear tracking state
    this.progressMilestones.clear();
    this.stepStartTimes.clear();
  }

  async flush(): Promise<void> {
    for (const provider of this.providers) {
      if (provider.flush) {
        try {
          await provider.flush();
        } catch (error) {
          this.logger.error(`Error flushing provider ${provider.name}:`, error);
        }
      }
    }
  }

  setUserId(userId: string): void {
    this.config.userId = userId;
  }

  setFlowId(flowId: string): void {
    this.config.flowId = flowId;
    this.flowInfo.flowId = flowId;
  }

  setFlowInfo(flowInfo: {
    flowId?: string;
    flowName?: string;
    flowVersion?: string;
    flowMetadata?: Record<string, unknown>;
    instanceId?: number;
  }): void {
    this.flowInfo = { ...this.flowInfo, ...flowInfo };
    if (flowInfo.flowId) {
      this.config.flowId = flowInfo.flowId;
    }
  }

  // New comprehensive event tracking methods
  trackStepSkipped(
    step: OnboardingStep<TContext>,
    context: TContext,
    skipReason: string = "user_action",
  ): void {
    this.trackEvent("step_skipped", {
      stepId: step.id,
      stepType: step.type,
      skipReason,
      stepIndex: this.getStepIndex(step, context),
      flowProgressPercentage: this.calculateFlowProgress(context),
      timeOnStep: this.getTimeOnStep(step.id),
    });
  }

  trackStepRetried(
    step: OnboardingStep<TContext>,
    context: TContext,
    retryCount: number,
  ): void {
    this.trackEvent("step_retried", {
      stepId: step.id,
      stepType: step.type,
      retryCount,
      stepIndex: this.getStepIndex(step, context),
      previousAttempts: retryCount - 1,
    });
  }

  trackStepValidationFailed(
    step: OnboardingStep<TContext>,
    context: TContext,
    validationErrors: string[],
  ): void {
    this.trackEvent("step_validation_failed", {
      stepId: step.id,
      stepType: step.type,
      validationErrors,
      errorCount: validationErrors.length,
      stepIndex: this.getStepIndex(step, context),
    });
  }

  trackStepHelpRequested(
    step: OnboardingStep<TContext>,
    context: TContext,
    helpType: string = "general",
  ): void {
    this.trackEvent("step_help_requested", {
      stepId: step.id,
      stepType: step.type,
      helpType,
      stepIndex: this.getStepIndex(step, context),
      timeOnStep: this.getTimeOnStep(step.id),
    });
  }

  trackStepAbandoned(
    step: OnboardingStep<TContext>,
    context: TContext,
    timeOnStep: number,
  ): void {
    this.trackEvent("step_abandoned", {
      stepId: step.id,
      stepType: step.type,
      timeOnStep,
      stepIndex: this.getStepIndex(step, context),
      flowProgressPercentage: this.calculateFlowProgress(context),
      churnRiskScore: this.calculateChurnRisk(step, context, timeOnStep),
    });
  }

  trackNavigationBack(
    fromStep: OnboardingStep<TContext>,
    toStep: OnboardingStep<TContext>,
    context: TContext,
  ): void {
    this.trackEvent("navigation_back", {
      fromStepId: fromStep.id,
      toStepId: toStep.id,
      fromStepType: fromStep.type,
      toStepType: toStep.type,
      fromStepIndex: this.getStepIndex(fromStep, context),
      toStepIndex: this.getStepIndex(toStep, context),
      navigationDistance:
        this.getStepIndex(fromStep, context) -
        this.getStepIndex(toStep, context),
    });
  }

  trackNavigationForward(
    fromStep: OnboardingStep<TContext>,
    toStep: OnboardingStep<TContext>,
    context: TContext,
  ): void {
    this.trackEvent("navigation_forward", {
      fromStepId: fromStep.id,
      toStepId: toStep.id,
      fromStepType: fromStep.type,
      toStepType: toStep.type,
      fromStepIndex: this.getStepIndex(fromStep, context),
      toStepIndex: this.getStepIndex(toStep, context),
      navigationDistance:
        this.getStepIndex(toStep, context) -
        this.getStepIndex(fromStep, context),
    });
  }

  trackNavigationJump(
    fromStep: OnboardingStep<TContext>,
    toStep: OnboardingStep<TContext>,
    context: TContext,
  ): void {
    const distance = Math.abs(
      this.getStepIndex(toStep, context) - this.getStepIndex(fromStep, context),
    );
    this.trackEvent("navigation_jump", {
      fromStepId: fromStep.id,
      toStepId: toStep.id,
      fromStepType: fromStep.type,
      toStepType: toStep.type,
      fromStepIndex: this.getStepIndex(fromStep, context),
      toStepIndex: this.getStepIndex(toStep, context),
      navigationDistance: distance,
      isForwardJump:
        this.getStepIndex(toStep, context) >
        this.getStepIndex(fromStep, context),
    });
  }

  trackDataChanged(
    context: TContext,
    changedFields: string[],
    oldData: any,
    newData: any,
  ): void {
    this.trackEvent("data_changed", {
      changedFields,
      changedFieldCount: changedFields.length,
      dataSizeBefore: JSON.stringify(oldData).length,
      dataSizeAfter: JSON.stringify(newData).length,
      currentStepId: this.getCurrentStepId(context),
      flowProgressPercentage: this.calculateFlowProgress(context),
    });
  }

  trackUserIdle(
    step: OnboardingStep<TContext>,
    context: TContext,
    idleDuration: number,
  ): void {
    this.userActivityState.isIdle = true;
    this.userActivityState.awayDuration = idleDuration;

    this.trackEvent("user_idle", {
      stepId: step.id,
      stepType: step.type,
      idleDuration,
      stepIndex: this.getStepIndex(step, context),
      timeOnStep: this.getTimeOnStep(step.id),
    });
  }

  trackUserReturned(
    step: OnboardingStep<TContext>,
    context: TContext,
    awayDuration: number,
  ): void {
    this.userActivityState.isIdle = false;
    this.userActivityState.lastActivityTime = Date.now();

    this.trackEvent("user_returned", {
      stepId: step.id,
      stepType: step.type,
      awayDuration,
      stepIndex: this.getStepIndex(step, context),
      timeOnStep: this.getTimeOnStep(step.id),
    });
  }

  trackStepRenderTime(
    step: OnboardingStep<TContext>,
    context: TContext,
    renderTime: number,
  ): void {
    this.performanceMetrics.stepRenderTimes.set(step.id, renderTime);

    this.trackEvent("step_render_time", {
      stepId: step.id,
      stepType: step.type,
      renderTime,
      stepIndex: this.getStepIndex(step, context),
      isSlowRender:
        renderTime > (this.config.performanceThresholds?.slowRenderMs || 2000),
    });
  }

  trackPersistenceSuccess(context: TContext, persistenceTime: number): void {
    this.trackEvent("persistence_success", {
      persistenceTime,
      dataPersisted: JSON.stringify(context.flowData).length,
      currentStepId: this.getCurrentStepId(context),
      flowProgressPercentage: this.calculateFlowProgress(context),
    });
  }

  trackPersistenceFailure(context: TContext, error: Error): void {
    this.trackEvent("persistence_failure", {
      errorMessage: error.message,
      errorName: error.name,
      currentStepId: this.getCurrentStepId(context),
      flowProgressPercentage: this.calculateFlowProgress(context),
    });
  }

  trackChecklistItemToggled(
    itemId: string,
    isCompleted: boolean,
    step: OnboardingStep<TContext>,
    context: TContext,
  ): void {
    this.trackEvent("checklist_item_toggled", {
      itemId,
      isCompleted,
      stepId: step.id,
      stepType: step.type,
      stepIndex: this.getStepIndex(step, context),
    });
  }

  trackChecklistProgressChanged(
    step: OnboardingStep<TContext>,
    context: TContext,
    progress: {
      completed: number;
      total: number;
      percentage: number;
      isComplete: boolean;
    },
  ): void {
    this.trackEvent("checklist_progress_changed", {
      stepId: step.id,
      stepType: step.type,
      ...progress,
      stepIndex: this.getStepIndex(step, context),
    });
  }

  trackErrorEncountered(
    error: Error,
    context: TContext,
    stepId?: string | number,
  ): void {
    this.trackEvent("error_encountered", {
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name,
      currentStepId: stepId || this.getCurrentStepId(context),
      flowProgressPercentage: this.calculateFlowProgress(context),
    });
  }

  trackProgressMilestone(context: TContext, milestone: number): void {
    this.trackEvent("progress_milestone", {
      milestonePercentage: milestone,
      actualProgress: this.calculateFlowProgress(context),
      stepsCompleted: this.getCompletedStepsCount(context),
      totalSteps: this.getTotalSteps(context),
      timeToMilestone: this.getFlowCompletionTime(context),
    });
  }

  trackSlowStep(
    step: OnboardingStep<TContext>,
    context: TContext,
    duration: number,
  ): void {
    this.trackEvent("step_slow", {
      stepId: step.id,
      stepType: step.type,
      duration,
      threshold: this.config.performanceThresholds?.slowStepMs || 3000,
      stepIndex: this.getStepIndex(step, context),
    });
  }

  // Utility to prevent sensitive data from being sent to analytics
  private sanitizeContext(context: TContext): Record<string, any> {
    // Create a clean version of the context for analytics that removes sensitive data
    const sanitized = { ...context };

    // Remove potentially sensitive fields
    delete sanitized.currentUser;
    delete sanitized.apiKeys;
    delete sanitized.tokens;

    return sanitized;
  }

  private getFlowCompletionTime(context: TContext): number {
    const startTime = context.flowData._internal?.startedAt;
    return startTime ? Date.now() - startTime : 0;
  }

  // Enhanced helper methods for detailed analytics
  private enrichEventWithSessionData(properties: AnalyticsEventPayload): void {
    if (typeof window !== "undefined") {
      properties.sessionData = {
        userAgent: navigator.userAgent,
        screenResolution: `${screen.width}x${screen.height}`,
        viewportSize: `${window.innerWidth}x${window.innerHeight}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        platform: navigator.platform,
      };
    }
  }

  private enrichEventWithPerformanceData(
    properties: AnalyticsEventPayload,
  ): void {
    if (this.config.enablePerformanceTracking) {
      properties.performanceMetrics = {
        memoryUsage: this.getMemoryUsage(),
        connectionType: this.getConnectionType(),
        renderTimeHistory: Array.from(
          this.performanceMetrics.stepRenderTimes.values(),
        ),
      };
    }
  }

  private getStepIndex(
    step: OnboardingStep<TContext>,
    context: TContext,
  ): number {
    // This should be implemented by accessing the engine's step list
    // For now, return a placeholder - in a real implementation, you'd need
    // access to the engine's step list to determine the index
    return 0; // Placeholder
  }

  private isFirstStep(
    step: OnboardingStep<TContext>,
    context: TContext,
  ): boolean {
    return this.getStepIndex(step, context) === 0;
  }

  private isLastStep(
    step: OnboardingStep<TContext>,
    context: TContext,
  ): boolean {
    return this.getStepIndex(step, context) === this.getTotalSteps(context) - 1;
  }

  private calculateFlowProgress(context: TContext): number {
    const totalSteps = this.getTotalSteps(context);
    const completedSteps = this.getCompletedStepsCount(context);
    return totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  }

  private getTotalSteps(context: TContext): number {
    // This should be implemented by accessing the engine's step list
    // For now, return a placeholder
    return (
      Object.keys(context.flowData._internal?.completedSteps || {}).length || 1
    );
  }

  private getCompletedStepsCount(context: TContext): number {
    return Object.keys(context.flowData._internal?.completedSteps || {}).length;
  }

  private getPreviousStepId(context: TContext): string | undefined {
    // This should be implemented by accessing the engine's navigation history
    return undefined; // Placeholder
  }

  private getCurrentStepId(context: TContext): string | undefined {
    // This should be implemented by accessing the engine's current step
    return undefined; // Placeholder
  }

  private getCompletionMethod(stepData: any): string {
    // Determine how the step was completed based on the step data
    if (stepData?.completionMethod) return stepData.completionMethod;
    if (stepData?.buttonClicked) return "button_click";
    if (stepData?.formSubmitted) return "form_submit";
    if (stepData?.keyPressed) return "keyboard";
    return "unknown";
  }

  private hasValidation(step: OnboardingStep<TContext>): boolean {
    // Check if step has validation logic
    return !!(
      step.payload &&
      (step.payload.validation ||
        step.payload.required ||
        step.payload.minSelections ||
        step.payload.maxSelections)
    );
  }

  private sanitizeStepData(stepData: Record<string, any>): Record<string, any> {
    // Remove sensitive data from step data
    const sanitized = { ...stepData };
    const sensitiveKeys = [
      "password",
      "token",
      "apiKey",
      "secret",
      "creditCard",
    ];

    sensitiveKeys.forEach((key) => {
      if (sanitized[key]) {
        sanitized[key] = "[REDACTED]";
      }
    });

    return sanitized;
  }

  private getTimeOnStep(stepId: string | number): number {
    const startTime = this.stepStartTimes.get(stepId);
    return startTime ? Date.now() - startTime : 0;
  }

  private calculateChurnRisk(
    step: OnboardingStep<TContext>,
    context: TContext,
    timeOnStep: number,
  ): number {
    // Simple churn risk calculation based on time on step and progress
    const progress = this.calculateFlowProgress(context);
    const normalizedTime = Math.min(timeOnStep / 60000, 10); // Normalize to 0-10 minutes
    const progressFactor = Math.max(0, 1 - progress / 100); // Higher risk for less progress

    return Math.min(1, normalizedTime * 0.1 + progressFactor * 0.9);
  }

  private checkProgressMilestones(context: TContext): void {
    const progress = this.calculateFlowProgress(context);
    const milestones = this.config.milestonePercentages || [25, 50, 75, 100];

    milestones.forEach((milestone: number) => {
      if (progress >= milestone && !this.progressMilestones.has(milestone)) {
        this.progressMilestones.add(milestone);
        this.trackProgressMilestone(context, milestone);
      }
    });
  }

  private getMemoryUsage(): number | undefined {
    if (typeof performance !== "undefined" && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return undefined;
  }

  private getConnectionType(): string | undefined {
    if (typeof navigator !== "undefined" && "connection" in navigator) {
      const connection = (navigator as any).connection;
      return connection?.effectiveType || connection?.type;
    }
    return undefined;
  }
}
