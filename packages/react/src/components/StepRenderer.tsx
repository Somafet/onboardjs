"use client";

// @onboardjs/react/src/components/StepRenderer.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  OnboardingStep as CoreOnboardingStep,
  CustomComponentStepPayload,
} from "@onboardjs/core";
import { useOnboarding } from "../hooks/useOnboarding";
import { StepComponentRegistry } from "../types";

interface StepRendererProps {
  /**
   * A registry mapping step types to their React components.
   * This allows users to provide their own custom step components.
   */
  stepComponentRegistry: StepComponentRegistry;
  /** Optional: Custom component to render when the flow is loading. */
  LoadingComponent?: React.ReactNode;
  /** Optional: Custom component to render when no step is active (e.g., flow ended or error). */
  EmptyStateComponent?: React.ReactNode;
  /** Optional: Custom component to render when an error occurs. */
  ErrorComponent?: React.ComponentType<{ error: Error }>;
}

const StepRenderer: React.FC<StepRendererProps> = ({
  stepComponentRegistry,
  LoadingComponent = <div>Loading step...</div>,
  EmptyStateComponent = <div>No active step.</div>,
  ErrorComponent,
}) => {
  const { engine, state, isLoading, next, skip, previous } = useOnboarding();
  const [currentActiveStepData, setCurrentActiveStepData] = useState<any>({});
  const [isCurrentActiveStepValid, setIsCurrentActiveStepValid] =
    useState<boolean>(true);

  const currentStep = state?.currentStep;
  const coreContext = state?.context;

  useEffect(() => {
    setCurrentActiveStepData({});
    setIsCurrentActiveStepValid(true); // New step must prove its validity
  }, [state?.currentStep?.id]);

  const handleStepDataChange = useCallback(
    (data: unknown, isValid: boolean) => {
      const prevData =
        typeof currentActiveStepData === "object" &&
        currentActiveStepData !== null
          ? currentActiveStepData
          : {};
      const newData = typeof data === "object" && data !== null ? data : {};
      const mergedData = { ...prevData, ...newData };

      setCurrentActiveStepData(mergedData);
      setIsCurrentActiveStepValid(isValid);
    },
    [],
  );

  if ((isLoading && !currentStep) || !state) {
    // Initial loading of the engine or flow
    return <>{LoadingComponent}</>;
  }

  if (state?.error && ErrorComponent) {
    return <ErrorComponent error={state.error} />;
  }
  if (state?.error) {
    return <div style={{ color: "red" }}>Error: {state.error.message}</div>;
  }

  if (!currentStep) {
    if (state?.isCompleted) {
      // Flow is completed, EmptyStateComponent might show a "Completed!" message
      // Or the parent component handles this based on onFlowComplete callback
      return <>{EmptyStateComponent}</>;
    }
    return <>{EmptyStateComponent}</>;
  }

  let SpecificStepComponent;
  let componentLookupKey: string = currentStep.type ?? "INFORMATION"; // Default to step.type

  if (currentStep.type === "CUSTOM_COMPONENT") {
    // For CUSTOM_COMPONENT, use the componentKey from its payload
    const payload = currentStep.payload as CustomComponentStepPayload; // Type assertion
    if (payload && payload.componentKey) {
      componentLookupKey = payload.componentKey;
    } else {
      console.error(
        `Step type is CUSTOM_COMPONENT but payload.componentKey is missing for step ID: ${currentStep.id}`,
      );
      return (
        <div style={{ color: "red", padding: "20px" }}>
          Error: CUSTOM_COMPONENT step is missing 'componentKey' in its payload.
        </div>
      );
    }
  }

  SpecificStepComponent = stepComponentRegistry[componentLookupKey];

  if (!SpecificStepComponent) {
    console.error(`No component registered for step type: ${currentStep.type}`);
    return (
      <div style={{ color: "red", padding: "20px" }}>
        Error: Component for step type "{currentStep.type}" not found.
      </div>
    );
  }

  const nextButtonLabel =
    currentStep.payload?.ctaLabel || (state?.isLastStep ? "Finish" : "Next");
  const prevButtonLabel = currentStep.payload?.secondaryCtaLabel || "Back";
  const skipButtonLabel = currentStep.payload?.skipLabel || "Skip";

  return (
    <div
      style={{
        padding: "20px",
        border: "1px solid #eee",
        borderRadius: "8px",
        background: "#fff",
      }}
    >
      <h2 style={{ marginTop: 0 }}>{currentStep.payload?.title}</h2>
      {currentStep.payload?.description && (
        <p>{currentStep.payload?.description}</p>
      )}

      {isLoading && currentStep && (
        <div style={{ minHeight: "50px" }}>{LoadingComponent}</div>
      )}
      {!isLoading && coreContext && (
        <div style={{ margin: "20px 0", minHeight: "50px" }}>
          <SpecificStepComponent
            payload={currentStep.payload}
            coreContext={coreContext}
            onDataChange={handleStepDataChange}
            initialData={coreContext.flowData} // Pass all flowData for potential rehydration
            setStepValid={setIsCurrentActiveStepValid}
          />
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "30px",
          paddingTop: "20px",
          borderTop: "1px solid #f0f0f0",
        }}
      >
        <div>
          {state?.isSkippable && (
            <button
              onClick={() => skip()}
              disabled={isLoading}
              style={{ marginRight: "10px" }}
            >
              {isLoading ? "..." : skipButtonLabel}
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {state?.canGoPrevious && (
            <button onClick={() => previous()} disabled={isLoading}>
              {isLoading ? "..." : prevButtonLabel}
            </button>
          )}
          {state?.canGoNext && (
            <button
              onClick={() => next(currentActiveStepData)}
              disabled={isLoading || !isCurrentActiveStepValid}
            >
              {isLoading ? "..." : nextButtonLabel}
            </button>
          )}
          {/* If it's the last step and can't go next (e.g. nextStep is null)
              but we still want a "Finish" button that calls engine.next()
              to trigger onFlowComplete and onStepComplete of the last step.
          */}
          {state?.isLastStep &&
            !state?.canGoNext &&
            currentStep.nextStep === null && (
              <button
                onClick={() => next(currentActiveStepData)} // This will call engine.next() which handles completion
                disabled={isLoading || !isCurrentActiveStepValid}
              >
                {isLoading ? "..." : currentStep.payload?.ctaLabel || "Finish"}
              </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default StepRenderer;
