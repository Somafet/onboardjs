// @onboardjs/react/src/types/index.ts
import React from "react";
import {
  OnboardingStep,
  OnboardingStepType, // Ensure this is imported from @onboardjs/core
  OnboardingContext,
  // Import specific payload types if needed for prop definitions
  // e.g., CustomComponentStepPayload from @onboardjs/core if you want to be more specific
  // for the 'else' branch, though 'any' is often practical here.
} from "@onboardjs/core";

/**
 * Props that will be passed to every registered step component.
 * @template P The type of the step's payload.
 */
export interface StepComponentProps<P = any, TContext = OnboardingContext> {
  /** The payload object from the current step's definition. */
  payload: P;
  /** The full, current context from the OnboardingEngine. */
  coreContext: TContext;
  /**
   * A callback to pass data from your component back to the engine.
   * This data will be automatically passed to the `next()` method.
   * @param data The data collected by the step.
   * @param isValid Whether the step is currently in a valid state to proceed.
   */
  onDataChange?: (data: any, isValid: boolean) => void;
  /**
   * Initial data for this step, pulled from the engine's `flowData`.
   * Useful for re-hydrating forms or selections.
   */
  initialData?: Record<string, any>;

  setStepValid?: (isValid: boolean) => void;
}

/**
 * A React component for rendering a step. It can be a component that accepts
 * `StepComponentProps` to interact with the onboarding engine, or a simple
 * presentational component that takes no props.
 * @template P The type of the step's payload.
 */
type StepComponent<P = any> =
  | React.ComponentType<StepComponentProps<P>>
  | React.ComponentType<{}>;

/**
 * Defines the mapping from a step type (or a custom key)
 * to a React component for rendering that step.
 *
 * This advanced type provides payload type inference for standard step types.
 */
export type StepComponentRegistry = {
  [Key in string]?: Key extends OnboardingStepType // Is it a standard type?
    ? StepComponent<Extract<OnboardingStep, { type: Key }>["payload"]>
    : // No: It's a custom key, so the payload is `any`
      StepComponent<any>;
};
