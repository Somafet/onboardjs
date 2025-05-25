// app/onboarding-demo/page.tsx
"use client"; // OnboardingProvider and UIManager are client components

import React from "react";
import { OnboardingProvider, CoreOnboardingContext } from "@onboardjs/react";
import {
  demoOnboardingSteps,
  demoStepComponentRegistry,
} from "@/config/onboardingConfig";
import OnboardingUIManager from "@/components/onboarding/OnboardingUIManager";
import { toast } from "sonner";

export default function OnboardingDemoPage() {
  const handleFlowComplete = (context: CoreOnboardingContext) => {
    console.log("DEMO PAGE: Flow completed! Final data:", context.flowData);
    toast("Onboarding Complete!", {
      description: `Welcome, ${context.flowData?.userName || "friend"}! You're all set.`,
      duration: 5000,
    });
    // Typically, you'd redirect the user or update global app state here
    // e.g., router.push('/dashboard');
  };

  const handleStepChange = (
    newStep: any,
    oldStep: any,
    context: CoreOnboardingContext
  ) => {
    console.log(
      `DEMO PAGE: Step changed from ${oldStep?.id || "start"} to ${newStep?.id || "end"}`
    );
    // You could show a toast on step change too
    // if (newStep) {
    //   toast({ title: `Moved to: ${newStep.title}` });
    // }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-sky-100 py-8 sm:py-12 flex flex-col items-center justify-center px-4">
      <header className="mb-10 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">
          @onboardjs/react Demo
        </h1>
        <p className="mt-3 text-lg text-gray-600">
          Showcasing a fully custom UI with headless capabilities.
        </p>
      </header>
      <OnboardingProvider
        steps={demoOnboardingSteps}
        initialStepId="welcome" // Or let persistence handle it
        // Enable localStorage persistence for this demo
        localStoragePersistence={{
          key: "onboardjsDemo_v1_progress",
          ttl: 1000 * 60 * 60 * 24,
        }} // 1 day TTL
        onFlowComplete={handleFlowComplete}
        onStepChange={handleStepChange}
        initialContext={
          {
            // You can provide some global initial data if needed
            // flowData: { prefilledEmail: 'test@example.com' }
          }
        }
      >
        <OnboardingUIManager
          stepsConfig={demoOnboardingSteps} // Pass for progress bar, etc.
          stepComponentRegistry={demoStepComponentRegistry}
          // You can also provide custom LoadingScreen, ErrorScreen, CompletedScreen components as props here
        />
      </OnboardingProvider>
    </div>
  );
}
