// @onboardjs/react/src/types/index.ts
import React from 'react'
import {
    OnboardingStep as CoreOnboardingStep,
    OnboardingContext,
    // Import specific payload types if needed for prop definitions
    // e.g., CustomComponentStepPayload from @onboardjs/core if you want to be more specific
    // for the 'else' branch, though 'any' is often practical here.
} from '@onboardjs/core'

/**
 * Props that will be passed to every registered step component.
 * @template P The type of the step's payload.
 * @template TContext The type of the onboarding context.
 */
export interface StepComponentProps<P = unknown, TContext extends OnboardingContext = OnboardingContext> {
    /** The payload object from the current step's definition. */
    payload: P

    /** The full, current context from the OnboardingEngine. */
    context: TContext

    /**
     * A callback to pass data from your component back to the engine.
     * This data will be automatically passed to the `next()` method.
     * @param data The data collected by the step.
     * @param isValid Whether the step is currently in a valid state to proceed.
     */
    onDataChange?: (data: unknown, isValid: boolean) => void

    /**
     * Initial data for this step, pulled from the engine's `flowData`.
     * Useful for re-hydrating forms or selections.
     */
    initialData?: Record<string, unknown>

    /**
     * @deprecated Use `context` instead. This will be removed in v3.0.
     */
    coreContext: TContext

    /**
     * @deprecated This prop is not used by the engine. This will be removed in v3.0.
     */
    setStepValid?: (isValid: boolean) => void
}

/**
 * A type representing the React specific definition of an onboarding step.
 * It expands the core onboarding step type to include React-specific properties.
 */
export type OnboardingStep<TContext extends OnboardingContext = OnboardingContext> = CoreOnboardingStep<TContext> & {
    /**
     * The React component that will render this step.
     * It can be a component that accepts `StepComponentProps` to interact with the onboarding engine,
     * or a simple presentational component that takes no props.
     */
    component?: StepComponent<any, TContext>
}

/**
 * A React component for rendering a step. It can be a component that accepts
 * `StepComponentProps` to interact with the onboarding engine, or a simple
 * presentational component that takes no props.
 *
 * @template P The type of the step's payload.
 * @template TContext The type of the onboarding context.
 */
export type StepComponent<P = any, TContext extends OnboardingContext = OnboardingContext> = React.ComponentType<
    StepComponentProps<P, TContext>
>

/**
 * Defines the mapping from a step type (or a custom key)
 * to a React component for rendering that step.
 *
 * This advanced type provides payload type inference for standard step types.
 * Uses `any` for the value type to allow components with specific payload types
 * to be assigned without strict type checking issues.
 */
export type StepComponentRegistry<TContext extends OnboardingContext = OnboardingContext> = {
    [Key in string]?: StepComponent<any, TContext>
}
