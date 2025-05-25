// components/onboarding/steps/ConfirmationStep.tsx
"use client";

import React, { useEffect } from "react";
import { StepComponentProps, CoreOnboardingContext } from "@onboardjs/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface ConfirmationPayload {
  componentKey: "confirmation";
  title: string;
  message?: string;
  dataKeysToShow: Array<{ key: string; label: string }>; // To display selected data
}

const ConfirmationStep: React.FC<StepComponentProps<ConfirmationPayload>> = ({
  payload,
  coreContext,
  setStepValid,
}) => {
  useEffect(() => {
    if (setStepValid) setStepValid(true); // This step is immediately valid
  }, [setStepValid]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{payload.title}</CardTitle>
        {payload.message && (
          <CardDescription>{payload.message}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <p className="mb-4">Please review your information:</p>
        <ul className="space-y-2">
          {payload.dataKeysToShow.map(({ key, label }) => (
            <li key={key} className="flex justify-between">
              <span className="font-medium">{label}:</span>
              <span>{coreContext.flowData?.[key] || "Not provided"}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default ConfirmationStep;
