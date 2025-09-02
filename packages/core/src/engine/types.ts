// @onboardjs/core/src/engine/types.ts (Corrected and Refactored)

import { AnalyticsConfig } from '../analytics/types'
import { OnboardingPlugin } from '../plugins'
import { OnboardingStep, OnboardingContext } from '../types'

// =============================================================================
// Engine State & Base Types
// =============================================================================

export interface FlowContext {
    flowId: string | null
    flowName: string | null
    flowVersion: string | null
    flowMetadata: Record<string, unknown> | null
    instanceId: number
    createdAt: number
}

export interface FlowInfo {
    flowId: string | null
    flowName: string | null
    flowVersion: string | null
    flowMetadata: Record<string, unknown> | null
    instanceId: number
    createdAt: number
}

export interface EngineState<TContext extends OnboardingContext = OnboardingContext> {
    // Flow identification
    flowId: string | null
    flowName: string | null
    flowVersion: string | null
    flowMetadata: Record<string, unknown> | null
    instanceId: number

    // Current state
    currentStep: OnboardingStep<TContext> | null
    context: TContext
    isFirstStep: boolean
    isLastStep: boolean
    canGoNext: boolean
    canGoPrevious: boolean
    isSkippable: boolean
    isLoading: boolean
    isHydrating: boolean
    error: Error | null
    isCompleted: boolean
    nextStepCandidate: OnboardingStep<TContext> | null
    previousStepCandidate: OnboardingStep<TContext> | null
    totalSteps: number
    completedSteps: number
    progressPercentage: number
    currentStepNumber: number
}

export type EngineStateChangeListener<TContext extends OnboardingContext = OnboardingContext> = (event: {
    state: EngineState<TContext>
}) => void

export type UnsubscribeFunction = () => void

// =============================================================================
// Event Object Interfaces
// =============================================================================

export interface BeforeStepChangeEvent<TContext extends OnboardingContext = OnboardingContext> {
    currentStep: OnboardingStep<TContext> | null
    targetStepId: string | number | null | undefined
    direction: 'next' | 'previous' | 'skip' | 'goto' | 'initial'
    cancel: () => void
    redirect: (newTargetId: string | number | null | undefined) => void
}

export interface StepChangeEvent<TContext extends OnboardingContext = OnboardingContext> {
    newStep: OnboardingStep<TContext> | null
    oldStep: OnboardingStep<TContext> | null
    context: TContext
}

export interface FlowCompletedEvent<TContext extends OnboardingContext = OnboardingContext> {
    context: TContext
    duration: number // Duration in milliseconds
}

export interface StepActiveEvent<TContext extends OnboardingContext = OnboardingContext> {
    step: OnboardingStep<TContext>
    context: TContext
    startTime: number
}

export interface StepCompletedEvent<TContext extends OnboardingContext = OnboardingContext> {
    step: OnboardingStep<TContext>
    stepData: Record<string, unknown>
    context: TContext
}

export interface ContextUpdateEvent<TContext extends OnboardingContext = OnboardingContext> {
    oldContext: TContext
    newContext: TContext
}

export interface ErrorEvent<TContext extends OnboardingContext = OnboardingContext> {
    error: Error
    context: TContext
}

export interface FlowStartedEvent<TContext extends OnboardingContext = OnboardingContext> {
    context: TContext
    startMethod: 'fresh' | 'resumed'
}

export interface FlowPausedEvent<TContext extends OnboardingContext = OnboardingContext> {
    context: TContext
    reason: 'user_action' | 'timeout' | 'error'
}

export interface FlowResumedEvent<TContext extends OnboardingContext = OnboardingContext> {
    context: TContext
    resumePoint: string
}

export interface FlowAbandonedEvent<TContext extends OnboardingContext = OnboardingContext> {
    context: TContext
    abandonmentReason: string
}

export interface FlowResetEvent<TContext extends OnboardingContext = OnboardingContext> {
    context: TContext
    resetReason: string
}

export interface StepSkippedEvent<TContext extends OnboardingContext = OnboardingContext> {
    step: OnboardingStep<TContext>
    context: TContext
    skipReason: string
}

export interface StepRetriedEvent<TContext extends OnboardingContext = OnboardingContext> {
    step: OnboardingStep<TContext>
    context: TContext
    retryCount: number
}

export interface StepValidationFailedEvent<TContext extends OnboardingContext = OnboardingContext> {
    step: OnboardingStep<TContext>
    context: TContext
    validationErrors: string[]
}

export interface StepHelpRequestedEvent<TContext extends OnboardingContext = OnboardingContext> {
    step: OnboardingStep<TContext>
    context: TContext
    helpType: string
}

