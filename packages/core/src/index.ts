// @onboardjs/core/src/index.ts

export * from './types'
export * from './engine/OnboardingEngine'
export * from './engine/OnboardingEngineRegistry'
export * from './engine/ConfigurationBuilder'
export * from './engine/StepValidator'
export * from './engine/types' // Export engine-specific types like EngineState
export * from './utils/step-utils'
export * from './utils/flow-utils'
export * from './plugins'
export * from './parser'
export * from './analytics/aha-tracker'

// Analytics exports
export { AnalyticsManager } from './analytics/analytics-manager'
export { AnalyticsCoordinator } from './analytics/AnalyticsCoordinator'
export { SessionTracker } from './analytics/SessionTracker'
export { PerformanceTracker } from './analytics/PerformanceTracker'
export { ActivityTracker } from './analytics/ActivityTracker'
export { ProgressMilestoneTracker } from './analytics/ProgressMilestoneTracker'
export type {
    AnalyticsConfig,
    AnalyticsProvider,
    AnalyticsEvent,
    AnalyticsEventPayload,
    AnalyticsBeforeSendHook,
} from './analytics/types'
export { map, mapErr, andThen, safeSync, safeAsync, fromPromise } from './types/Result'

// Export AsyncOperationQueue for advanced async operation management
export { AsyncOperationQueue, type QueueStats } from './services/AsyncOperationQueue'
