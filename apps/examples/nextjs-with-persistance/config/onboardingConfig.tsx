// config/onboardingConfig.ts
import ConfirmationStep from "@/components/onboarding/ConfirmationStep";
import UserProfileStep from "@/components/onboarding/UserProfileStep";
import WelcomeStep from "@/components/onboarding/WelcomeStep";
import WorkspaceDetailsStep from "@/components/onboarding/WorkspaceDetailsStep";
import { OnboardingStep, StepComponentRegistry } from "@onboardjs/react";


export const appOnboardingSteps: OnboardingStep[] = [
  {
    id: "welcome",
    type: "CUSTOM_COMPONENT", // Critical: Use CUSTOM_COMPONENT type
    title: "Welcome!",
    payload: {
      componentKey: "welcome", // This key maps to WelcomeStep in the registry
      title: "Welcome to Our Application!",
      description: "We're excited to have you on board.",
      imageUrl: "https://placehold.co/600x300/e2e8f0/64748b?text=Welcome!",
    },
    nextStep: "user-profile",
    ctaLabel: "Let's Go!",
  },
  {
    id: "user-profile",
    type: "CUSTOM_COMPONENT",
    title: "Your Profile",
    payload: {
      componentKey: "userProfile",
      nameFieldKey: "userName",
      emailFieldKey: "userEmail",
    },
    nextStep: "workspace-details",
    previousStep: "welcome",
  },
  {
    id: "workspace-details",
    type: "CUSTOM_COMPONENT",
    title: "Workspace Setup",
    payload: {
      componentKey: "workspaceDetails",
      workspaceNameKey: "workspaceName",
    },
    nextStep: "confirmation",
    previousStep: "user-profile",
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
    previousStep: "workspace-details",
    nextStep: null, // End of the flow
    ctaLabel: "Finish Setup",
  },
];

export const appStepComponentRegistry: StepComponentRegistry = {
  // The key here MUST match the `componentKey` in the step's payload
  welcome: WelcomeStep,
  userProfile: UserProfileStep,
  workspaceDetails: WorkspaceDetailsStep,
  confirmation: ConfirmationStep,
  // Note: For non-CUSTOM_COMPONENT types, you'd use the OnboardingStepType string
  // e.g., WELCOME: MyStandardWelcomeComponent (if you mix and match)
};
