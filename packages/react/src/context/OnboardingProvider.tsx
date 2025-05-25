// @onboardjs/react/src/context/OnboardingProvider.tsx
"use client";

import React, {
  createContext,
  useState,
  useEffect,
  useMemo,
  // useCallback, // useCallback was not used in the provided snippet, removed for cleanliness
  ReactNode,
} from "react";
import {
  OnboardingEngine,
  EngineState,
  // OnboardingStep, // Not directly used in this file's top-level logic
  // OnboardingContext as CoreOnboardingContext, // Not directly used
  OnboardingEngineConfig,
} from "@onboardjs/core";

export interface OnboardingContextValue {
  engine: OnboardingEngine | null;
  state: EngineState | null;
  isLoading: boolean; // Combined loading state (engine + component interactions)
  setComponentLoading: (loading: boolean) => void;
}
// -------------------------

export const OnboardingContext = createContext<
  OnboardingContextValue | undefined
>(undefined);

interface OnboardingProviderProps extends OnboardingEngineConfig {
  children: ReactNode;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({
  children,
  steps,
  initialStepId,
  initialContext,
  onFlowComplete,
  onStepChange,
}) => {
  const [engine, setEngine] = useState<OnboardingEngine | null>(null);
  const [engineState, setEngineState] = useState<EngineState | null>(null);
  const [componentLoading, setComponentLoading] = useState(false);

  useEffect(() => {
    const newEngine = new OnboardingEngine({
      steps,
      initialStepId,
      initialContext,
      onFlowComplete,
      onStepChange,
    });
    setEngine(newEngine);
    setEngineState(newEngine.getState()); // Set initial state

    const unsubscribe = newEngine.subscribe((newState) => {
      setEngineState(newState);
    });

    return () => {
      unsubscribe();
    };
  }, [steps, initialStepId, initialContext, onFlowComplete, onStepChange]);

  const isLoading = useMemo(
    () => componentLoading || (engineState?.isLoading ?? false),
    [componentLoading, engineState?.isLoading]
  );

  const value = useMemo(
    () => ({
      engine,
      state: engineState,
      isLoading,
      setComponentLoading,
    }),
    [engine, engineState, isLoading] // Added setComponentLoading to dependencies if it were to change, though it's stable here
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};
