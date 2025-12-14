// src/services/index.ts
// Service exports for @onboardjs/core
// Consolidated services following the refactoring plan (Phase 3)

// Core Services (new consolidated pattern)
export { CoreEngineService } from './CoreEngineService'
export { PersistenceService } from './PersistenceService'
export { NavigationService, type ChecklistProgress } from './NavigationService'

// Navigation Services (Phase 4 decomposition)
export { NavigationOrchestrator } from './NavigationOrchestrator'
export { StepTransitionService } from './StepTransitionService'
export {
    ChecklistNavigationService,
    type ChecklistProgress as ChecklistProgressInfo,
} from './ChecklistNavigationService'
export { BeforeNavigationHandler, type BeforeNavigationResult } from './BeforeNavigationHandler'

// Existing Services
export { AsyncOperationQueue, type QueueStats } from './AsyncOperationQueue'
export { Logger, type LoggerConfig } from './Logger'
export { ActivityTracker } from './ActivityTracker'

// Service Interfaces
export * from './interfaces'
