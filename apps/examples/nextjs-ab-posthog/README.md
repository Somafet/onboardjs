# Next.js AB Testing Example with PostHog

This project demonstrates how to run A/B experiments in a Next.js app using PostHog for analytics and feature flagging. It is part of the onboardjs examples suite.

[Demo](https://ab.onboardjs.com/)

## Features
- Next.js 14+ app
- Shadcn UI (so you can plug-n-play your own UI components)
- PostHog integration for analytics and feature flags
- Example onboarding flow
- Demo components for experiment variants

## Getting Started

### Prerequisites
- Node.js 18+
- Yarn or npm
- A [PostHog](https://posthog.com/) account

### Installation

1. **Clone the repository:**
   ```sh
   git clone https://github.com/Somafet/onboardjs.git
   cd onboardjs/apps/examples/nextjs-ab-posthog
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Configure PostHog:**
   - Create a project in [PostHog](https://eu.posthog.com/).
   - Copy your PostHog API key and project URL.
   - Add them to your environment variables (e.g., `.env.local`):
     ```env
     NEXT_PUBLIC_POSTHOG_KEY=your_project_api_key
     NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com
     ```

4. **Run the development server:**
   ```sh
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

## Setting Up an Experiment in PostHog

To replicate the A/B experiment in this project:

1. **Create a New Experiment:**

Ensure you have already completed the onboarding flow in the UI to see the events in PostHog.

   - Go to your PostHog dashboard.
   - Navigate to **Experiments** > **New experiment**.
   - Name your experiment & Feature flag key (e.g., `motivational-progress-indicator`).
   - Add description as "The goal of this experiment is to see which heading text leads to more conversion."
   - Add two variants (e.g., `control`, `with-progress`).
   - Set rollout conditions (e.g., 50% control, 50% variant).
   - Save the experiment as draft.
   - Add your first metric by clicking the "Add metric" button. Select either "Single-use" or "Shared" as the metric source.
   - Name the metric as "Onboarding Flow Completed".
   - Select "Funnel" as the metric type.
   - As the metric first step, select "onboarding_flow_started" and the second step as "onboarding_flow_completed".
   - Save the metric and launch the experiment.

2. **Update the App to Use the Flag:**
   - The app reads the feature flag using the PostHog client and renders the appropriate variant.
   - You can find the flag usage in the onboarding flow or experiment component.
   - You can force the variant by pressing the "Override Experiment" button in the UI.

3. **Track Events:**
   - The app sends events to PostHog for onboarding steps and experiment conversions.
   - You can view these events in the PostHog dashboard for analysis.

## Folder Structure
```
apps/examples/nextjs-ab-posthog/
├── public/
├── src/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── types/
├── package.json
├── next.config.ts
├── tsconfig.json
└── ...
```

## Customization
- Update `src/components/onboarding/` to modify the onboarding flow.
- Change experiment names, logic and variant distribution to match your experiment needs.

## License
MIT

## Contributing
See the root `CONTRIBUTING.md` for guidelines.
