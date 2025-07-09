import { type OnboardingStep } from "@onboardjs/core";

const initialStep: OnboardingStep = {
  id: "initial",
  meta: {
    title: "Unlock your tailored OnboardJS experience!",
    subtitle: "Which best describes your goal?",
  },
};

const devFlow: OnboardingStep[] = [
  {
    id: "dev-showcase",
    condition: (context) => context.flowData.onboardingType === "developer",
  },
  {
    id: "dev-impl",
    condition: (context) => context.flowData.onboardingType === "developer",
    meta: {
      title: "Logic & Layout: Seamlessly Connected.",
      subtitle:
        "OnboardJS handles your flow’s logic, state, and steps. You build your unique UI, powered by our intuitive React hooks.",
    },
  },
  {
    id: "dev-type",
    type: "SINGLE_CHOICE",
    condition: (context) => context.flowData.onboardingType === "developer",
    meta: {
      title: "Guide Users Intelligently.",
      subtitle:
        "Create dynamic paths that adapt to user choices or collected data, making every onboarding unique.",
    },
    payload: {
      options: [
        {
          id: "frontend",
          label: "Frontend Developer",
          value: "frontend",
        },
        {
          id: "backend",
          label: "Backend Developer",
          value: "backend",
        },
        {
          id: "fullstack",
          label: "Fullstack Developer",
          value: "fullstack",
        },
      ],
    },
  },
  {
    id: "dev-end",
    condition: (context) => context.flowData.onboardingType === "developer",
    meta: {
      title: "Your Onboarding Journey Starts Here.",
      subtitle:
        "Ready to build your custom onboarding experience? Let’s get started with a free, no-obligation onboarding React example.",
      cta: "Submit",
    },
    nextStep: null,
  },
];

const businessFlow: OnboardingStep[] = [
  {
    id: "business-welcome",
    condition: (context) => context.flowData.onboardingType === "business-rep",
    meta: {
      title: "Stop Losing Users. Start Growing.",
      subtitle:
        "Every day without an optimized onboarding flow means missed opportunities and user churn. OnboardJS helps you turn those losses into rapid activation and sustained engagement. Let’s see how.",
    },
  },
  {
    id: "business-onboardjs",
    condition: (context) => context.flowData.onboardingType === "business-rep",
    meta: {
      title: "Real Impact: Boost Your Onboarding Metrics.",
      subtitle:
        "Here’s a typical example of how OnboardJS can dramatically improve your user activation and retention over time.",
    },
  },
  {
    id: "business-step-3",
    type: "SINGLE_CHOICE",
    condition: (context) => context.flowData.onboardingType === "business-rep",
    meta: {
      title: "Real Impact: Boost Your Onboarding Metrics.",
      subtitle:
        "Create adaptive, user-friendly journeys that guide users perfectly, all managed intuitively. Quickly test new flows and adapt to user behavior without relying on constant developer cycles.",
    },
    payload: {
      options: [
        {
          id: "completion",
          label: "Improving Completion Rates",
          value: "completion",
        },
        {
          id: "personalization",
          label: "Personalizing User Journeys",
          value: "personalization",
        },
        {
          id: "data",
          label: "Getting Actionable Data",
          value: "data",
        },
      ],
    },
  },
  {
    id: "business-end",
    condition: (context) => context.flowData.onboardingType === "business-rep",
    meta: {
      title: "Ready to See Your Metrics Soar?",
      subtitle: "Start with a free, no-obligation onboarding React example.",
      cta: "Submit",
    },
    nextStep: null,
  },
];

export const steps = [initialStep, ...devFlow, ...businessFlow];
