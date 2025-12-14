import { Logger } from '../services/Logger'
import { OnboardingContext, OnboardingStep } from '../types'
import { AnalyticsProvider, AnalyticsConfig } from './types'
import { AnalyticsCoordinator } from './AnalyticsCoordinator'

/**
 * AnalyticsManager v2 - Refactored facade for analytics operations
 *
 * Delegates to specialized trackers via AnalyticsCoordinator:
 * - SessionTracker: session lifecycle, sessionId, userId, flowId
 * - PerformanceTracker: render times, navigation times (with LRU memory limits)
 * - ActivityTracker: idle detection, user activity state
 * - ProgressMilestoneTracker: progress percentage and milestone tracking
 *
 * Responsibilities:
 * - High-level event tracking (step, flow, navigation events)
 * - Context-dependent metric calculations (step index, progress, churn risk)
 * - Step duration tracking and performance analytics
 */
export class AnalyticsManager<TContext extends OnboardingContext = OnboardingContext> {
    private _coordinator: AnalyticsCoordinator
    private _logger: Logger
    private _config: AnalyticsConfig
    private _stepStartTimes: Map<string | number, number> = new Map()

    constructor(config: AnalyticsConfig = {}, logger?: Logger) {
        this._config = config
        this._logger = logger || Logger.getInstance({ debugMode: config.debug, prefix: 'AnalyticsManager' })
        this._coordinator = new AnalyticsCoordinator(config, this._logger)
    }

    registerProvider(provider: AnalyticsProvider): void {
        this._coordinator.registerProvider(provider)
    }

    get providerCount(): number {
        return this._coordinator.providerCount
    }

    setUserId(userId: string): void {
        this._coordinator.setUserId(userId)
    }

    setFlowId(flowId: string): void {
        this._coordinator.setFlowId(flowId)
    }

    setFlowInfo(flowInfo: {
        flowId?: string
        flowName?: string
        flowVersion?: string
        flowMetadata?: Record<string, unknown>
        instanceId?: number
    }): void {
        this._coordinator.setFlowInfo(flowInfo)
    }

    async flush(): Promise<void> {
        await this._coordinator.flush()
    }

    // ==================== Core Tracking Methods ====================

    trackEvent(eventType: string, properties: Record<string, any> = {}): void {
        this._coordinator.trackEvent(eventType, properties)
    }

    trackStepViewed(step: OnboardingStep<TContext>, context: TContext): void {
        this._stepStartTimes.set(step.id, Date.now())

        this.trackEvent('step_viewed', {
            stepId: step.id,
            stepType: step.type,
            hasCondition: !!step.condition,
            isSkippable: !!step.isSkippable,
            hasValidation: this._hasValidation(step),
            payloadKeys: Object.keys(step.payload || {}),
            payloadSize: JSON.stringify(step.payload || {}).length,
        })

        // Check for milestone progress (only if enabled in config)
        if (this._config.enableProgressMilestones !== false) {
            const completedSteps = this._getCompletedStepsCount(context)
            const totalSteps = this._getTotalSteps(context)
            const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
            const newMilestones = this._coordinator.checkForNewMilestones(progress)

            newMilestones.forEach((milestone) => {
                this.trackProgressMilestone(context, milestone)
            })
        }
    }

    trackStepCompleted(
        step: OnboardingStep<TContext>,
        context: TContext,
        duration: number,
        stepData?: Record<string, any>
    ): void {
        const stepStartTime = this._stepStartTimes.get(step.id)
        const actualDuration = stepStartTime ? Date.now() - stepStartTime : duration

        this.trackEvent('step_completed', {
            stepId: step.id,
            stepType: step.type,
            duration: actualDuration,
            stepData: this._sanitizeStepData(stepData || {}),
            completionMethod: this._getCompletionMethod(stepData),
        })

        // Track slow steps
        if (actualDuration > 3000) {
            this.trackSlowStep(step, context, actualDuration)
        }

        this._stepStartTimes.delete(step.id)
    }

    trackStepSkipped(step: OnboardingStep<TContext>, context: TContext, skipReason: string = 'user_action'): void {
        this.trackEvent('step_skipped', {
            stepId: step.id,
            stepType: step.type,
            skipReason,
            timeOnStep: this._getTimeOnStep(step.id),
        })
    }

    trackStepRetried(step: OnboardingStep<TContext>, context: TContext, retryCount: number): void {
        this.trackEvent('step_retried', {
            stepId: step.id,
            stepType: step.type,
            retryCount,
            previousAttempts: retryCount - 1,
        })
    }

    trackStepValidationFailed(step: OnboardingStep<TContext>, context: TContext, validationErrors: string[]): void {
        this.trackEvent('step_validation_failed', {
            stepId: step.id,
            stepType: step.type,
            validationErrors,
            errorCount: validationErrors.length,
        })
    }

