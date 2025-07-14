"use client";

import { posthog } from "posthog-js";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";

export default function ExperimentOverride() {
  const router = useRouter();
  const currentValue = posthog.getFeatureFlag("motivational-progress-indicator");
  const overrideValue = currentValue === "with-progress" ? "control" : "with-progress";

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Override the experiment to see the progress indicator A/B test in
        action.
      </p>
      <Button
        onClick={() => {
          posthog.featureFlags.overrideFeatureFlags({
            flags: { "motivational-progress-indicator": overrideValue },
          });
          posthog.capture("experiment_override", {
            feature: "motivational-progress-indicator",
            value: overrideValue,
          });
          router.refresh();
        }}
      >
        Override Experiment ({overrideValue})
      </Button>
    </div>
  );
}
