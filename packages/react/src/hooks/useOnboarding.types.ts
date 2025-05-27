// @onboardjs/react/src/hooks/useOnboarding.types.ts (or directly in useOnboarding.ts)
import {
  OnboardingEngine,
  EngineState,
  OnboardingEngineConfig,
  OnboardingContext as CoreOnboardingContext,
  DataLoadListener,
  DataPersistListener,
  BeforeStepChangeListener,
  FlowCompleteListener, // Assuming this is exported from @onboardjs/core
  // Add other event listener types from @onboardjs/core if needed
  // e.g., StepChangeListener, BeforeStepChangeListenerType
} from "@onboardjs/core";
import { OnboardingActions } from "../context/OnboardingProvider"; // Assuming OnboardingActions is still useful

export interface UseOnboardingOptions {
  /**
   * Callback executed when the entire onboarding flow is completed.
   * This callback is specific to this instance of the `useOnboarding` hook.
   */
  onFlowComplete?: FlowCompleteListener;

  /**
   * Callback executed when the current step changes.
   * Specific to this instance of the `useOnboarding` hook.
   */
  onStepChange?: (
    newStep: ReturnType<OnboardingEngine["getState"]>["currentStep"],
    oldStep: ReturnType<OnboardingEngine["getState"]>["currentStep"], // Assuming oldStep can be tracked or passed
    context: CoreOnboardingContext
  ) => void;

  /**
   * Callback executed before the current step changes.
   * This allows you to perform checks or actions before the step transition.
   */
  onBeforeStepChange?: BeforeStepChangeListener;

  /**
   * Callback executed when data is loaded for the current step.
   * This can be used to trigger UI updates or other actions based on loaded data.
   */
  onDataLoad?: DataLoadListener;

  /**
   * Callback executed when data is persisted for the current step.
   * Useful for triggering actions after data is saved.
   */
  onDataPersist?: DataPersistListener;
}

export interface UseOnboardingReturn {
  engine: OnboardingEngine | null;
  state: EngineState | null;
  isLoading: boolean;
  actions: OnboardingActions | null; // Keep the wrapped actions for direct invocation
  // Add any other status shorthands if desired, similar to next-safe-action
  isCompleted: boolean;
  currentStep: EngineState["currentStep"];
  // ... etc.
}
