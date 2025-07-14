"use client";

import { useOnboarding } from "@onboardjs/react";
import { Card, CardContent } from "../ui/card";
import { OnboardingCompleteStep } from "./onboarding-complete-step";

export default function OnboardingUI() {
  const { renderStep, isCompleted } = useOnboarding();

  return (
    <Card className="w-full mx-auto border-0 shadow-2xl bg-card/50 backdrop-blur-sm max-w-lg">
      <CardContent className="p-8 text-center space-y-6">
        {isCompleted ? <OnboardingCompleteStep /> : renderStep()}
      </CardContent>
    </Card>
  );
}