export interface StepAbandonedEvent<TContext extends OnboardingContext = OnboardingContext> {
    step: OnboardingStep<TContext>
    context: TContext
    timeOnStep: number
}

export interface NavigationBackEvent<TContext extends OnboardingContext = OnboardingContext> {
    fromStep: OnboardingStep<TContext>
    toStep: OnboardingStep<TContext>
    context: TContext
}

export interface NavigationForwardEvent<TContext extends OnboardingContext = OnboardingContext> {
    fromStep: OnboardingStep<TContext>
    toStep: OnboardingStep<TContext>
    context: TContext
}

export interface NavigationJumpEvent<TContext extends OnboardingContext = OnboardingContext> {
    fromStep: OnboardingStep<TContext>
    toStep: OnboardingStep<TContext>
    context: TContext
}

export interface UserIdleEvent<TContext extends OnboardingContext = OnboardingContext> {
    step: OnboardingStep<TContext>
    context: TContext
    idleDuration: number
}

export interface UserReturnedEvent<TContext extends OnboardingContext = OnboardingContext> {
    step: OnboardingStep<TContext>
    context: TContext
    awayDuration: number
}

export interface DataChangedEvent<TContext extends OnboardingContext = OnboardingContext> {
    step: OnboardingStep<TContext>
    context: TContext
    changedFields: string[]
}

export interface StepRenderTimeEvent<TContext extends OnboardingContext = OnboardingContext> {
    step: OnboardingStep<TContext>
    context: TContext
    renderTime: number
}

export interface PersistenceSuccessEvent<TContext extends OnboardingContext = OnboardingContext> {
    context: TContext
    persistenceTime: number
}

export interface PersistenceFailureEvent<TContext extends OnboardingContext = OnboardingContext> {
    context: TContext
    error: Error
}

export interface ChecklistItemToggledEvent<TContext extends OnboardingContext = OnboardingContext> {
    itemId: string
    isCompleted: boolean
    step: OnboardingStep<TContext>
    context: TContext
}

export interface ChecklistProgressChangedEvent<TContext extends OnboardingContext = OnboardingContext> {
    step: OnboardingStep<TContext>
    context: TContext
    progress: {
        completed: number
        total: number
        percentage: number
        isComplete: boolean
    }
}

export interface FlowRegisteredEvent<TContext extends OnboardingContext = OnboardingContext> {
    flowInfo: FlowInfo
    context: TContext
}

export interface FlowUnregisteredEvent<TContext extends OnboardingContext = OnboardingContext> {
    flowInfo: FlowInfo
    context: TContext
}

export interface PluginInstalledEvent {
    pluginName: string
    pluginVersion: string
}

export interface PluginErrorEvent<TContext extends OnboardingContext = OnboardingContext> {
    pluginName: string
    error: Error
    context: TContext
}

// =============================================================================
// Event Listener Map
// =============================================================================

export interface EventListenerMap<TContext extends OnboardingContext = OnboardingContext> {
    stateChange: (event: { state: EngineState<TContext> }) => void
    beforeStepChange: (event: BeforeStepChangeEvent<TContext>) => void | Promise<void>
    stepChange: (event: StepChangeEvent<TContext>) => void | Promise<void>
    stepActive: (event: StepActiveEvent<TContext>) => void | Promise<void>
    stepCompleted: (event: StepCompletedEvent<TContext>) => void | Promise<void>
    contextUpdate: (event: ContextUpdateEvent<TContext>) => void | Promise<void>
    error: (event: ErrorEvent<TContext>) => void | Promise<void>

    // Flow-level events
    flowStarted: (event: FlowStartedEvent<TContext>) => void | Promise<void>
    flowCompleted: (event: FlowCompletedEvent<TContext>) => void | Promise<void>
    flowPaused: (event: FlowPausedEvent<TContext>) => void | Promise<void>
    flowResumed: (event: FlowResumedEvent<TContext>) => void | Promise<void>
    flowAbandoned: (event: FlowAbandonedEvent<TContext>) => void | Promise<void>
    flowReset: (event: FlowResetEvent<TContext>) => void | Promise<void>

    // Step-level events
    stepSkipped: (event: StepSkippedEvent<TContext>) => void | Promise<void>
    stepRetried: (event: StepRetriedEvent<TContext>) => void | Promise<void>
    stepValidationFailed: (event: StepValidationFailedEvent<TContext>) => void | Promise<void>
    stepHelpRequested: (event: StepHelpRequestedEvent<TContext>) => void | Promise<void>
    stepAbandoned: (event: StepAbandonedEvent<TContext>) => void | Promise<void>

