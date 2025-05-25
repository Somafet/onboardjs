// @onboardjs/core/src/utils/step-utils.ts

import { OnboardingStep, OnboardingContext } from "../types";

/**
 * Evaluates a step ID that can be a string or a function.
 */
export function evaluateStepId(
  stepIdOrFn:
    | string
    | number
    | ((context: OnboardingContext) => string | null | undefined)
    | null
    | undefined,
  context: OnboardingContext
): string | number | null | undefined {
  if (typeof stepIdOrFn === "function") {
    return stepIdOrFn(context);
  }
  return stepIdOrFn;
}

/**
 * Finds a step by its ID in an array of steps.
 */
export function findStepById(
  steps: OnboardingStep[],
  stepId: string | null | undefined | number
): OnboardingStep | undefined {
  if (!stepId) return undefined;
  return steps.find((s) => s.id === stepId);
}
