// components/onboarding-ui/OnboardingUIManager.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  useOnboarding,
  StepComponentRegistry,
  OnboardingStep,
} from "@onboardjs/react";

// Assuming Shadcn UI components are available
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

interface OnboardingUIManagerProps {
  stepsConfig: OnboardingStep[];
  stepComponentRegistry: StepComponentRegistry;
  LoadingScreen?: React.ReactNode;
  ErrorScreen?: React.ComponentType<{ error: Error; onRetry?: () => void }>;
  CompletedScreen?: React.ReactNode;
}

const OnboardingUIManager: React.FC<OnboardingUIManagerProps> = ({
  stepsConfig,
  stepComponentRegistry,
  LoadingScreen = (
    <div className="flex flex-col items-center justify-center p-10 text-xl text-gray-600 min-h-[300px]">
      <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mb-4" />
      Initializing Onboarding...
    </div>
  ),
  ErrorScreen = ({ error, onRetry }) => (
    <Card className="w-full max-w-lg mx-auto my-8 text-center">
      <CardHeader>
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-2" />
        <CardTitle className="text-2xl text-red-600">
          Onboarding Error!
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-red-700">{error.message}</p>
      </CardContent>
      {onRetry && (
        <CardFooter className="justify-center">
          <Button onClick={onRetry} variant="destructive">
            Try Again
          </Button>
        </CardFooter>
      )}
    </Card>
  ),
  CompletedScreen,
}) => {
  const { state, isLoading, actions } = useOnboarding();
  const [currentActiveStepData, setCurrentActiveStepData] = useState<any>({});
  const [isCurrentActiveStepValid, setIsCurrentActiveStepValid] =
    useState<boolean>(true);

  useEffect(() => {
    setCurrentActiveStepData({});
    setIsCurrentActiveStepValid(true); // New step must prove its validity
  }, [state?.currentStep?.id]);

  const handleStepDataChange = useCallback(
    (data: any, isValid: boolean) => {
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
    [currentActiveStepData]
  );

  if (!state || !actions) return <>{LoadingScreen}</>; // Engine not ready
  if (isLoading) return <>{LoadingScreen}</>; // Covers hydration and engine's isLoading
  if (state.error)
    return (
      <ErrorScreen
        error={state.error}
        onRetry={() => actions.reset({ steps: stepsConfig })}
      />
    );
  if (state.isCompleted)
    return (
      <>
        {CompletedScreen ?? (
          <Card className="w-full max-w-lg mx-auto my-8 text-center">
            <CardHeader>
              <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-2" />
              <CardTitle className="text-3xl text-green-600">
                Onboarding Complete!
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-gray-700">
                You're all set up and ready to go.
              </p>
            </CardContent>
            <CardFooter className="justify-center mt-8">
              <Button onClick={() => actions.reset()}>
                Reset Onboarding flow
              </Button>
            </CardFooter>
          </Card>
        )}
      </>
    );

  const currentStepDetails = state.currentStep;
  if (!currentStepDetails) {
    return (
      <div className="p-10 text-center text-gray-500">
        No active onboarding step.
      </div>
    );
  }

  let SpecificStepComponent;
  const componentKey =
    currentStepDetails.type === "CUSTOM_COMPONENT"
      ? (currentStepDetails.payload as any)?.componentKey
      : currentStepDetails.type;

  SpecificStepComponent = stepComponentRegistry[componentKey];

  if (!SpecificStepComponent) {
    return (
      <div className="p-10 text-center text-red-500">
        Error: UI Component not found for step ID '{currentStepDetails.id}'
        (key: {componentKey}).
      </div>
    );
  }

  const currentStepIndex = stepsConfig.findIndex(
    (s) => s.id === currentStepDetails.id
  );

  const progressPercentage =
    stepsConfig.length > 0
      ? ((currentStepIndex + 1) / stepsConfig.length) * 100
      : 0;

  return (
    <div className="w-full mx-auto h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <CardTitle className="text-2xl font-bold mb-2">
              {currentStepDetails.title}
            </CardTitle>
            {currentStepDetails.description && (
              <CardDescription className="mt-1 text-md">
                {currentStepDetails.description}
              </CardDescription>
            )}
          </div>
          <span className="text-xs uppercase font-semibold text-indigo-600 bg-indigo-100 px-2 py-1 rounded-full text-nowrap">
            Step {currentStepIndex + 1} / {stepsConfig.length}
          </span>
        </div>
        <Progress value={progressPercentage} className="my-8" />
      </CardHeader>

      <CardContent className="min-h-[250px] py-6 pt-12 grow">
        <SpecificStepComponent
          payload={currentStepDetails.payload}
          coreContext={state.context}
          initialData={currentActiveStepData} // Or derive from state.context.flowData for this step's keys
          onDataChange={handleStepDataChange}
        />
      </CardContent>

      <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-4">
        <div className="w-full sm:w-auto">
          {state.isSkippable && currentStepDetails.isSkippable && (
            <Button
              variant="outline"
              onClick={() => actions.skip()}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              {currentStepDetails.skipLabel || "Skip"}
            </Button>
          )}
        </div>
        <div className="flex w-full sm:w-auto space-x-3 justify-end">
          {state.canGoPrevious && (
            <Button
              variant="outline"
              onClick={() => actions.previous()}
              disabled={isLoading}
            >
              {currentStepDetails.secondaryCtaLabel || "Back"}
            </Button>
          )}
          {(state.canGoNext ||
            (state.isLastStep &&
              !state.canGoNext &&
              currentStepDetails.nextStep === null)) && (
            <Button
              onClick={() => actions.next(currentActiveStepData)}
              disabled={isLoading || !isCurrentActiveStepValid}
            >
              {currentStepDetails.ctaLabel ||
                (state.isLastStep ? "Finish" : "Next")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingUIManager;
