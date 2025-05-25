// components/onboarding/steps/UserProfileStep.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { StepComponentProps } from "@onboardjs/react";

interface UserProfilePayload {
  componentKey: "userProfile";
  nameFieldKey: string; // e.g., 'userName'
  emailFieldKey: string; // e.g., 'userEmail'
}

const UserProfileStep: React.FC<StepComponentProps<UserProfilePayload>> = ({
  payload,
  onDataChange,
  initialData,
  coreContext,
}) => {
  const [name, setName] = useState(
    initialData?.[payload.nameFieldKey] ||
      coreContext.flowData?.[payload.nameFieldKey] ||
      ""
  );
  const [email, setEmail] = useState(
    initialData?.[payload.emailFieldKey] ||
      coreContext.flowData?.[payload.emailFieldKey] ||
      ""
  );
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");

  const validate = useCallback(() => {
    let isValid = true;
    if (!name.trim()) {
      setNameError("Name is required.");
      isValid = false;
    } else {
      setNameError("");
    }

    if (!email.trim()) {
      setEmailError("Email is required.");
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError("Invalid email format.");
      isValid = false;
    } else {
      setEmailError("");
    }
    return isValid;
  }, [name, email]);

  useEffect(() => {
    const isValid = validate();
    onDataChange(
      {
        [payload.nameFieldKey]: name,
        [payload.emailFieldKey]: email,
      },
      isValid
    );
  }, [
    name,
    email,
    payload.nameFieldKey,
    payload.emailFieldKey,
    onDataChange,
    validate,
  ]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Your Profile</CardTitle>
        <CardDescription>Please tell us a bit about yourself.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Lovelace"
          />
          {nameError && <p className="text-sm text-red-500">{nameError}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ada@example.com"
          />
          {emailError && <p className="text-sm text-red-500">{emailError}</p>}
        </div>
      </CardContent>
    </Card>
  );
};

export default UserProfileStep;
