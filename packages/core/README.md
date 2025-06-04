# @onboardjs/core

[![npm version](https://badge.fury.io/js/%40onboardjs%2Fcore.svg)](https://badge.fury.io/js/%40onboardjs%2Fcore)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<!-- Add other badges: build status, test coverage, downloads, etc. -->
<!-- [![Build Status](https://travis-ci.org/your-username/onboardjs.svg?branch=main)](https://travis-ci.org/your-username/onboardjs) -->
<!-- [![Coverage Status](https://coveralls.io/repos/github/your-username/onboardjs/badge.svg?branch=main)](https://coveralls.io/github/your-username/onboardjs?branch=main) -->
<!-- [![npm downloads](https://img.shields.io/npm/dm/@onboardjs/core.svg)](https://www.npmjs.com/package/@onboardjs/core) -->
<!-- [![Discord](https://img.shields.io/discord/your-discord-invite-code?label=discord)](https://discord.gg/your-discord-invite-code) -->

**`@onboardjs/core` is the headless, framework-agnostic engine that powers dynamic and customizable onboarding experiences. It provides the foundational logic for defining, managing, and transitioning through multi-step user onboarding flows.**

This core library is designed to be integrated into any JavaScript/TypeScript application, with dedicated binding packages (like [`@onboardjs/react`](https://github.com/Somafet/onboardjs/tree/main/packages/react)) for popular UI frameworks.

**The OnboardJS Project:**

OnboardJS aims to enable developers to quickly and easily build highly customizable, dynamic, and effective onboarding flows for their web applications. We provide an open-source engine, comprehensive resources, and foster a supportive community.

➡️ **Looking for React integration? Check out [`@onboardjs/react`](https://github.com/Somafet/onboardjs/tree/main/packages/react)!**
➡️ **Explore our [Documentation](#)!** (Coming soon)
➡️ **Join our [Community](#)!** (Coming soon)

## Why OnboardJS Core?

Building effective user onboarding is crucial for product adoption and user success, but it can be complex and time-consuming. `@onboardjs/core` simplifies this by offering:

- **Headless Logic:** Completely decoupled from any UI framework, giving you full control over the presentation.
- **Dynamic Flows:** Define steps with conditional logic, dynamic navigation, and data-driven behavior.
- **Extensibility:** Designed with extensibility in mind, allowing for custom step types, payloads, and lifecycle hooks.
- **State Management:** Robust internal state machine to manage the current step, collected data, and flow status.
- **Developer Experience:** Written in TypeScript for strong typing and a better development experience.
- **Lightweight:** Focused on providing the essential engine without unnecessary bloat.

## Key Features

- **Declarative Flow Definition:** Define onboarding flows as a simple array of step objects.
- **Flexible Step Structure:** Each step includes:
  - `id`: Unique identifier.
  - `type`: String identifier for the kind of step (e.g., `INFORMATION`, `SINGLE_CHOICE`, `CHECKLIST`, `CUSTOM_COMPONENT`).
  - `payload`: Arbitrary data specific to the step type, used to render its content.
- **Dynamic Navigation:**
  - `nextStep`, `previousStep`, `skipToStep`: Can be a static step ID (string) or a function `(context: OnboardingContext) => string | null | undefined` for conditional routing.
- **Conditional Step Rendering:**
  - `condition: (context: OnboardingContext) => boolean`: Dynamically show or hide steps based on collected data or user state.
- **Lifecycle Hooks:**
  - `onStepActive: (context: OnboardingContext) => Promise<void> | void`: Execute logic when a step becomes active (e.g., pre-load data).
  - `onStepComplete: (stepData: any, context: OnboardingContext) => Promise<void> | void`: Execute logic when a step is completed (e.g., validate data, make API calls).
- **Shared Onboarding Context:**
  - `OnboardingContext`: An object containing `flowData` (data collected from all steps) and other shared information (like `currentUser`).
- **Event System:**
  - Subscribe to engine events like `stateChange` and `beforeStepChange` to react to flow updates or intercept navigation.
- **Data Persistence Hooks:**
  - `loadData`: Allows you to load saved progress when the engine initializes.
  - `persistData`: Allows you to save progress whenever data changes or steps are completed.
- **Flow Validation Utility:**
  - `validateFlow()`: A helper function to check your flow definitions for common errors.
- **Support for Various Step Types:**
  - Includes definitions for common types (e.g., `INFORMATION`, `CONFIRMATION`, `CHECKLIST`).
  - Crucially supports `CUSTOM_COMPONENT` type for maximum flexibility when used with UI binding libraries.
- **Plugin System:** Easily extend the engine with custom plugins for additional functionality (e.g., analytics, custom storage).

## Installation

```bash
npm install @onboardjs/core
```

```bash
yarn add @onboardjs/core
# or
pnpm add @onboardjs/core
# or
bun add @onboardjs/core
```

## Quick Start

This example demonstrates the basic usage of the `OnboardingEngine`. For UI integration, you'll typically use a binding library like `@onboardjs/react`.

```typescript
import {
  OnboardingEngine,
  OnboardingStep,
  OnboardingContext,
} from "@onboardjs/core";

// 1. Define your onboarding steps
const steps: OnboardingStep[] = [
  {
    id: "welcome",
    type: "INFORMATION", // Predefined or custom type
    payload: {
      title: "Welcome to Our App!",
      mainText: "We are excited to have you.",
    },
    nextStep: "profile-setup",
    onStepActive: (context) => {
      console.log("Welcome step is now active!", context.flowData);
    },
  },
  {
    id: "profile-setup",
    type: "CUSTOM_COMPONENT", // Example type
    payload: {
      componentKey: "ProfileSetupComponent", // This should match a registered component
      title: "Setup Your Profile",
      fields: [
        { id: "name", name: "userName", label: "Your Name", type: "text" },
      ],
    },
    previousStep: "welcome",
    nextStep: (context: OnboardingContext) => {
      // Dynamic navigation based on collected data
      return context.flowData?.userName
        ? "confirmation"
        : "profile-setup-error";
    },
    onStepComplete: async (stepData, context) => {
      console.log("Profile data submitted:", stepData);
      // context.flowData will be automatically updated by the engine
      // with stepData before this hook is called if data is passed to engine.next(stepData)
      // You might make an API call here:
      // await api.updateUserProfile(context.flowData.userName);
    },
  },
  {
    id: "profile-setup-error",
    type: "INFORMATION",
    payload: {
      title: "Name Required",
      mainText: "Please go back and enter your name.",
    },
    previousStep: "profile-setup",
    nextStep: null,
  },
  {
    id: "confirmation",
    type: "CONFIRMATION",
    payload: { title: "All Set!", confirmationMessage: "Your profile is set up." },
    previousStep: "profile-setup",
    nextStep: null, // End of flow
  },
];

// 2. Configure and instantiate the engine
const engine = new OnboardingEngine({
  steps,
  initialStepId: "welcome", // Optional: defaults to the first step in your steps array
  initialContext: {
    // Provide initial global data if needed
    // flowData: { prefillSomeValue: 'test' },
    currentUser: { id: "user123", email: "user@example.com" },
  },
  onFlowComplete: (context: OnboardingContext) => {
    console.log("Onboarding flow completed! Final data:", context.flowData);
    // e.g., mark onboarding as complete for the user in your backend
  },
  onStepChange: (newStep, oldStep, context) => {
    if (newStep) {
      console.log(
        `Moved to step: ${newStep.payload.title} (ID: ${newStep.id})`,
      );
    }
    if (oldStep) {
      console.log(
        `Came from step: ${oldStep.payload.title} (ID: ${oldStep.id})`,
      );
    }
  },
  // onDataLoad: async () => {
  //   if (typeof window !== 'undefined') {
  //     const saved = localStorage.getItem('onboardingState');
  //     if (saved) {
  //       const parsed = JSON.parse(saved);
  //       // Check TTL if needed
  //       return parsed.data; // Assuming you store { timestamp, data: LoadedData }
  //     }
  //   }
  //   return null;
  // },
  // onDataPersist: async (context, currentStepId) => {
  //   if (typeof window !== 'undefined') {
  //     const stateToStore = {
  //       timestamp: Date.now(),
  //       data: { flowData: context.flowData, currentStepId }
  //     };
  //     localStorage.setItem('onboardingState', JSON.stringify(stateToStore));
  //   }
  // }
});

// 3. Subscribe to state changes (e.g., to update your UI)
const unsubscribe = engine.addEventListener("stateChange", (newState) => {
  console.log("Engine state changed:", newState);
  // Update your UI based on newState.currentStep, newState.context, etc.
  // For example, if using React, you'd update component state here.
});

// 4. Interact with the engine
async function runFlow() {
  let currentState = engine.getState();

  // Example: Simulate completing the profile setup step
  if (currentState.currentStep?.id === "profile-setup") {
    // Data collected by the UI for the 'profile-setup' step
    const profileData = { userName: "Soma The Developer" };
    console.log('Simulating "Next" with profile data:', profileData);
    await engine.next(profileData); // Pass data collected by the current step
    currentState = engine.getState();
  }

  // Example: If on confirmation, simulate "Next" to finish
  if (currentState.currentStep?.id === "confirmation") {
    console.log('Simulating "Next" to finish flow.');
    await engine.next();
  }
}

// Call after engine initialization (which might be async due to onDataLoad)
// A good practice is to wait for the initial hydration/loading state to clear.
// You can use `engine.ready()` to ensure the engine is ready before running the flow.
await engine.ready();
```

## Core Concepts

### `OnboardingEngine`

The main class that manages the onboarding flow. You instantiate it with your step definitions and configuration.

### `OnboardingStep`

An object defining a single step in the flow. Key properties:

- `id: string` (Unique)
- `type: string` (e.g., `CHECKLIST`, `CUSTOM_COMPONENT`)
- `payload: any` (Data specific to this step's type and content)
- `nextStep?: string | null | ((context: OnboardingContext) => string | null | undefined) | undefined`
- `previousStep?: string | null | ((context: OnboardingContext) => string | null | undefined) | undefined`
- `condition?: (context: OnboardingContext) => boolean`
- `onStepActive?: (context: OnboardingContext) => Promise<void> | void`
- `onStepComplete?: (stepData: any, context: OnboardingContext) => Promise<void> | void`
- `isSkippable?: boolean`
- `skipToStep?: string | null | ((context: OnboardingContext) => string | null | undefined) | undefined`
- `meta?: Record<string, any>` (For arbitrary custom data)

_(For detailed type definitions, please refer to the source code or generated type documentation.)_

### `OnboardingContext`

An object passed around and updated by the engine, available to various functions and hooks. It contains:

- `flowData: Record<string, any>`: A key-value store for all data collected during the onboarding flow. When `engine.next(stepData)` is called, `stepData` is merged into `flowData`.
- `currentUser?: any`: Placeholder for user-specific information you might want to make available.
- Other custom global properties you can add via `engine.updateContext()` or `initialContext`.

### `EngineState`

The object returned by `engine.getState()` and provided to state change subscribers. It includes:

- `currentStep: OnboardingStep | null`
- `context: OnboardingContext`
- `isLoading: boolean` (True during async operations like `onStepComplete` or `onDataLoad`)
- `isHydrating: boolean` (True while `onDataLoad` is being processed)
- `isCompleted: boolean`
- `isFirstStep: boolean`
- `isLastStep: boolean`
- `canGoNext: boolean`
- `canGoPrevious: boolean`
- `isSkippable: boolean`
- `error: Error | null`

### Step Types & Payloads

`@onboardjs/core` defines interfaces for common step payloads (like `InformationStepPayload`, `SingleChoiceStepPayload`, `ChecklistStepPayload`). The most important type for custom UI is `CUSTOM_COMPONENT`, where the `payload` must include a `componentKey` used by UI binding libraries (like `@onboardjs/react`) to select the correct UI component to render.

## API Reference

Detailed API documentation is coming soon, but here are the key methods and types you will interact with:

### `new OnboardingEngine(config: OnboardingEngineConfig)`

Creates a new onboarding engine instance.

- `config.steps: OnboardingStep[]` (Required)
- `config.initialStepId?: string`
- `config.initialContext?: Partial<OnboardingContext>`
- `config.onFlowComplete?: (context: OnboardingContext) => void`
- `config.onStepChange?: (newStep, oldStep, context) => void`
- `config.onDataLoad?: () => Promise<LoadedData | null | undefined>`
- `config.onDataPersist?: (context, currentStepId) => Promise<void> | void`

### Engine Instance Methods

- `getState(): EngineState`
- `subscribeToStateChange(listener: EngineStateChangeListener): UnsubscribeFunction`
- `onBeforeStepChange(listener: BeforeStepChangeListener): UnsubscribeFunction`
- `next(stepSpecificData?: any): Promise<void>`
- `previous(): Promise<void>`
- `skip(): Promise<void>`
- `goToStep(stepId: string, stepSpecificData?: any): Promise<void>`
- `updateContext(newContextData: Partial<OnboardingContext>): Promise<void>`
- `reset(newConfig?: Partial<OnboardingEngineConfig>): Promise<void>`
- `updateChecklistItem(itemId: string, isCompleted: boolean, stepId?: string): Promise<void>` (For `CHECKLIST` steps)
- `ready(): Promise<void>` (Waits for initial data load and hydration)

### Utility Functions

- `validateFlow(steps: OnboardingStep[]): ValidationIssue[]`

## Advanced Usage

### Data Persistence

Use the `onDataLoad` and `onDataPersist` configuration options to integrate with any storage mechanism (localStorage, sessionStorage, backend API, Supabase, etc.). The engine calls `onDataLoad` during initialization and `onDataPersist` after significant data changes or step completions.

```typescript
const engine = new OnboardingEngine({
  steps,
  async onDataLoad() {
    // Your logic to load { flowData, currentStepId }
    const data = await myApi.getOnboardingState();
    return data;
  },
  async onDataPersist(context, currentStepId) {
    // Your logic to save context.flowData and currentStepId
    await myApi.saveOnboardingState({
      flowData: context.flowData,
      currentStepId,
    });
  },
});
```

### Conditional Navigation & Step Rendering

Leverage function arguments for `nextStep`, `previousStep`, `skipToStep`, and the `condition` property on steps to create highly dynamic and personalized flows. These functions receive the current `OnboardingContext`.

```typescript
const steps: OnboardingStep[] = [
  {
    id: "user-type-choice",
    type: "SINGLE_CHOICE",
    payload: {
      dataKey: "userRole",
      options: [{ value: "admin" }, { value: "user" }],
    },
    nextStep: (context) =>
      context.flowData.userRole === "admin" ? "admin-setup" : "user-setup",
  },
  {
    id: "admin-feature",
    type: "INFO",
    title: "Admin Feature",
    payload: { message: "This is for admins only." },
    condition: (context) => context.currentUser?.role === "admin", // Example using currentUser
    nextStep: "common-next-step",
  },
];
```

### Custom Step Types

While `@onboardjs/core` defines some payload interfaces, you are free to define your own `type` strings and `payload` structures. UI binding libraries like `@onboardjs/react` use a `stepComponentRegistry` to map these types (or a `componentKey` within the payload for `type: 'CUSTOM_COMPONENT'`) to actual UI components.

## Contributing

We welcome contributions from the community! Whether it's bug reports, feature requests, documentation improvements, or code contributions, your help is appreciated.

Please read our [**Contributing Guidelines**](CONTRIBUTING.md) to get started. This document includes information on:

- Setting up the development environment
- Coding standards (linting, formatting)
- Running tests
- Submitting pull requests
- Our Code of Conduct

Key areas for contribution:

- **Core Engine Features:** Enhancements to flow control, state management, or new utilities.
- **New Step Type Definitions:** Proposing and defining interfaces for new common step types.
- **Plugins:** Developing plugins for common integrations (e.g., persistence adapters, analytics).
- **Documentation & Examples:** Improving clarity, adding more use cases.
- **Testing:** Increasing test coverage.

## Roadmap

The vision for `@onboardjs/core` for the future is to continue evolving as a powerful and flexible base for building amazing onboarding experiences with fast and efficient DX (developer experience). We aim to provide a solid foundation that can be easily extended and integrated with various UI frameworks, while also maintaining a focus on performance and usability.

Our high-level goals include:

- **Enhanced Plugin Architecture:** Making it even easier to extend the engine's capabilities.
- **More Predefined Step Logic:** Adding core logic for more complex step types (e.g., interactive tours, hotspots - though UI is still separate).
- **Tooling:** A CLI for scaffolding and managing flows.
- **Community-Driven Templates & Recipes:** A collection of common onboarding patterns.
- **Improved Internationalization (i18n) Support:** Patterns for localizing flow content.

## Community & Support

- **GitHub Discussions:** For questions, ideas, and showing off what you've built! [Discuss here](https://github.com/Somafet/onboardjs/issues)
- **GitHub Issues:** For bug reports and feature requests. [Issues here](https://github.com/Somafet/onboardjs/issues)
- **Discord Server:** Join our community for real-time chat and support. (Coming Soon)
- **Stack Overflow:** Tag your questions with `onboardjs`.

## License

`@onboardjs/core` is [MIT licensed](LICENSE).

---

Thank you for considering OnboardJS! We're excited to see what you build.
