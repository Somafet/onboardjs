# @onboardjs/react

[![npm version](https://badge.fury.io/js/%40onboardjs%2Freact.svg)](https://badge.fury.io/js/%40onboardjs%2Freact)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Discord](https://img.shields.io/discord/1380449826663301182?label=discord)](https://discord.gg/RnG5AdZjyR)

[![Build Status](https://github.com/Somafet/onboardjs/actions/workflows/react-tests.yml/badge.svg?branch=main&path=packages/react)](#)
[![npm downloads](https://img.shields.io/npm/dm/@onboardjs/react.svg)](https://www.npmjs.com/package/@onboardjs/react)

**Official React bindings for [`@onboardjs/core`](https://github.com/Somafet/onboardjs/tree/main/packages/core): Build fully custom, dynamic onboarding flows in React and Next.js with maximum flexibility.**

---

## ✨ Features

- **Headless-first:** Bring your own UI—OnboardJS manages the logic.
- **React Hooks API:** Use `useOnboarding()` to access state and actions.
- **Context-based:** `OnboardingProvider` manages and distributes onboarding state.
- **Custom Step Components:** Map any step to your own React component.
- **Persistence:** Built-in localStorage support, or plug in your own (e.g., Supabase).
- **TypeScript-first:** Full type safety and autocompletion.
- **Next.js Ready:** Works with App Router and Pages Router.
- **Plugins:** Extend functionality with custom plugins.

---

## 🚀 Quickstart

### 1. Install

```bash
npm install @onboardjs/core @onboardjs/react
```

```bash
yarn add @onboardjs/core @onboardjs/react
# or
pnpm add @onboardjs/core @onboardjs/react
# or
bun add @onboardjs/core @onboardjs/react
```

### 2. Define Your Steps and Components

```typescript jsx
// config/onboarding.ts
import { OnboardingStep } from '@onboardjs/core';
import { StepComponentProps } from '@onboardjs/react';

const WelcomeStep: React.FC<StepComponentProps<{ title: string }>> = ({ payload }) => (
  <div>
    <h1>{payload.title}</h1>
    <p>Welcome to the app!</p>
  </div>
);

const NameStep: React.FC<StepComponentProps<{ fieldKey: string }>> = ({ payload, onDataChange }) => (
  <input
    placeholder="Your name"
    onChange={e => onDataChange({ [payload.fieldKey]: e.target.value }, e.target.value.length > 1)}
  />
);

export const steps: OnboardingStep[] = [
  {
    id: 'welcome',
    type: 'CUSTOM_COMPONENT',
    payload: { componentKey: 'welcome', title: 'Hello from OnboardJS!' },
    nextStep: 'name',
  },
  {
    id: 'name',
    type: 'CUSTOM_COMPONENT',
    payload: { componentKey: 'name', fieldKey: 'userName' },
    nextStep: null,
  },
];

export const stepRegistry = {
  welcome: WelcomeStep,
  name: NameStep,
};
```

### 3. Wrap Your App with OnboardingProvider

```typescript jsx
// pages/onboarding.tsx or app/onboarding/page.tsx
'use client';
import { OnboardingProvider } from '@onboardjs/react';
import { steps, stepRegistry } from '@/config/onboarding';
import OnboardingUIManager from '@/components/OnboardingUIManager';

export default function OnboardingPage() {
  return (
    <OnboardingProvider
      steps={steps}
      localStoragePersistence={{
        key: 'onboarding_v1',
        // ttl: 1000 * 60 * 60 * 24, // 1 day (optional)
      }}
    >
      <OnboardingUIManager stepsConfig={steps} stepComponentRegistry={stepRegistry} />
    </OnboardingProvider>
  );
}
```

### 4. Build Your UI with useOnboarding

```typescript jsx
// components/OnboardingUIManager.tsx
'use client';
import { useOnboarding } from '@onboardjs/react';

export default function OnboardingUIManager({ stepsConfig, stepComponentRegistry }) {
  const { state, next, isLoading } = useOnboarding();

  if (!state || !state.currentStep) return <p>Loading...</p>;
  if (state.isCompleted) return <p>Onboarding complete! 🎉</p>;

  const StepComponent =
    state.currentStep.type === 'CUSTOM_COMPONENT'
      ? stepComponentRegistry[state.currentStep.payload.componentKey]
      : null;

  return (
    <div>
      <h2>{state.currentStep.title}</h2>
      {StepComponent && (
        <StepComponent
          payload={state.currentStep.payload}
          coreContext={state.context}
          onDataChange={() => {}}
        />
      )}
      <button onClick={() => next()} disabled={isLoading}>Next</button>
    </div>
  );
}
```

---

## 📝 Next.js Integration

- **Client Components**: `OnboardingProvider` and any component using `useOnboarding` must be a Client Component (`'use client';`).
- **Persistence**: Use `localStoragePersistence` for out-of-the-box device bound progress saving, or provide your own handlers for Supabase, Neon, etc.
- **Examples**: See [onboardjs/apps/examples](https://github.com/Somafet/onboardjs/tree/main/apps/examples).

---

## 📚 Documentation & Community

- **[@onboardjs/core README](https://github.com/Somafet/onboardjs/tree/main/packages/core)**
- **Main Documentation Site**@ [onboardjs.com/docs](https://onboardjs.com/docs)
- **Discord Discussions**: [Join the community](https://discord.gg/RnG5AdZjyR)

---

**Build onboarding your way.**
Star the repo, join the community, and help us shape the future of onboarding for React and Next.js!

---
