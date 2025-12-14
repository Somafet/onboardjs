// src/analytics/aha-tracker/tracker.ts
import { Logger } from '../../services/Logger'
import { AnalyticsManager } from '../analytics-manager'
import { AnalyticsProvider } from '../types'
import { AhaTrackerConfig, TrackAhaParams, AhaEvent, AhaUserStats, EngineContext } from './types'
import { generateSessionId } from './utils'
import { FlowDataExtractor } from './flow-extractor'
import { AhaEventBuilder } from './event-builder'
import { DeduplicationManager } from './deduplication'
import { AhaEventConverter } from './converters'

/**
 * Singleton class for tracking aha moments across the application
 */
export class AhaTracker {
    private static _instance: AhaTracker | null = null

    private _logger: Logger
    private _config: Required<AhaTrackerConfig>
    private _deduplicationManager: DeduplicationManager
    private _eventBuilder: AhaEventBuilder
    private _analyticsManager: AnalyticsManager | null = null
    private _customProviders: AnalyticsProvider[] = []
    private _sessionId: string | null = null
    private _sessionStartTime: number | null = null
    private _engineContext: EngineContext | null = null

    private constructor(config: AhaTrackerConfig = {}) {
        this._config = this._buildConfig(config)
        this._customProviders = this._config.custom_providers
        this._logger = Logger.getInstance({ debugMode: this._config.debug, prefix: 'AhaTracker' })

        // Initialize managers
        this._deduplicationManager = new DeduplicationManager(this._config)
        this._eventBuilder = new AhaEventBuilder(this._config, this._deduplicationManager.getUserAhaCountMap())

        // Initialize session on client-side only
        if (this._isClientSide()) {
            this._initializeSession()
        }
    }

    /**
     * Get the singleton instance of AhaTracker
     */
    static getInstance(config?: AhaTrackerConfig): AhaTracker {
        if (!AhaTracker._instance) {
            AhaTracker._instance = new AhaTracker(config)
        } else if (config) {
            // Update config if provided
            AhaTracker._instance.updateConfig(config)
        }
        return AhaTracker._instance
    }

    /**
     * Reset the singleton instance (useful for testing)
     */
    static resetInstance(): void {
        AhaTracker._instance = null
    }

    /**
     * Initialize the tracker with an analytics manager
     */
    initialize(analyticsManager: AnalyticsManager): void {
        this._analyticsManager = analyticsManager
        this._logger.debug('AhaTracker initialized with AnalyticsManager')
    }

    /**
     * Add a custom analytics provider
     */
    addProvider(provider: AnalyticsProvider): void {
        this._customProviders.push(provider)
        this._logger.debug(`Added custom provider: ${provider.name}`)
    }

    /**
     * Link to OnboardingEngine for automatic user/flow detection (client-side only)
     *
     * @example
     * ```typescript
     * // In OnboardingProvider setup
     * const tracker = AhaTracker.getInstance()
     * tracker.linkToEngine({
     *   getUserId: () => engine.getContext().userId,
     *   getFlowData: () => ({
     *     flow_id: engine.config.flowId,
     *     current_step_id: engine.getState().currentStep?.id,
     *     // ...
     *   })
     * })
     * ```
     */
    linkToEngine(context: EngineContext): void {
        if (!this._isClientSide()) {
            this._logger.warn('linkToEngine should only be called on client-side')
            return
        }
        this._engineContext = context
        this._logger.debug('Linked to OnboardingEngine for auto user detection')
    }

    /**
     * Update tracker configuration
     */
    updateConfig(config: Partial<AhaTrackerConfig>): void {
        this._config = { ...this._config, ...this._buildConfig(config) } as Required<AhaTrackerConfig>
        if (config.custom_providers) {
            this._customProviders = config.custom_providers
        }

        // Reinitialize managers with new config
        this._deduplicationManager = new DeduplicationManager(this._config)
        this._eventBuilder = new AhaEventBuilder(this._config, this._deduplicationManager.getUserAhaCountMap())
    }