    trackStepHelpRequested(step: OnboardingStep<TContext>, context: TContext, helpType: string = 'general'): void {
        this.trackEvent('step_help_requested', {
            stepId: step.id,
            stepType: step.type,
            helpType,
            timeOnStep: this._getTimeOnStep(step.id),
        })
    }

    trackStepAbandoned(step: OnboardingStep<TContext>, context: TContext, timeOnStep: number): void {
        this.trackEvent('step_abandoned', {
            stepId: step.id,
            stepType: step.type,
            timeOnStep,
            churnRiskScore: this._calculateChurnRisk(context, timeOnStep),
        })
    }

    trackStepRenderTime(step: OnboardingStep<TContext>, context: TContext, renderTime: number): void {
        this._coordinator.recordStepRenderTime(step.id, renderTime)

        this.trackEvent('step_render_time', {
            stepId: step.id,
            stepType: step.type,
            renderTime,
            isSlowRender: renderTime > 2000,
        })
    }

    trackSlowStep(step: OnboardingStep<TContext>, context: TContext, duration: number): void {
        this.trackEvent('step_slow', {
            stepId: step.id,
            stepType: step.type,
            duration,
            threshold: 3000,
        })
    }

    // ==================== Flow Tracking Methods ====================

    trackFlowStarted(context: TContext, startMethod: 'fresh' | 'resumed' = 'fresh'): void {
        this.trackEvent('flow_started', {
            startMethod,
            isResumed: startMethod === 'resumed',
            totalSteps: this._getTotalSteps(context),
            initialFlowDataSize: JSON.stringify(context.flowData).length,
            flowData: this._sanitizeContext(context),
        })
    }

    trackFlowCompleted(context: TContext): void {
        const completedStepsCount = this._getCompletedStepsCount(context)
        const totalSteps = this._getTotalSteps(context)

        this.trackEvent('flow_completed', {
            totalSteps,
            completedSteps: completedStepsCount,
            skippedSteps: totalSteps - completedStepsCount,
            completionRate: totalSteps > 0 ? Math.round((completedStepsCount / totalSteps) * 100) : 0,
            finalFlowDataSize: JSON.stringify(context.flowData).length,
            flowData: this._sanitizeContext(context),
        })

        this._stepStartTimes.clear()
    }

    trackFlowPaused(context: TContext, reason: string = 'user_action'): void {
        this.trackEvent('flow_paused', {
            reason,
            completedSteps: this._getCompletedStepsCount(context),
            totalSteps: this._getTotalSteps(context),
        })
    }

    trackFlowResumed(context: TContext, resumePoint: string): void {
        this.trackEvent('flow_resumed', {
            resumePoint,
            completedSteps: this._getCompletedStepsCount(context),
            totalSteps: this._getTotalSteps(context),
            timeAwayFromFlow: this._coordinator.getAwayDuration(),
        })
    }

    trackFlowAbandoned(context: TContext, abandonmentReason: string = 'unknown'): void {
        this.trackEvent('flow_abandoned', {
            abandonmentReason,
            completedSteps: this._getCompletedStepsCount(context),
            totalSteps: this._getTotalSteps(context),
        })
    }

    trackFlowReset(context: TContext, resetReason: string = 'user_action'): void {
        this.trackEvent('flow_reset', {
            resetReason,
            previousProgress: this._calculateFlowProgress(context),
            completedStepsBeforeReset: this._getCompletedStepsCount(context),
        })

        this._stepStartTimes.clear()
    }

    // ==================== Navigation Tracking Methods ====================

    trackNavigationBack(fromStep: OnboardingStep<TContext>, toStep: OnboardingStep<TContext>): void {
        this.trackEvent('navigation_back', {
            fromStepId: fromStep.id,
            toStepId: toStep.id,
            fromStepType: fromStep.type,
            toStepType: toStep.type,
        })
    }

    trackNavigationForward(fromStep: OnboardingStep<TContext>, toStep: OnboardingStep<TContext>): void {
        this.trackEvent('navigation_forward', {
            fromStepId: fromStep.id,
            toStepId: toStep.id,
            fromStepType: fromStep.type,
            toStepType: toStep.type,
        })
    }

    trackNavigationJump(fromStep: OnboardingStep<TContext>, toStep: OnboardingStep<TContext>): void {
        this.trackEvent('navigation_jump', {
            fromStepId: fromStep.id,
            toStepId: toStep.id,
            fromStepType: fromStep.type,
            toStepType: toStep.type,
            navigationDistance: 0, // Would be calculated based on step indices in full engine
        })
    }

    // ==================== Data & Persistence Tracking ====================

