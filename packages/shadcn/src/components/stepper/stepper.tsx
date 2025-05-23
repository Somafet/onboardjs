"use client";

import { useStepper } from "@onboardjs/core";
import { Button } from "../ui/button";

export function Stepper() {
  const { currentStep, next, prev, isFirst, isLast, steps } = useStepper();

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
