"use client";
import { StepComponentProps, useOnboarding } from "@onboardjs/react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import React, { useState } from "react";
import { Radio, RadioGroup } from "@/components/ui/radio";
import { Field } from "@headlessui/react";
import { AppOnboardingContext } from "../common-flow-config";
import { PersonStandingIcon } from "lucide-react";
import { twMerge } from "tailwind-merge";

type ConditionalNamePayload = {
  options?: {
    label: string;
    value: string;
    description: string;
  }[];
};

const choiceIconMap: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  individual: () => <span className="text-lg">👤</span>,
  org: () => <span className="text-lg">🏢</span>,
};

const ConditionalNameStep: React.FC<
  StepComponentProps<ConditionalNamePayload, AppOnboardingContext>
> = ({ payload }) => {
  const { updateContext, state } = useOnboarding();
  const [name, setName] = useState(state?.context.flowData.userName ?? "");

  const handleOnChange = (value: string) => {
    updateContext({
      flowData: {
        userName: value,
      },
    });
  };

  const handleTypeChange = (value: string) => {
    setName(value);
    updateContext({
      flowData: {
        userType: value,
      },
    });
  };

  return (
    <div className="space-y-8 animate-fade-left">
      <p>
        This step captures the user&apos;s name and type (individual or
        organization). The name will be used to personalize the onboarding
        experience and the type will conditionally determine the next steps in
        the flow.
      </p>

      <div className="space-y-1">
        <Label htmlFor="name-input">What is your name? 👋</Label>
        <Input
          id="name-input"
          type="text"
          defaultValue={name}
          onChange={(e) => handleOnChange(e.target.value)}
          placeholder={"Enter your name"}
        />
      </div>

      <RadioGroup<string>
        className="flex flex-col gap-y-4"
        value={state?.context.flowData.userType ?? "individual"}
      >
        {(args) => (
          <>
            {payload.options?.map((option, index) => {
              const Icon = choiceIconMap[option.value] || PersonStandingIcon;
              return (
                <Field
                  as="button"
                  value={option.value}
                  onClick={() => {
                    handleTypeChange(option.value);
                  }}
                  data-slot="field"
                  key={option.value}
                  className={`
                    animate-fade-up
                  `}
                  style={{
                    animationDelay: `${index * 150}ms`, // 150ms stagger
                  }}
                >
                  <div
                    className={twMerge(
                      "relative transition-all mode-200",
                      "rounded-xl overflow-hidden border border-gray-600",
                      "transition-transform hover:scale-105 duration-300",
                      args.value === option.value
                        ? "ring-2 ring-primary border-primary"
                        : "",
                    )}
                  >
                    <div className="p-4">
                      <div className="flex max-sm:flex-col items-center">
                        <div className="mr-6 max-sm:mb-4">
                          <Icon className={twMerge("size-8")} />
                        </div>

                        <div className="w-full">
                          <div className="flex items-center justify-between sm:mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-lg font-semibold">
                                {option.label}
                              </span>
                            </div>
                            <Radio
                              value={String(option.value)}
                              id={`mode-${option.value}`}
                              color="primary"
                              className="max-sm:absolute max-sm:top-4 max-sm:right-4"
                            />
                          </div>

                          <div className="flex items-center gap-2 sm:mt-3">
                            <Label
                              htmlFor={`mode-${option.value}`}
                              className={twMerge("text-base font-semibold")}
                            >
                              {option.description}
                            </Label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Field>
              );
            })}
          </>
        )}
      </RadioGroup>
    </div>
  );
};

export default ConditionalNameStep;
