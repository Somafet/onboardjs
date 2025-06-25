"use client";

import { useOnboarding } from "@onboardjs/react";
import OnobardJSLogo from "../icons/OnboardJSLogo";
import { steps } from "../../../lib/onboarding/onboarding-steps";
import { CheckIcon } from "lucide-react";

export default function OnboardingLayout() {
  const { state, renderStep } = useOnboarding();

  return (
    <>
      <div className="min-h-screen flex">
        {/* Static sidebar for desktop */}
        <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
          {/* Sidebar component, swap this element with another sidebar if you like */}
          <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r px-6 py-8">
            <div className="flex items-center shrink-0 rounded-md gap-x-4">
              <OnobardJSLogo className="size-16" />
              <span className="text-2xl font-semibold tracking-tight">
                OnboardJS
              </span>
            </div>
            <nav className="flex flex-1 flex-col">
              <span className="text-2xl font-semibold mb-2">
                Quick Setup{" "}
                <span className="text-green-500 text-xl">
                  {state?.currentStepNumber} / {state?.totalSteps}{" "}
                </span>
              </span>
              <ul role="list" className="flex flex-1 flex-col gap-y-4 mt-8">
                {steps.map((step, index) => (
                  <li key={step.id} className="flex items-center gap-x-3">
                    <div className="rounded-full p-2 bg-slate-100 dark:bg-[#343434]">
                      {index < (state?.currentStepNumber ?? -1) ? (
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
        {renderStep()}
      </div>
    </>
  );
}
