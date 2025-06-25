"use client";

import AddProjectsStep from "@/components/onboarding/steps/add-projects-step";
import { StepComponentRegistry } from "@onboardjs/react";

export const componentRegistry: StepComponentRegistry = {
  welcome: AddProjectsStep,
};
