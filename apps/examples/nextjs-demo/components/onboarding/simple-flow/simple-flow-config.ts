import { OnboardingStep } from "@onboardjs/core";
import { StepComponentRegistry } from "@onboardjs/react";
import dynamic from "next/dynamic";
import { AppOnboardingContext } from "../common-flow-config";

const DemoNameStep = dynamic(
  () => import("@/components/onboarding/DemoNameStep"),
);
const FinalStep = dynamic(
  () => import("@/components/onboarding/DemoFinalStep"),
);

export const simpleFlowSteps: OnboardingStep<AppOnboardingContext>[] = [
  {
    id: "name-step",
    type: "CUSTOM_COMPONENT",
    condition(context) {
      return context.flowData.selectedOption === "simple-flow";
    },
    payload: {
      componentKey: "demoName", // Maps to DemoNameStep
      title: "What is your name? 👋",
      description: "Personalization is key!",
      fields: [
        {
          label: "Your Name",
          key: "userName", // This will be stored in flowData
          placeholder: "Enter your name",
        },
        {
          label: "Organization (Optional)",
          description: "Optional, but helps us personalize your experience.",
          key: "orgName", // This will be stored in flowData
          placeholder: "Google LLC",
        },
      ],
      ctaLabel: "Continue",
    },
  },
  {
    id: "final-step",
    type: "CUSTOM_COMPONENT",
    condition(context) {      
      return context.flowData.selectedOption === "simple-flow";
    },
    payload: {
      componentKey: "finalStep",
      title: "All Done (Almost)!",
      mainText: "🎉 Welcome aboard!",
      subText: "This is the last step in our short demo. Click Finish!",
      ctaLabel: "Finish!",
    },
    previousStep: "name-step",
    nextStep: null, // End of flow
    meta: {
      isValid: true, // This step is always valid
    },
  },
];

export const simpleFlowRegistry: StepComponentRegistry = {
  demoName: DemoNameStep,
  finalStep: FinalStep,
};
