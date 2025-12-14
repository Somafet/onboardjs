import { Logger } from '../services/Logger'
import { AnalyticsConfig, AnalyticsProvider, AnalyticsEvent, AnalyticsEventPayload } from './types'
import { SessionTracker } from './SessionTracker'
import { PerformanceTracker } from './PerformanceTracker'
import { ActivityTracker } from './ActivityTracker'
import { ProgressMilestoneTracker } from './ProgressMilestoneTracker'

/**
 * AnalyticsCoordinator delegates analytics tracking responsibilities to specialized trackers.
 * It coordinates SessionTracker, PerformanceTracker, ActivityTracker, and ProgressMilestoneTracker.
 */
export class AnalyticsCoordinator {
    private _providers: AnalyticsProvider[] = []
    private _config: AnalyticsConfig
    private _logger: Logger
    private _sessionTracker: SessionTracker
    private _performanceTracker: PerformanceTracker
    private _activityTracker: ActivityTracker
    private _progressMilestoneTracker: ProgressMilestoneTracker

    constructor(config: AnalyticsConfig = {}, logger?: Logger) {
        this._config = {
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
        }

        this._logger = logger || Logger.getInstance({ debugMode: config.debug, prefix: 'AnalyticsCoordinator' })

        // Initialize specialized trackers
        this._sessionTracker = new SessionTracker(this._config, this._logger)
        this._performanceTracker = new PerformanceTracker(this._config, this._logger)
        this._activityTracker = new ActivityTracker(this._logger)
        this._progressMilestoneTracker = new ProgressMilestoneTracker(
            this._config.milestonePercentages || [25, 50, 75, 100],
            this._logger
        )

        if (config.providers) {
            this._providers.push(...config.providers)
        }
    }

    registerProvider(provider: AnalyticsProvider): void {
        this._providers.push(provider)
        this._logger.debug(`Registered analytics provider: ${provider.name}`)
    }

    get providerCount(): number {
        return this._providers.length
    }

    // Session delegation
    getSessionId(): string {
        return this._sessionTracker.getSessionId()
    }

    setUserId(userId: string): void {
        this._sessionTracker.setUserId(userId)
    }

    setFlowId(flowId: string): void {
        this._sessionTracker.setFlowId(flowId)
    }

    setFlowInfo(flowInfo: {
        flowId?: string
        flowName?: string
        flowVersion?: string
        flowMetadata?: Record<string, unknown>
        instanceId?: number
    }): void {
        this._sessionTracker.setFlowInfo(flowInfo)
    }

    getFlowInfo(): Readonly<ReturnType<SessionTracker['getFlowInfo']>> {
        return this._sessionTracker.getFlowInfo()
    }

    // Performance delegation
    recordStepRenderTime(stepId: string | number, renderTime: number): void {
        this._performanceTracker.recordStepRenderTime(stepId, renderTime)
    }

    recordNavigationTime(direction: string, duration: number): void {
        this._performanceTracker.recordNavigationTime(direction, duration)
    }

    getPerformanceMetrics() {
        return {
            stepRenderTimes: this._performanceTracker.getRenderTimeHistory(),
            navigationTimes: this._performanceTracker.getNavigationTimes(),
            memoryUsage: this._performanceTracker.getMemoryUsage(),
            connectionType: this._performanceTracker.getConnectionType(),
        }
    }

    // Activity delegation
    recordActivity(): void {
        this._activityTracker.recordActivity()
    }

    recordIdleStart(duration: number): void {
        this._activityTracker.recordIdleStart(duration)
    }

    recordIdleEnd(awayDuration: number): void {
        this._activityTracker.recordIdleEnd(awayDuration)
    }

    isUserIdle(): boolean {
        return this._activityTracker.isIdle()
    }

    getAwayDuration(): number {
        return this._activityTracker.getAwayDuration()
    }

    // Progress milestone delegation
    calculateFlowProgress(completedSteps: number, totalSteps: number): number {
        return this._progressMilestoneTracker.calculateFlowProgress(completedSteps, totalSteps)
    }

    checkForNewMilestones(progress: number): number[] {
        return this._progressMilestoneTracker.checkForNewMilestones(progress)
    }

    // Event tracking core
    trackEvent(eventType: string, properties: Record<string, any> = {}): void {
        const augmentedProperties: AnalyticsEventPayload = {
            ...properties,
            ...this._sessionTracker.getFlowInfo(),
        }

        // Capture URL if in browser
        if (typeof window !== 'undefined' && window.location && window.location.href) {
            augmentedProperties.pageUrl = window.location.href
        }

        // Enrich with session and performance data
        this._enrichEventWithSessionData(augmentedProperties)
        this._enrichEventWithPerformanceData(augmentedProperties)

        const event: AnalyticsEvent = {
            type: eventType,
            timestamp: Date.now(),
            properties: augmentedProperties,
            sessionId: this._sessionTracker.getSessionId(),
            userId: this._sessionTracker.getUserId(),
            flowId: this._sessionTracker.getFlowId(),
        }

        this._logger.debug(`[AnalyticsCoordinator] Event: "${eventType}"`, event)

        if (!this._config.enabled || this._providers.length === 0) {
            return
        }

        // Apply sampling
        if (
            this._config.samplingRate !== undefined &&
            this._config.samplingRate < 1.0 &&
            Math.random() > this._config.samplingRate
        ) {
            this._logger.debug(`[AnalyticsCoordinator] Event "${eventType}" skipped due to sampling.`)
            return
        }

        // Dispatch to providers
        for (const provider of this._providers) {
            try {
                provider.trackEvent(event)
            } catch (error) {
                this._logger.error(`[AnalyticsCoordinator] Error in analytics provider "${provider.name}":`, error)
            }
        }
    }

    async flush(): Promise<void> {
        for (const provider of this._providers) {
            if (provider.flush) {
                try {
                    await provider.flush()
                } catch (error) {
                    this._logger.error(`Error flushing provider ${provider.name}:`, error)
                }
            }
        }
    }

    private _enrichEventWithSessionData(properties: AnalyticsEventPayload): void {
        if (typeof window !== 'undefined') {
            properties.sessionData = {
                userAgent: navigator.userAgent,
                screenResolution: `${screen.width}x${screen.height}`,
                viewportSize: `${window.innerWidth}x${window.innerHeight}`,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                language: navigator.language,
                platform: navigator.platform,
            }
        }
    }

    private _enrichEventWithPerformanceData(properties: AnalyticsEventPayload): void {
        if (this._config.enablePerformanceTracking) {
            const metrics = this.getPerformanceMetrics()
            properties.performanceMetrics = {
                memoryUsage: metrics.memoryUsage,
                connectionType: metrics.connectionType,
                renderTimeHistory: metrics.stepRenderTimes,
            }
        }
    }
}
