import { OnboardingStep } from "@onboardjs/core";
import { AppOnboardingContext } from "../common-flow-config";
import dynamic from "next/dynamic";
import { StepComponentRegistry } from "@onboardjs/react";

const ConditionalNameStep = dynamic(() => import("./conditional-name-step"));
const OrgStep = dynamic(() => import("./conditional-org-step"));

export const conditionalFlowSteps: OnboardingStep<AppOnboardingContext>[] = [
  {
    id: "conditional-name-step",
    type: "CUSTOM_COMPONENT",
    payload: {
      componentKey: "conditional-name-step", // Maps to ConditionalNameStep
      options: [
        {
          label: "Individual",
          value: "individual",
          description: "Select if you are an individual user.",
        },
        {
          label: "Organization",
          value: "org",
          description: "Select if you are representing an organization.",
        },
      ],
    },
    previousStep: "welcome",
    condition: (context) => {
      return context.flowData?.selectedOption === "conditional-flow";
    },
  },
  {
    id: "org-step",
    type: "CUSTOM_COMPONENT",
    payload: {
      componentKey: "org-step", // This would be another step component for orgs
    },
    previousStep: "conditional-name-step",
    condition: (context) => {
      return (
        context.flowData?.selectedOption === "conditional-flow" &&
        context.flowData?.userType === "org"
      );
    },
  },
];

export const conditionalFlowRegistry: StepComponentRegistry = {
  "conditional-name-step": ConditionalNameStep,
  "org-step": OrgStep,
};
