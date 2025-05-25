// components/onboarding/steps/WelcomeStep.tsx
"use client";

import React, { useEffect } from "react";
import { StepComponentProps } from "@onboardjs/react"; // Assuming this is exported
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface WelcomeStepPayload {
  componentKey: "welcome"; // Matches the key in step definition
  title: string;
  description: string;
  imageUrl?: string;
}

const WelcomeStep: React.FC<StepComponentProps<WelcomeStepPayload>> = ({
  payload,
  setStepValid,
}) => {
  useEffect(() => {
    if (setStepValid) setStepValid(true); // This step is immediately valid
  }, [setStepValid]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{payload.title}</CardTitle>
        {payload.description && (
          <CardDescription>{payload.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {payload.imageUrl && (
          <img
            src={payload.imageUrl}
            alt={payload.title}
            className="rounded-md object-cover w-full max-h-60 my-4"
          />
        )}
        <p>This is a custom welcome step using Shadcn UI components!</p>
      </CardContent>
    </Card>
  );
};

export default WelcomeStep;
