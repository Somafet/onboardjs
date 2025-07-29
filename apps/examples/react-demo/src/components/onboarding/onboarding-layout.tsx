import { OnboardingProvider } from "@onboardjs/react";
import OnboardingUI from "./onboarding-ui";
import { steps } from "./steps";
import { createPostHogPlugin } from "@onboardjs/posthog-plugin";
import posthog from "posthog-js";

const posthogPlugin = createPostHogPlugin({
  posthogInstance: posthog,
  // We can enable debug logging during development
  debug: process.env.NODE_ENV === "development",
  enableConsoleLogging: process.env.NODE_ENV === "development",
});

export default function OnboardingLayout() {
  return (
    <OnboardingProvider
      plugins={[posthogPlugin]}
      steps={steps}
      // Uncomment the following lines to enable localStorage persistence
      // localStoragePersistence={{
      //   key: 'onboarding-flow',
      //   ttl: 1000 * 60 * 60 * 24, // 1 day
      // }}

      // You can specify an initial context for the onboarding flow.
      // This context can be used to pre-fill data or set initial values for the onboarding steps
      initialContext={{ flowData: { onboardingType: "developer" } }}
    >
      <OnboardingUI />
    </OnboardingProvider>
  );
}