    trackDataChanged(context: TContext, changedFields: string[], oldData: any, newData: any): void {
        this.trackEvent('data_changed', {
            changedFields,
            changedFieldCount: changedFields.length,
            dataSizeBefore: JSON.stringify(oldData).length,
            dataSizeAfter: JSON.stringify(newData).length,
        })
    }

    trackPersistenceSuccess(context: TContext, persistenceTime: number): void {
        this.trackEvent('persistence_success', {
            persistenceTime,
            dataPersisted: JSON.stringify(context.flowData).length,
        })
    }

    trackPersistenceFailure(context: TContext, error: Error): void {
        this.trackEvent('persistence_failure', {
            errorMessage: error.message,
            errorName: error.name,
        })
    }

    // ==================== User Activity Tracking ====================

    trackUserIdle(step: OnboardingStep<TContext>, context: TContext, idleDuration: number): void {
        this._coordinator.recordIdleStart(idleDuration)

        this.trackEvent('user_idle', {
            stepId: step.id,
            stepType: step.type,
            idleDuration,
            timeOnStep: this._getTimeOnStep(step.id),
        })
    }

    trackUserReturned(step: OnboardingStep<TContext>, context: TContext, awayDuration: number): void {
        this._coordinator.recordIdleEnd(awayDuration)

        this.trackEvent('user_returned', {
            stepId: step.id,
            stepType: step.type,
            awayDuration,
            timeOnStep: this._getTimeOnStep(step.id),
        })
    }

    // ==================== Checklist Tracking ====================

    trackChecklistItemToggled(itemId: string, isCompleted: boolean, step: OnboardingStep<TContext>): void {
        this.trackEvent('checklist_item_toggled', {
            itemId,
            isCompleted,
            stepId: step.id,
            stepType: step.type,
        })
    }

    trackChecklistProgressChanged(
        step: OnboardingStep<TContext>,
        progress: {
            completed: number
            total: number
            percentage: number
            isComplete: boolean
        }
    ): void {
        this.trackEvent('checklist_progress_changed', {
            stepId: step.id,
            stepType: step.type,
            ...progress,
        })
    }

    // ==================== Error & Progress Tracking ====================

    trackErrorEncountered(error: Error, context: TContext, stepId?: string | number): void {
        this.trackEvent('error_encountered', {
            errorMessage: error.message,
            errorStack: error.stack,
            errorName: error.name,
            currentStepId: stepId,
        })
    }

    trackProgressMilestone(context: TContext, milestone: number): void {
        this.trackEvent('progress_milestone', {
            milestonePercentage: milestone,
            actualProgress: this._calculateFlowProgress(context),
            stepsCompleted: this._getCompletedStepsCount(context),
            totalSteps: this._getTotalSteps(context),
        })
    }

    // ==================== Private Helper Methods ====================

    private _hasValidation(step: OnboardingStep<TContext>): boolean {
        return !!(
            step.payload &&
            (step.payload.validation ||
                step.payload.required ||
                step.payload.minSelections ||
                step.payload.maxSelections)
        )
    }

    private _getCompletionMethod(stepData: any): string {
        if (stepData?.completionMethod) return stepData.completionMethod
        if (stepData?.buttonClicked) return 'button_click'
        if (stepData?.formSubmitted) return 'form_submit'
        if (stepData?.keyPressed) return 'keyboard'
        return 'unknown'
    }

    private _getTimeOnStep(stepId: string | number): number {
        const startTime = this._stepStartTimes.get(stepId)
        return startTime ? Date.now() - startTime : 0
    }

    private _calculateFlowProgress(context: TContext): number {
        const totalSteps = this._getTotalSteps(context)
        const completedSteps = this._getCompletedStepsCount(context)
        return totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
    }

    private _calculateChurnRisk(context: TContext, timeOnStep: number): number {
        const progress = this._calculateFlowProgress(context)
        const normalizedTime = Math.min(timeOnStep / 60000, 10)
        const progressFactor = Math.max(0, 1 - progress / 100)
        return Math.min(1, normalizedTime * 0.1 + progressFactor * 0.9)
    }

    private _getTotalSteps(context: TContext): number {
        return Object.keys(context.flowData._internal?.completedSteps || {}).length || 1
    }

    private _getCompletedStepsCount(context: TContext): number {
        return Object.keys(context.flowData._internal?.completedSteps || {}).length
    }

    private _sanitizeContext(context: TContext): Record<string, any> {
        const sanitized = { ...context }
        delete sanitized.currentUser
        delete (sanitized as any).apiKeys
        delete (sanitized as any).tokens
        return sanitized
    }

    private _sanitizeStepData(stepData: Record<string, any>): Record<string, any> {
        const sanitized = { ...stepData }
        const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'creditCard']

        sensitiveKeys.forEach((key) => {
            if (sanitized[key]) {
                sanitized[key] = '[REDACTED]'
            }
        })

        return sanitized
    }
}