    // Navigation events
    navigationBack: (event: NavigationBackEvent<TContext>) => void | Promise<void>
    navigationForward: (event: NavigationForwardEvent<TContext>) => void | Promise<void>
    navigationJump: (event: NavigationJumpEvent<TContext>) => void | Promise<void>

    // Interaction events
    userIdle: (event: UserIdleEvent<TContext>) => void | Promise<void>
    userReturned: (event: UserReturnedEvent<TContext>) => void | Promise<void>
    dataChanged: (event: DataChangedEvent<TContext>) => void | Promise<void>

    // Performance events
    stepRenderTime: (event: StepRenderTimeEvent<TContext>) => void | Promise<void>
    persistenceSuccess: (event: PersistenceSuccessEvent<TContext>) => void | Promise<void>
    persistenceFailure: (event: PersistenceFailureEvent<TContext>) => void | Promise<void>

    // Checklist-specific events
    checklistItemToggled: (event: ChecklistItemToggledEvent<TContext>) => void | Promise<void>
    checklistProgressChanged: (event: ChecklistProgressChangedEvent<TContext>) => void | Promise<void>

    // Plugin events
    pluginInstalled: (event: PluginInstalledEvent) => void | Promise<void>
    pluginError: (event: PluginErrorEvent<TContext>) => void | Promise<void>

    // Flow management events
    flowRegistered: (event: FlowRegisteredEvent<TContext>) => void | Promise<void>
    flowUnregistered: (event: FlowUnregisteredEvent<TContext>) => void | Promise<void>
}

// =============================================================================
// Data Persistence & Engine Config
// =============================================================================

export type LoadedData<TContext extends OnboardingContext = OnboardingContext> = Partial<TContext> & {
    currentStepId?: string | number | null
}

export type DataLoadFn<TContext extends OnboardingContext = OnboardingContext> = () =>
    | Promise<LoadedData<TContext> | null | undefined>
    | LoadedData<TContext>
    | null
    | undefined

export type DataPersistFn<TContext extends OnboardingContext = OnboardingContext> = (
    context: TContext,
    currentStepId: string | number | null
) => Promise<void> | void

export interface OnboardingEngineConfig<TContext extends OnboardingContext = OnboardingContext> {
    /**
     * Unique identifier for this onboarding flow.
     * Useful when running multiple flows on the same page.
     */
    flowId?: string

    /**
     * Human-readable name for this onboarding flow.
     */
    flowName?: string

    /**
     * Version of this onboarding flow.
     * Follows semantic versioning (e.g., "1.0.0", "2.1.0").
     */
    flowVersion?: string

    /**
     * Optional metadata for the flow (e.g., target audience, feature flags).
     */
    flowMetadata?: Record<string, unknown>

    /**
     * The list of steps in the onboarding flow.
     * Each step should implement the OnboardingStep interface.
     */
    steps: OnboardingStep<TContext>[]

    /**
     * The initial step ID to start the onboarding flow.
     * If not provided, the first step in the steps array will be used.
     */
    initialStepId?: string | number

    /**
     * The initial context for the onboarding flow.
     * This can be used to pre-populate the context with data.
     */
    initialContext?: Partial<TContext>
    onFlowComplete?: (context: TContext) => void | Promise<void>
    onStepChange?: (
        newStep: OnboardingStep<TContext> | null,
        oldStep: OnboardingStep<TContext> | null,
        context: TContext
    ) => void
    loadData?: DataLoadFn<TContext>
    persistData?: DataPersistFn<TContext>
    clearPersistedData?: () => Promise<void> | void

    /**
     * Optional plugins to extend the functionality of the onboarding engine.
     * Each plugin should implement the OnboardingPlugin interface.
     */
    plugins?: OnboardingPlugin<TContext>[]

    /**
     * Optional configuration for debugging the onboarding engine.
     * If set to true, additional debug information will be logged.
     */
    debug?: boolean

    /**
     * Analytics configuration for tracking onboarding events
     */
    analytics?: AnalyticsConfig | boolean // boolean for simple enable/disable

    /**
     * Project public key for authentication with OnboardJS Cloud. It is safe to expose this key in your frontend code.
     */
    publicKey?: string

    /**
     * Host URL for the OnboardJS Cloud API
     */
    apiHost?: string

    /**
     * Optional configuration for OnboardJS Cloud Analytics.
     */
    cloudOptions?: {
        /**
         * Enable or disable analytics tracking (defaults to true if publicKey and apiHost are provided)
         */
        enabled?: boolean

        /**
         * Control what percentage of events to track (0.0-1.0, defaults to 1.0)
         */
        samplingRate?: number
    }

    /**
     * The user ID for tracking user-specific events.
     */
    userId?: string | null
}
