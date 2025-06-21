"use client";
import { StepComponentProps, useOnboarding } from "@onboardjs/react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import React from "react";
import { AppOnboardingContext } from "../common-flow-config";
import { MailIcon, Building2Icon } from "lucide-react";
import { twMerge } from "tailwind-merge";

const SUPPORT_EMAIL = "soma@onboardjs.com";

const OrganisationStep: React.FC<
  StepComponentProps<unknown, AppOnboardingContext>
> = () => {
  const { updateContext, state } = useOnboarding();

  const handleOrgNameChange = (value: string) => {
    updateContext({
      flowData: {
        orgName: value,
      },
    });
  };

  return (
    <div className="space-y-8 animate-fade-left">
      <div className="flex items-center gap-3">
        <Building2Icon className="size-7 text-primary" />
        <h2 className="text-xl font-semibold">Your Organisation</h2>
      </div>

      <div className="space-y-1">
        <Label htmlFor="org-name-input">
          What’s your organisation called? 🏢
        </Label>
        <Input
          id="org-name-input"
          type="text"
          value={state?.context.flowData.orgName || ""}
          onChange={(e) => handleOrgNameChange(e.target.value)}
          placeholder="Enter your organisation name"
        />
      </div>

      <div
        className={twMerge(
          "flex items-start gap-3 p-4 rounded-lg border border-muted bg-muted/50",
        )}
      >
        <MailIcon className="size-8 mt-1 text-primary" />
        <div>
          <p className="font-medium">
            Whether you’re looking to use{" "}
            <span className="font-bold">OnboardJS</span> in your app, or want to
            work with us, we’d love to hear from you!
          </p>
          <p>
            Just shoot us an email at{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="underline font-semibold"
              target="_blank"
              rel="noopener noreferrer"
            >
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrganisationStep;
