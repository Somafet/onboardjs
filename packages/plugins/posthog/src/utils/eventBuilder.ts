import { OnboardingStep, OnboardingContext, FlowInfo } from '@onboardjs/core'
import { PostHogPluginConfig, PerformanceMetrics } from '../types'

export class EventDataBuilder<TContext extends OnboardingContext> {
    constructor(private _config: PostHogPluginConfig) {}

    buildEventData(
        eventType: string,
        baseData: Record<string, any>,
        step?: OnboardingStep<TContext>,
        context?: TContext,
        performanceMetrics?: PerformanceMetrics,
        flowInfo?: FlowInfo
    ): Record<string, any> {
        let eventData = { ...baseData }

        // Add timestamp
        eventData.timestamp = new Date().toISOString()
        eventData.event_type = eventType

        // Add global properties
        if (this._config.globalProperties) {
            eventData = { ...eventData, ...this._config.globalProperties }
        }

        // Add flow information
        if (this._config.includeFlowInfo && flowInfo) {
            eventData.flow_info = this._buildFlowInfo(flowInfo)
        }

        // Add user properties
        if (this._config.includeUserProperties && context?.currentUser) {
            eventData.user_properties = this._buildUserProperties(context.currentUser)
        }

        // Add flow data
        if (this._config.includeFlowData && context?.flowData) {
            eventData.flow_data = this._sanitizeFlowData(context.flowData)
        }

        // Add step metadata
        if (this._config.includeStepMetadata && step) {
            eventData.step_metadata = this._buildStepMetadata(step)
        }

        // Add session data
        if (this._config.includeSessionData) {
            eventData.session_data = this._buildSessionData()
        }

        // Add performance metrics
        if (this._config.includePerformanceMetrics && performanceMetrics) {
            eventData.performance = performanceMetrics
        }

        // Apply step-specific enrichment
        if (step && this._config.stepPropertyEnrichers) {
            const enricher = this._config.stepPropertyEnrichers[step.type ?? 'INFORMATION']
            if (enricher) {
                const enrichedData = enricher(step, context)
                eventData = { ...eventData, ...enrichedData }
            }
        }

        // Apply custom sanitization
        if (this._config.sanitizeData) {
            eventData = this._config.sanitizeData(eventData)
        }

        // Remove excluded personal data
        if (this._config.excludePersonalData) {
            eventData = this._removePersonalData(eventData)
        }

        return eventData
    }

    private _buildUserProperties(user: any): Record<string, any> {
        if (this._config.userPropertyMapper) {
            return this._config.userPropertyMapper(user)
        }

        // Default user property mapping
        return {
            user_id: user.id,
            user_email: user.email,
            user_name: user.name,
            user_created_at: user.createdAt,
            user_plan: user.plan,
            user_role: user.role,
        }
    }

    private _sanitizeFlowData(flowData: Record<string, any>): Record<string, any> {
        const sanitized = { ...flowData }

        // Remove excluded keys
        if (this._config.excludeFlowDataKeys) {
            this._config.excludeFlowDataKeys.forEach((key) => {
                delete sanitized[key]
            })
        }

        // Remove internal data
        delete sanitized._internal

        return sanitized
    }

    private _buildFlowInfo(flowInfo: FlowInfo): Record<string, any> {
        return {
            flow_id: flowInfo.flowId,
            flow_name: flowInfo.flowName,
            flow_version: flowInfo.flowVersion,
            flow_metadata: flowInfo.flowMetadata,
            instance_id: flowInfo.instanceId,
            flow_created_at: new Date(flowInfo.createdAt).toISOString(),
        }
    }

    private _buildStepMetadata(step: OnboardingStep<TContext>): Record<string, any> {
        return {
            step_id: step.id,
            step_type: step.type,
            has_condition: !!step.condition,
            is_skippable: !!step.isSkippable,
            has_validation: this._hasValidation(step),
            payload_keys: Object.keys(step.payload || {}),
            payload_size: JSON.stringify(step.payload || {}).length,
        }
    }

    private _buildSessionData(): Record<string, any> {
        return {
            session_id: this._getSessionId(),
            page_url: typeof window !== 'undefined' ? window.location.href : undefined,
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
            screen_resolution: typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : undefined,
            viewport_size: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : undefined,
        }
    }

    private _hasValidation(step: OnboardingStep<TContext>): boolean {
        // Check if step has validation logic
        return !!(
            step.payload &&
            (step.payload.validation ||
                step.payload.required ||
                step.payload.minSelections ||
                step.payload.maxSelections)
        )
    }

    private _removePersonalData(data: Record<string, any>): Record<string, any> {
        const sensitiveKeys = [
            'email',
            'phone',
            'address',
            'ssn',
            'credit_card',
            'password',
            'token',
            'api_key',
            'secret',
        ]

        const cleaned = { ...data }

        const removeSensitiveData = (obj: any): any => {
            if (typeof obj !== 'object' || obj === null) return obj

            if (Array.isArray(obj)) {
                return obj.map(removeSensitiveData)
            }

            const result: any = {}
            for (const [key, value] of Object.entries(obj)) {
                const lowerKey = key.toLowerCase()
                if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
                    result[key] = '[REDACTED]'
                } else {
                    result[key] = removeSensitiveData(value)
                }
            }
            return result
        }

        return removeSensitiveData(cleaned)
    }

    private _getSessionId(): string {
        // Simple session ID generation
        if (typeof window !== 'undefined') {
            let sessionId = sessionStorage.getItem('onboardjs_session_id')
            if (!sessionId) {
                const random = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) =>
                    b.toString(16).padStart(2, '0')
                ).join('')
                sessionId = `session_${Date.now()}_${random}`
                sessionStorage.setItem('onboardjs_session_id', sessionId)
            }
            return sessionId
        }
        return `server_session_${Date.now()}`
    }
}
