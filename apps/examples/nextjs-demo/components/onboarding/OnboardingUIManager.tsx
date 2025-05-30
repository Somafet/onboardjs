// components/onboarding-ui/OnboardingUIManager.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  useOnboarding,
  StepComponentRegistry,
  OnboardingStep,
} from "@onboardjs/react";
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
import { AlertTriangle, Loader2, PartyPopperIcon } from "lucide-react";
import { useRouter } from "next/navigation";

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
      <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mb-4" />
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
  const router = useRouter();
  const { state, currentStep, isLoading, next, skip, reset, previous } =
    useOnboarding();
  const [currentActiveStepData, setCurrentActiveStepData] = useState<any>({});
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [isCurrentActiveStepValid, setIsCurrentActiveStepValid] =
    useState<boolean>(true);

  useEffect(() => {
    setCurrentActiveStepData({});
    setIsCurrentActiveStepValid(currentStep?.meta?.isValid ?? false);
  }, [currentStep?.id]);

  const currentStepIndex = stepsConfig.findIndex(
    (s) => s.id === currentStep?.id
  );

  const progressPercentage =
    stepsConfig.length > 0
      ? ((currentStepIndex + 1) / stepsConfig.length) * 100
      : 0;

  useEffect(() => {
    // Optional: clear any previous timeouts if you want to be robust
    const timeout = setTimeout(() => {
      setAnimatedProgress(progressPercentage);
    }, 100); // 100ms delay for animation to be visible

    return () => clearTimeout(timeout);
  }, [progressPercentage]);

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

  if (!state) return <>{LoadingScreen}</>; // Engine not ready
  if (isLoading) return <>{LoadingScreen}</>; // Covers hydration and engine's isLoading
  if (state.error)
    return (
      <ErrorScreen
        error={state.error}
        onRetry={() => reset({ steps: stepsConfig })}
      />
    );
  if (state.isCompleted)
    return (
      <>
        {CompletedScreen ?? (
          <Card className="w-full max-w-lg mx-auto my-8 text-center">
            <CardHeader>
              <PartyPopperIcon className="mx-auto h-16 w-16 text-green-500 mb-2" />
              <CardTitle className="text-3xl text-green-600">
                Demo Completed!
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 text-sm">
                Now you get the idea of what you can build with OnboardJs.
                <br />
                <br />
                You can customize the steps, components, and flow to fit your
                application's needs. Check out the code to see how it works!
              </p>
            </CardContent>
            <CardFooter className="justify-center mt-8 space-x-4">
              <Button variant="outline" onClick={() => reset()}>
                Go again?
              </Button>
              <Button onClick={() => router.push("https://onboardjs.com")}>
                Go to Homepage
              </Button>
            </CardFooter>
          </Card>
        )}
      </>
    );

  if (!currentStep) {
    return (
      <div className="p-10 text-center text-gray-500">
        No active onboarding step.
      </div>
    );
  }

  let SpecificStepComponent;
  const componentKey =
    currentStep.type === "CUSTOM_COMPONENT"
      ? (currentStep.payload as any)?.componentKey
      : currentStep.type;

  SpecificStepComponent = stepComponentRegistry[componentKey];

  if (!SpecificStepComponent) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="p-10 text-center text-red-500">
          Error: UI Component not found for step ID '{currentStep.id}' (key:{" "}
          {componentKey}).
        </div>

        <Button variant="outline" onClick={() => reset()}>
          Reset Onboarding Flow
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <CardTitle className="text-2xl font-bold mb-2">
              {currentStep.title}
            </CardTitle>
            {currentStep.description && (
              <CardDescription className="mt-1 text-md">
                {currentStep.description}
              </CardDescription>
            )}
          </div>
          <span className="text-xs uppercase font-semibold text-[#2D2D2D] bg-[#AFCBFF] px-2 py-1 rounded-full text-nowrap">
            Step {currentStepIndex + 1} / {stepsConfig.length}
          </span>
        </div>
        <Progress value={animatedProgress} className="my-3 sm:my-8" />
      </CardHeader>

      <CardContent className="min-h-[250px] p-6 sm:pt-12">
        <SpecificStepComponent
          payload={currentStep.payload}
          coreContext={state.context}
          initialData={currentActiveStepData} // Or derive from state.context.flowData for this step's keys
          onDataChange={handleStepDataChange}
        />
      </CardContent>

      {!currentStep.meta?.disableCta ? (
        <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-4">
          <div className="w-full sm:w-auto">
            {state.isSkippable && currentStep.isSkippable && (
              <Button
                variant="outline"
                onClick={() => skip()}
                disabled={isLoading}
                className="w-full sm:w-auto animate-fade delay-100"
              >
                {currentStep.skipLabel || "Skip"}
              </Button>
            )}
          </div>
          <div className="flex w-full sm:w-auto space-x-3 justify-end">
            {state.canGoPrevious && (
              <Button
                variant="outline"
                className="animate-fade delay-100"
                onClick={() => previous()}
                disabled={isLoading}
              >
                {currentStep.secondaryCtaLabel || "Back"}
              </Button>
            )}
            {(state.canGoNext ||
              (state.isLastStep &&
                !state.canGoNext &&
                currentStep.nextStep === null)) && (
              <Button
                onClick={() => next(currentActiveStepData)}
                className="animate-fade"
                disabled={isLoading || !isCurrentActiveStepValid}
              >
                {currentStep.ctaLabel || (state.isLastStep ? "Finish" : "Next")}
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default OnboardingUIManager;
