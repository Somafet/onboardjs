// @onboardjs/react/src/hooks/useOnboarding.ts
"use client";

import { useContext, useEffect, useRef } from "react";
import { OnboardingContext } from "../context/OnboardingProvider";
import { UseOnboardingOptions } from "./useOnboarding.types";
import { OnboardingContext as CoreOnboardingContext } from "@onboardjs/core";

export const useOnboarding = (options?: UseOnboardingOptions) => {
  const contextValue = useContext(OnboardingContext);
  if (contextValue === undefined) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }

  const {
    engine,
    state,
    isLoading,
    skip,
    next,
    previous,
    goToStep,
    reset,
    setComponentLoading,
    updateContext,
  } = contextValue;

  // Use refs to store the latest callbacks to avoid re-subscribing unnecessarily
  const onFlowCompleteRef = useRef(options?.onFlowComplete);
  const onStepChangeRef = useRef(options?.onStepChange);

  // Update refs when callback props change
  useEffect(() => {
    onFlowCompleteRef.current = options?.onFlowComplete;
  }, [options?.onFlowComplete]);

  useEffect(() => {
    onStepChangeRef.current = options?.onStepChange;
  }, [options?.onStepChange]);

  // Effect for onFlowComplete
  useEffect(() => {
    if (!engine || !onFlowCompleteRef.current) {
      return;
    }

    const listener = (context: CoreOnboardingContext) => {
      if (onFlowCompleteRef.current) {
        onFlowCompleteRef.current(context);
      }
    };

    const unsubscribe = engine.addFlowCompleteListener(listener);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [engine]);

  // Effect for onStepChange
  useEffect(() => {
    if (!engine || !onStepChangeRef.current) {
      return;
    }
    const unsubscribe = engine.addAfterStepChangeListener(
      (oldStep, newStep, context) => {
        if (onStepChangeRef.current) {
          onStepChangeRef.current(newStep, oldStep, context);
        }
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [engine]);

  // Derive shorthand status values for convenience
  const isCompleted = state?.isCompleted ?? false;
  const currentStep = state?.currentStep ?? null;

  return {
    engine,
    state,
    isLoading,
    skip,
    next,
    previous,
    goToStep,
    reset,
    setComponentLoading,
    updateContext,
    isCompleted,
    currentStep,
  };
};
