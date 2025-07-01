# OnboardJS PostHog Plugin

[![npm version](https://img.shields.io/npm/v/@onboardjs/posthog-plugin.svg)](https://www.npmjs.com/package/@onboardjs/posthog-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![OnboardJS Core](https://img.shields.io/badge/requires-%40onboardjs%2Fcore-blue)](https://www.npmjs.com/package/@onboardjs/core)

The official PostHog analytics plugin for **OnboardJS**.

This plugin automatically captures detailed events throughout your user onboarding flows, enabling you to understand user behavior, detect churn, analyze funnels, and optimize your flows with data-driven experiments—all with minimal setup.

## ✨ Key Features

*   **🚀 Automatic Event Tracking**: Captures all critical onboarding events out-of-the-box, including flow starts, step views, completions, and errors.
*   **📊 Funnel & Churn Detection**: Automatically tracks step abandonment and calculates churn risk, helping you identify exactly where users drop off.
*   **🧪 A/B Testing Integration**: Seamlessly integrates with PostHog Feature Flags and Experiments to help you test and optimize different onboarding flows.
*   **⚡ Performance Monitoring**: Captures step render times and other performance metrics to identify and fix slow or janky steps.
*   **🛡️ Privacy-First**: Includes options to automatically redact PII and exclude sensitive data from your analytics events.
*   **🔧 Deeply Customizable**: Tailor event names, enrich events with custom properties, and configure advanced features to match your exact needs.
*   **📈 Shareable Dashboards**: Comes with pre-built JSON templates for PostHog dashboards to get you started with analysis instantly.

## 📦 Installation

Install the plugin and its peer dependencies using your favorite package manager:

```bash
# Using npm
npm install @onboardjs/core @onboardjs/plugin-posthog posthog-js

# Using yarn
yarn add @onboardjs/core @onboardjs/plugin-posthog posthog-js

# Using pnpm
pnpm add @onboardjs/core @onboardjs/plugin-posthog posthog-js
```

## 🚀 Quick Start

Get up and running with just a few lines of code. This example assumes you are in a client-side environment like a React component.

```tsx
"use client";

import { OnboardingEngine } from "@onboardjs/core";
import { PostHogPlugin } from "@onboardjs/plugin-posthog";
import posthog from "posthog-js";

// 1. Initialize PostHog (do this once in your app)
posthog.init("YOUR_POSTHOG_API_KEY", {
  api_host: "https://app.posthog.com",
});

// 2. Create an instance of the plugin
const postHogPlugin = new PostHogPlugin({
  // Pass your initialized PostHog instance
  posthogInstance: posthog,
  // Enable debug logging in development
  debug: process.env.NODE_ENV === "development",
});

// 3. Add the plugin to your OnboardJS engine
const engine = new OnboardingEngine({
  steps: [
    // ... your onboarding steps
  ],
  plugins: [postHogPlugin],
});

// 4. Identify your user in PostHog
// This links all captured events to a specific user.
const user = engine.getState().context.currentUser;
if (user?.id) {
  posthog.identify(user.id, {
    email: user.email,
    name: user.name,
  });
}
```

That's it! The plugin will now automatically track user progress through your onboarding flow.

## 🛠️ Advanced Configuration

Customize the plugin to fit your production needs, including custom event names, data enrichment, and privacy controls.

```tsx
import { PostHogPlugin, PostHogPluginConfig } from "@onboardjs/plugin-posthog";

const advancedConfig: PostHogPluginConfig = {
  posthogInstance: posthog,
  eventPrefix: "saas_signup_", // e.g., saas_signup_step_active

  // Customize event names
  customEventNames: {
    flowCompleted: "user_onboarding_completed",
  },

  // Enrich events with custom data
  globalProperties: {
    onboarding_version: "2.1",
  },
  stepPropertyEnrichers: {
    // Add custom properties ONLY for steps of type 'ACCOUNT_SETUP'
    ACCOUNT_SETUP: (step, context) => ({
      account_type: context.flowData.accountType,
      team_size: context.flowData.teamSize,
    }),
  },

  // Privacy & Compliance
  excludePersonalData: true, // Automatically redacts common PII
  excludeFlowDataKeys: ["apiKey", "secretToken"], // Manually exclude sensitive keys

  // Advanced Features
  enableChurnDetection: true,
  churnTimeoutMs: 180000, // 3 minutes
  enableProgressMilestones: true,
  enableExperimentTracking: true,
  experimentFlags: ["new-welcome-copy", "show-video-tutorial"],
};

const advancedPlugin = new PostHogPlugin(advancedConfig);

// Use it in your engine
const engine = new OnboardingEngine({
  steps: [
    /* ... */
  ],
  plugins: [advancedPlugin],
});
```

## ⚙️ Configuration Options

| Option                      | Type                                     | Default                               | Description                                                                                             |
| --------------------------- | ---------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `apiKey`                    | `string`                                 | `undefined`                           | Your PostHog Project API Key. Required if `posthogInstance` is not provided.                            |
| `host`                      | `string`                                 | `'https://app.posthog.com'`           | The PostHog API host.                                                                                   |
| `posthogInstance`           | `PostHog`                                | `undefined`                           | An existing, initialized PostHog instance. Recommended approach.                                        |
| `eventPrefix`               | `string`                                 | `'onboarding_'`                       | A prefix added to all default event names.                                                              |
| `customEventNames`          | `Partial<EventNameMapping>`              | `{}`                                  | Override default event names.                                                                           |
| `includeUserProperties`     | `boolean`                                | `true`                                | Whether to include user properties from `context.currentUser` in events.                                |
| `includeFlowData`           | `boolean`                                | `true`                                | Whether to include `context.flowData` in events.                                                        |
| `includeStepMetadata`       | `boolean`                                | `true`                                | Whether to include metadata about the current step (e.g., type, skippable).                             |
| `excludePersonalData`       | `boolean`                                | `false`                               | If true, automatically redacts common PII keys (email, name, etc.) from event properties.               |
| `excludeFlowDataKeys`       | `string[]`                               | `[]`                                  | An array of keys to remove from `flowData` before sending.                                              |
| `enableChurnDetection`      | `boolean`                                | `false`                               | If true, automatically fires a `step_abandoned` event if a user is idle on a step.                      |
| `churnTimeoutMs`            | `number`                                 | `300000` (5 mins)                     | The idle duration in milliseconds before a user is considered to have abandoned a step.                 |
| `enableProgressMilestones`  | `boolean`                                | `false`                               | If true, fires `progress_milestone` events at specific completion percentages.                          |
| `milestonePercentages`      | `number[]`                               | `[25, 50, 75, 100]`                   | The percentages at which to fire milestone events.                                                      |
| `enableExperimentTracking`  | `boolean`                                | `false`                               | If true, automatically tracks experiment exposure based on PostHog feature flags.                       |
| `experimentFlags`           | `string[]`                               | `[]`                                  | An array of PostHog feature flag keys to check for experiments.                                         |
| `globalProperties`          | `Record<string, any>`                    | `{}`                                  | An object of properties to be included with every event.                                                |
| `stepPropertyEnrichers`     | `Record<string, (step, context) => any>` | `{}`                                  | An object where keys are `step.type` and values are functions that return extra properties for that step. |
| `debug`                     | `boolean`                                | `false`                               | Enable verbose console logging for debugging.                                                           |

## 📈 Automatic Events

The plugin automatically captures the following events. You can use these to build funnels and insights in PostHog.

| Event Name (Default)      | Trigger                                                              | Key Properties                                                              |
| ------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `onboarding_flow_started`   | The OnboardJS engine is initialized for the first time.              | `start_method` ('fresh' or 'resumed'), `total_steps`                        |
| `onboarding_step_active`    | A new step becomes visible to the user.                              | `step_id`, `step_type`, `step_index`, `flow_progress_percentage`            |
| `onboarding_step_completed` | The user successfully completes a step and moves to the next.        | `step_id`, `completion_time_ms`, `render_time_ms`                           |
| `onboarding_step_abandoned` | The user is idle on a step for longer than `churnTimeoutMs`.         | `step_id`, `churn_risk_score`, `time_on_step_ms`                            |
| `onboarding_flow_completed` | The user successfully completes the final step of the flow.          | `total_steps`, `completion_time_ms`, `steps_skipped`                        |
| `onboarding_error`          | An error occurs within the OnboardJS engine.                         | `error_message`, `error_stack`, `current_step_id`                           |
| `onboarding_experiment_exposed` | A user is exposed to a variant of a configured feature flag.     | `experiment_flag`, `variant`                                                |

## 📊 Shareable PostHog Dashboards

To get you started with analysis immediately, we've included pre-built dashboard templates.

1.  Go to your PostHog project's **Dashboards** page.
2.  Click the **"New dashboard"** button and select **"Import dashboard"** from the dropdown.
3.  Copy the JSON content from one of the files in the [`dashboards/`](https://github.com/Soma-ch/onboardjs/tree/main/packages/plugin-posthog/dashboards) directory of this plugin.
4.  Paste the JSON into the import modal and click **"Import"**.

**Available Dashboards:**

*   **Onboarding Funnel Analysis:** A top-level view of your entire onboarding funnel, from start to completion, with step-by-step drop-off rates.
*   **Churn & Abandonment Analysis:** Deep dive into where and why users are abandoning your flow.
*   **Experiment Performance:** Compare the performance of different onboarding variants when running A/B tests.

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](https://github.com/Soma-ch/onboardjs/blob/main/CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/Soma-ch/onboardjs/blob/main/LICENSE) file for details.
