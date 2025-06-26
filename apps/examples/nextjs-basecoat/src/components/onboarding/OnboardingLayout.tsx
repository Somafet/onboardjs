"use client";

import { useOnboarding } from "@onboardjs/react";
import OnboardJSLogo from "../icons/OnboardJSLogo";
import { steps } from "../../lib/onboarding/onboarding-steps";
import { CheckIcon } from "lucide-react";
import CompleteStep from "./steps/complete-step";
import Link from "next/link";

export default function OnboardingLayout() {
  const { state, renderStep, currentStep } = useOnboarding();

  return (
    <>
      <div className="min-h-screen flex">
        {/* Static sidebar for desktop */}
        <div className="hidden md:fixed md:inset-y-0 md:z-50 md:flex md:w-72 md:flex-col bg-[#1c1c1c]">
          {/* Sidebar component, swap this element with another sidebar if you like */}
          <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r px-6 py-8">
            <Link
              href="https://onboardjs.com"
              target="_blank"
              className="flex items-center shrink-0 rounded-md gap-x-4"
            >
              <OnboardJSLogo className="size-8" />
              <span className="text-lg font-semibold tracking-tight">
                OnboardJS
              </span>
            </Link>

            <Link href="https://www.youtube.com/watch?v=G8U0qAc2MZE">
              <p className="text-sm text-gray-400">
                Credits to @radzion for the layout!
              </p>
            </Link>
            <nav className="flex flex-1 flex-col mt-4">
              <span className="text-2xl font-semibold mb-2">
                Quick Setup{" "}
                <span className="text-green-500 text-xl">
                  {state?.completedSteps} / {state?.totalSteps}{" "}
                </span>
              </span>
              <ul role="list" className="flex flex-1 flex-col gap-y-4 mt-6">
                {steps.map((step, index) => (
                  <li key={step.id} className="flex items-center gap-x-3">
                    <div className="rounded-full p-2 bg-slate-100 dark:bg-[#343434]">
                      {index < (state?.completedSteps ?? -1) ? (
                        <CheckIcon className="size-4 text-green-500" />
                      ) : (
                        <div className="size-4" />
                      )}
                    </div>
                    <span className="tracking-wide font-medium">
                      {step.payload?.name}
                    </span>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
        {currentStep !== null ? renderStep() : <CompleteStep />}
      </div>
    </>
  );
}
