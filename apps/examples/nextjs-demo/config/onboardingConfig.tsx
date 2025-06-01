"use client";

// config/demoOnboardingConfig.ts
import { OnboardingStep, StepComponentRegistry } from "@onboardjs/react";
import { z } from "zod";

// Import custom step components
import DemoNameStep from "@/components/onboarding/DemoNameStep";
import DemoWelcomeStep from "@/components/onboarding/DemoWelcomeStep";
import DemoFinalStep from "@/components/onboarding/DemoFinalStep";

export const demoOnboardingSteps: OnboardingStep[] = [
  {
    id: "welcome",
    type: "CUSTOM_COMPONENT", // All steps will be custom for this demo
    payload: {
      componentKey: "step1",
      title: "Build Your Onboarding Flow",
      description:
        "We just need a few details to better tailor your experience.",
      mainText: "Welcome to OnboardJs!",
      subText:
        "Thanks for checking out OnboardJS. In just a few steps, you’ll see how easy it is to build powerful, custom onboarding flows for your own apps.",
      ctaLabel: "Let's Go!",
    },
    meta: {
      disableCta: true,
    },
    nextStep: "enter-name",
  },
  {
    id: "enter-name",
    type: "CUSTOM_COMPONENT",
    payload: {
      componentKey: "demoName", // Maps to DemoNameStep
      title: "What Should We Call You?",
      description: "Personalization is key!",
      fields: [
        {
          label: "Your Name",
          key: "userName", // This will be stored in flowData
          placeholder: "Enter your name",
          validation: z.string().min(1, "Name is required"),
        },
        {
          label: "Organization (Optional)",
          description: "Optional, but helps us personalize your experience.",
          key: "orgName", // This will be stored in flowData
          placeholder: "Google LLC",
          validation: z.string().optional(),
        },
      ],
      ctaLabel: "Continue",
    },
    previousStep: "welcome",
    nextStep: "final-step",
  },
  {
    id: "final-step",
    type: "CUSTOM_COMPONENT",
    payload: {
      componentKey: "finalStep",
      title: "All Done (Almost)!",
      mainText: "🎉 Welcome aboard!",
      subText: "This is the last step in our short demo. Click Finish!",
      ctaLabel: "Finish!",
    },
    previousStep: "enter-name",
    nextStep: null, // End of flow
    meta: {
      isValid: true, // This step is always valid
    },
  },
];

export const demoStepComponentRegistry: StepComponentRegistry = {
  step1: DemoWelcomeStep,
  demoName: DemoNameStep,
  finalStep: DemoFinalStep,
  // If you had standard types you wanted to map, e.g.:
  // WELCOME: SomeOtherWelcomeComponent,
};
