import { OnboardingStep } from "@onboardjs/core";

export const steps: OnboardingStep[] = [
  {
    id: "welcome",
    type: "INFORMATION",
    payload: {
      name: "Add projects",
    },
  },
  {
    id: "budget",
    type: "INFORMATION",
    payload: {
      name: "Define work budget",
    },
  },
  {
    id: "goals",
    type: "INFORMATION",
    payload: {
      name: "Define weekly goals",
    },
  },
  {
    id: "schedule",
    type: "INFORMATION",
    payload: {
      name: "Arrange schedule",
    },
  },
  {
    id: "habits",
    type: "INFORMATION",
    payload: {
      name: "Establish daily habits",
    },
  },
  {
    id: "tasks",
    type: "INFORMATION",
    payload: {
      name: "List tasks",
    },
  },
  {
    id: "focus",
    type: "INFORMATION",
    payload: {
      name: "Start focus session",
    },
    nextStep: null,
  },
];
