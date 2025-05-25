// @onboardjs/react/src/index.ts

export { OnboardingFlow } from "./OnboardingFlow";
export { useOnboarding } from "./hooks/useOnboarding";
export {
  OnboardingContext,
  OnboardingProvider,
} from "./context/OnboardingProvider";

// Export step display components if you want to allow users to import them directly
// though they are primarily used via the stepComponentRegistry
export * from "./components/steps";

// Export types needed by consumers
export * from "./types"; // StepComponentProps, StepComponentRegistry
// Re-export core types for convenience, so users only need to import from @onboardjs/react
export type {
  OnboardingStep,
  OnboardingContext as CoreOnboardingContext,
  BaseOnboardingStep,
  OnboardingStepType,
  // Export specific payloads if users might need to type them for custom logic
  WelcomeStepPayload,
  WelcomeInputFormStepPayload,
  FormInputStepPayload,
  // ... other payloads
  OnboardingEngineConfig,
  EngineState,
} from "@onboardjs/core";
