// @onboardjs/react/src/types/index.ts
import React from 'react'
import {
    OnboardingStep as CoreOnboardingStep,
    OnboardingContext,
    OnboardingStepType,
    InformationStepPayload,
    MultipleChoiceStepPayload,
    SingleChoiceStepPayload,
    ConfirmationStepPayload,
    CustomComponentStepPayload,
    ChecklistStepPayload,
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
 * Discriminated union for step component props by step type.
 * Provides type-safe mapping from step types to their payload types.
 */
export type StepComponentPropsMap<TContext extends OnboardingContext = OnboardingContext> = {
    INFORMATION: StepComponentProps<InformationStepPayload, TContext>
    SINGLE_CHOICE: StepComponentProps<SingleChoiceStepPayload, TContext>
    MULTIPLE_CHOICE: StepComponentProps<MultipleChoiceStepPayload, TContext>
    CONFIRMATION: StepComponentProps<ConfirmationStepPayload, TContext>
    CHECKLIST: StepComponentProps<ChecklistStepPayload<TContext>, TContext>
    CUSTOM_COMPONENT: StepComponentProps<CustomComponentStepPayload, TContext>
}

/**
 * A React component for rendering a step. It can be a component that accepts
 * `StepComponentProps` to interact with the onboarding engine, or a simple
 * presentational component that takes no props.
 *
 * @template P The type of the step's payload.
 * @template TContext The type of the onboarding context.
 */
export type StepComponent<P = unknown, TContext extends OnboardingContext = OnboardingContext> = React.ComponentType<
    StepComponentProps<P, TContext>
>

/**
 * Strict component type keyed by step type.
 * Provides type-safe component assignment for predefined step types.
 */
export type StepComponentByType<
    T extends OnboardingStepType,
    TContext extends OnboardingContext = OnboardingContext,
> = React.ComponentType<StepComponentPropsMap<TContext>[T]>

/**
 * Defines the mapping from a step type (or a custom key) to a React component for rendering that step.
 *
 * This type provides:
 * - Strong typing for predefined step types (INFORMATION, CUSTOM_COMPONENT, etc.)
 * - Flexibility for string-keyed custom components
 * - Proper payload type inference based on step type
 *
 * @example
 * ```tsx
 * const registry: StepComponentRegistry<MyContext> = {
 *   // Predefined types with type-safe props
 *   INFORMATION: (props) => { // props is StepComponentProps<InformationStepPayload, MyContext>
 *     return <div>{props.payload.mainText}</div>
 *   },
 *   // String keys for custom components
 *   'custom-step': (props) => {
 *     return <CustomStepUI payload={props.payload} />
 *   }
 * }
 * ```
 */
export type StepComponentRegistry<TContext extends OnboardingContext = OnboardingContext> = {
    [K in OnboardingStepType]?: StepComponentByType<K, TContext>
} & Record<string | number, StepComponent<any, TContext>>

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
    // Accept strongly-typed step components or any React component (e.g., Next.js dynamic())
    // Using ComponentType<any> allows dynamically imported components with unknown props to be assigned.
    component?: StepComponent<unknown, TContext> | React.ComponentType<any>
}
