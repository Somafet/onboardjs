// components/onboarding/steps/WorkspaceDetailsStep.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { StepComponentProps } from "@onboardjs/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface WorkspaceDetailsPayload {
  componentKey: "workspaceDetails";
  workspaceNameKey: string; // e.g., 'workspaceName'
}

const WorkspaceDetailsStep: React.FC<
  StepComponentProps<WorkspaceDetailsPayload>
> = ({ payload, onDataChange, initialData, coreContext }) => {
  const [workspaceName, setWorkspaceName] = useState(
    initialData?.[payload.workspaceNameKey] ||
      coreContext.flowData?.[payload.workspaceNameKey] ||
      ""
  );
  const [error, setError] = useState("");

  const validate = useCallback(() => {
    if (!workspaceName.trim()) {
      setError("Workspace name is required.");
      return false;
    }
    if (workspaceName.trim().length < 3) {
      setError("Workspace name must be at least 3 characters.");
      return false;
    }
    setError("");
    return true;
  }, [workspaceName]);

  useEffect(() => {
    const isValid = validate();
    onDataChange({ [payload.workspaceNameKey]: workspaceName }, isValid);
  }, [workspaceName, payload.workspaceNameKey, onDataChange, validate]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Workspace Details</CardTitle>
        <CardDescription>Set up your new workspace.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="workspaceName">Workspace Name</Label>
          <Input
            id="workspaceName"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="My Awesome Project"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkspaceDetailsStep;
