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
    AhaTracker,
} from '@onboardjs/core'
// Mixpanel interface definition
interface Mixpanel {
    init(token: string, config?: any): void
    track(event: string, properties?: any): void
    people: {
        set(properties: any): void
    }
}

// Import mixpanel-browser with proper typing
let mixpanel: Mixpanel

// Handle both browser and server environments
if (typeof window !== 'undefined') {
    try {
        // Dynamic import for browser environment
        mixpanel = require('mixpanel-browser') as Mixpanel
    } catch {
        console.warn('[MixpanelPlugin] Failed to import mixpanel-browser. Make sure it is installed.')
        // Create a no-op implementation for fallback
        mixpanel = {
            init: () => {},
            track: () => {},
            people: { set: () => {} },
        }
    }
} else {
    // Server-side fallback
    mixpanel = {
        init: () => {},
        track: () => {},
        people: { set: () => {} },
    }
}

import { MixpanelPluginConfig, EventNameMapping, ChurnRiskFactors } from './types'
import { EventDataBuilder } from './utils/eventBuilder'
import { ChurnDetectionManager } from './utils/churnDetection'
import { PerformanceTracker } from './utils/performanceMetrics'

export class MixpanelPlugin<TContext extends OnboardingContext> extends BasePlugin<TContext, MixpanelPluginConfig> {
    readonly name = '@onboardjs/plugin-mixpanel'
    readonly version = '1.0.0'
    readonly description = 'Official Mixpanel analytics plugin for OnboardJS'

    private _mixpanel!: Mixpanel
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
        // Initialize Mixpanel
        this._initializeMixpanel()

        // Initialize utilities
        this._eventBuilder = new EventDataBuilder(this.config)
        this._churnDetection = new ChurnDetectionManager(this.config.churnTimeoutMs, this.config.churnRiskThreshold)
        this._performanceTracker = new PerformanceTracker()

        // Hook into AhaTracker's analytics provider system
        this._setupAhaTracking()

