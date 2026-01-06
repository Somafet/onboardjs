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
    StepSkippedEvent,
    StepRetriedEvent,
    StepValidationFailedEvent,
    StepHelpRequestedEvent,
    StepAbandonedEvent,
    NavigationBackEvent,
    NavigationForwardEvent,
    NavigationJumpEvent,
    StepRenderTimeEvent,
    PersistenceSuccessEvent,
    PersistenceFailureEvent,
    ChecklistItemToggledEvent,
    ChecklistProgressChangedEvent,
    PluginInstalledEvent,
    PluginErrorEvent,
    FlowInfo,
    AhaTracker,
} from '@onboardjs/core'
import { PostHog } from 'posthog-js'
import { ChurnRiskFactors, EventNameMapping, PostHogPluginConfig } from './types'
import { EventDataBuilder } from './utils/eventBuilder'
import { ChurnDetectionManager } from './utils/churnDetection'
import { PerformanceTracker } from './utils/performanceMetrics'

export class PostHogPlugin<TContext extends OnboardingContext> extends BasePlugin<TContext, PostHogPluginConfig> {
    readonly name = '@onboardjs/plugin-posthog'
    readonly version = '1.0.3'
    readonly description = 'Official PostHog analytics plugin for OnboardJS'

    private _posthog!: PostHog
    private _eventBuilder!: EventDataBuilder<TContext>
    private _churnDetection!: ChurnDetectionManager<TContext>
    private _performanceTracker!: PerformanceTracker
    private _progressMilestones = new Set<number>()

    private readonly _defaultEventNames: EventNameMapping = {
        // Flow events
        flowStarted: 'flow_started',
        flowCompleted: 'flow_completed',
        flowAbandoned: 'flow_abandoned',
        flowPaused: 'flow_paused',
        flowResumed: 'flow_resumed',
        flowReset: 'flow_reset',

        // Step events
        stepActive: 'step_active',
        stepCompleted: 'step_completed',
        stepSkipped: 'step_skipped',
        stepAbandoned: 'step_abandoned',
        stepRetried: 'step_retried',
        stepValidationFailed: 'step_validation_failed',
        stepHelpRequested: 'step_help_requested',

        // Navigation events
        navigationBack: 'navigation_back',
        navigationForward: 'navigation_forward',
        navigationJump: 'navigation_jump',

        // Interaction events
        userIdle: 'user_idle',
        userReturned: 'user_returned',
        dataChanged: 'data_changed',

        // Progress events
        progressMilestone: 'progress_milestone',
        highChurnRisk: 'high_churn_risk',

        // Performance events
        stepRenderSlow: 'step_render_slow',
        persistenceSuccess: 'persistence_success',
        persistenceFailure: 'persistence_failure',

        // Checklist events
        checklistItemToggled: 'checklist_item_toggled',
        checklistProgress: 'checklist_progress',

        // Experiment events
        experimentExposed: 'experiment_exposed',

        // Error events
        errorEncountered: 'error_encountered',
        pluginError: 'plugin_error',
    }

    protected async onInstall(): Promise<void> {
        // Initialize PostHog
        this._initializePostHog()

        // Initialize utilities
        this._eventBuilder = new EventDataBuilder(this.config)
        this._churnDetection = new ChurnDetectionManager(this.config.churnTimeoutMs, this.config.churnRiskThreshold)
        this._performanceTracker = new PerformanceTracker()

        // Hook into AhaTracker's analytics provider system
        this._setupAhaTracking()

        // Log installation
        if (this.config.debug) {
            console.info('[PostHogPlugin] Plugin installed successfully')
        }
    }

    protected async onUninstall(): Promise<void> {
        this._churnDetection.cleanup()
        this._performanceTracker.cleanup()
        this._progressMilestones.clear()

        if (this.config.debug) {
            console.info('[PostHogPlugin] Plugin uninstalled')
        }
    }

