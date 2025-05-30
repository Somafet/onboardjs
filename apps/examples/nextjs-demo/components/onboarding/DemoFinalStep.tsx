// components/onboarding-ui/steps/DemoFinalStep.tsx
"use client";
import React from "react";
import {
  CustomComponentStepPayload,
  StepComponentProps,
} from "@onboardjs/react";
import { CheckCircle } from "lucide-react";

const DemoFinalStep: React.FC<
  StepComponentProps<CustomComponentStepPayload>
> = ({ payload, coreContext }) => {
  // Optionally, show the user's name if it was collected in flowData
  const userName = coreContext?.flowData?.userName ?? undefined;

  return (
    <div className="text-center p-4">
      <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-6 animate-fade-up" />
      <h2 className="text-3xl font-bold text-zinc-950 animate-fade-up mb-6">
        {userName
          ? `🎉 Welcome aboard, ${userName}!`
          : (payload.mainText ?? "You’re all set!")}
      </h2>
      <p className="text-lg text-gray-600 animate-fade-up animate-delay-300 mb-8">
        {payload.subText ?? "Your onboarding is complete."}
      </p>
    </div>
  );
};

export default DemoFinalStep;
