// src/analytics/aha-tracker/event-builder.ts
import { AhaEvent, AhaMetrics, AhaContext, TrackAhaParams, OnboardingFlowData, AhaTrackerConfig } from './types'
import { getTimezone, detectDeviceType, detectBrowser, detectOS } from './utils'

/**
 * Builds aha event payloads with proper context enrichment
 */
export class AhaEventBuilder {
    private _config: Required<AhaTrackerConfig>
    private _sessionStartTime: number
    private _userAhaCount: Map<string, number>

    constructor(config: Required<AhaTrackerConfig>, userAhaCount: Map<string, number>) {
        this._config = config
        this._sessionStartTime = config.session_start_time
        this._userAhaCount = userAhaCount
    }

    /**
     * Build a complete aha event from parameters
     */
    buildEvent(params: TrackAhaParams, flowData?: OnboardingFlowData): AhaEvent {
        const now = params.custom_timestamp ? new Date(params.custom_timestamp) : new Date()
        const timezone = getTimezone()

        // Build metrics
        const metrics = this._buildMetrics(params.metrics || {}, flowData)

        // Build context
        const context = this._buildContext(params.context || {}, params.user_id)

        return {
            event_name: 'onboarding_aha_moment',
            event_version: this._config.event_version,

            user_id: params.user_id,
            anonymous_id: params.anonymous_id,
            session_id: this._config.session_id,

            timestamp: now.toISOString(),
            client_timestamp: now.toISOString(),
            timezone,

            aha_type: params.aha_type,
            journey_stage: params.journey_stage || 'activation',
            aha_description: params.aha_description,

            metrics,
            context,
            experiments: params.experiments,
            onboarding_flow: flowData,
        }
    }

    /**
     * Build metrics with auto-calculation
     */
    private _buildMetrics(partialMetrics: Partial<AhaMetrics>, flowData?: OnboardingFlowData): AhaMetrics {
        const now = Date.now()

        return {
            time_to_aha_seconds:
                partialMetrics.time_to_aha_seconds ?? Math.floor((now - this._sessionStartTime) / 1000),
            time_since_signup_seconds:
                partialMetrics.time_since_signup_seconds ?? Math.floor((now - this._config.user_signup_time) / 1000),
            session_duration_seconds:
                partialMetrics.session_duration_seconds ?? Math.floor((now - this._sessionStartTime) / 1000),
            actions_before_aha: partialMetrics.actions_before_aha,
            steps_completed: partialMetrics.steps_completed ?? flowData?.steps_completed?.length,
            features_explored: partialMetrics.features_explored,
            engagement_score: partialMetrics.engagement_score,
            completion_rate: partialMetrics.completion_rate,
            retention_likelihood: partialMetrics.retention_likelihood,
        }
    }

    /**
     * Build context with auto-detection and enrichment
     */
    private _buildContext(partialContext: AhaContext, userId?: string): AhaContext {
        const context: AhaContext = {
            ...partialContext,
            first_aha: partialContext.first_aha ?? this._isFirstAha(userId || 'anonymous'),
            previous_aha_events:
                partialContext.previous_aha_events ?? (this._userAhaCount.get(userId || 'anonymous') || 0),
        }

        // Auto-detect platform/device if in browser
        if (typeof window !== 'undefined' && !partialContext.platform) {
            context.platform = 'web'
            context.device_type = detectDeviceType()
            context.browser = detectBrowser()
            context.os = detectOS()
        }

        // Sanitize if needed
        if (this._config.exclude_personal_data) {
            return this._config.sanitize_context(context)
        }

        return context
    }

    /**
     * Check if this is the user's first aha moment
     */
    private _isFirstAha(userId: string): boolean {
        return (this._userAhaCount.get(userId) || 0) === 0
    }
}
