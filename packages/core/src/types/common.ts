import { type ChecklistItemState } from './payloads'

/**
 * Represents the shared context available throughout the onboarding flow.
 * This context is passed to dynamic functions (like condition, nextStep)
 * and can be made available to UI components.
 */
export interface OnboardingContext<TUser = any> {
    /** Data collected from all completed steps so far. */
    flowData: {
        _internal?: {
            completedSteps: Record<string | number, number> // stepId -> completionTimestamp
            startedAt: number // timestamp when the overall flow started
            stepStartTimes: Record<string | number, number> // stepId -> timestamp when step became active
        }

        [key: string]: any // Additional data can be added by steps
    }
    /** Information about the current user, if available. */
    currentUser?: TUser
    /** Any other global state or services relevant to the onboarding flow. */
    [key: string]: any
}

/**
 * Helper type to extract the step data type based on step type and payload
 */
export type StepDataForStep<TStepType extends string, TPayload> = TStepType extends 'SINGLE_CHOICE'
    ? TPayload extends { dataKey: infer K extends string }
        ? { [P in K]: any }
        : Record<string, any>
    : TStepType extends 'MULTIPLE_CHOICE'
      ? TPayload extends { dataKey: infer K extends string }
          ? { [P in K]: any[] }
          : Record<string, any>
      : TStepType extends 'CHECKLIST'
        ? TPayload extends { dataKey: infer K extends string }
            ? { [P in K]: ChecklistItemState[] }
            : Record<string, any>
        : Record<string, any>

type SkipableStep<TContext extends OnboardingContext = OnboardingContext> = {
    isSkippable: true
    skipToStep:
        | string
        | number
        | null
        | ((context: TContext) => string | null | undefined) // Use TContext
        | undefined
}

type NonSkipableStep = {
    isSkippable?: false
    skipToStep?: never
}

/**
 * Base properties common to all onboarding steps.
 */
export type BaseOnboardingStep<
    TStepType extends string = 'INFORMATION',
    TPayload = Record<string, any>,
    TContext extends OnboardingContext = OnboardingContext,
> = {
    /** A unique identifier for this step. */
    id: string | number
    nextStep?:
        | string
        | number
        | null
        | ((context: TContext) => string | null | undefined) // Use TContext
        | undefined
    /**
     * Determines the ID of the previous step.
     * Can be a static string, null (no previous), undefined, or a function.
     */
    previousStep?:
        | string
        | number
        | null
        | ((context: TContext) => string | null | undefined) // Use TContext
        | undefined
    onStepActive?: (context: TContext) => Promise<void> | void // Use TContext
    onStepComplete?: (
        stepData: StepDataForStep<TStepType, TPayload>,
        context: TContext // Use TContext
    ) => Promise<void> | void
    condition?: (context: TContext) => boolean // Use TContext
    /** Arbitrary metadata for custom use cases or extensions. */
    meta?: Record<string, any>
} & (SkipableStep<TContext> | NonSkipableStep) // Pass TContext to SkipableStep
