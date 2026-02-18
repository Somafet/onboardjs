![OnboardJS React Demo Screenshot](./public/react-demo-screenshot.png)

# OnboardJS + React + Vite Example

## Description

This demo shows how to integrate **OnboardJS** with a React application built on Vite. It walks through building a multi-step onboarding flow using the OnboardJS core engine and its React bindings — covering real-world patterns like step progression, conditional logic, and persisting onboarding state.

If you're looking to add onboarding to your own React app, this is the best place to start.

---

## Prerequisites

Before running this project, make sure you have the following installed:

- **Node.js** v18 or higher
- **pnpm** — this repo uses pnpm workspaces (`npm install -g pnpm`)
- A basic familiarity with React is helpful but not required

---

## Installation & Setup

This demo lives inside the OnboardJS monorepo. Follow these steps to get it running locally:

**1. Clone the repository**

```bash
git clone https://github.com/Somafet/onboardjs.git
cd onboardjs
```

**2. Install dependencies from the root**

```bash
pnpm install
```

**3. Navigate to the React demo**

```bash
cd apps/examples/react-demo
```

**4. Start the development server**

```bash
pnpm dev
```

The app will be available at `http://localhost:5173` by default.

---

## Features Demonstrated

This demo covers the core OnboardJS features you'll use in a real project:

- **Multi-step onboarding flow** — defining and navigating through a sequence of steps
- **React bindings** — using the `@onboardjs/react` package to connect the engine to your UI
- **Progress tracking** — showing users where they are in the onboarding process
- **Conditional step logic** — skipping or branching steps based on user input or state
- **Completion handling** — what happens when a user finishes or dismisses the flow

---

## Project Structure

```
react-demo/
├── public/                  # Static assets
├── src/
│   ├── components/          # Reusable UI components for onboarding steps
│   ├── App.tsx              # Root component, OnboardJS setup lives here
│   └── main.tsx             # Entry point
├── index.html
├── vite.config.ts
└── package.json
```

The most important file to look at first is `src/App.tsx` — that's where the OnboardJS flow is initialized and connected to React.

---

## How to Extend

Once you've got the demo running, here are a few ways to experiment with it:

- **Add a new step** — create a new step definition in `src/steps/` and register it in the flow config in `App.tsx`
- **Add conditional logic** — use the `condition` field on a step to skip it based on collected data
- **Persist progress** — wire up a custom storage adapter to save where a user left off (localStorage or an API)
- **Style it your way** — the demo uses minimal styling intentionally so it's easy to drop in your own design system
- **Trigger onboarding programmatically** — explore starting the flow based on a user action rather than on page load

---

## Resources

- [OnboardJS Documentation](https://github.com/Somafet/onboardjs)
- [React Bindings Package — `@onboardjs/react`](https://github.com/Somafet/onboardjs/tree/main/packages/react)
- [Other Examples](https://github.com/Somafet/onboardjs/tree/main/apps/examples)