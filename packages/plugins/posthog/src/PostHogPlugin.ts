import {
  BasePlugin,
  OnboardingStep,
  OnboardingContext,
  PluginHooks,
  StepActiveEvent,
  StepChangeEvent,
  FlowCompletedEvent,
  ContextUpdateEvent,
  ErrorEvent,
  StepCompletedEvent,
  FlowStartedEvent,
} from "@onboardjs/core";
import { PostHog } from "posthog-js";
import { EventNameMapping, PostHogPluginConfig } from "./types";
import { EventDataBuilder } from "./utils/eventBuilder";
import { ChurnDetectionManager } from "./utils/churnDetection";
import { PerformanceTracker } from "./utils/performanceMetrics";

export class PostHogPlugin<
  TContext extends OnboardingContext,
> extends BasePlugin<TContext, PostHogPluginConfig> {
  readonly name = "@onboardjs/plugin-posthog";
  readonly version = "1.0.0";
  readonly description = "Official PostHog analytics plugin for OnboardJS";

  private posthog!: PostHog;
  private eventBuilder!: EventDataBuilder<TContext>;
  private churnDetection!: ChurnDetectionManager<TContext>;
  private performanceTracker!: PerformanceTracker;
  private progressMilestones = new Set<number>();

  private readonly defaultEventNames: EventNameMapping = {
    // Flow events
    flowStarted: "flow_started",
    flowCompleted: "flow_completed",
    flowAbandoned: "flow_abandoned",
    flowPaused: "flow_paused",
    flowResumed: "flow_resumed",
    flowReset: "flow_reset",

    // Step events
    stepActive: "step_active",
    stepCompleted: "step_completed",
    stepSkipped: "step_skipped",
    stepAbandoned: "step_abandoned",
    stepRetried: "step_retried",
    stepValidationFailed: "step_validation_failed",
    stepHelpRequested: "step_help_requested",

    // Navigation events
    navigationBack: "navigation_back",
    navigationForward: "navigation_forward",
    navigationJump: "navigation_jump",

    // Interaction events
    userIdle: "user_idle",
    userReturned: "user_returned",
    dataChanged: "data_changed",

    // Progress events
    progressMilestone: "progress_milestone",
    highChurnRisk: "high_churn_risk",

    // Performance events
    stepRenderSlow: "step_render_slow",
    persistenceSuccess: "persistence_success",
    persistenceFailure: "persistence_failure",

    // Checklist events
    checklistItemToggled: "checklist_item_toggled",
    checklistProgress: "checklist_progress",

    // Experiment events
    experimentExposed: "experiment_exposed",

    // Error events
    errorEncountered: "error_encountered",
    pluginError: "plugin_error",
  };

  protected async onInstall(): Promise<void> {
    // Initialize PostHog
    this.initializePostHog();

    // Initialize utilities
    this.eventBuilder = new EventDataBuilder(this.config);
    this.churnDetection = new ChurnDetectionManager(
      this.config.churnTimeoutMs,
      this.config.churnRiskThreshold,
    );
    this.performanceTracker = new PerformanceTracker();

    // Log installation
    if (this.config.debug) {
      console.log("[PostHogPlugin] Plugin installed successfully");
    }
  }

  protected async onUninstall(): Promise<void> {
    this.churnDetection.cleanup();
    this.performanceTracker.cleanup();
    this.progressMilestones.clear();

    if (this.config.debug) {
      console.log("[PostHogPlugin] Plugin uninstalled");
    }
  }

  protected getHooks(): PluginHooks<TContext> {
    return {
      // Flow-level events
      onFlowStarted: this.handleFlowStarted.bind(this),
      onFlowCompleted: this.handleFlowCompleted.bind(this),
      onFlowPaused: this.handleFlowPaused.bind(this),
      onFlowResumed: this.handleFlowResumed.bind(this),
      onFlowAbandoned: this.handleFlowAbandoned.bind(this),
      onFlowReset: this.handleFlowReset.bind(this),

      // Step-level events
      onStepActive: this.handleStepActive.bind(this),
      onStepCompleted: this.handleStepCompleted.bind(this),
      onStepStarted: this.handleStepStarted.bind(this),
      onStepSkipped: this.handleStepSkipped.bind(this),
      onStepRetried: this.handleStepRetried.bind(this),
      onStepValidationFailed: this.handleStepValidationFailed.bind(this),
      onStepHelpRequested: this.handleStepHelpRequested.bind(this),
      onStepAbandoned: this.handleStepAbandoned.bind(this),

      // Navigation events
      beforeStepChange: this.handleBeforeStepChange.bind(this),
      afterStepChange: this.handleAfterStepChange.bind(this),
      onNavigationBack: this.handleNavigationBack.bind(this),
      onNavigationForward: this.handleNavigationForward.bind(this),
      onNavigationJump: this.handleNavigationJump.bind(this),

      // Context events
      onContextUpdate: this.handleContextUpdate.bind(this),
      onDataChanged: this.handleDataChanged.bind(this),

      // Error events
      onError: this.handleError.bind(this),

      // Performance events
      onStepRenderTime: this.handleStepRenderTime.bind(this),
      onPersistenceSuccess: this.handlePersistenceSuccess.bind(this),
      onPersistenceFailure: this.handlePersistenceFailure.bind(this),

      // Checklist events
      onChecklistItemToggled: this.handleChecklistItemToggled.bind(this),
      onChecklistProgressChanged:
        this.handleChecklistProgressChanged.bind(this),

      // Plugin events
      onPluginInstalled: this.handlePluginInstalled.bind(this),
      onPluginError: this.handlePluginError.bind(this),
    };
  }

  private initializePostHog(): void {
    if (this.config.posthogInstance) {
      this.posthog = this.config.posthogInstance;
    } else if (this.config.apiKey) {
      // Initialize PostHog if not provided
      if (typeof window !== "undefined") {
        const posthog = require("posthog-js");
        this.posthog = posthog.init(this.config.apiKey, {
          api_host: this.config.host || "https://app.posthog.com",
        });
      } else {
        throw new Error("PostHog instance or API key required");
      }
    } else {
      throw new Error(
        "PostHog configuration missing: provide either posthogInstance or apiKey",
      );
    }
  }

  private async handleStepActive(
    event: StepActiveEvent<TContext>,
  ): Promise<void> {
    if (!this.shouldTrackEvent("stepActive")) return;
    const { step, context } = event;

    // Start performance tracking
    if (this.config.enablePerformanceTracking) {
      this.performanceTracker.startRenderTimer(step.id.toString());
    }

    // Start churn detection
    if (this.config.enableChurnDetection) {
      this.churnDetection.startStepTimer(step.id);
      this.churnDetection.setupChurnTimeout(
        step,
        context,
        this.handleChurnDetected.bind(this),
      );
    }

    // Track step activation
    const eventData = this.eventBuilder.buildEventData(
      "stepActive",
      {
        step_id: step.id,
        step_type: step.type,
        step_index: this.getStepIndex(step),
        is_first_step: this.isFirstStep(step),
        is_last_step: this.isLastStep(step),
        flow_progress_percentage: this.calculateFlowProgress(context),
        previous_step_id: this.getPreviousStepId(context),
      },
      step,
      context,
      this.performanceTracker.getCurrentMetrics(),
    );

    this.captureEvent("stepActive", eventData);

    // Check progress milestones
    if (this.config.enableProgressMilestones) {
      this.checkProgressMilestones(context);
    }

    // Track experiment exposure if enabled
    if (this.config.enableExperimentTracking && this.config.experimentFlags) {
      this.trackExperimentExposure(context);
    }
  }

  private async handleStepCompleted(
    event: StepCompletedEvent<TContext>,
  ): Promise<void> {
    if (!this.shouldTrackEvent("stepCompleted")) return;

    const { step, context, stepData } = event;

    // Clear churn timeout
    if (this.config.enableChurnDetection) {
      this.churnDetection.clearChurnTimeout(step.id.toString());
    }

    // End performance tracking
    let renderTime: number | undefined;
    if (this.config.enablePerformanceTracking) {
      renderTime = this.performanceTracker.endRenderTimer(step.id.toString());
    }

    const eventData = this.eventBuilder.buildEventData(
      "stepCompleted",
      {
        step_id: step.id,
        step_type: step.type,
        step_data: this.sanitizeStepData(stepData),
        flow_progress_percentage: this.calculateFlowProgress(context),
        render_time_ms: renderTime,
        completion_method: this.getCompletionMethod(stepData),
      },
      step,
      context,
      {
        stepRenderTime: renderTime,
        ...this.performanceTracker.getCurrentMetrics(),
      },
    );

    this.captureEvent("stepCompleted", eventData);

    // Track slow render performance
    if (
      renderTime &&
      this.config.performanceThresholds?.slowRenderMs &&
      renderTime > this.config.performanceThresholds.slowRenderMs
    ) {
      this.trackSlowRender(step, context, renderTime);
    }
  }

  private async handleFlowStarted(
    event: FlowStartedEvent<TContext>,
  ): Promise<void> {
    if (!this.shouldTrackEvent("flowStarted")) return;
    const { context, startMethod } = event;

    const eventData = this.eventBuilder.buildEventData(
      "flowStarted",
      {
        start_method: startMethod,
        total_steps: this.getTotalSteps(),
        flow_start_time_ms: Date.now(),
        initial_flow_data_size: JSON.stringify(context.flowData).length,
      },
      undefined,
      context,
      this.performanceTracker.getCurrentMetrics(),
    );

    this.captureEvent("flowStarted", eventData);
  }

  private async handleFlowPaused(event: any): Promise<void> {
    if (!this.shouldTrackEvent("flowPaused")) return;
    const { context, reason } = event;
    const eventData = this.eventBuilder.buildEventData(
      "flowPaused",
      { reason },
      undefined,
      context,
    );
    this.captureEvent("flowPaused", eventData);
  }

  private async handleFlowResumed(event: any): Promise<void> {
    if (!this.shouldTrackEvent("flowResumed")) return;
    const { context, resumePoint } = event;
    const eventData = this.eventBuilder.buildEventData(
      "flowResumed",
      { resume_point: resumePoint },
      undefined,
      context,
    );
    this.captureEvent("flowResumed", eventData);
  }

  private async handleFlowAbandoned(event: any): Promise<void> {
    if (!this.shouldTrackEvent("flowAbandoned")) return;
    const { context, abandonmentReason } = event;
    const eventData = this.eventBuilder.buildEventData(
      "flowAbandoned",
      { abandonment_reason: abandonmentReason },
      undefined,
      context,
    );
    this.captureEvent("flowAbandoned", eventData);
  }

  private async handleFlowReset(event: any): Promise<void> {
    if (!this.shouldTrackEvent("flowReset")) return;
    const { context, resetReason } = event;
    const eventData = this.eventBuilder.buildEventData(
      "flowReset",
      { reset_reason: resetReason },
      undefined,
      context,
    );
    this.captureEvent("flowReset", eventData);
  }

  private async handleStepStarted(event: any): Promise<void> {
    // Not in EventNameMapping by default. Add if you want to track this event.
    // if (!this.shouldTrackEvent("stepStarted" as any)) return;
    // this.captureEvent("stepStarted" as any, event);
    // For now, just log:
    if (this.config.debug) {
      console.log("[PostHogPlugin] stepStarted event", event);
    }
  }

  private async handleStepSkipped(event: any): Promise<void> {
    if (!this.shouldTrackEvent("stepSkipped")) return;
    const { step, context, skipReason } = event;
    const eventData = this.eventBuilder.buildEventData(
      "stepSkipped",
      { step_id: step.id, skip_reason: skipReason },
      step,
      context,
    );
    this.captureEvent("stepSkipped", eventData);
  }

  private async handleStepRetried(event: any): Promise<void> {
    if (!this.shouldTrackEvent("stepRetried")) return;
    const { step, context, retryCount } = event;
    const eventData = this.eventBuilder.buildEventData(
      "stepRetried",
      { step_id: step.id, retry_count: retryCount },
      step,
      context,
    );
    this.captureEvent("stepRetried", eventData);
  }

  private async handleStepValidationFailed(event: any): Promise<void> {
    if (!this.shouldTrackEvent("stepValidationFailed")) return;
    const { step, context, validationErrors } = event;
    const eventData = this.eventBuilder.buildEventData(
      "stepValidationFailed",
      { step_id: step.id, validation_errors: validationErrors },
      step,
      context,
    );
    this.captureEvent("stepValidationFailed", eventData);
  }

  private async handleStepHelpRequested(event: any): Promise<void> {
    if (!this.shouldTrackEvent("stepHelpRequested")) return;
    const { step, context, helpType } = event;
    const eventData = this.eventBuilder.buildEventData(
      "stepHelpRequested",
      { step_id: step.id, help_type: helpType },
      step,
      context,
    );
    this.captureEvent("stepHelpRequested", eventData);
  }

  private async handleStepAbandoned(event: any): Promise<void> {
    if (!this.shouldTrackEvent("stepAbandoned")) return;
    const { step, context, timeOnStep } = event;
    const eventData = this.eventBuilder.buildEventData(
      "stepAbandoned",
      { step_id: step.id, time_on_step: timeOnStep },
      step,
      context,
    );
    this.captureEvent("stepAbandoned", eventData);
  }

  private async handleNavigationBack(event: any): Promise<void> {
    if (!this.shouldTrackEvent("navigationBack")) return;
    const { fromStep, toStep, context } = event;
    const eventData = this.eventBuilder.buildEventData(
      "navigationBack",
      { from_step_id: fromStep.id, to_step_id: toStep.id },
      toStep,
      context,
    );
    this.captureEvent("navigationBack", eventData);
  }

  private async handleNavigationForward(event: any): Promise<void> {
    if (!this.shouldTrackEvent("navigationForward")) return;
    const { fromStep, toStep, context } = event;
    const eventData = this.eventBuilder.buildEventData(
      "navigationForward",
      { from_step_id: fromStep.id, to_step_id: toStep.id },
      toStep,
      context,
    );
    this.captureEvent("navigationForward", eventData);
  }

  private async handleNavigationJump(event: any): Promise<void> {
    if (!this.shouldTrackEvent("navigationJump")) return;
    const { fromStep, toStep, context } = event;
    const eventData = this.eventBuilder.buildEventData(
      "navigationJump",
      { from_step_id: fromStep.id, to_step_id: toStep.id },
      toStep,
      context,
    );
    this.captureEvent("navigationJump", eventData);
  }

  private async handleDataChanged(event: any): Promise<void> {
    if (!this.shouldTrackEvent("dataChanged")) return;
    // This is a stub, as contextUpdate is already handled. Implement if needed.
  }

  private async handleStepRenderTime(event: any): Promise<void> {
    // Not in EventNameMapping by default. Add if you want to track this event.
    if (this.config.debug) {
      console.log("[PostHogPlugin] stepRenderTime event", event);
    }
  }

  private async handlePersistenceSuccess(event: any): Promise<void> {
    if (!this.shouldTrackEvent("persistenceSuccess")) return;
    const { context, persistenceTime } = event;
    const eventData = this.eventBuilder.buildEventData(
      "persistenceSuccess",
      { persistence_time: persistenceTime },
      undefined,
      context,
    );
    this.captureEvent("persistenceSuccess", eventData);
  }

  private async handlePersistenceFailure(event: any): Promise<void> {
    if (!this.shouldTrackEvent("persistenceFailure")) return;
    const { context, error } = event;
    const eventData = this.eventBuilder.buildEventData(
      "persistenceFailure",
      { error_message: error.message },
      undefined,
      context,
    );
    this.captureEvent("persistenceFailure", eventData);
  }

  private async handleChecklistItemToggled(event: any): Promise<void> {
    if (!this.shouldTrackEvent("checklistItemToggled")) return;
    const { itemId, isCompleted, step, context } = event;
    const eventData = this.eventBuilder.buildEventData(
      "checklistItemToggled",
      { item_id: itemId, is_completed: isCompleted },
      step,
      context,
    );
    this.captureEvent("checklistItemToggled", eventData);
  }

  private async handleChecklistProgressChanged(event: any): Promise<void> {
    if (!this.shouldTrackEvent("checklistProgress")) return;
    const { step, context, progress } = event;
    const eventData = this.eventBuilder.buildEventData(
      "checklistProgress",
      { ...progress },
      step,
      context,
    );
    this.captureEvent("checklistProgress", eventData);
  }

  private async handlePluginInstalled(event: any): Promise<void> {
    // Not in EventNameMapping by default. Add if you want to track this event.
    if (this.config.debug) {
      console.log("[PostHogPlugin] pluginInstalled event", event);
    }
  }

  private async handlePluginError(event: any): Promise<void> {
    if (!this.shouldTrackEvent("pluginError")) return;
    const { pluginName, error, context } = event;
    const eventData = this.eventBuilder.buildEventData(
      "pluginError",
      { plugin_name: pluginName, error_message: error.message },
      undefined,
      context,
    );
    this.captureEvent("pluginError", eventData);
  }

  private async handleFlowCompleted(
    event: FlowCompletedEvent<TContext>,
  ): Promise<void> {
    if (!this.shouldTrackEvent("flowCompleted")) return;
    const context = event.context;

    const eventData = this.eventBuilder.buildEventData(
      "flowCompleted",
      {
        total_steps: this.getTotalSteps(),
        completion_time_ms: this.getFlowCompletionTime(context),
        steps_skipped: this.getSkippedStepsCount(context),
        steps_retried: this.getRetriedStepsCount(context),
        final_flow_data_size: JSON.stringify(context.flowData).length,
      },
      undefined,
      context,
      this.performanceTracker.getCurrentMetrics(),
    );

    this.captureEvent("flowCompleted", eventData);

    // Clean up tracking data
    this.progressMilestones.clear();
  }

  private async handleBeforeStepChange(event: any): Promise<void> {
    // Track navigation patterns
    if (event.direction === "previous") {
      const userId = event.currentStep?.context?.currentUser?.id || "anonymous";
      this.churnDetection.recordBackNavigation(userId);
    }
  }

  private async handleAfterStepChange(
    event: StepChangeEvent<TContext>,
  ): Promise<void> {
    const { oldStep: previousStep, newStep: currentStep, context } = event;

    if (!previousStep || !currentStep) return;

    // Determine navigation type
    const navigationType = this.getNavigationType(previousStep, currentStep);

    if (this.shouldTrackEvent(`navigation${navigationType}`)) {
      const eventData = this.eventBuilder.buildEventData(
        `navigation${navigationType}`,
        {
          from_step_id: previousStep.id,
          to_step_id: currentStep.id,
          from_step_type: previousStep.type,
          to_step_type: currentStep.type,
          navigation_time_ms: Date.now(), // Could be more precise
        },
        currentStep,
        context,
      );

      this.captureEvent(`navigation${navigationType}`, eventData);
    }
  }

  private async handleContextUpdate(
    event: ContextUpdateEvent<TContext>,
  ): Promise<void> {
    if (!this.shouldTrackEvent("dataChanged")) return;

    const { oldContext, newContext } = event;

    const changedKeys = this.getChangedKeys(
      oldContext.flowData,
      newContext.flowData,
    );

    if (changedKeys.length > 0) {
      const eventData = this.eventBuilder.buildEventData(
        "dataChanged",
        {
          changed_keys: changedKeys,
          data_size_before: JSON.stringify(oldContext.flowData).length,
          data_size_after: JSON.stringify(newContext.flowData).length,
        },
        undefined,
        newContext,
      );

      this.captureEvent("dataChanged", eventData);
    }
  }

  private async handleError(event: ErrorEvent<TContext>): Promise<void> {
    if (!this.shouldTrackEvent("errorEncountered")) return;
    const { error, context } = event;

    // Record error for churn detection
    const userId = context.currentUser?.id || "anonymous";
    this.churnDetection.recordError(userId);

    const eventData = this.eventBuilder.buildEventData(
      "errorEncountered",
      {
        error_message: error.message,
        error_stack: error.stack,
        error_name: error.name,
        current_step_id: this.getCurrentStepId(context),
      },
      undefined,
      context,
    );

    this.captureEvent("errorEncountered", eventData);
  }

  private handleChurnDetected(
    step: OnboardingStep<TContext>,
    context: TContext,
    riskFactors: any,
  ): void {
    if (!this.shouldTrackEvent("stepAbandoned")) return;

    const churnRisk = this.churnDetection.calculateChurnRisk(step, context);
    const isHighRisk = this.churnDetection.isHighChurnRisk(step, context);

    const eventData = this.eventBuilder.buildEventData(
      "stepAbandoned",
      {
        step_id: step.id,
        step_type: step.type,
        churn_risk_score: churnRisk,
        is_high_risk: isHighRisk, // NEW: Boolean flag for easy filtering
        risk_threshold: this.churnDetection.getChurnRiskThreshold(), // NEW: Include threshold for context
        time_on_step_ms: riskFactors.timeOnStep,
        back_navigation_count: riskFactors.backNavigationCount,
        error_count: riskFactors.errorCount,
        idle_time_ms: riskFactors.idleTime,
        validation_failures: riskFactors.validationFailures,
      },
      step,
      context,
    );

    this.captureEvent("stepAbandoned", eventData);

    // Optional: Trigger additional high-risk events for easier PostHog filtering
    if (isHighRisk) {
      const highRiskEventData = this.eventBuilder.buildEventData(
        "highChurnRisk",
        {
          step_id: step.id,
          churn_risk_score: churnRisk,
          primary_risk_factor: this.getPrimaryRiskFactor(riskFactors),
        },
        step,
        context,
      );

      // You might want to add 'highChurnRisk' to EventNameMapping if you use this
      this.captureEvent("highChurnRisk", highRiskEventData);
    }
  }

  // Helper method to identify the primary risk factor
  private getPrimaryRiskFactor(riskFactors: any): string {
    const factors = {
      timeOnStep:
        riskFactors.timeOnStep / this.churnDetection.getChurnRiskThreshold(),
      backNavigation: riskFactors.backNavigationCount,
      errors: riskFactors.errorCount,
      idle: riskFactors.idleTime / 60000, // Convert to minutes
      validationFailures: riskFactors.validationFailures,
    };

    // Find the highest risk factor
    const maxFactor = Object.entries(factors).reduce(
      (max, [key, value]) => (value > max.value ? { key, value } : max),
      { key: "unknown", value: 0 },
    );

    return maxFactor.key;
  }

  private checkProgressMilestones(context: TContext): void {
    const progress = this.calculateFlowProgress(context);
    const milestones = this.config.milestonePercentages || [25, 50, 75, 100];

    milestones.forEach((milestone) => {
      if (progress >= milestone && !this.progressMilestones.has(milestone)) {
        this.progressMilestones.add(milestone);

        const eventData = this.eventBuilder.buildEventData(
          "progressMilestone",
          {
            milestone_percentage: milestone,
            actual_progress: progress,
            steps_completed: this.getCompletedStepsCount(context),
          },
          undefined,
          context,
        );

        this.captureEvent("progressMilestone", eventData);
      }
    });
  }

  private trackExperimentExposure(context: TContext): void {
    if (!this.config.experimentFlags) return;

    this.config.experimentFlags.forEach((flagName) => {
      const variant = this.posthog.getFeatureFlag(flagName);
      if (variant) {
        const eventData = this.eventBuilder.buildEventData(
          "experimentExposed",
          {
            experiment_flag: flagName,
            variant: variant,
            user_id: context.currentUser?.id,
          },
          undefined,
          context,
        );

        this.captureEvent("experimentExposed", eventData);
      }
    });
  }

  private trackSlowRender(
    step: OnboardingStep<TContext>,
    context: TContext,
    renderTime: number,
  ): void {
    const eventData = this.eventBuilder.buildEventData(
      "stepRenderSlow",
      {
        step_id: step.id,
        step_type: step.type,
        render_time_ms: renderTime,
        threshold_ms: this.config.performanceThresholds?.slowRenderMs,
      },
      step,
      context,
    );

    this.captureEvent("stepRenderSlow", eventData);
  }

  private async handleUserIdle(event: any): Promise<void> {
    if (!this.shouldTrackEvent("userIdle" as keyof EventNameMapping)) return;
    if (this.config.debug) {
      console.log("[PostHogPlugin] userIdle event", event);
    }
  }

  private async handleUserReturned(event: any): Promise<void> {
    if (!this.shouldTrackEvent("userReturned" as keyof EventNameMapping))
      return;
    if (this.config.debug) {
      console.log("[PostHogPlugin] userReturned event", event);
    }
  }

  // Utility methods
  private shouldTrackEvent(eventType: keyof EventNameMapping): boolean {
    if (this.config.includeOnlyEvents) {
      return this.config.includeOnlyEvents.includes(eventType);
    }

    if (this.config.excludeEvents) {
      return !this.config.excludeEvents.includes(eventType);
    }

    return true;
  }

  private captureEvent(
    eventType: keyof EventNameMapping,
    eventData: Record<string, any>,
  ): void {
    const eventName = this.getEventName(eventType);

    try {
      this.posthog.capture(eventName, eventData);

      if (this.config.enableConsoleLogging) {
        console.log(`[PostHogPlugin] Event captured: ${eventName}`, eventData);
      }
    } catch (error) {
      console.error(
        `[PostHogPlugin] Failed to capture event ${eventName}:`,
        error,
      );

      // Track plugin errors
      this.posthog.capture(this.getEventName("pluginError"), {
        plugin_name: this.name,
        error_message: error instanceof Error ? error.message : String(error),
        failed_event: eventName,
      });
    }
  }

  private getEventName(eventType: keyof EventNameMapping): string {
    const prefix = this.config.eventPrefix || "onboarding_";
    const customName = this.config.customEventNames?.[eventType];
    const defaultName = this.defaultEventNames[eventType];

    return customName || `${prefix}${defaultName}`;
  }

  // Helper methods for data extraction
  private getStepIndex(step: OnboardingStep<TContext>): number {
    // This would need to be implemented based on your engine's step management
    return 0; // Placeholder
  }

  private isFirstStep(step: OnboardingStep<TContext>): boolean {
    return this.getStepIndex(step) === 0;
  }

  private isLastStep(step: OnboardingStep<TContext>): boolean {
    // Implementation depends on your engine
    return false; // Placeholder
  }

  private calculateFlowProgress(context: TContext): number {
    // Calculate based on completed steps vs total steps
    const totalSteps = this.getTotalSteps();
    const completedSteps = this.getCompletedStepsCount(context);
    return totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  }

  private getTotalSteps(): number {
    // Get from engine
    return this.engine?.getSteps().length || 0;
  }

  private getCompletedStepsCount(context: TContext): number {
    return Object.keys(context.flowData._internal?.completedSteps || {}).length;
  }

  private getSkippedStepsCount(context: TContext): number {
    // Implementation depends on how you track skipped steps
    return 0; // Placeholder
  }

  private getRetriedStepsCount(context: TContext): number {
    // Implementation depends on how you track retries
    return 0; // Placeholder
  }

  private getFlowCompletionTime(context: TContext): number {
    const startTime = context.flowData._internal?.startedAt;
    return startTime ? Date.now() - startTime : 0;
  }

  private getPreviousStepId(context: TContext): string | undefined {
    // Get from engine state or history
    return undefined; // Placeholder
  }

  private getCurrentStepId(context: TContext): string | undefined {
    // Get current step ID from engine
    return undefined; // Placeholder
  }

  private getCompletionMethod(stepData: any): string {
    // Determine how the step was completed (button click, form submit, etc.)
    return "unknown"; // Placeholder
  }

  private getNavigationType(
    previousStep: OnboardingStep<TContext>,
    currentStep: OnboardingStep<TContext>,
  ) {
    // Determine if it's forward, back, or jump navigation
    const prevIndex = this.getStepIndex(previousStep);
    const currIndex = this.getStepIndex(currentStep);

    if (currIndex > prevIndex) return "Forward";
    if (currIndex < prevIndex) return "Back";
    return "Jump";
  }

  private getChangedKeys(
    oldData: Record<string, any>,
    newData: Record<string, any>,
  ): string[] {
    const changedKeys: string[] = [];
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

    allKeys.forEach((key) => {
      if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        changedKeys.push(key);
      }
    });

    return changedKeys;
  }

  private sanitizeStepData(stepData: any): any {
    // Apply the same sanitization as the event builder
    return this.config.sanitizeData
      ? this.config.sanitizeData(stepData)
      : stepData;
  }
}
