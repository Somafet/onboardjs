"use client";

import React from "react";
import {
  OnboardingProvider,
  CoreOnboardingContext,
  useOnboarding,
} from "@onboardjs/react";
import {
  demoOnboardingSteps,
  demoStepComponentRegistry,
} from "@/config/onboardingConfig";
import OnboardingUIManager from "@/components/onboarding/OnboardingUIManager";
import { toast } from "sonner";
import OnboardJsLogo from "@/components/logo";

export default function OnboardingDemoPage() {
  useOnboarding({
    onFlowComplete: (context: CoreOnboardingContext) => {
      console.log("DEMO PAGE: Flow completed! Final data:", context.flowData);
      toast("Onboarding Complete!", {
        description: `Welcome, ${context.flowData?.userName || "friend"}! You're all set.`,
        duration: 5000,
      });
      // Typically, you'd redirect the user or update global app state here
      // e.g., router.push('/dashboard');
    },
  });

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#">
            <div className="flex items-center justify-center rounded-md gap-x-4">
              <OnboardJsLogo className="size-16" />
              <span className="text-3xl font-semibold tracking-tight">
                OnboardJs Demo
              </span>
            </div>
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center py-4 sm:py-12">
          <OnboardingUIManager
            stepsConfig={demoOnboardingSteps} // Pass for progress bar, etc.
            stepComponentRegistry={demoStepComponentRegistry}
            // You can also provide custom LoadingScreen, ErrorScreen, CompletedScreen components as props here
          />
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        <div className="flex flex-col min-w-100 max-w-150 h-full p-5 font-bold text-4xl leading-10 tracking-normal z-10 relative mt-[30%] ml-[10%]">
          <div>
            <OnboardJsLogo className="size-32 mb-8" />
          </div>
          <div className="text-zinc-950">
            Set up your Onboarding Flow in minutes
          </div>
        </div>

        <div className="absolute left-0 top-0 z-0 h-full w-full overflow-hidden">
          <div className="mx-auto px-4 sm:px-8 max-w-8xl md:px-8 relative h-full">
            <div className="absolute left-[-160px] top-[-300px] z-[2] h-[500px] w-[500px] rounded-full bg-[radial-gradient(closest-side_at_50%_50%,_rgba(255,71,133,1),_rgba(255,71,133,0)),url('/home/texture.svg')] min-[600px]:h-[700px] min-[600px]:w-[700px] min-[960px]:left-[-100px] min-[960px]:top-[-500px] min-[960px]:h-[928px] min-[960px]:w-[928px] min-[1440px]:left-[-20%] min-[1440px]:top-[-720px] min-[1440px]:h-[1400px] min-[1440px]:w-[1400px]"></div>
            <div className="absolute left-[200px] top-[-220px] z-[1] h-[400px] w-[400px] rounded-full bg-[radial-gradient(closest-side_at_50%_50%,_rgba(252,81,31,1),_rgba(252,81,31,0)),url('/home/texture.svg')] opacity-80 min-[600px]:left-[360px] min-[600px]:top-[-260px] min-[600px]:h-[600px] min-[600px]:w-[600px] min-[960px]:left-[480px] min-[960px]:top-[-420px] min-[960px]:h-[900px] min-[960px]:w-[900px] min-[1440px]:left-[34%]"></div>
            <div className="absolute right-[200px] top-[160px] z-[1] h-[600px] w-[600px] rounded-full bg-[radial-gradient(closest-side_at_50%_50%,_rgba(71,145,255,1),_rgba(252,81,31,0)),url('/home/texture.svg')] opacity-90 min-[600px]:right-[400px] min-[600px]:top-[220px] min-[960px]:right-[0px] min-[960px]:top-[260px] min-[960px]:h-[1400px] min-[960px]:w-[1400px] min-[1440px]:right-[-16%]"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