    protected getHooks(): PluginHooks<TContext> {
        return {
            // Flow-level events
            onFlowStarted: this._handleFlowStarted.bind(this),
            onFlowCompleted: this._handleFlowCompleted.bind(this),
            onFlowPaused: this._handleFlowPaused.bind(this),
            onFlowResumed: this._handleFlowResumed.bind(this),
            onFlowAbandoned: this._handleFlowAbandoned.bind(this),
            onFlowReset: this._handleFlowReset.bind(this),

            // Step-level events
            onStepActive: this._handleStepActive.bind(this),
            onStepCompleted: this._handleStepCompleted.bind(this),
            onStepSkipped: this._handleStepSkipped.bind(this),
            onStepRetried: this._handleStepRetried.bind(this),
            onStepValidationFailed: this._handleStepValidationFailed.bind(this),
            onStepHelpRequested: this._handleStepHelpRequested.bind(this),
            onStepAbandoned: this._handleStepAbandoned.bind(this),

            // Navigation events
            beforeStepChange: this._handleBeforeStepChange.bind(this),
            afterStepChange: this._handleAfterStepChange.bind(this),
            onNavigationBack: this._handleNavigationBack.bind(this),
            onNavigationForward: this._handleNavigationForward.bind(this),
            onNavigationJump: this._handleNavigationJump.bind(this),

            // Context events
            onContextUpdate: this._handleContextUpdate.bind(this),
            onDataChanged: this._handleDataChanged.bind(this),

            // Error events
            onError: this._handleError.bind(this),

            // Performance events
            onStepRenderTime: this._handleStepRenderTime.bind(this),
            onPersistenceSuccess: this._handlePersistenceSuccess.bind(this),
            onPersistenceFailure: this._handlePersistenceFailure.bind(this),

            // Checklist events
            onChecklistItemToggled: this._handleChecklistItemToggled.bind(this),
            onChecklistProgressChanged: this._handleChecklistProgressChanged.bind(this),

            // Plugin events
            onPluginInstalled: this._handlePluginInstalled.bind(this),
            onPluginError: this._handlePluginError.bind(this),
        }
    }

    private _initializePostHog(): void {
        if (this.config.posthogInstance) {
            this._posthog = this.config.posthogInstance
        } else if (this.config.apiKey) {
            // Initialize PostHog if not provided
            if (typeof window !== 'undefined') {
                const posthog: PostHog = require('posthog-js')
                this._posthog = posthog.init(this.config.apiKey, {
                    api_host: this.config.host || 'https://app.posthog.com',
                })
            } else {
                throw new Error('PostHog instance or API key required')
            }
        } else {
            throw new Error('PostHog configuration missing: provide either posthogInstance or apiKey')
        }
    }

    /**
     * Set up aha moment tracking integration with PostHog.
     * This registers PostHog as an analytics provider for AhaTracker events.
     *
     * When users call aha(), the events will be captured in PostHog automatically.
     */
    private _setupAhaTracking(): void {
        try {
            const tracker = AhaTracker.getInstance()

            // Register PostHog as a custom analytics provider
            tracker.addProvider({
                name: 'posthog',
                trackEvent: (event: any) => {
                    this._trackAhaEvent(event)
                },
            })

            if (this.config.debug) {
                console.info('[PostHogPlugin] Aha tracking integration initialized')
            }
        } catch (error) {
            if (this.config.debug) {
                console.warn(
                    '[PostHogPlugin] Could not set up aha tracking. AhaTracker may not be initialized yet.',
                    error
                )
            }
            // This is not critical - aha tracking will still work if AhaTracker is initialized after the plugin
        }
    }

    /**
     * Track aha moments in PostHog.
     * This method is called whenever an aha() event is tracked.
     */
    private _trackAhaEvent(event: any): void {
        try {
            // The event structure from AhaTracker has properties nested inside
            const properties = event.properties || event
            const aha_type = properties.aha_type || event.aha_type || 'unknown'

            const eventName = `onboarding_aha`

            const eventData = {
                // Map event fields to PostHog properties
                aha_type: aha_type,
                journey_stage: properties.journey_stage,
                timestamp: event.timestamp,
                session_id: event.sessionId,
                user_id: event.userId,
                flow_id: event.flowId,
                flow_name: event.flowName,
                flow_version: event.flowVersion,

                // Aha-specific metrics (from properties)
                first_aha: properties.first_aha,
                previous_aha_events: properties.previous_aha_events,
                time_to_aha_seconds: properties.time_to_aha_seconds,
                time_since_signup_seconds: properties.time_since_signup_seconds,

                // Spread any additional context and metrics
                ...(properties.context || {}),
                ...(properties.metrics || {}),
            }

            this._posthog.capture(eventName, eventData)

            if (this.config.enableConsoleLogging || this.config.debug) {
                console.info(`[PostHogPlugin] Aha event tracked: ${eventName}`, eventData)
            }
        } catch (error) {
            console.error('[PostHogPlugin] Failed to track aha event:', error)
        }
    }

