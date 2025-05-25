"use client";

// @onboardjs/react/src/components/StepRenderer.tsx
import React, { useState, useEffect, useCallback } from "react";
import { OnboardingStep as CoreOnboardingStep, CustomComponentStepPayload } from "@onboardjs/core";
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
  const { engine, state, isLoading, setComponentLoading } = useOnboarding();
  const [currentStepCollectedData, setCurrentStepCollectedData] = useState<any>(
    {}
  );
  const [isCurrentStepContentValid, setIsCurrentStepContentValid] =
    useState<boolean>(true);

  const currentStep = state?.currentStep;
  const coreContext = state?.context;

  useEffect(() => {
    // Reset local step data and validity when the engine's current step changes
    setCurrentStepCollectedData({});
    // Default to true for steps that don't actively manage validity via onDataChange/setStepValid
    // The specific step component will override this if needed.
    setIsCurrentStepContentValid(
      !currentStep || // No step, or...
        currentStep.type === "WELCOME" || // Simple welcome is valid
        currentStep.type === "CONFIRMATION" // Confirmation is valid
    );
  }, [currentStep?.id]); // Depend on step ID to reset

  const handleDataChange = useCallback((data: any, isValid: boolean) => {
    setCurrentStepCollectedData(data);
    setIsCurrentStepContentValid(isValid);
  }, []);

  const handleSetStepValid = useCallback((isValid: boolean) => {
    setIsCurrentStepContentValid(isValid);
  }, []);

  const handleNext = async () => {
    if (!engine || !currentStep || !state?.canGoNext || isLoading) return;
    if (!isCurrentStepContentValid) {
      // Optionally, trigger validation display in the step component here
      console.warn("Attempted to proceed with invalid step data.");
      return;
    }
    setComponentLoading(true);
    try {
      await engine.next(currentStepCollectedData);
    } catch (e) {
      console.error("Error during engine.next():", e);
    } finally {
      setComponentLoading(false);
    }
  };

  const handlePrevious = async () => {
    if (!engine || !state?.canGoPrevious || isLoading) return;
    setComponentLoading(true);
    try {
      await engine.previous();
    } catch (e) {
      console.error("Error during engine.previous():", e);
    } finally {
      setComponentLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!engine || !state?.isSkippable || isLoading) return;
    setComponentLoading(true);
    try {
      await engine.skip();
    } catch (e) {
      console.error("Error during engine.skip():", e);
    } finally {
      setComponentLoading(false);
    }
  };

  if (isLoading && !currentStep) {
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
  let componentLookupKey: string = currentStep.type; // Default to step.type

  if (currentStep.type === "CUSTOM_COMPONENT") {
    // For CUSTOM_COMPONENT, use the componentKey from its payload
    const payload = currentStep.payload as CustomComponentStepPayload; // Type assertion
    if (payload && payload.componentKey) {
      componentLookupKey = payload.componentKey;
    } else {
      console.error(
        `Step type is CUSTOM_COMPONENT but payload.componentKey is missing for step ID: ${currentStep.id}`
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
    currentStep.ctaLabel || (state?.isLastStep ? "Finish" : "Next");
  const prevButtonLabel = currentStep.secondaryCtaLabel || "Back";
  const skipButtonLabel = currentStep.skipLabel || "Skip";

  return (
    <div
      style={{
        padding: "20px",
        border: "1px solid #eee",
        borderRadius: "8px",
        background: "#fff",
      }}
    >
      <h2 style={{ marginTop: 0 }}>{currentStep.title}</h2>
      {currentStep.description && <p>{currentStep.description}</p>}

      {isLoading && currentStep && (
        <div style={{ minHeight: "50px" }}>{LoadingComponent}</div>
      )}
      {!isLoading && coreContext && (
        <div style={{ margin: "20px 0", minHeight: "50px" }}>
          <SpecificStepComponent
            payload={currentStep.payload}
            coreContext={coreContext}
            onDataChange={handleDataChange}
            initialData={coreContext.flowData} // Pass all flowData for potential rehydration
            setStepValid={handleSetStepValid}
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
              onClick={handleSkip}
              disabled={isLoading}
              style={{ marginRight: "10px" }}
            >
              {isLoading ? "..." : skipButtonLabel}
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {state?.canGoPrevious && (
            <button onClick={handlePrevious} disabled={isLoading}>
              {isLoading ? "..." : prevButtonLabel}
            </button>
          )}
          {state?.canGoNext && (
            <button
              onClick={handleNext}
              disabled={isLoading || !isCurrentStepContentValid}
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
                onClick={handleNext} // This will call engine.next() which handles completion
                disabled={isLoading || !isCurrentStepContentValid}
              >
                {isLoading ? "..." : currentStep.ctaLabel || "Finish"}
              </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default StepRenderer;
