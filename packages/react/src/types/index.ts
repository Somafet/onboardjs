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

export interface StepComponentProps<P = any> {
  payload: P;
  coreContext: OnboardingContext;
  onDataChange: (data: any, isValid: boolean) => void;
  initialData?: Record<string, any>;
  setStepValid?: (isValid: boolean) => void;
}

/**
 * Defines the mapping from a key (either an OnboardingStepType or a custom string)
 * to a React component for rendering that step.
 */
export type StepComponentRegistry = {
  // Iterate over all possible string keys
  [Key in string]?: Key extends OnboardingStepType // Check if the key is a standard OnboardingStepType
    ? React.ComponentType<
        // If yes, the component expects the specific payload for that OnboardingStepType
        StepComponentProps<Extract<OnboardingStep, { type: Key }>["payload"]>
      >
    : React.ComponentType<StepComponentProps<any>>; // If no (it's a custom key like 'welcome', 'userProfile'),
  // the component expects StepComponentProps with any payload.
  // The specific custom component will define its own expected payload structure.
};
