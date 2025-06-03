// components/onboarding-ui/steps/DemoWelcomeStep.tsx
"use client";
import React from "react";
import { StepComponentProps, useOnboarding } from "@onboardjs/react"; // Assuming user installs and imports this
import { Button } from "../ui/button";
import { DemoNamePayload } from "./DemoNameStep";

const DemoWelcomeStep: React.FC<StepComponentProps<DemoNamePayload>> = ({
  payload,
}) => {
  const { next } = useOnboarding();
  return (
    <div className="text-center p-4">
      <h2 className="text-3xl font-bold text-zinc-950 animate-fade-up mb-8 sm:mb-16">
        {payload.mainText}
      </h2>
      <p className="text-lg text-gray-600 animate-fade-up animate-delay-300 mb-8 sm:mb-24">
        {payload.subText}
      </p>

      <Button
        className="animate-jump-in animate-delay-1000 px-6 py-3 text-lg"
        onClick={() => next()}
      >
        {payload.ctaLabel ?? "Let's Go!"}
      </Button>
    </div>
  );
};

export default DemoWelcomeStep;
