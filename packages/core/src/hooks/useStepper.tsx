import { useOnboardingContext } from "../context/OnboardingProvider";

export function useStepper() {
  const { currentStep, steps, setCurrentStep } = useOnboardingContext();

  const isFirst = currentStep === 0;
  const isLast = currentStep === steps - 1;

  const next = () => setCurrentStep((s) => Math.min(s + 1, steps - 1));
  const prev = () => setCurrentStep((s) => Math.max(s - 1, 0));
  const goToStep = (step: number) =>
    setCurrentStep(Math.max(0, Math.min(step, steps - 1)));

  return {
    currentStep,
    steps,
    isFirst,
    isLast,
    next,
    prev,
    goToStep,
  };
}
