import { useState } from "react";

export interface UseStepperProps {
  steps: number;
  initialStep?: number;
  onStepChange?: (step: number) => void;
}

export function useStepper({
  steps,
  initialStep = 0,
  onStepChange,
}: UseStepperProps) {
  const [current, setCurrent] = useState(initialStep);

  const goToStep = (step: number) => {
    if (step >= 0 && step < steps) {
      setCurrent(step);
      onStepChange?.(step);
    }
  };

  const next = () => goToStep(current + 1);
  const prev = () => goToStep(current - 1);

  return {
    currentStep: current,
    goToStep,
    next,
    prev,
    steps,
    isFirst: current === 0,
    isLast: current === steps - 1,
  };
}
