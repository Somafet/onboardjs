"use client";
import { StepComponentProps } from "@onboardjs/react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ZodError, ZodType } from "zod";
import React from "react";

export interface DemoNamePayload {
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
  onDataChange,
  initialData,
  coreContext,
}) => {
  // Track field values and errors locally
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {}
  );
  const [fieldValues, setFieldValues] = React.useState<Record<string, string>>(
    () =>
      fields.reduce(
        (acc, field) => ({
          ...acc,
          [field.key]:
            initialData?.[field.key] ??
            coreContext?.flowData?.[field.key] ??
            "",
        }),
        {}
      )
  );

  const handleOnChange = (fieldKey: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldKey]: value }));

    let valid = true;
    let errorMsg = "";
    const validationSchema = fields.find((f) => f.key === fieldKey)?.validation;

    if (validationSchema) {
      try {
        validationSchema.parse(value);
      } catch (error) {
        valid = false;
        if (error instanceof ZodError) {
          errorMsg = error.errors[0]?.message || "Invalid value";
        } else {
          errorMsg = "Invalid value";
        }
      }
    }

    setFieldErrors((prev) => ({ ...prev, [fieldKey]: errorMsg }));

    // If any field has an error, the step is not valid
    const allValid = Object.values({
      ...fieldErrors,
      [fieldKey]: errorMsg,
    }).every((msg) => !msg);

    onDataChange({ ...fieldValues, [fieldKey]: value }, allValid && valid);
  };

  return (
    <div className="space-y-8 p-4 animate-fade-left">
      <p>
        This is a simple example on how you can capture user input in your
        onboarding flow
      </p>
      {fields.map((field) => (
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