    /**
     * Track an aha moment
     *
     * @param params - Aha tracking parameters
     * @returns The tracked aha event or null if tracking was blocked
     *
     * @example
     * ```typescript
     * // Server-side (must provide user_id)
     * await aha({
     *   aha_type: 'value_demonstration',
     *   user_id: 'user_123', // REQUIRED on server
     *   context: { feature_name: 'video_download' }
     * })
     *
     * // Client-side (user_id auto-detected from linked engine)
     * await aha({
     *   aha_type: 'feature_activation',
     *   context: { feature_name: 'image_upload' }
     * })
     * ```
     */
    async track(params: TrackAhaParams): Promise<AhaEvent | null> {
        try {
            // 1. Resolve user_id (server requires explicit, client can auto-detect)
            const userId = this._resolveUserId(params)

            if (!userId && !params.anonymous_id) {
                const context = this._isClientSide() ? 'client-side' : 'server-side'
                throw new Error(
                    `aha() called on ${context} without user_id or anonymous_id. ` +
                        (this._isClientSide()
                            ? 'Did you forget to link the tracker to OnboardingEngine via linkToEngine()?'
                            : 'You must explicitly provide user_id when calling aha() from server-side.')
                )
            }

            const trackingKey = userId || params.anonymous_id || 'anonymous'

            // 2. Check deduplication rules
            if (!this._deduplicationManager.shouldTrack(trackingKey)) {
                this._logger.debug(`Aha event skipped for user ${trackingKey} due to deduplication rules`)
                return null
            }

            // 3. Auto-detect flow context if available
            let flowData = params.flow_id ? FlowDataExtractor.getFlowData(params.flow_id) : undefined
            if (!flowData && this._engineContext) {
                flowData = this._engineContext.getFlowData()
            }

            // 4. Build the complete aha event
            const ahaEvent = this._eventBuilder.buildEvent(params, flowData)

            // 5. Track with analytics manager
            if (this._analyticsManager) {
                this._analyticsManager.trackEvent(
                    'onboarding_aha_moment',
                    AhaEventConverter.toAnalyticsPayload(ahaEvent)
                )
            }

            // 6. Track with custom providers
            const analyticsEvent = AhaEventConverter.toAnalyticsEvent(ahaEvent)
            await Promise.all(this._customProviders.map((provider) => provider.trackEvent(analyticsEvent)))

            // 7. Update internal state
            this._deduplicationManager.updateUserState(trackingKey)

            this._logger.info(`Aha moment tracked: ${params.aha_type} for user ${trackingKey}`)

            return ahaEvent
        } catch (error) {
            this._logger.error('Failed to track aha moment', error)
            throw error
        }
    }

    /**
     * Get aha statistics for a user
     */
    getUserAhaStats(userId: string): AhaUserStats {
        return {
            total_aha_events: this._deduplicationManager.getUserCount(userId),
            last_aha_time: this._deduplicationManager.getLastAhaTime(userId),
            can_track_aha: this._deduplicationManager.shouldTrack(userId),
        }
    }

    /**
     * Clear aha tracking data for a user (e.g., on logout)
     */
    clearUserData(userId: string): void {
        this._deduplicationManager.clearUserData(userId)
    }

    /**
     * Resolve user_id from params or linked engine context
     * Priority: params.user_id > engineContext.getUserId() > undefined
     */
    private _resolveUserId(params: TrackAhaParams): string | undefined {
        // Explicit user_id always wins
        if (params.user_id) {
            return params.user_id
        }

        // Try to get from linked engine (client-side only)
        if (this._engineContext) {
            const engineUserId = this._engineContext.getUserId()
            if (engineUserId) {
                return engineUserId
            }
        }

        return undefined
    }

    /**
     * Initialize session tracking (client-side only)
     */
    private _initializeSession(): void {
        if (!this._isClientSide()) return

        this._sessionId = this._config.session_id || generateSessionId()
        this._sessionStartTime = this._config.session_start_time || Date.now()

        // Store in sessionStorage for persistence across page loads
        try {
            if (typeof sessionStorage !== 'undefined') {
                const existingSessionId = sessionStorage.getItem('onboardjs_session_id')
                const existingStartTime = sessionStorage.getItem('onboardjs_session_start')

                if (existingSessionId && existingStartTime) {
                    this._sessionId = existingSessionId
                    this._sessionStartTime = parseInt(existingStartTime, 10)
                } else {
                    sessionStorage.setItem('onboardjs_session_id', this._sessionId)
                    sessionStorage.setItem('onboardjs_session_start', String(this._sessionStartTime))
                }
            }
        } catch {
            // Ignore storage errors
        }
    }

    /**
     * Detect if running in client-side environment
     */
    private _isClientSide(): boolean {
        return typeof window !== 'undefined' && typeof document !== 'undefined'
    }

    /**
     * Build configuration with defaults
     */
    private _buildConfig(config: Partial<AhaTrackerConfig>): Required<AhaTrackerConfig> {
        return {
            event_version: config.event_version || '1.0.0',
            max_events_per_user: config.max_events_per_user ?? Infinity,
            cooldown_seconds: config.cooldown_seconds ?? 0,
            session_id: config.session_id || generateSessionId(),
            session_start_time: config.session_start_time || Date.now(),
            user_signup_time: config.user_signup_time || Date.now(),
            debug: config.debug ?? false,
            exclude_personal_data: config.exclude_personal_data ?? false,
            sanitize_context: config.sanitize_context || ((ctx) => ctx),
            custom_providers: config.custom_providers || [],
        }
    }
}
