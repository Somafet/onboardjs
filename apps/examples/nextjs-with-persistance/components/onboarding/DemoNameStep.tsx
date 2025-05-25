// components/onboarding-ui/steps/DemoNameStep.tsx
"use client";
import React, { useState, useEffect } from "react";
import { StepComponentProps } from "@onboardjs/react";
import { Label } from "@/components/ui/label"; // Assuming Shadcn
import { Input } from "@/components/ui/input"; // Assuming Shadcn

export interface DemoNamePayload {
  fieldLabel: string;
  fieldKey: string; // e.g., 'userName'
  placeholder?: string;
}

const DemoNameStep: React.FC<StepComponentProps<DemoNamePayload>> = ({
  payload,
  onDataChange,
  initialData, // Data from previous attempts or global flowData
  coreContext,
}) => {
  const [name, setName] = useState(
    initialData?.[payload.fieldKey] ||
      coreContext.flowData?.[payload.fieldKey] ||
      ""
  );
  const [error, setError] = useState("");

  useEffect(() => {
    let isValid = true;
    if (!name.trim()) {
      setError("Name cannot be empty.");
      isValid = false;
    } else if (name.trim().length < 2) {
      setError("Name must be at least 2 characters.");
      isValid = false;
    } else {
      setError("");
    }
    onDataChange({ [payload.fieldKey]: name }, isValid);
  }, [name, payload.fieldKey, onDataChange]);

  return (
    <div className="space-y-3 p-4">
      <Label htmlFor="nameInput" className="text-xl font-medium text-gray-700">
        {payload.fieldLabel}
      </Label>
      <Input
        id="nameInput"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={payload.placeholder || "Enter your name"}
        className={`w-full ${error ? "border-red-500" : "border-gray-300"}`}
      />
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      <p className="text-xs text-gray-500">
        Current name in flowData (from context):{" "}
        {coreContext.flowData?.[payload.fieldKey] || "N/A"}
      </p>
    </div>
  );
};

export default DemoNameStep;
