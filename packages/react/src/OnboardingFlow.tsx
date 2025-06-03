// @onboardjs/react/src/OnboardingFlow.tsx
"use client";

import React, { ReactNode } from "react";
import {
  DataLoadFn,
  DataPersistFn,
  OnboardingEngineConfig,
} from "@onboardjs/core";
import {
  LocalStoragePersistenceOptions,
  OnboardingProvider,
} from "./context/OnboardingProvider";
import StepRenderer from "./components/StepRenderer";
import { StepComponentRegistry } from "./types";

interface OnboardingFlowProps extends OnboardingEngineConfig {
  /**
   * A registry mapping step types to their React components.
   */
  stepComponentRegistry: StepComponentRegistry;
  /** Optional: Custom component to render when the flow is loading. */
  LoadingComponent?: React.ReactNode;
  /** Optional: Custom component to render when no step is active (e.g., flow ended or error). */
  EmptyStateComponent?: React.ReactNode;
  /** Optional: Custom component to render when an error occurs. */
  ErrorComponent?: React.ComponentType<{ error: Error }>;
  /** Optional: A wrapper component for the entire flow UI. */
  WrapperComponent?: React.ComponentType<{ children: ReactNode }>;

  /**
   * Configuration for enabling localStorage persistence.
   * If provided, the flow's progress will be saved to and loaded from localStorage.
   */
  localStoragePersistence?: LocalStoragePersistenceOptions;

  /**
   * For advanced scenarios: Directly provide your own onDataLoad function.
   * If provided, this will be used INSTEAD of localStoragePersistence.
   */
  customOnDataLoad?: DataLoadFn;
  /**
   * For advanced scenarios: Directly provide your own onDataPersist function.
   * If provided, this will be used INSTEAD of localStoragePersistence.
   */
  customOnDataPersist?: DataPersistFn;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  steps,
  initialStepId,
  initialContext,
  onFlowComplete,
  onStepChange,
  stepComponentRegistry,
  LoadingComponent,
  EmptyStateComponent,
  ErrorComponent,
  WrapperComponent,
  localStoragePersistence,
  customOnDataLoad,
  customOnDataPersist,
}) => {
  const content = (
    <StepRenderer
      stepComponentRegistry={stepComponentRegistry}
      LoadingComponent={LoadingComponent}
      EmptyStateComponent={EmptyStateComponent}
      ErrorComponent={ErrorComponent}
    />
  );

  return (
    <OnboardingProvider
      steps={steps}
      initialStepId={initialStepId}
      initialContext={initialContext}
      onFlowComplete={onFlowComplete}
      onStepChange={onStepChange}
      localStoragePersistence={localStoragePersistence}
      customOnDataLoad={customOnDataLoad}
      customOnDataPersist={customOnDataPersist}
    >
      {WrapperComponent ? (
        <WrapperComponent>{content}</WrapperComponent>
      ) : (
        content
      )}
    </OnboardingProvider>
  );
};