        // Log installation
        if (this.config.debug) {
            console.info(`[MixpanelPlugin] Plugin installed with config:`, {
                token: this.config.token ? '***' : 'not provided',
                mixpanelInstance: !!this.config.mixpanelInstance,
                eventPrefix: this.config.eventPrefix,
            })
        }
    }

    protected async onUninstall(): Promise<void> {
        this._churnDetection.cleanup()
        this._performanceTracker.cleanup()
        this._progressMilestones.clear()

        if (this.config.debug) {
            console.info(`[MixpanelPlugin] Plugin uninstalled`)
        }
    }

    protected getHooks(): PluginHooks<TContext> {
        return {
            onFlowStarted: this._handleFlowStarted.bind(this),
            onFlowCompleted: this._handleFlowCompleted.bind(this),
            onFlowPaused: this._handleFlowPaused.bind(this),
            onFlowResumed: this._handleFlowResumed.bind(this),
            onFlowAbandoned: this._handleFlowAbandoned.bind(this),
            onFlowReset: this._handleFlowReset.bind(this),
            onStepActive: this._handleStepActive.bind(this),
            onStepCompleted: this._handleStepCompleted.bind(this),
            onStepSkipped: this._handleStepSkipped.bind(this),
            onStepRetried: this._handleStepRetried.bind(this),
            onStepValidationFailed: this._handleStepValidationFailed.bind(this),
            onStepHelpRequested: this._handleStepHelpRequested.bind(this),
            onStepAbandoned: this._handleStepAbandoned.bind(this),
            beforeStepChange: this._handleBeforeStepChange.bind(this),
            afterStepChange: this._handleAfterStepChange.bind(this),
            onNavigationBack: this._handleNavigationBack.bind(this),
            onNavigationForward: this._handleNavigationForward.bind(this),
            onNavigationJump: this._handleNavigationJump.bind(this),
            onContextUpdate: this._handleContextUpdate.bind(this),
            onDataChanged: this._handleDataChanged.bind(this),
            onError: this._handleError.bind(this),
            onStepRenderTime: this._handleStepRenderTime.bind(this),
            onPersistenceSuccess: this._handlePersistenceSuccess.bind(this),
            onPersistenceFailure: this._handlePersistenceFailure.bind(this),
            onChecklistItemToggled: this._handleChecklistItemToggled.bind(this),
            onChecklistProgressChanged: this._handleChecklistProgressChanged.bind(this),
            onPluginInstalled: this._handlePluginInstalled.bind(this),
            onPluginError: this._handlePluginError.bind(this),
        }
    }

    private _initializeMixpanel(): void {
        if (this.config.mixpanelInstance) {
            this._mixpanel = this.config.mixpanelInstance
            this._debugLog('Using provided Mixpanel instance')
        } else if (this.config.token) {
            mixpanel.init(this.config.token, this.config.config || {})
            this._mixpanel = mixpanel
            this._debugLog('Initialized Mixpanel with token')
        } else {
            throw new Error('MixpanelPlugin requires either a token or a mixpanelInstance to be provided in config')
        }
    }

    /**
     * Set up aha moment tracking integration with Mixpanel.
     * This registers Mixpanel as an analytics provider for AhaTracker events.
     *
     * When users call aha(), the events will be captured in Mixpanel automatically.
     */
    private _setupAhaTracking(): void {
        try {
            const tracker = AhaTracker.getInstance()

            // Register Mixpanel as a custom analytics provider
            tracker.addProvider({
                name: 'mixpanel',
                trackEvent: (event: any) => {
                    this._trackAhaEvent(event)
                },
            })

            if (this.config.debug) {
                console.info('[MixpanelPlugin] Aha tracking integration initialized')
            }
        } catch (error) {
            if (this.config.debug) {
                console.warn(
                    '[MixpanelPlugin] Could not set up aha tracking. AhaTracker may not be initialized yet.',
                    error
                )
            }
            // This is not critical - aha tracking will still work if AhaTracker is initialized after the plugin
        }
    }

    /**
     * Track aha moments in Mixpanel.
     * This method is called whenever an aha() event is tracked.
     */
    private _trackAhaEvent(event: any): void {
        try {
            // The event structure from AhaTracker has properties nested inside
            const properties = event.properties || event
            const aha_type = properties.aha_type || event.aha_type || 'unknown'

            const eventName = `onboarding_aha`

            const eventData = {
                // Map event fields to Mixpanel properties
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

            this._mixpanel.track(eventName, eventData)

            if (this.config.enableConsoleLogging || this.config.debug) {
                console.info(`[MixpanelPlugin] Aha event tracked: ${eventName}`, eventData)
            }
        } catch (error) {
            console.error('[MixpanelPlugin] Failed to track aha event:', error)
        }
    }

    private _getFlowInfo(): FlowInfo | undefined {
        return this.engine && typeof this.engine.getFlowInfo === 'function' ? this.engine.getFlowInfo() : undefined
    }

    private _debugLog(message: string, data?: any): void {
        if (this.config.debug) {
            console.info(`[MixpanelPlugin] ${message}`, data || '')
        }
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
                flow_progress_percentage: this._calculateFlowProgress(),
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
                flow_progress_percentage: this._calculateFlowProgress(),
                render_time_ms: renderTime,
                completion_method: this._getCompletionMethod(stepData),
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

        // Set user properties if user exists
        if (context.currentUser && this.config.includeUserProperties) {
            const userProperties = this._eventBuilder['buildUserProperties'](context.currentUser)
            this._mixpanel.people.set(userProperties)
        }
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

        // Record validation failure for churn detection
        if (this.config.enableChurnDetection && context.currentUser) {
            this._churnDetection.recordValidationFailure(context.currentUser.id)
        }

        const eventData = this._eventBuilder.buildEventData(
            'stepValidationFailed',
            {
                step_id: step.id,
                validation_errors: validationErrors,
                error_count: Array.isArray(validationErrors) ? validationErrors.length : 1,
            },
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
            { step_id: step.id, time_on_step_ms: timeOnStep },
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

        // Record back navigation for churn detection
        if (this.config.enableChurnDetection && context.currentUser) {
            this._churnDetection.recordBackNavigation(context.currentUser.id)
        }

        const eventData = this._eventBuilder.buildEventData(
            'navigationBack',
            {
                from_step_id: fromStep.id,
                to_step_id: toStep.id,
                navigation_type: this._getNavigationType(fromStep, toStep),
            },
            fromStep,
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
            {
                from_step_id: fromStep.id,
                to_step_id: toStep.id,
                navigation_type: this._getNavigationType(fromStep, toStep),
            },
            fromStep,
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
            {
                from_step_id: fromStep?.id,
                to_step_id: toStep.id,
                jump_distance: fromStep ? Math.abs(this._getStepIndex(toStep) - this._getStepIndex(fromStep)) : 0,
            },
            toStep,
            context,
            undefined,
            this._getFlowInfo()
        )
        this._captureEvent('navigationJump', eventData)
    }

    private async _handleDataChanged(event: DataChangedEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('dataChanged')) return
        const { step, context, changedFields } = event
        const eventData = this._eventBuilder.buildEventData(
            'dataChanged',
            {
                changed_keys: changedFields,
                change_count: changedFields.length,
            },
            step,
            context,
            undefined,
            this._getFlowInfo()
        )
        this._captureEvent('dataChanged', eventData)
    }

    private async _handleStepRenderTime(event: StepRenderTimeEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('stepRenderSlow')) return

        const { step, context, renderTime } = event

        if (
            this.config.performanceThresholds?.slowRenderMs &&
            renderTime > this.config.performanceThresholds.slowRenderMs
        ) {
            this._trackSlowRender(step, context, renderTime)
        }
    }

    private async _handlePersistenceSuccess(event: PersistenceSuccessEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('persistenceSuccess')) return
        const { context, persistenceTime } = event
        const eventData = this._eventBuilder.buildEventData(
            'persistenceSuccess',
            { persistence_time_ms: persistenceTime },
            undefined,
            context,
            { persistenceTime },
            this._getFlowInfo()
        )
        this._captureEvent('persistenceSuccess', eventData)
    }

    private async _handlePersistenceFailure(event: PersistenceFailureEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('persistenceFailure')) return
        const { context, error } = event
        const eventData = this._eventBuilder.buildEventData(
            'persistenceFailure',
            { error_message: error.message, error_type: error.name },
            undefined,
            context,
            undefined,
            this._getFlowInfo()
        )
        this._captureEvent('persistenceFailure', eventData)
    }

    private async _handleChecklistItemToggled(event: ChecklistItemToggledEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('checklistItemToggled')) return
        const { step, context, itemId, isCompleted } = event
        const eventData = this._eventBuilder.buildEventData(
            'checklistItemToggled',
            { step_id: step.id, item_id: itemId, checked: isCompleted },
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
            {
                step_id: step.id,
                completed_items: progress.completed,
                total_items: progress.total,
                completion_percentage: progress.percentage,
            },
            step,
            context,
            undefined,
            this._getFlowInfo()
        )
        this._captureEvent('checklistProgress', eventData)
    }

    private async _handlePluginInstalled(event: PluginInstalledEvent): Promise<void> {
        const { pluginName, pluginVersion } = event

        // Don't track our own installation to avoid infinite loops
        if (pluginName === this.name) return

        const eventData = {
            plugin_name: pluginName,
            plugin_version: pluginVersion,
            timestamp: new Date().toISOString(),
        }

        // Use track directly since pluginInstalled is not in our EventNameMapping
        try {
            this._mixpanel.track(
                this._getEventName('flowStarted').replace('flow_started', 'plugin_installed'),
                eventData
            )

            if (this.config.enableConsoleLogging) {
                this._debugLog('Tracked plugin installation:', eventData)
            }
        } catch (error) {
            console.error(`[MixpanelPlugin] Failed to track plugin installation:`, error)
        }
    }

    private async _handlePluginError(event: PluginErrorEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('pluginError')) return
        const { pluginName, error, context } = event
        const eventData = this._eventBuilder.buildEventData(
            'pluginError',
            {
                plugin_name: pluginName,
                error_message: error.message,
                error_type: error.name,
                error_stack: error.stack,
            },
            undefined,
            context,
            undefined,
            this._getFlowInfo()
        )
        this._captureEvent('pluginError', eventData)
    }

    private async _handleFlowCompleted(event: FlowCompletedEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('flowCompleted')) return

        const { context, duration } = event

        const eventData = this._eventBuilder.buildEventData(
            'flowCompleted',
            {
                completion_time_ms: duration,
                total_steps: this._getTotalSteps(),
                completed_steps: this._getCompletedStepsCount(),
                flow_completion_time_ms: this._getFlowCompletionTime(context),
            },
            undefined,
            context,
            this._performanceTracker.getCurrentMetrics(),
            this._getFlowInfo()
        )

        this._captureEvent('flowCompleted', eventData)
    }

    private async _handleBeforeStepChange(event: any): Promise<void> {
        // This is called before step transitions, useful for cleanup
        if (this.config.enablePerformanceTracking && event.fromStep) {
            this._performanceTracker.endRenderTimer(event.fromStep.id.toString())
        }
    }

    private async _handleAfterStepChange(event: StepChangeEvent<TContext>): Promise<void> {
        // This is called after step transitions
        if (this.config.enablePerformanceTracking && event.newStep) {
            this._performanceTracker.startRenderTimer(event.newStep.id.toString())
        }
    }

    private async _handleContextUpdate(event: ContextUpdateEvent<TContext>): Promise<void> {
        // Update user properties in Mixpanel if user data changed
        if (
            event.newContext.currentUser &&
            this.config.includeUserProperties &&
            // Check if the user object has changed by comparing old and new
            JSON.stringify(event.oldContext.currentUser) !== JSON.stringify(event.newContext.currentUser)
        ) {
            const userProperties = this._eventBuilder['buildUserProperties'](event.newContext.currentUser)
            this._mixpanel.people.set(userProperties)
        }
    }

    private async _handleError(event: ErrorEvent<TContext>): Promise<void> {
        if (!this._shouldTrackEvent('errorEncountered')) return

        const { error, context } = event

        // Record error for churn detection
        if (this.config.enableChurnDetection && context.currentUser) {
            this._churnDetection.recordError(context.currentUser.id)
        }

        const eventData = this._eventBuilder.buildEventData(
            'errorEncountered',
            {
                error_message: error.message,
                error_type: error.name,
                error_stack: error.stack,
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
        if (!this._shouldTrackEvent('highChurnRisk')) return

        const eventData = this._eventBuilder.buildEventData(
            'highChurnRisk',
            {
                step_id: step.id,
                risk_score: this._churnDetection.calculateChurnRisk(step, context),
                time_on_step_ms: riskFactors.timeOnStep,
                back_navigation_count: riskFactors.backNavigationCount,
                error_count: riskFactors.errorCount,
                idle_time_ms: riskFactors.idleTime,
                validation_failures: riskFactors.validationFailures,
                primary_risk_factor: this._getPrimaryRiskFactor(riskFactors),
            },
            step,
            context,
            undefined,
            this._getFlowInfo()
        )

        this._captureEvent('highChurnRisk', eventData)
    }

    // Helper method to identify the primary risk factor
    private _getPrimaryRiskFactor(riskFactors: ChurnRiskFactors): string {
        const factors = {
            time: riskFactors.timeOnStep,
            navigation: riskFactors.backNavigationCount * 60000, // Convert to ms equivalent
            errors: riskFactors.errorCount * 120000, // Higher weight for errors
            idle: riskFactors.idleTime,
            validation: riskFactors.validationFailures * 90000,
        }

        return Object.entries(factors).reduce((a, b) =>
            factors[a[0] as keyof typeof factors] > factors[b[0] as keyof typeof factors] ? a : b
        )[0]
    }

    private _checkProgressMilestones(context: TContext): void {
        const progress = this._calculateFlowProgress()
        const milestones = this.config.milestonePercentages || [25, 50, 75, 100]

        for (const milestone of milestones) {
            if (progress >= milestone && !this._progressMilestones.has(milestone)) {
                this._progressMilestones.add(milestone)

                const eventData = this._eventBuilder.buildEventData(
                    'progressMilestone',
                    {
                        milestone_percentage: milestone,
                        current_progress: progress,
                        steps_completed: this._getCompletedStepsCount(),
                        total_steps: this._getTotalSteps(),
                    },
                    undefined,
                    context,
                    undefined,
                    this._getFlowInfo()
                )

                this._captureEvent('progressMilestone', eventData)
            }
        }
    }

    private _trackExperimentExposure(context: TContext): void {
        if (!this.config.experimentFlags) return

        for (const flag of this.config.experimentFlags) {
            // Assuming experiment data is stored in context
            const experimentData = (context as any).experiments?.[flag]
            if (experimentData) {
                const eventData = this._eventBuilder.buildEventData(
                    'experimentExposed',
                    {
                        experiment_flag: flag,
                        experiment_variant: experimentData.variant,
                        experiment_id: experimentData.id,
                    },
                    undefined,
                    context,
                    undefined,
                    this._getFlowInfo()
                )

                this._captureEvent('experimentExposed', eventData)
            }
        }
    }

    private _trackSlowRender(step: OnboardingStep<TContext>, context: TContext, renderTime: number): void {
        const eventData = this._eventBuilder.buildEventData(
            'stepRenderSlow',
            {
                step_id: step.id,
                render_time_ms: renderTime,
                threshold_ms: this.config.performanceThresholds?.slowRenderMs,
                performance_ratio: renderTime / (this.config.performanceThresholds?.slowRenderMs || 1),
            },
            step,
            context,
            { stepRenderTime: renderTime },
            this._getFlowInfo()
        )

        this._captureEvent('stepRenderSlow', eventData)
    }

    // Utility methods
    private _shouldTrackEvent(eventType: keyof EventNameMapping): boolean {
        // Check if event is excluded
        if (this.config.excludeEvents?.includes(eventType)) {
            return false
        }

        // Check if only specific events should be included
        if (this.config.includeOnlyEvents && !this.config.includeOnlyEvents.includes(eventType)) {
            return false
        }

        return true
    }

    private _captureEvent(eventType: keyof EventNameMapping, eventData: Record<string, any>): void {
        const eventName = this._getEventName(eventType)

        try {
            this._mixpanel.track(eventName, eventData)

            if (this.config.enableConsoleLogging) {
                console.info(`[MixpanelPlugin] Tracked event: ${eventName}`, eventData)
            }
        } catch (error) {
            console.error(`[MixpanelPlugin] Failed to track event: ${eventName}`, error)
        }
    }

    private _getEventName(eventType: keyof EventNameMapping): string {
        const customName = this.config.customEventNames?.[eventType]
        const defaultName = this._defaultEventNames[eventType]
        const eventName = customName || defaultName

        return this.config.eventPrefix ? `${this.config.eventPrefix}${eventName}` : eventName
    }

    // Helper methods for data extraction
    private _getStepIndex(step: OnboardingStep<TContext>): number {
        return this.engine.getStepIndex(step.id)
    }

    private _isFirstStep(): boolean {
        const currentStep = this.engine.getState().currentStep

        if (!currentStep) return false

        return this._getStepIndex(currentStep) === 0
    }

    private _isLastStep(): boolean {
        const totalSteps = this._getTotalSteps()
        const currentStep = this.engine.getState().currentStep

        if (!currentStep) return false
        return totalSteps > 0 && this._getStepIndex(currentStep) === totalSteps - 1
    }

    private _calculateFlowProgress(): number {
        return this._getEngineState().progressPercentage
    }

    private _getTotalSteps(): number {
        return this.engine.getRelevantSteps().length
    }

    private _getCompletedStepsCount(): number {
        // This would need to be implemented based on how completed steps are tracked
        return this._getEngineState().completedSteps ?? 0
    }

    private _getFlowCompletionTime(context: TContext): number {
        // This would need to be implemented based on how flow start time is tracked
        const startTime = (context as any).flowStartTime
        return startTime ? Date.now() - startTime : 0
    }

    private _getPreviousStepId() {
        // This would need to be implemented based on your navigation history tracking
        return this.engine.getState().previousStepCandidate?.id
    }

    private _getCompletionMethod(stepData: any): string {
        if (stepData?.completionMethod) return stepData.completionMethod
        if (stepData?.skipped) return 'skipped'
        if (stepData?.automated) return 'automated'
        return 'unknown'
    }

    private _getNavigationType(previousStep: OnboardingStep<TContext>, currentStep: OnboardingStep<TContext>): string {
        const prevIndex = this._getStepIndex(previousStep)
        const currentIndex = this._getStepIndex(currentStep)

        if (currentIndex > prevIndex) return 'Forward'
        if (currentIndex < prevIndex) return 'Back'
        return 'Jump'
    }

    private _sanitizeStepData(stepData: any): any {
        if (!stepData) return stepData

        // Remove sensitive data
        const sanitized = { ...stepData }
        delete sanitized.password
        delete sanitized.token
        delete sanitized.apiKey
        delete sanitized.secret

        return sanitized
    }

    private _getEngineState(): EngineState<TContext> {
        return this.engine.getState()
    }
}
