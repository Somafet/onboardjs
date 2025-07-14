"use client";

import { useOnboarding } from "@onboardjs/react";
import { useEffect, useState } from "react";
import { Progress } from "../ui/progress";

const motivationalCopy = [
  "Let’s get started! 🚀",
  "You’re making great progress! 💪",
  "Almost there! 🎯",
  "All set! 🎉",
];

export default function OnboardingProgress() {
  const { state, currentStep } = useOnboarding();

  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const totalSteps = state?.totalSteps || 1; // Avoid division by zero
    const currentStep = state?.currentStepNumber || 0;
    const newProgress = (currentStep / totalSteps) * 100;

    const timer = setTimeout(() => setProgress(newProgress), 300);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <>
      {state && (
        <div className="mb-6 w-full">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium">
              Step{" "}
              {currentStep ? state.currentStepNumber : state.totalSteps + 1} of{" "}
              {state.totalSteps + 1}
            </span>
            <span className="text-sm text-gray-500">
              {
                motivationalCopy[
                  currentStep
                    ? state.currentStepNumber - 1
                    : state.totalSteps
                ]
              }
            </span>
          </div>
          <Progress value={currentStep ? progress : 100} />
        </div>
      )}
    </>
  );
}
