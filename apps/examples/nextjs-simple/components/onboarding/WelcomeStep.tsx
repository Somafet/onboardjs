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
  title: string;
  description: string;
}

const WelcomeStep: React.FC<StepComponentProps<WelcomeStepPayload>> = ({
  payload,
}) => {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{payload.title}</CardTitle>
        {payload.description && (
          <CardDescription>{payload.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <p>This is a custom welcome step using Shadcn UI components!</p>
      </CardContent>
    </Card>
  );
};

export default WelcomeStep;
