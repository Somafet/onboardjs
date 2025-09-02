// src/engine/analytics/types.ts
export interface AnalyticsEvent {
    type: string
    timestamp: number
    properties: AnalyticsEventPayload
    sessionId?: string
    userId?: string
    flowId?: string
    flowName?: string
    flowVersion?: string
    instanceId?: number
}

export interface AnalyticsEventPayload {
    [key: string]: unknown
    pageUrl?: string
    sessionData?: {
        userAgent?: string
        screenResolution?: string
        viewportSize?: string
        timezone?: string
        language?: string
        platform?: string
    }
    performanceMetrics?: {
        memoryUsage?: number
        connectionType?: string
        renderTimeHistory?: number[]
    }
}

export interface AnalyticsProvider {
    name: string
    trackEvent(event: AnalyticsEvent): void | Promise<void>
    flush?(): void | Promise<void>
}

export interface AnalyticsConfig {
    enabled?: boolean
    providers?: AnalyticsProvider[]
    sessionId?: string
    userId?: string
    flowId?: string
    samplingRate?: number
    debug?: boolean
    autoTrack?:
        | boolean
        | {
              steps?: boolean
              flow?: boolean
              navigation?: boolean
              interactions?: boolean
          }

    // Enhanced configuration options
    enableProgressMilestones?: boolean
    enablePerformanceTracking?: boolean
    enableChurnDetection?: boolean
    milestonePercentages?: number[]
    performanceThresholds?: {
        slowStepMs?: number
        slowRenderMs?: number
    }

    // Privacy and data control
    excludePersonalData?: boolean
    sanitizeData?: (data: Record<string, any>) => Record<string, any>
    excludeFlowDataKeys?: string[]

    // Event filtering
    includeUserProperties?: boolean
    includeFlowData?: boolean
    includeFlowInfo?: boolean
    includeStepMetadata?: boolean
    includePerformanceMetrics?: boolean
    includeSessionData?: boolean

    // Global properties
    globalProperties?: Record<string, any>
}
