import { OnboardingStep } from "@onboardjs/core";
import { AppOnboardingContext } from "../common-flow-config";
import { StepComponentRegistry } from "@onboardjs/react";
import dynamic from "next/dynamic";

const PersistenceWithSupabaseStep = dynamic(
  () => import("./peristence-flow-step"),
);

export const persistenceFlowSteps: OnboardingStep<AppOnboardingContext>[] = [
  {
    id: "persistence-with-supabase",
    type: "CUSTOM_COMPONENT",
    payload: {
      componentKey: "persistence-with-supabase-step",
      title: "Persistence w/ Supabase",
    },
    condition(context) {
      return context.flowData.selectedOption === "persistence";
    },
    nextStep: null,
  },
];

export const persistenceRegistry: StepComponentRegistry<AppOnboardingContext> =
  {
    "persistence-with-supabase-step": PersistenceWithSupabaseStep,
  };
