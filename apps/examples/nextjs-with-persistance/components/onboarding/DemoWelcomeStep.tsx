// components/onboarding-ui/steps/DemoWelcomeStep.tsx
"use client";
import React from "react";
import { StepComponentProps } from "@onboardjs/react"; // Assuming user installs and imports this

export interface DemoWelcomePayload {
  title: string;
  message: string;
  imageUrl?: string;
}

const DemoWelcomeStep: React.FC<StepComponentProps<DemoWelcomePayload>> = ({
  payload,
}) => {
  return (
    <div className="text-center p-4 space-y-8">
      {payload.imageUrl && (
        <img
          src={payload.imageUrl}
          alt="Welcome"
          className="mx-auto rounded-lg shadow-md w-full max-w-sm h-auto animate-in fade-in-0 duration-500"
        />
      )}
      <h2 className="text-3xl font-bold text-gray-800">{payload.title}</h2>
      <p className="text-lg text-gray-600">{payload.message}</p>
    </div>
  );
};

export default DemoWelcomeStep;
