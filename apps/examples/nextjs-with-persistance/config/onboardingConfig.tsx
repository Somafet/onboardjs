// config/demoOnboardingConfig.ts
import { OnboardingStep, StepComponentRegistry } from "@onboardjs/react";

// Import custom step components
import DemoNameStep from "@/components/onboarding/DemoNameStep";
import DemoWelcomeStep from "@/components/onboarding/DemoWelcomeStep";

export const demoOnboardingSteps: OnboardingStep[] = [
  {
    id: "welcome",
    type: "CUSTOM_COMPONENT", // All steps will be custom for this demo
    title: "Welcome Aboard!",
    description: "We are excited to guide you through our app.",
    payload: {
      componentKey: "demoWelcome", // This key maps to DemoWelcomeStep
      title: "Hello There!",
      message: (
        <>
          This is a fully custom onboarding flow using{" "}
          <code>@onboardjs/react</code> headless capabilities.
        </>
      ),
      imageUrl: "https://placehold.co/600x300/7c3aed/white?text=Welcome!",
    },
    nextStep: "enter-name",
    ctaLabel: "Let's Get Started",
  },
  {
    id: "enter-name",
    type: "CUSTOM_COMPONENT",
    title: "What Should We Call You?",
    description: "Personalization is key!",
    payload: {
      componentKey: "demoName", // Maps to DemoNameStep
      fields: [
        {
          label: "Your Name",
          key: "userName", // This will be stored in flowData
          placeholder: "Enter your name",
        },
        {
          label: "Organization",
          description: "Optional, but helps us personalize your experience.",
          key: "orgName", // This will be stored in flowData
          placeholder: "Google LLC",
        },
      ],
    },
    previousStep: "welcome",
    nextStep: "final-step",
    ctaLabel: "Continue",
  },
  {
    id: "final-step",
    type: "CUSTOM_COMPONENT",
    title: "All Done (Almost)!",
    payload: {
      componentKey: "demoWelcome", // Reusing welcome for simplicity
      title: "You are doing great!",
      message: "This is the last step in our short demo. Click Finish!",
    },
    previousStep: "enter-name",
    nextStep: null, // End of flow
    ctaLabel: "Finish Onboarding",
  },
];

export const demoStepComponentRegistry: StepComponentRegistry = {
  demoWelcome: DemoWelcomeStep,
  demoName: DemoNameStep,
  // If you had standard types you wanted to map, e.g.:
  // WELCOME: SomeOtherWelcomeComponent,
};
