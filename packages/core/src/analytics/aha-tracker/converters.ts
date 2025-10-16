// src/analytics/aha-tracker/converters.ts
import { AnalyticsEvent } from '../types'
import { AhaEvent } from './types'

/**
 * Converts aha events to different analytics formats
 */
export class AhaEventConverter {
    /**
     * Convert aha event to analytics payload
     */
    static toAnalyticsPayload(ahaEvent: AhaEvent): Record<string, any> {
        return {
            event_version: ahaEvent.event_version,
            user_id: ahaEvent.user_id,
            anonymous_id: ahaEvent.anonymous_id,
            aha_type: ahaEvent.aha_type,
            journey_stage: ahaEvent.journey_stage,
            aha_description: ahaEvent.aha_description,
            timezone: ahaEvent.timezone,
            metrics: ahaEvent.metrics,
            context: ahaEvent.context,
            experiments: ahaEvent.experiments,
            onboarding_flow: ahaEvent.onboarding_flow,
        }
    }

    /**
     * Convert aha event to standard analytics event
     */
    static toAnalyticsEvent(ahaEvent: AhaEvent): AnalyticsEvent {
        return {
            type: 'onboarding_aha_moment',
            timestamp: new Date(ahaEvent.timestamp).getTime(),
            properties: AhaEventConverter.toAnalyticsPayload(ahaEvent),
            sessionId: ahaEvent.session_id,
            userId: ahaEvent.user_id,
            flowId: ahaEvent.onboarding_flow?.flow_id,
            flowName: ahaEvent.onboarding_flow?.flow_id, // Could be enhanced
            flowVersion: ahaEvent.onboarding_flow?.flow_version,
        }
    }
}
