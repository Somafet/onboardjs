// @onboardjs/core/src/utils/step-utils.ts

import { OnboardingStep, OnboardingContext } from '../types'

/**
 * Evaluates a step ID that can be a string, number or a function.
 */
export function evaluateStepId<TContext extends OnboardingContext = OnboardingContext>(
    stepIdOrFn:
        | string
        | number
        | ((context: TContext) => string | number | null | undefined) // Use TContext
        | null
        | undefined,
    context: TContext // Use TContext
): string | number | null | undefined {
    if (typeof stepIdOrFn === 'function') {
        return stepIdOrFn(context)
    }
    return stepIdOrFn
}

/**
 * Finds a step by its ID in an array of steps.
 */
export function findStepById<TContext extends OnboardingContext = OnboardingContext>(
    steps: OnboardingStep<TContext>[], // Use generic OnboardingStep
    stepId: string | null | undefined | number
): OnboardingStep<TContext> | undefined {
    // Return generic OnboardingStep
    if (stepId === null || stepId === undefined) return undefined // Handle null/undefined explicitly
    return steps.find((s) => s.id === stepId)
}

/**
 * Gets the index of a step by its ID in an array of steps.
 *
 * @param steps - Array of onboarding steps
 * @param stepId - The ID of the step to find
 * @returns The 0-based index of the step, or -1 if not found
 *
 * @example
 * const steps = [{ id: 'welcome' }, { id: 'profile' }, { id: 'complete' }]
 * getStepIndex(steps, 'profile') // returns 1
 * getStepIndex(steps, 'unknown') // returns -1
 */
export function getStepIndex<TContext extends OnboardingContext = OnboardingContext>(
    steps: OnboardingStep<TContext>[],
    stepId: string | number | null | undefined
): number {
    if (stepId === null || stepId === undefined) return -1
    return steps.findIndex((s) => s.id === stepId)
}