    private _getFlowInfo(): FlowInfo | undefined {
        return this.engine && typeof this.engine.getFlowInfo === 'function' ? this.engine.getFlowInfo() : undefined
    }

    private async _handleStepActive(event: StepActiveEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('stepActive')) return
        const { step, context } = event

        // Start performance tracking
        if (this.config.enablePerformanceTracking) {
            this._performanceTracker.startRenderTimer(step.id.toString())
        }

        // Start churn detection
        if (this.config.enableChurnDetection) {
            this._churnDetection.startStepTimer(step.id)
            this._churnDetection.setupChurnTimeout(step, context, this._handleChurnDetected.bind(this))
        }

        // Track step activation
        const eventData = this._eventBuilder.buildEventData(
            'stepActive',
            {
                step_id: step.id,
                step_type: step.type,
                step_index: this._getStepIndex(step),
                is_first_step: this._isFirstStep(step),
                is_last_step: this._isLastStep(step),
                flow_progress_percentage: this._calculateFlowProgress(context),
                previous_step_id: this._getPreviousStepId(),
            },
            step,
            context,
            this._performanceTracker.getCurrentMetrics(),
            this._getFlowInfo()
        )

        this._captureEvent('stepActive', eventData)

        // Check progress milestones
        if (this.config.enableProgressMilestones) {
            this._checkProgressMilestones(context)
        }

