"use client";
import { StepComponentProps, useOnboarding } from "@onboardjs/react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ZodError, ZodType } from "zod";
import React from "react";

export interface DemoNamePayload {
  mainText?: string; // Optional main text for the step
  subText?: string; // Optional sub text for the step
  ctaLabel?: string; // Optional call-to-action label for the button
  fields: {
    label: string;
    key: string; // This will be used as the fieldKey in flowData
    placeholder?: string;
    // zod schema for validation
    validation: ZodType;
  }[];
}

const DemoNameStep: React.FC<StepComponentProps<DemoNamePayload>> = ({
  payload: { fields },
  initialData,
  coreContext,
}) => {
  const { updateContext } = useOnboarding();
  // Track field values and errors locally
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [fieldValues, setFieldValues] = React.useState<Record<string, string>>(
    () =>
      fields?.reduce(
        (acc, field) => ({
          ...acc,
          [field.key]:
            initialData?.[field.key] ??
            coreContext?.flowData?.[field.key] ??
            "",
        }),
        {},
      ),
  );

  const handleOnChange = (fieldKey: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldKey]: value }));

    let errorMsg = "";
    const validationSchema = fields?.find(
      (f) => f.key === fieldKey,
    )?.validation;

    if (validationSchema) {
      try {
        validationSchema.parse(value);
      } catch (error) {
        if (error instanceof ZodError) {
          errorMsg = error.errors[0]?.message || "Invalid value";
        } else {
          errorMsg = "Invalid value";
        }
      }
    }

    setFieldErrors((prev) => ({ ...prev, [fieldKey]: errorMsg }));
    updateContext({ flowData: { ...fieldValues, [fieldKey]: value } });
  };

  return (
    <div className="space-y-8 p-4 animate-fade-left">
      <p>
        This is a simple example on how you can capture user input in your
        onboarding flow
      </p>
      {fields?.map((field) => (
        <div key={field.key} className="space-y-1">
          <Label htmlFor={field.key}>{field.label}</Label>
          <Input
            id={field.key}
            type="text"
            value={fieldValues[field.key]}
            onChange={(e) => handleOnChange(field.key, e.target.value)}
            placeholder={field.placeholder || "Enter your name"}
            className={`w-full ${
              fieldErrors[field.key]
                ? "border-red-500 focus:border-red-500"
                : ""
            }`}
            aria-invalid={!!fieldErrors[field.key]}
            aria-describedby={
              fieldErrors[field.key] ? `${field.key}-error` : undefined
            }
          />
          {fieldErrors[field.key] && (
            <p
              id={`${field.key}-error`}
              className="text-sm text-red-600 mt-1"
              role="alert"
            >
              {fieldErrors[field.key]}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

export default DemoNameStep;
