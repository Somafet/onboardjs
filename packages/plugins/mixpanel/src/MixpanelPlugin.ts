import {
  BasePlugin,
  OnboardingContext,
  OnboardingStep,
  PluginHooks,
  FlowInfo,
  StepActiveEvent,
  StepCompletedEvent,
  FlowStartedEvent,
  FlowCompletedEvent,
  StepSkippedEvent,
  StepRetriedEvent,
  StepValidationFailedEvent,
  StepHelpRequestedEvent,
  StepAbandonedEvent,
  NavigationBackEvent,
  NavigationForwardEvent,
  NavigationJumpEvent,
  DataChangedEvent,
  ContextUpdateEvent,
  ErrorEvent,
  StepChangeEvent,
  StepRenderTimeEvent,
  PersistenceSuccessEvent,
  PersistenceFailureEvent,
  ChecklistItemToggledEvent,
  ChecklistProgressChangedEvent,
  PluginInstalledEvent,
  PluginErrorEvent,
  EngineState,
} from "@onboardjs/core";
interface Mixpanel {
  init(token: string, config?: any): void;
  track(event: string, properties?: any): void;
  people: {
    set(properties: any): void;
  };
}

import {
  MixpanelPluginConfig,
  EventNameMapping,
  ChurnRiskFactors,
} from "./types";
import { EventDataBuilder } from "./utils/eventBuilder";
import { ChurnDetectionManager } from "./utils/churnDetection";
import { PerformanceTracker } from "./utils/performanceMetrics";

export class MixpanelPlugin<
  TContext extends OnboardingContext,
