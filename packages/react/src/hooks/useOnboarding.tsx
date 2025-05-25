// @onboardjs/react/src/hooks/useOnboarding.ts
"use client";

import { useContext } from "react";
import { OnboardingContext } from "../context/OnboardingProvider";

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
};
