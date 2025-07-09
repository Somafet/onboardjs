import { OnboardingProvider } from "@onboardjs/react";
import OnboardingUI from "./onboarding-ui";
import { stepRegistry } from "./step-registry";
import { steps } from "./steps";

export default function OnboardingLayout() {
  return (
    <OnboardingProvider
      steps={steps}
      componentRegistry={stepRegistry}
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
