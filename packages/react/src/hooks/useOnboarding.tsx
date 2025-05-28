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
  // if only the callback function instance changes but not the hook's dependencies for subscription.
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

    // If the flow is already completed when this hook instance mounts/callback is provided,
    // and we want to fire it for past completion, we could do it here.
    // However, typically, event listeners are for future events.
    // Let's assume it only fires when the completion event happens *while subscribed*.
    // The engine's onFlowHasCompleted should handle this.

    const listener = (context: CoreOnboardingContext) => {
      if (onFlowCompleteRef.current) {
        onFlowCompleteRef.current(context);
      }
    };

    // Assuming engine has `onFlowHasCompleted` method that returns an unsubscribe function
    const unsubscribe = engine.addFlowCompletedListener(listener);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [engine]); // Re-subscribe if the engine instance changes

  // Effect for onStepChange
  useEffect(() => {
    if (!engine || !onStepChangeRef.current) {
      return;
    }

    const unsubscribe = engine.addStepChangeListener(
      (newStep, oldStep, context) => {
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
  // Add more derived states if needed, similar to getActionShorthandStatusObject

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
