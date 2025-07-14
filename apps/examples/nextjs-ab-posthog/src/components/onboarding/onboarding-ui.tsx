"use client";

import { useOnboarding } from "@onboardjs/react";

export default function OnboardingUI() {
  const { renderStep } = useOnboarding();

  return <div>{renderStep()}</div>;
}
