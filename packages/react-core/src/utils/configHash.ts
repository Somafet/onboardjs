// @onboardjs/react/src/utils/configHash.ts
'use client'

import { OnboardingStep, OnboardingContext as OnboardingContextType, AnalyticsConfig } from '@onboardjs/core'

/**
 * Creates a stable hash for step configuration.
 * Only considers structural properties that affect engine behavior,
 * not callback functions which change on every render.
 */
function hashStep<TContext extends OnboardingContextType>(step: OnboardingStep<TContext>): string {
    // Extract only the structural properties that affect behavior
    const stepIdentity = {
        id: step.id,
        type: step.type,
        // Hash the payload structure, but stringify functions to detect if they exist
        payload: step.payload
            ? JSON.stringify(step.payload, (_key, value) => (typeof value === 'function' ? '[function]' : value))
            : undefined,
        isSkippable: 'isSkippable' in step ? step.isSkippable : undefined,
        // Check if dynamic navigation exists (not the actual function)
        hasNextStep: step.nextStep !== undefined,
        hasPreviousStep: step.previousStep !== undefined,
        hasCondition: step.condition !== undefined,
        hasOnStepActive: step.onStepActive !== undefined,
        hasOnStepComplete: step.onStepComplete !== undefined,
        // Include meta if it affects rendering
        meta: step.meta ? JSON.stringify(step.meta) : undefined,
    }

    return JSON.stringify(stepIdentity)
}

/**
 * Creates a stable hash for the steps array.
 * This hash only changes when the structural configuration of steps changes,
 * not when callback references change.
 */
export function createStepsHash<TContext extends OnboardingContextType>(steps: OnboardingStep<TContext>[]): string {
    if (!steps || steps.length === 0) {
        return 'empty'
    }

    const stepHashes = steps.map(hashStep)
    return stepHashes.join('|')
}

/**
 * Creates a stable configuration identity for engine initialization.
 * Only includes configuration that should trigger engine re-creation.
 */
export function createConfigHash<TContext extends OnboardingContextType>(config: {
    steps: OnboardingStep<TContext>[]
    initialStepId?: string | number
    initialContext?: Partial<TContext>
    debug?: boolean
    plugins?: unknown[]
    analytics?: AnalyticsConfig | boolean
    publicKey?: string
    apiHost?: string
    userId?: string | null
}): string {
    const { steps, initialStepId, initialContext, debug, plugins, analytics, publicKey, apiHost, userId } = config

    const identity = {
        stepsHash: createStepsHash(steps),
        initialStepId: initialStepId ?? null,
        // Only hash serializable parts of initial context
        initialContextHash: initialContext
            ? JSON.stringify(initialContext, (_key, value) => (typeof value === 'function' ? '[function]' : value))
            : null,
        debug: debug ?? false,
        // Count plugins and their types, not their instances
        pluginCount: plugins?.length ?? 0,
        // Hash analytics config (before_send is a function, so we check for its presence)
        analyticsHash: analytics
            ? JSON.stringify(analytics, (_key, value) => (typeof value === 'function' ? '[function]' : value))
            : null,
        publicKey: publicKey ?? null,
        apiHost: apiHost ?? null,
        userId: userId ?? null,
    }

    return JSON.stringify(identity)
}

/**
 * Compares two step arrays for structural equality.
 * Returns true if the steps are structurally equivalent.
 */
export function areStepsEqual<TContext extends OnboardingContextType>(
    stepsA: OnboardingStep<TContext>[],
    stepsB: OnboardingStep<TContext>[]
): boolean {
    if (stepsA.length !== stepsB.length) {
        return false
    }

    return createStepsHash(stepsA) === createStepsHash(stepsB)
}
