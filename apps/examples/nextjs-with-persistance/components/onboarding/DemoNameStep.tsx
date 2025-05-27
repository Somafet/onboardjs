// components/onboarding-ui/steps/DemoNameStep.tsx
"use client";
import { StepComponentProps } from "@onboardjs/react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export interface DemoNamePayload {
  fields: {
    label: string;
    key: string; // This will be used as the fieldKey in flowData
    placeholder?: string;
  }[];
}

const DemoNameStep: React.FC<StepComponentProps<DemoNamePayload>> = ({
  payload: { fields },
  onDataChange,
  initialData, // Data from previous attempts or global flowData
  coreContext,
}) => {
  const handleOnChange = (fieldKey: string, value: unknown) => {
    onDataChange({ [fieldKey]: value }, true);
  };

  return (
    <div className="space-y-8 p-4">
      <p className="leading-1.5">
        This is a simple example on how you can capture user input in your
        onboarding flow
      </p>
      {fields.map((field) => (
        <div key={field.key}>
          <Label htmlFor={field.key}>{field.label}</Label>
          <Input
            id={field.key}
            type="text"
            onChange={(e) => handleOnChange(field.key, e.target.value)}
            defaultValue={
              initialData?.[field.key] ??
              coreContext?.flowData?.[field.key] ??
              ""
            }
            placeholder={field.placeholder || "Enter your name"}
            className="w-full"
          />
        </div>
      ))}
    </div>
  );
};

export default DemoNameStep;
