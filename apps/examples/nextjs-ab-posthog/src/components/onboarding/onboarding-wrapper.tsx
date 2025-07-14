"use client";

import { OnboardingStep } from "@onboardjs/core";
import { OnboardingProvider } from "@onboardjs/react";
import { PropsWithChildren } from "react";
import FirstStep from "./first-step";

const steps: OnboardingStep[] = [
  {
    id: "first-step",
  },
];

const componentRegistry = {
  "first-step": FirstStep,
};

export default function OnboardingWrapper({ children }: PropsWithChildren) {
  return (
    <OnboardingProvider steps={steps} componentRegistry={componentRegistry}>
      {children}
    </OnboardingProvider>
  );
}
