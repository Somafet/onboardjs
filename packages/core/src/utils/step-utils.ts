// @onboardjs/core/src/utils/step-utils.ts

import { OnboardingStep, OnboardingContext } from "../types";

/**
 * Evaluates a step ID that can be a string, number or a function.
 */
export function evaluateStepId<
  TContext extends OnboardingContext = OnboardingContext, // Add TContext generic
>(
  stepIdOrFn:
    | string
    | number
    | ((context: TContext) => string | number | null | undefined) // Use TContext
    | null
    | undefined,
  context: TContext // Use TContext
): string | number | null | undefined {
  if (typeof stepIdOrFn === "function") {
    return stepIdOrFn(context);
  }
  return stepIdOrFn;
}

/**
 * Finds a step by its ID in an array of steps.
 */
export function findStepById<
  TContext extends OnboardingContext = OnboardingContext, // Add TContext generic
>(
  steps: OnboardingStep<TContext>[], // Use generic OnboardingStep
  stepId: string | null | undefined | number
): OnboardingStep<TContext> | undefined {
  // Return generic OnboardingStep
  if (stepId === null || stepId === undefined) return undefined; // Handle null/undefined explicitly
  return steps.find((s) => s.id === stepId);
}
