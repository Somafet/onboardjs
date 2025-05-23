import { useStepper } from "@onboardjs/core";
import { Button } from "../ui/button";

export type StepperProps = {
  steps: number;
};

export function Stepper({ steps }: StepperProps) {
  const { currentStep, next, prev, isFirst, isLast } = useStepper({ steps });

  return (
    <div>
      <div className="mb-2">
        Step {currentStep + 1} of {steps}
      </div>
      <div className="flex gap-2">
        <Button onClick={prev} disabled={isFirst}>
          Back
        </Button>
        <Button onClick={next} disabled={isLast}>
          Next
        </Button>
      </div>
    </div>
  );
}