        // Track experiment exposure if enabled
        if (this.config.enableExperimentTracking && this.config.experimentFlags) {
            this._trackExperimentExposure(context)
        }
    }

    private async _handleStepCompleted(event: StepCompletedEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('stepCompleted')) return

        const { step, context, stepData } = event

        // Clear churn timeout
        if (this.config.enableChurnDetection) {
            this._churnDetection.clearChurnTimeout(step.id.toString())
        }

        // End performance tracking
        let renderTime: number | undefined
        if (this.config.enablePerformanceTracking) {
            renderTime = this._performanceTracker.endRenderTimer(step.id.toString())
        }

        const eventData = this._eventBuilder.buildEventData(
            'stepCompleted',
            {
                step_id: step.id,
                step_type: step.type,
                step_data: this._sanitizeStepData(stepData),
                flow_progress_percentage: this._calculateFlowProgress(context),
                render_time_ms: renderTime,
            },
            step,
            context,
            {
                stepRenderTime: renderTime,
                ...this._performanceTracker.getCurrentMetrics(),
            },
            this._getFlowInfo()
        )

        this._captureEvent('stepCompleted', eventData)

        // Track slow render performance
        if (
            renderTime &&
            this.config.performanceThresholds?.slowRenderMs &&
            renderTime > this.config.performanceThresholds.slowRenderMs
        ) {
            this._trackSlowRender(step, context, renderTime)
        }
    }

    private async _handleFlowStarted(event: FlowStartedEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('flowStarted')) return
        const { context, startMethod } = event

        const eventData = this._eventBuilder.buildEventData(
            'flowStarted',
            {
                start_method: startMethod,
                total_steps: this._getTotalSteps(),
                flow_start_time_ms: Date.now(),
                initial_flow_data_size: JSON.stringify(context.flowData).length,
            },
            undefined,
            context,
            this._performanceTracker.getCurrentMetrics(),
            this._getFlowInfo()
        )

        this._captureEvent('flowStarted', eventData)
    }

    private async _handleFlowPaused(event: any): Promise<void> {
        if (!this._shouldTrackEvent('flowPaused')) return
        const { context, reason } = event
        const eventData = this._eventBuilder.buildEventData(
            'flowPaused',
            { reason },
            undefined,
            context,
            undefined,
            this._getFlowInfo()
        )
        this._captureEvent('flowPaused', eventData)
    }

    private async _handleFlowResumed(event: any): Promise<void> {
        if (!this._shouldTrackEvent('flowResumed')) return
        const { context, resumePoint } = event
        const eventData = this._eventBuilder.buildEventData(
            'flowResumed',
            { resume_point: resumePoint },
            undefined,
            context,
            undefined,
            this._getFlowInfo()
        )
        this._captureEvent('flowResumed', eventData)
    }

    private async _handleFlowAbandoned(event: any): Promise<void> {
        if (!this._shouldTrackEvent('flowAbandoned')) return
        const { context, abandonmentReason } = event
        const eventData = this._eventBuilder.buildEventData(
            'flowAbandoned',
            { abandonment_reason: abandonmentReason },
            undefined,
            context,
            undefined,
            this._getFlowInfo()
        )
        this._captureEvent('flowAbandoned', eventData)
    }

    private async _handleFlowReset(event: any): Promise<void> {
        if (!this._shouldTrackEvent('flowReset')) return
        const { context, resetReason } = event
        const eventData = this._eventBuilder.buildEventData(
            'flowReset',
            { reset_reason: resetReason },
            undefined,
            context,
            undefined,
            this._getFlowInfo()
        )
        this._captureEvent('flowReset', eventData)
    }

    private async _handleStepSkipped(event: StepSkippedEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('stepSkipped')) return
        const { step, context, skipReason } = event
        const eventData = this._eventBuilder.buildEventData(
            'stepSkipped',
            { step_id: step.id, skip_reason: skipReason },
            step,
            context,
            undefined,
            this._getFlowInfo()
        )
        this._captureEvent('stepSkipped', eventData)
    }

    private async _handleStepRetried(event: StepRetriedEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('stepRetried')) return
        const { step, context, retryCount } = event
        const eventData = this._eventBuilder.buildEventData(
            'stepRetried',
            { step_id: step.id, retry_count: retryCount },
            step,
            context,
            undefined,
            this._getFlowInfo()
        )
        this._captureEvent('stepRetried', eventData)
    }

    private async _handleStepValidationFailed(event: StepValidationFailedEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('stepValidationFailed')) return
        const { step, context, validationErrors } = event
        const eventData = this._eventBuilder.buildEventData(
            'stepValidationFailed',
            { step_id: step.id, validation_errors: validationErrors },
            step,
            context,
            undefined,
            this._getFlowInfo()
        )
        this._captureEvent('stepValidationFailed', eventData)
    }

    private async _handleStepHelpRequested(event: StepHelpRequestedEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('stepHelpRequested')) return
        const { step, context, helpType } = event
        const eventData = this._eventBuilder.buildEventData(
            'stepHelpRequested',
            { step_id: step.id, help_type: helpType },
            step,
            context,
            undefined,
            this._getFlowInfo()
        )
        this._captureEvent('stepHelpRequested', eventData)
    }

    private async _handleStepAbandoned(event: StepAbandonedEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('stepAbandoned')) return
        const { step, context, timeOnStep } = event
        const eventData = this._eventBuilder.buildEventData(
            'stepAbandoned',
            { step_id: step.id, time_on_step: timeOnStep },
            step,
            context,
            undefined,
            this._getFlowInfo()
        )
        this._captureEvent('stepAbandoned', eventData)
    }

    private async _handleNavigationBack(event: NavigationBackEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('navigationBack')) return
        const { fromStep, toStep, context } = event
        const eventData = this._eventBuilder.buildEventData(
            'navigationBack',
            { from_step_id: fromStep.id, to_step_id: toStep.id },
            toStep,
            context,
            undefined,
            this._getFlowInfo()
        )
        this._captureEvent('navigationBack', eventData)
    }

    private async _handleNavigationForward(event: NavigationForwardEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('navigationForward')) return
        const { fromStep, toStep, context } = event
        const eventData = this._eventBuilder.buildEventData(
            'navigationForward',
            { from_step_id: fromStep.id, to_step_id: toStep.id },
            toStep,
            context,
            undefined,
            this._getFlowInfo()
        )
        this._captureEvent('navigationForward', eventData)
    }

    private async _handleNavigationJump(event: NavigationJumpEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('navigationJump')) return
        const { fromStep, toStep, context } = event
        const eventData = this._eventBuilder.buildEventData(
            'navigationJump',
            { from_step_id: fromStep.id, to_step_id: toStep.id },
            toStep,
            context,
            undefined,
            this._getFlowInfo()
        )
        this._captureEvent('navigationJump', eventData)
    }

    private async _handleDataChanged(): Promise<void> {
        if (!this._shouldTrackEvent('dataChanged')) return
        // This is a stub, as contextUpdate is already handled. Implement if needed.
    }

    private async _handleStepRenderTime(event: StepRenderTimeEvent<TContext>): Promise<void> {
        // Not in EventNameMapping by default. Add if you want to track this event.
        if (this.config.debug) {
            console.info('[PostHogPlugin] stepRenderTime event', event)
        }
    }

    private async _handlePersistenceSuccess(event: PersistenceSuccessEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('persistenceSuccess')) return
        const { context, persistenceTime } = event
        const eventData = this._eventBuilder.buildEventData(
            'persistenceSuccess',
            { persistence_time: persistenceTime },
            undefined,
            context,
            undefined,
            this._getFlowInfo()
        )
        this._captureEvent('persistenceSuccess', eventData)
    }

    private async _handlePersistenceFailure(event: PersistenceFailureEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('persistenceFailure')) return
        const { context, error } = event
        const eventData = this._eventBuilder.buildEventData(
            'persistenceFailure',
            { error_message: error.message },
            undefined,
            context,
            undefined,
            this._getFlowInfo()
        )
        this._captureEvent('persistenceFailure', eventData)
    }

    private async _handleChecklistItemToggled(event: ChecklistItemToggledEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('checklistItemToggled')) return
        const { itemId, isCompleted, step, context } = event
        const eventData = this._eventBuilder.buildEventData(
            'checklistItemToggled',
            { item_id: itemId, is_completed: isCompleted },
            step,
            context,
            undefined,
            this._getFlowInfo()
        )
        this._captureEvent('checklistItemToggled', eventData)
    }

    private async _handleChecklistProgressChanged(event: ChecklistProgressChangedEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('checklistProgress')) return
        const { step, context, progress } = event
        const eventData = this._eventBuilder.buildEventData(
            'checklistProgress',
            { ...progress },
            step,
            context,
            undefined,
            this._getFlowInfo()
        )
        this._captureEvent('checklistProgress', eventData)
    }

    private async _handlePluginInstalled(event: PluginInstalledEvent): Promise<void> {
        // Not in EventNameMapping by default. Add if you want to track this event.
        if (this.config.debug) {
            console.info('[PostHogPlugin] pluginInstalled event', event)
        }
    }

    private async _handlePluginError(event: PluginErrorEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('pluginError')) return
        const { pluginName, error, context } = event
        const eventData = this._eventBuilder.buildEventData(
            'pluginError',
            { plugin_name: pluginName, error_message: error.message },
            undefined,
            context,
            undefined,
            this._getFlowInfo()
        )
        this._captureEvent('pluginError', eventData)
    }

    private async _handleFlowCompleted(event: FlowCompletedEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('flowCompleted')) return
        const context = event.context

        const eventData = this._eventBuilder.buildEventData(
            'flowCompleted',
            {
                total_steps: this._getTotalSteps(),
                completion_time_ms: this._getFlowCompletionTime(context),
                final_flow_data_size: JSON.stringify(context.flowData).length,
            },
            undefined,
            context,
            this._performanceTracker.getCurrentMetrics(),
            this._getFlowInfo()
        )

        this._captureEvent('flowCompleted', eventData)

        // Clean up tracking data
        this._progressMilestones.clear()
    }

    private async _handleBeforeStepChange(event: any): Promise<void> {
        // Track navigation patterns
        if (event.direction === 'previous') {
            const userId = event.currentStep?.context?.currentUser?.id || 'anonymous'
            this._churnDetection.recordBackNavigation(userId)
        }
    }

    private async _handleAfterStepChange(event: StepChangeEvent<TContext>): Promise<void> {
        const { oldStep: previousStep, newStep: currentStep, context } = event

        if (!previousStep || !currentStep) return

        // Determine navigation type
        const navigationType = this._getNavigationType(previousStep, currentStep)

        if (this._shouldTrackEvent(`navigation${navigationType}`)) {
            const eventData = this._eventBuilder.buildEventData(
                `navigation${navigationType}`,
                {
                    from_step_id: previousStep.id,
                    to_step_id: currentStep.id,
                    from_step_type: previousStep.type,
                    to_step_type: currentStep.type,
                    navigation_time_ms: Date.now(), // Could be more precise
                },
                currentStep,
                context
            )

            this._captureEvent(`navigation${navigationType}`, eventData)
        }
    }

    private async _handleContextUpdate(event: ContextUpdateEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('dataChanged')) return

        const { oldContext, newContext } = event

        const changedKeys = this._getChangedKeys(oldContext.flowData, newContext.flowData)

        if (changedKeys.length > 0) {
            const eventData = this._eventBuilder.buildEventData(
                'dataChanged',
                {
                    changed_keys: changedKeys,
                    data_size_before: JSON.stringify(oldContext.flowData).length,
                    data_size_after: JSON.stringify(newContext.flowData).length,
                },
                undefined,
                newContext
            )

            this._captureEvent('dataChanged', eventData)
        }
    }

    private async _handleError(event: ErrorEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('errorEncountered')) return
        const { error, context } = event

        // Record error for churn detection
        const userId = context.currentUser?.id || 'anonymous'
        this._churnDetection.recordError(userId)

        const eventData = this._eventBuilder.buildEventData(
            'errorEncountered',
            {
                error_message: error.message,
                error_stack: error.stack,
                error_name: error.name,
                current_step_id: this._getCurrentStepId(context),
            },
            undefined,
            context,
            undefined,
            this._getFlowInfo()
        )

        this._captureEvent('errorEncountered', eventData)
    }

    private _handleChurnDetected(
        step: OnboardingStep<TContext>,
        context: TContext,
        riskFactors: ChurnRiskFactors
    ): void {
        if (!this._shouldTrackEvent('stepAbandoned')) return

        const churnRisk = this._churnDetection.calculateChurnRisk(step, context)
        const isHighRisk = this._churnDetection.isHighChurnRisk(step, context)

        const eventData = this._eventBuilder.buildEventData(
            'stepAbandoned',
            {
                step_id: step.id,
                step_type: step.type,
                churn_risk_score: churnRisk,
                is_high_risk: isHighRisk, // NEW: Boolean flag for easy filtering
                risk_threshold: this._churnDetection.getChurnRiskThreshold(), // NEW: Include threshold for context
                time_on_step_ms: riskFactors.timeOnStep,
                back_navigation_count: riskFactors.backNavigationCount,
                error_count: riskFactors.errorCount,
                idle_time_ms: riskFactors.idleTime,
                validation_failures: riskFactors.validationFailures,
            },
            step,
            context,
            undefined,
            this._getFlowInfo()
        )

        this._captureEvent('stepAbandoned', eventData)

        // Optional: Trigger additional high-risk events for easier PostHog filtering
        if (isHighRisk) {
            const highRiskEventData = this._eventBuilder.buildEventData(
                'highChurnRisk',
                {
                    step_id: step.id,
                    churn_risk_score: churnRisk,
                    primary_risk_factor: this._getPrimaryRiskFactor(riskFactors),
                },
                step,
                context,
                undefined,
                this._getFlowInfo()
            )

            // You might want to add 'highChurnRisk' to EventNameMapping if you use this
            this._captureEvent('highChurnRisk', highRiskEventData)
        }
    }

    // Helper method to identify the primary risk factor
    private _getPrimaryRiskFactor(riskFactors: ChurnRiskFactors): string {
        const factors = {
            timeOnStep: riskFactors.timeOnStep / this._churnDetection.getChurnRiskThreshold(),
            backNavigation: riskFactors.backNavigationCount,
            errors: riskFactors.errorCount,
            idle: riskFactors.idleTime / 60000, // Convert to minutes
            validationFailures: riskFactors.validationFailures,
        }

        // Find the highest risk factor
        const maxFactor = Object.entries(factors).reduce(
            (max, [key, value]) => (value > max.value ? { key, value } : max),
            { key: 'unknown', value: 0 }
        )

        return maxFactor.key
    }

    private _checkProgressMilestones(context: TContext): void {
        const progress = this._calculateFlowProgress(context)
        const milestones = this.config.milestonePercentages || [25, 50, 75, 100]

        milestones.forEach((milestone) => {
            if (progress >= milestone && !this._progressMilestones.has(milestone)) {
                this._progressMilestones.add(milestone)

                const eventData = this._eventBuilder.buildEventData(
                    'progressMilestone',
                    {
                        milestone_percentage: milestone,
                        actual_progress: progress,
                        steps_completed: this._getCompletedStepsCount(context),
                    },
                    undefined,
                    context,
                    undefined,
                    this._getFlowInfo()
                )

                this._captureEvent('progressMilestone', eventData)
            }
        })
    }

    private _trackExperimentExposure(context: TContext): void {
        if (!this.config.experimentFlags) return

        this.config.experimentFlags.forEach((flagName) => {
            const variant = this._posthog.getFeatureFlag(flagName)
            if (variant) {
                const eventData = this._eventBuilder.buildEventData(
                    'experimentExposed',
                    {
                        experiment_flag: flagName,
                        variant: variant,
                        user_id: context.currentUser?.id,
                    },
                    undefined,
                    context
                )

                this._captureEvent('experimentExposed', eventData)
            }
        })
    }

    private _trackSlowRender(step: OnboardingStep<TContext>, context: TContext, renderTime: number): void {
        const eventData = this._eventBuilder.buildEventData(
            'stepRenderSlow',
            {
                step_id: step.id,
                step_type: step.type,
                render_time_ms: renderTime,
                threshold_ms: this.config.performanceThresholds?.slowRenderMs,
            },
            step,
            context
        )

        this._captureEvent('stepRenderSlow', eventData)
    }

    // Utility methods
    private _shouldTrackEvent(eventType: keyof EventNameMapping): boolean {
        if (this.config.includeOnlyEvents) {
            return this.config.includeOnlyEvents.includes(eventType)
        }

        if (this.config.excludeEvents) {
            return !this.config.excludeEvents.includes(eventType)
        }

        return true
    }

    private _captureEvent(eventType: keyof EventNameMapping, eventData: Record<string, any>): void {
        const eventName = this._getEventName(eventType)

        try {
            this._posthog.capture(eventName, eventData)

            if (this.config.enableConsoleLogging) {
                console.info(`[PostHogPlugin] Event captured: ${eventName}`, eventData)
            }
        } catch (error) {
            console.error(`[PostHogPlugin] Failed to capture event ${eventName}:`, error)

            // Track plugin errors
            this._posthog.capture(this._getEventName('pluginError'), {
                plugin_name: this.name,
                error_message: error instanceof Error ? error.message : String(error),
                failed_event: eventName,
            })
        }
    }

    private _getEventName(eventType: keyof EventNameMapping): string {
        const prefix = this.config.eventPrefix || 'onboarding_'
        const customName = this.config.customEventNames?.[eventType]
        const defaultName = this._defaultEventNames[eventType]

        return customName || `${prefix}${defaultName}`
    }

    // Helper methods for data extraction
    private _getStepIndex(step: OnboardingStep<TContext>): number {
        // This would need to be implemented based on your engine's step management
        return this.engine.getStepIndex(step.id)
    }

    private _isFirstStep(step: OnboardingStep<TContext>): boolean {
        return this._getStepIndex(step) === 0
    }

    private _isLastStep(step: OnboardingStep<TContext>): boolean {
        return this._getStepIndex(step) === this._getTotalSteps() - 1
    }

    private _calculateFlowProgress(context: TContext): number {
        // Calculate based on completed steps vs total steps
        const totalSteps = this._getTotalSteps()
        const completedSteps = this._getCompletedStepsCount(context)
        return totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
    }

    private _getTotalSteps(): number {
        // Get from engine
        return this.engine.getRelevantSteps().length
    }

    private _getCompletedStepsCount(context: TContext): number {
        return Object.keys(context.flowData._internal?.completedSteps || {}).length
    }

    private _getFlowCompletionTime(context: TContext): number {
        const startTime = context.flowData._internal?.startedAt
        return startTime ? Date.now() - startTime : 0
    }

    private _getPreviousStepId() {
        // Get from engine state or history
        return this.engine.getState().previousStepCandidate?.id
    }

    private _getCurrentStepId(context: TContext): string | undefined {
        // Get from engine state or current step
        return context.currentStep?.id // Placeholder
    }

    private _getCompletionMethod(): string {
        // Determine how the step was completed (button click, form submit, etc.)
        return 'unknown' // Placeholder
    }

    private _getNavigationType(previousStep: OnboardingStep<TContext>, currentStep: OnboardingStep<TContext>) {
        // Determine if it's forward, back, or jump navigation
        const prevIndex = this._getStepIndex(previousStep)
        const currIndex = this._getStepIndex(currentStep)

        if (currIndex > prevIndex) return 'Forward'
        if (currIndex < prevIndex) return 'Back'
        return 'Jump'
    }

    private _getChangedKeys(oldData: Record<string, any>, newData: Record<string, any>): string[] {
        const changedKeys: string[] = []
        const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)])

        allKeys.forEach((key) => {
            if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
                changedKeys.push(key)
            }
        })

        return changedKeys
    }

    private _sanitizeStepData(stepData: any): any {
        // Apply the same sanitization as the event builder
        return this.config.sanitizeData ? this.config.sanitizeData(stepData) : stepData
    }
}
