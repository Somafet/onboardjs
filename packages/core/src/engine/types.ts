// @onboardjs/core/src/engine/types.ts

import { OnboardingStep, OnboardingContext } from "../types";

export interface EngineState {
  currentStep: OnboardingStep | null;
  context: OnboardingContext;
  isFirstStep: boolean;
  isLastStep: boolean;
  canGoNext: boolean; // Considers if nextStep exists and current step is valid (validity handled by UI)
  canGoPrevious: boolean; // Considers if previousStep exists
  isSkippable: boolean;
  isLoading: boolean; // For async operations within the engine
  error: Error | null;
  isCompleted: boolean;
}

export type EngineStateChangeListener = (state: EngineState) => void;
export type UnsubscribeFunction = () => void;

export interface OnboardingEngineConfig {
  steps: OnboardingStep[];
  initialStepId?: string;
  initialContext?: Partial<OnboardingContext>;
  onFlowComplete?: (context: OnboardingContext) => void;
  onStepChange?: (
    newStep: OnboardingStep | null,
    oldStep: OnboardingStep | null,
    context: OnboardingContext
  ) => void;
}
