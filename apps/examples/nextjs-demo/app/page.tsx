"use client";

import React from "react";
import { useOnboarding } from "@onboardjs/react";
import OnboardingUIManager from "@/components/onboarding/OnboardingUIManager";
import { toast } from "sonner";
import OnboardJsLogo from "@/components/logo";
import confetti from "canvas-confetti";
import Link from "next/link";
import { OnboardingContext } from "@onboardjs/core";
import { commonFlowSteps } from "@/components/onboarding/common-flow-config";

export default function OnboardingDemoPage() {
  useOnboarding({
    onFlowComplete: (context: OnboardingContext) => {
      console.log("DEMO PAGE: Flow completed! Final data:", context.flowData);
      toast("Onboarding Complete!", {
        description: `Welcome, ${context.flowData?.userName || "friend"}! You're all set.`,
        duration: 3000,
      });

      confetti({
        particleCount: 200,
        angle: 60,
        spread: 55,
        startVelocity: 80,
        origin: { x: 0, y: 0.6 },
      });
      // Fire confetti from the right side
      confetti({
        particleCount: 200,
        angle: 120,
        spread: 55,
        startVelocity: 80,
        origin: { x: 1, y: 0.6 },
      });
    },
  });

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="https://onboardjs.com" target="_blank">
            <div className="flex items-center justify-center rounded-md gap-x-4">
              <OnboardJsLogo className="size-16" />
              <span className="text-3xl font-semibold tracking-tight">
                OnboardJs
              </span>
            </div>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center py-4 sm:py-12">
          <OnboardingUIManager
            stepsConfig={commonFlowSteps} // Pass for progress bar, etc.
            // You can also provide custom LoadingScreen, ErrorScreen, CompletedScreen components as props here
          />
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block onboarding-bg">
        <div className="flex flex-col min-w-100 max-w-150 p-5 font-bold text-4xl leading-10 tracking-normal z-10 absolute top-1/2 -translate-y-1/2 h-fit ml-[10%]">
          <div className="mb-10 flex items-center gap-8">
            <OnboardJsLogo className="size-32" />
            <span className="text-5xl">OnboardJs</span>
          </div>
          <div className="text-zinc-950">
            Set up your onboarding flow with ease using OnboardJs.
          </div>
        </div>
      </div>
    </div>
  );
}
