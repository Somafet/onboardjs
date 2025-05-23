import type { Preview } from "@storybook/react";
import "@onboardjs/shadcn/index.css";
import { OnboardingProvider } from "@onboardjs/core";

const steps = 5;

const withOnboardingProvider = (Story, context) => (
  <OnboardingProvider steps={steps}>
    <Story {...context} />
  </OnboardingProvider>
);

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [withOnboardingProvider],
};

export default preview;