> extends BasePlugin<TContext, MixpanelPluginConfig> {
  readonly name = "@onboardjs/mixpanel-plugin";
  readonly version = "1.0.0";
  readonly description = "Official Mixpanel analytics plugin for OnboardJS";

  private mixpanel!: Mixpanel;
  private eventBuilder!: EventDataBuilder<TContext>;
  private churnDetection!: ChurnDetectionManager<TContext>;
  private performanceTracker!: PerformanceTracker;
  private progressMilestones = new Set<number>();
  private retriedSteps = new Map<string, number>(); // Track retry counts per step

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
    // Initialize utilities
    this.eventBuilder = new EventDataBuilder(this.config);
    this.churnDetection = new ChurnDetectionManager(
      this.config.churnTimeoutMs,
      this.config.churnRiskThreshold,
    );
    this.performanceTracker = new PerformanceTracker();

    // Initialize Mixpanel
    await this.initializeMixpanel();

    // Log installation
    if (this.config.debug) {
      console.log(`[MixpanelPlugin] Plugin installed with config:`, {
        token: this.config.token ? "***" : "not provided",
        mixpanelInstance: !!this.config.mixpanelInstance,
        eventPrefix: this.config.eventPrefix,
      });
    }
  }

  protected async onUninstall(): Promise<void> {
    this.churnDetection.cleanup();
    this.performanceTracker.cleanup();
    this.progressMilestones.clear();
    this.retriedSteps.clear();

    if (this.config.debug) {
      console.log(`[MixpanelPlugin] Plugin uninstalled`);
    }
  }

  protected getHooks(): PluginHooks<TContext> {
    return {
      onFlowStarted: this.handleFlowStarted.bind(this),
      onFlowCompleted: this.handleFlowCompleted.bind(this),
      onFlowPaused: this.handleFlowPaused.bind(this),
      onFlowResumed: this.handleFlowResumed.bind(this),
      onFlowAbandoned: this.handleFlowAbandoned.bind(this),
      onFlowReset: this.handleFlowReset.bind(this),
      onStepActive: this.handleStepActive.bind(this),
      onStepCompleted: this.handleStepCompleted.bind(this),
      onStepSkipped: this.handleStepSkipped.bind(this),
      onStepRetried: this.handleStepRetried.bind(this),
      onStepValidationFailed: this.handleStepValidationFailed.bind(this),
      onStepHelpRequested: this.handleStepHelpRequested.bind(this),
      onStepAbandoned: this.handleStepAbandoned.bind(this),
      beforeStepChange: this.handleBeforeStepChange.bind(this),
      afterStepChange: this.handleAfterStepChange.bind(this),
      onNavigationBack: this.handleNavigationBack.bind(this),
      onNavigationForward: this.handleNavigationForward.bind(this),
      onNavigationJump: this.handleNavigationJump.bind(this),
      onContextUpdate: this.handleContextUpdate.bind(this),
      onDataChanged: this.handleDataChanged.bind(this),
      onError: this.handleError.bind(this),
      onStepRenderTime: this.handleStepRenderTime.bind(this),
      onPersistenceSuccess: this.handlePersistenceSuccess.bind(this),
      onPersistenceFailure: this.handlePersistenceFailure.bind(this),
      onChecklistItemToggled: this.handleChecklistItemToggled.bind(this),
      onChecklistProgressChanged:
        this.handleChecklistProgressChanged.bind(this),
      onPluginInstalled: this.handlePluginInstalled.bind(this),
      onPluginError: this.handlePluginError.bind(this),
    };
  }

  private async initializeMixpanel(): Promise<void> {
    // Handle both browser and server environments
    if (typeof window !== "undefined") {
      try {
        // Dynamic import for browser environment
        this.mixpanel = (await import("mixpanel-browser")).default;
      } catch (error) {
        console.warn(
          "[MixpanelPlugin] Failed to import mixpanel-browser. Make sure it is installed.",
        );
        // Create a no-op implementation for fallback
        this.mixpanel = {
          init: () => {},
          track: () => {},
          people: { set: () => {} },
        };
      }
    } else {
      // Server-side fallback
      this.mixpanel = {
        init: () => {},
        track: () => {},
        people: { set: () => {} },
      };
    }

    if (this.config.mixpanelInstance) {
      this.mixpanel = this.config.mixpanelInstance;
      this.debugLog("Using provided Mixpanel instance");
    } else if (this.config.token) {
      this.mixpanel.init(this.config.token, this.config.config || {});
      this.debugLog("Initialized Mixpanel with token");
    } else {
      throw new Error(
        "MixpanelPlugin requires either a token or a mixpanelInstance to be provided in config",
      );
    }
  }

  private getFlowInfo(): FlowInfo | undefined {
    return this.engine && typeof this.engine.getFlowInfo === "function"
      ? this.engine.getFlowInfo()
      : undefined;
  }

  private debugLog(message: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[MixpanelPlugin] ${message}`, data || "");
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
        flow_progress_percentage: this.calculateFlowProgress(),
        previous_step_id: this.getPreviousStepId(context),
      },
      step,
      context,
      this.performanceTracker.getCurrentMetrics(),
      this.getFlowInfo(),
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
        flow_progress_percentage: this.calculateFlowProgress(),
        render_time_ms: renderTime,
        completion_method: this.getCompletionMethod(stepData),
      },
      step,
      context,
      {
        stepRenderTime: renderTime,
        ...this.performanceTracker.getCurrentMetrics(),
      },
      this.getFlowInfo(),
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
      this.getFlowInfo(),
    );

    this.captureEvent("flowStarted", eventData);

    // Set user properties if user exists
    if (context.currentUser && this.config.includeUserProperties) {
      const userProperties = this.eventBuilder["buildUserProperties"](
        context.currentUser,
      );
      this.mixpanel.people.set(userProperties);
    }
  }

  private async handleFlowPaused(event: any): Promise<void> {
    if (!this.shouldTrackEvent("flowPaused")) return;
    const { context, reason } = event;
    const eventData = this.eventBuilder.buildEventData(
      "flowPaused",
      { reason },
      undefined,
      context,
      undefined,
      this.getFlowInfo(),
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
      undefined,
      this.getFlowInfo(),
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
      undefined,
      this.getFlowInfo(),
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
      undefined,
      this.getFlowInfo(),
    );
    this.captureEvent("flowReset", eventData);
  }

  private async handleStepSkipped(
    event: StepSkippedEvent<TContext>,
  ): Promise<void> {
    if (!this.shouldTrackEvent("stepSkipped")) return;
    const { step, context, skipReason } = event;
    const eventData = this.eventBuilder.buildEventData(
      "stepSkipped",
      { step_id: step.id, skip_reason: skipReason },
      step,
      context,
      undefined,
      this.getFlowInfo(),
    );
    this.captureEvent("stepSkipped", eventData);
  }

  private async handleStepRetried(
    event: StepRetriedEvent<TContext>,
  ): Promise<void> {
    if (!this.shouldTrackEvent("stepRetried")) return;
    const { step, context, retryCount } = event;

    // Track retry count locally
    this.retriedSteps.set(step.id.toString(), retryCount);

    const eventData = this.eventBuilder.buildEventData(
      "stepRetried",
      { step_id: step.id, retry_count: retryCount },
      step,
      context,
      undefined,
      this.getFlowInfo(),
    );
    this.captureEvent("stepRetried", eventData);
  }

  private async handleStepValidationFailed(
    event: StepValidationFailedEvent<TContext>,
  ): Promise<void> {
    if (!this.shouldTrackEvent("stepValidationFailed")) return;

    const { step, context, validationErrors } = event;

    // Record validation failure for churn detection
    if (this.config.enableChurnDetection && context.currentUser) {
      this.churnDetection.recordValidationFailure(context.currentUser.id);
    }

    const eventData = this.eventBuilder.buildEventData(
      "stepValidationFailed",
      {
        step_id: step.id,
        validation_errors: validationErrors,
        error_count: Array.isArray(validationErrors)
          ? validationErrors.length
          : 1,
      },
      step,
      context,
      undefined,
      this.getFlowInfo(),
    );

    this.captureEvent("stepValidationFailed", eventData);
  }

  private async handleStepHelpRequested(
    event: StepHelpRequestedEvent<TContext>,
  ): Promise<void> {
    if (!this.shouldTrackEvent("stepHelpRequested")) return;
    const { step, context, helpType } = event;
    const eventData = this.eventBuilder.buildEventData(
      "stepHelpRequested",
      { step_id: step.id, help_type: helpType },
      step,
      context,
      undefined,
      this.getFlowInfo(),
    );
    this.captureEvent("stepHelpRequested", eventData);
  }

  private async handleStepAbandoned(
    event: StepAbandonedEvent<TContext>,
  ): Promise<void> {
    if (!this.shouldTrackEvent("stepAbandoned")) return;
    const { step, context, timeOnStep } = event;
    const eventData = this.eventBuilder.buildEventData(
      "stepAbandoned",
      { step_id: step.id, time_on_step_ms: timeOnStep },
      step,
      context,
      undefined,
      this.getFlowInfo(),
    );
    this.captureEvent("stepAbandoned", eventData);
  }

  private async handleNavigationBack(
    event: NavigationBackEvent<TContext>,
  ): Promise<void> {
    if (!this.shouldTrackEvent("navigationBack")) return;

    const { fromStep, toStep, context } = event;

    // Record back navigation for churn detection
    if (this.config.enableChurnDetection && context.currentUser) {
      this.churnDetection.recordBackNavigation(context.currentUser.id);
    }

    const eventData = this.eventBuilder.buildEventData(
      "navigationBack",
      {
        from_step_id: fromStep.id,
        to_step_id: toStep.id,
        navigation_type: this.getNavigationType(fromStep, toStep),
      },
      fromStep,
      context,
      undefined,
      this.getFlowInfo(),
    );

    this.captureEvent("navigationBack", eventData);
  }

  private async handleNavigationForward(
    event: NavigationForwardEvent<TContext>,
  ): Promise<void> {
    if (!this.shouldTrackEvent("navigationForward")) return;
    const { fromStep, toStep, context } = event;
    const eventData = this.eventBuilder.buildEventData(
      "navigationForward",
      {
        from_step_id: fromStep.id,
        to_step_id: toStep.id,
        navigation_type: this.getNavigationType(fromStep, toStep),
      },
      fromStep,
      context,
      undefined,
      this.getFlowInfo(),
    );
    this.captureEvent("navigationForward", eventData);
  }

  private async handleNavigationJump(
    event: NavigationJumpEvent<TContext>,
  ): Promise<void> {
    if (!this.shouldTrackEvent("navigationJump")) return;
    const { fromStep, toStep, context } = event;
    const eventData = this.eventBuilder.buildEventData(
      "navigationJump",
      {
        from_step_id: fromStep?.id,
        to_step_id: toStep.id,
        jump_distance: fromStep
          ? Math.abs(this.getStepIndex(toStep) - this.getStepIndex(fromStep))
          : 0,
      },
      toStep,
      context,
      undefined,
      this.getFlowInfo(),
    );
    this.captureEvent("navigationJump", eventData);
  }

  private async handleDataChanged(
    event: DataChangedEvent<TContext>,
  ): Promise<void> {
    if (!this.shouldTrackEvent("dataChanged")) return;
    const { step, context, changedFields } = event;
    const eventData = this.eventBuilder.buildEventData(
      "dataChanged",
      {
        changed_keys: changedFields,
        change_count: changedFields.length,
      },
      step,
      context,
      undefined,
      this.getFlowInfo(),
    );
    this.captureEvent("dataChanged", eventData);
  }

  private async handleStepRenderTime(
    event: StepRenderTimeEvent<TContext>,
  ): Promise<void> {
    if (!this.shouldTrackEvent("stepRenderSlow")) return;

    const { step, context, renderTime } = event;

    if (
      this.config.performanceThresholds?.slowRenderMs &&
      renderTime > this.config.performanceThresholds.slowRenderMs
    ) {
      this.trackSlowRender(step, context, renderTime);
    }
  }

  private async handlePersistenceSuccess(
    event: PersistenceSuccessEvent<TContext>,
  ): Promise<void> {
    if (!this.shouldTrackEvent("persistenceSuccess")) return;
    const { context, persistenceTime } = event;
    const eventData = this.eventBuilder.buildEventData(
      "persistenceSuccess",
      { persistence_time_ms: persistenceTime },
      undefined,
      context,
      { persistenceTime },
      this.getFlowInfo(),
    );
    this.captureEvent("persistenceSuccess", eventData);
  }

  private async handlePersistenceFailure(
    event: PersistenceFailureEvent<TContext>,
  ): Promise<void> {
    if (!this.shouldTrackEvent("persistenceFailure")) return;
    const { context, error } = event;
    const eventData = this.eventBuilder.buildEventData(
      "persistenceFailure",
      { error_message: error.message, error_type: error.name },
      undefined,
      context,
      undefined,
      this.getFlowInfo(),
    );
    this.captureEvent("persistenceFailure", eventData);
  }

  private async handleChecklistItemToggled(
    event: ChecklistItemToggledEvent<TContext>,
  ): Promise<void> {
    if (!this.shouldTrackEvent("checklistItemToggled")) return;
    const { step, context, itemId, isCompleted } = event;
    const eventData = this.eventBuilder.buildEventData(
      "checklistItemToggled",
      { step_id: step.id, item_id: itemId, checked: isCompleted },
      step,
      context,
      undefined,
      this.getFlowInfo(),
    );
    this.captureEvent("checklistItemToggled", eventData);
  }

  private async handleChecklistProgressChanged(
    event: ChecklistProgressChangedEvent<TContext>,
  ): Promise<void> {
    if (!this.shouldTrackEvent("checklistProgress")) return;
    const { step, context, progress } = event;
    const eventData = this.eventBuilder.buildEventData(
      "checklistProgress",
      {
        step_id: step.id,
        completed_items: progress.completed,
        total_items: progress.total,
        completion_percentage: progress.percentage,
      },
      step,
      context,
      undefined,
      this.getFlowInfo(),
    );
    this.captureEvent("checklistProgress", eventData);
  }

  private async handlePluginInstalled(
    event: PluginInstalledEvent,
  ): Promise<void> {
    const { pluginName, pluginVersion } = event;

    // Don't track our own installation to avoid infinite loops
    if (pluginName === this.name) return;

    const eventData = {
      plugin_name: pluginName,
      plugin_version: pluginVersion,
      timestamp: new Date().toISOString(),
    };

    // Use track directly since pluginInstalled is not in our EventNameMapping
    try {
      this.mixpanel.track(
        this.getEventName("flowStarted").replace(
          "flow_started",
          "plugin_installed",
        ),
        eventData,
      );

      if (this.config.enableConsoleLogging) {
        console.log(`[MixpanelPlugin] Tracked plugin installation:`, eventData);
      }
    } catch (error) {
      console.error(
        `[MixpanelPlugin] Failed to track plugin installation:`,
        error,
      );
    }
  }

  private async handlePluginError(
    event: PluginErrorEvent<TContext>,
  ): Promise<void> {
    if (!this.shouldTrackEvent("pluginError")) return;
    const { pluginName, error, context } = event;
    const eventData = this.eventBuilder.buildEventData(
      "pluginError",
      {
        plugin_name: pluginName,
        error_message: error.message,
        error_type: error.name,
        error_stack: error.stack,
      },
      undefined,
      context,
      undefined,
      this.getFlowInfo(),
    );
    this.captureEvent("pluginError", eventData);
  }

  private async handleFlowCompleted(
    event: FlowCompletedEvent<TContext>,
  ): Promise<void> {
    if (!this.shouldTrackEvent("flowCompleted")) return;

    const { context, duration } = event;

    const eventData = this.eventBuilder.buildEventData(
      "flowCompleted",
      {
        completion_time_ms: duration,
        total_steps: this.getTotalSteps(),
        completed_steps: this.getCompletedStepsCount(),
        skipped_steps: this.getSkippedStepsCount(context),
        retried_steps: this.getRetriedStepsCount(context),
        flow_completion_time_ms: this.getFlowCompletionTime(context),
      },
      undefined,
      context,
      this.performanceTracker.getCurrentMetrics(),
      this.getFlowInfo(),
    );

    this.captureEvent("flowCompleted", eventData);
  }

  private async handleBeforeStepChange(event: any): Promise<void> {
    // This is called before step transitions, useful for cleanup
    if (this.config.enablePerformanceTracking && event.fromStep) {
      this.performanceTracker.endRenderTimer(event.fromStep.id.toString());
    }
  }

  private async handleAfterStepChange(
    event: StepChangeEvent<TContext>,
  ): Promise<void> {
    // This is called after step transitions
    if (this.config.enablePerformanceTracking && event.newStep) {
      this.performanceTracker.startRenderTimer(event.newStep.id.toString());
    }
  }

  private async handleContextUpdate(
    event: ContextUpdateEvent<TContext>,
  ): Promise<void> {
    // Update user properties in Mixpanel if user data changed
    if (
      event.newContext.currentUser &&
      this.config.includeUserProperties &&
      // Check if the user object has changed by comparing old and new
      JSON.stringify(event.oldContext.currentUser) !==
        JSON.stringify(event.newContext.currentUser)
    ) {
      const userProperties = this.eventBuilder["buildUserProperties"](
        event.newContext.currentUser,
      );
      this.mixpanel.people.set(userProperties);
    }
  }

  private async handleError(event: ErrorEvent<TContext>): Promise<void> {
    if (!this.shouldTrackEvent("errorEncountered")) return;

    const { error, context } = event;

    // Record error for churn detection
    if (this.config.enableChurnDetection && context.currentUser) {
      this.churnDetection.recordError(context.currentUser.id);
    }

    const eventData = this.eventBuilder.buildEventData(
      "errorEncountered",
      {
        error_message: error.message,
        error_type: error.name,
        error_stack: error.stack,
      },
      undefined,
      context,
      undefined,
      this.getFlowInfo(),
    );

    this.captureEvent("errorEncountered", eventData);
  }

  private handleChurnDetected(
    step: OnboardingStep<TContext>,
    context: TContext,
    riskFactors: ChurnRiskFactors,
  ): void {
    if (!this.shouldTrackEvent("highChurnRisk")) return;

    const eventData = this.eventBuilder.buildEventData(
      "highChurnRisk",
      {
        step_id: step.id,
        risk_score: this.churnDetection.calculateChurnRisk(step, context),
        time_on_step_ms: riskFactors.timeOnStep,
        back_navigation_count: riskFactors.backNavigationCount,
        error_count: riskFactors.errorCount,
        idle_time_ms: riskFactors.idleTime,
        validation_failures: riskFactors.validationFailures,
        primary_risk_factor: this.getPrimaryRiskFactor(riskFactors),
      },
      step,
      context,
      undefined,
      this.getFlowInfo(),
    );

    this.captureEvent("highChurnRisk", eventData);
  }

  // Helper method to identify the primary risk factor
  private getPrimaryRiskFactor(riskFactors: ChurnRiskFactors): string {
    const factors = {
      time: riskFactors.timeOnStep,
      navigation: riskFactors.backNavigationCount * 60000, // Convert to ms equivalent
      errors: riskFactors.errorCount * 120000, // Higher weight for errors
      idle: riskFactors.idleTime,
      validation: riskFactors.validationFailures * 90000,
    };

    return Object.entries(factors).reduce((a, b) =>
      factors[a[0] as keyof typeof factors] >
      factors[b[0] as keyof typeof factors]
        ? a
        : b,
    )[0];
  }

  private checkProgressMilestones(context: TContext): void {
    const progress = this.calculateFlowProgress();
    const milestones = this.config.milestonePercentages || [25, 50, 75, 100];

    for (const milestone of milestones) {
      if (progress >= milestone && !this.progressMilestones.has(milestone)) {
        this.progressMilestones.add(milestone);

        const eventData = this.eventBuilder.buildEventData(
          "progressMilestone",
          {
            milestone_percentage: milestone,
            current_progress: progress,
            steps_completed: this.getCompletedStepsCount(),
            total_steps: this.getTotalSteps(),
          },
          undefined,
          context,
          undefined,
          this.getFlowInfo(),
        );

        this.captureEvent("progressMilestone", eventData);
      }
    }
  }

  private trackExperimentExposure(context: TContext): void {
    if (!this.config.experimentFlags) return;

    for (const flag of this.config.experimentFlags) {
      // Assuming experiment data is stored in context
      const experimentData = (context as any).experiments?.[flag];
      if (experimentData) {
        const eventData = this.eventBuilder.buildEventData(
          "experimentExposed",
          {
            experiment_flag: flag,
            experiment_variant: experimentData.variant,
            experiment_id: experimentData.id,
          },
          undefined,
          context,
          undefined,
          this.getFlowInfo(),
        );

        this.captureEvent("experimentExposed", eventData);
      }
    }
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
        render_time_ms: renderTime,
        threshold_ms: this.config.performanceThresholds?.slowRenderMs,
        performance_ratio:
          renderTime / (this.config.performanceThresholds?.slowRenderMs || 1),
      },
      step,
      context,
      { stepRenderTime: renderTime },
      this.getFlowInfo(),
    );

    this.captureEvent("stepRenderSlow", eventData);
  }

  private async handleUserIdle(event: any): Promise<void> {
    if (!this.shouldTrackEvent("userIdle")) return;
    const { context, idleTime } = event;
    const eventData = this.eventBuilder.buildEventData(
      "userIdle",
      { idle_time_ms: idleTime },
      undefined,
      context,
      undefined,
      this.getFlowInfo(),
    );
    this.captureEvent("userIdle", eventData);
  }

  private async handleUserReturned(event: any): Promise<void> {
    if (!this.shouldTrackEvent("userReturned")) return;
    const { context, awayTime } = event;
    const eventData = this.eventBuilder.buildEventData(
      "userReturned",
      { away_time_ms: awayTime },
      undefined,
      context,
      undefined,
      this.getFlowInfo(),
    );
    this.captureEvent("userReturned", eventData);
  }

  // Utility methods
  private shouldTrackEvent(eventType: keyof EventNameMapping): boolean {
    // Check if event is excluded
    if (this.config.excludeEvents?.includes(eventType)) {
      return false;
    }

    // Check if only specific events should be included
    if (
      this.config.includeOnlyEvents &&
      !this.config.includeOnlyEvents.includes(eventType)
    ) {
      return false;
    }

    return true;
  }

  private captureEvent(
    eventType: keyof EventNameMapping,
    eventData: Record<string, any>,
  ): void {
    const eventName = this.getEventName(eventType);

    try {
      this.mixpanel.track(eventName, eventData);

      if (this.config.enableConsoleLogging) {
        console.log(`[MixpanelPlugin] Tracked event: ${eventName}`, eventData);
      }
    } catch (error) {
      console.error(
        `[MixpanelPlugin] Failed to track event: ${eventName}`,
        error,
      );
    }
  }

  private getEventName(eventType: keyof EventNameMapping): string {
    const customName = this.config.customEventNames?.[eventType];
    const defaultName = this.defaultEventNames[eventType];
    const eventName = customName || defaultName;

    return this.config.eventPrefix
      ? `${this.config.eventPrefix}${eventName}`
      : eventName;
  }

  // Helper methods for data extraction
  private getStepIndex(step: OnboardingStep<TContext>): number {
    // Get the index of the step in the relevant steps list
    if (this.engine && typeof this.engine.getRelevantSteps === "function") {
      const relevantSteps = this.engine.getRelevantSteps();
      const index = relevantSteps.findIndex((s) => s.id === step.id);
      return index !== -1 ? index : 0;
    }
    // Fallback to engine state if getRelevantSteps is not available
    return this._getEngineState().currentStepNumber - 1; // Convert to 0-based index
  }

  private isFirstStep(step: OnboardingStep<TContext>): boolean {
    return this.getStepIndex(step) === 0;
  }

  private isLastStep(step: OnboardingStep<TContext>): boolean {
    const totalSteps = this.getTotalSteps();
    return totalSteps > 0 && this.getStepIndex(step) === totalSteps - 1;
  }

  private calculateFlowProgress(): number {
    return this._getEngineState().progressPercentage;
  }

  private getTotalSteps(): number {
    return this._getEngineState().totalSteps ?? 0;
  }

  private getCompletedStepsCount(): number {
    const engineState = this._getEngineState();
    return engineState.completedSteps ?? 0;
  }

  private getSkippedStepsCount(context: TContext): number {
    // This would need to be implemented based on how skipped steps are tracked
    return (context as any).skippedSteps?.length || 0;
  }

  private getRetriedStepsCount(context: TContext): number {
    // Count unique steps that have been retried
    return this.retriedSteps.size;
  }

  private getFlowCompletionTime(context: TContext): number {
    // Get flow start time from internal tracking data
    const startedAt = context.flowData?._internal?.startedAt;
    return startedAt ? Date.now() - startedAt : 0;
  }

  private getPreviousStepId(context: TContext): string | undefined {
    // Get the previous step from engine state
    const engineState = this._getEngineState();
    return engineState.previousStepCandidate?.id?.toString();
  }

  private getCurrentStepId(context: TContext): string | number | undefined {
    // Get current step ID from engine state
    const engineState = this._getEngineState();
    return engineState.currentStep?.id;
  }

  private getCompletionMethod(stepData: any): string {
    if (stepData?.completionMethod) return stepData.completionMethod;
    if (stepData?.skipped) return "skipped";
    if (stepData?.automated) return "automated";
    return "manual";
  }

  private getNavigationType(
    previousStep: OnboardingStep<TContext>,
    currentStep: OnboardingStep<TContext>,
  ): string {
    const prevIndex = this.getStepIndex(previousStep);
    const currentIndex = this.getStepIndex(currentStep);

    if (currentIndex > prevIndex) return "forward";
    if (currentIndex < prevIndex) return "backward";
    return "same";
  }

  private getChangedKeys(
    oldData: Record<string, any>,
    newData: Record<string, any>,
  ): string[] {
    const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    return Array.from(keys).filter((key) => oldData[key] !== newData[key]);
  }

  private sanitizeStepData(stepData: any): any {
    if (!stepData) return stepData;

    // Remove sensitive data
    const sanitized = { ...stepData };
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.apiKey;
    delete sanitized.secret;

    return sanitized;
  }

  private _getEngineState(): EngineState<TContext> {
    return this.engine.getState();
  }
}
