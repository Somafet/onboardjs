# @onboardjs/react-core

Headless, platform-agnostic React bindings for [OnboardJS](https://onboardjs.com).

This package contains the shared engine integration — the `OnboardingProvider`, `useOnboarding` and related hooks, utilities, types, the plugin base, and the persistence / step-fallback / error-boundary **abstractions** — with no DOM or React Native UI of its own.

You usually do **not** install this package directly. Install a platform package instead, which re-exports everything here and adds the platform layer:

- **Web** → [`@onboardjs/react`](https://www.npmjs.com/package/@onboardjs/react) (DOM components, `localStorage` persistence, Next.js / React Router adapters)
- **React Native** → [`@onboardjs/react-native`](https://www.npmjs.com/package/@onboardjs/react-native) (native components, AsyncStorage persistence)

It peers on `@onboardjs/core` and `react` only — notably **not** `react-dom` — so it is safe to consume from any React renderer.

## Building a custom platform layer

Provide a storage adapter and step-not-found fallback to the core provider:

```tsx
import { OnboardingProvider, type OnboardingStorageAdapter } from '@onboardjs/react-core'

const myStorage: OnboardingStorageAdapter = {
    load: (key) => /* string | null | Promise<...> */,
    save: (key, value) => {},
    remove: (key) => {},
}

<OnboardingProvider
    steps={steps}
    storageAdapter={myStorage}
    renderStepNotFound={({ stepId, attemptedKeys }) => /* your platform's UI */}
>
    {children}
</OnboardingProvider>
```

## License

MIT
