// components/onboarding/OnboardingClient.tsx
"use client";

import React from "react";
import {
  appOnboardingSteps,
  appStepComponentRegistry,
} from "@/config/onboardingConfig";
import { Button } from "@/components/ui/button"; // For custom loading/empty states
import { toast } from "sonner"; // For notifications
import { OnboardingStep } from "@onboardjs/core";
import { CoreOnboardingContext, OnboardingFlow } from "@onboardjs/react";

export const OnboardingClientWrapper = () => {
  const handleFlowComplete = (context: CoreOnboardingContext) => {
    console.log("Onboarding Completed! Final data:", context.flowData);
    toast("Onboarding Complete!", {
      description: `Welcome, ${context.flowData.userName}! Your workspace "${context.flowData.workspaceName}" is ready.`,
      duration: 5000,
    });
    // Here you would typically redirect the user or update application state
    // For example: router.push('/dashboard');
  };

  const handleStepChange = (
    newStep: OnboardingStep | null,
    oldStep: OnboardingStep | null
    // context: CoreOnboardingContext,
  ) => {
    if (newStep) {
      console.log(`Moved to step: ${newStep.title} (ID: ${newStep.id})`);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 md:p-0">
      <OnboardingFlow
        steps={appOnboardingSteps}
        stepComponentRegistry={appStepComponentRegistry}
        onFlowComplete={handleFlowComplete}
        onStepChange={handleStepChange}
        localStoragePersistence={{
          key: "appOnboardingFlow",
          ttl: 1000 * 60 * 60 * 24 * 7, // 7 days
        }}
        
        initialContext={
          {
            // You can pre-fill flowData or add other context here
            // flowData: { userEmail: 'prefill@example.com' },
            // currentUser: { id: 'user123', role: 'admin' }
          }
        }
        LoadingComponent={
          <div className="flex justify-center items-center h-64">
            <p className="text-lg">Loading Onboarding...</p>
          </div>
        }
        EmptyStateComponent={
          <div className="text-center p-10">
            <h3 className="text-xl font-semibold mb-4">
              Onboarding Finished or Not Available
            </h3>
            <p>You've completed the onboarding process!</p>
          </div>
        }
        ErrorComponent={({ error }) => (
          <div className="text-center p-10 bg-red-100 border border-red-400 text-red-700 rounded">
            <h3 className="text-xl font-semibold mb-2">An Error Occurred</h3>
            <p>{error.message}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Try Again
            </Button>
          </div>
        )}
        // Example of using a WrapperComponent for overall styling if needed
        // WrapperComponent={({ children }) => (
        //   <Card className="shadow-xl">
        //     <CardContent className="p-6">{children}</CardContent>
        //   </Card>
        // )}
      />
    </div>
  );
};
