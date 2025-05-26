// config/onboardingConfig.ts
import ConfirmationStep from "@/components/onboarding/ConfirmationStep";
import WelcomeStep from "@/components/onboarding/WelcomeStep";
import { OnboardingStep, StepComponentRegistry } from "@onboardjs/react";

export const appOnboardingSteps: OnboardingStep[] = [
  {
    id: "welcome",
    type: "INFORMATION",
    title: "Welcome!",
    payload: {
      mainText: "Welcome to Our Application!",
      subText: "We're excited to have you on board.",
    },
    nextStep: "confirmation",
    ctaLabel: "Let's Go!",
  },
  {
    id: "confirmation",
    type: "CUSTOM_COMPONENT",
    title: "Confirm Your Details",
    payload: {
      componentKey: "confirmation",
      title: "Ready to Go?",
      message: "One last look before we finalize your setup.",
      dataKeysToShow: [
        { key: "userName", label: "Full Name" },
        { key: "userEmail", label: "Email" },
        { key: "workspaceName", label: "Workspace" },
      ],
    },
    nextStep: null, // End of the flow
    ctaLabel: "Finish Setup",
  },
];

export const appStepComponentRegistry: StepComponentRegistry = {
  INFORMATION: WelcomeStep,
  // The key for type CUSTOM_COMPONENT here MUST match the `componentKey` in the step's payload
  confirmation: ConfirmationStep,
};
