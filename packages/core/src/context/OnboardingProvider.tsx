"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export interface OnboardingContextValue {
  currentStep: number;
  steps: number;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(
  undefined
);

export function OnboardingProvider({
  children,
  steps,
  initialStep = 0,
}: {
  children: ReactNode;
  steps: number;
  initialStep?: number;
}) {
  const [currentStep, setCurrentStep] = useState(initialStep);

  return (
    <OnboardingContext.Provider value={{ currentStep, steps, setCurrentStep }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboardingContext() {
  const ctx = useContext(OnboardingContext);
  if (!ctx)
    throw new Error(
      "useOnboardingContext must be used within OnboardingProvider"
    );
  return ctx;
}
