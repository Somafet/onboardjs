# @onboardjs/react-native

Official React Native bindings for [OnboardJS](https://onboardjs.com) — a headless, flexible user-onboarding engine.

This package is the React Native counterpart to `@onboardjs/react`. Both share the same headless core (`@onboardjs/react-core`); this package adds the native platform layer: an AsyncStorage-backed persistence adapter and React Native UI primitives (`View`/`Text`/`Pressable`).

## Installation

```bash
npm install @onboardjs/core @onboardjs/react-native @react-native-async-storage/async-storage
```

`@react-native-async-storage/async-storage` is a peer dependency — it ships native modules, so it must be installed (and pod-installed on iOS) in your app.

`@onboardjs/react-core` is pulled in automatically; you never install it directly.

## Usage

```tsx
import { OnboardingProvider, useOnboarding } from '@onboardjs/react-native'
import { View, Text, Pressable } from 'react-native'
import type { OnboardingStep, StepComponentRegistry } from '@onboardjs/react-native'

const steps: OnboardingStep[] = [
    { id: 'welcome', type: 'CUSTOM_COMPONENT', payload: { componentKey: 'welcome' } },
    { id: 'profile', type: 'CUSTOM_COMPONENT', payload: { componentKey: 'profile' } },
]

const registry: StepComponentRegistry = {
    welcome: () => <Text>Welcome 👋</Text>,
    profile: () => <Text>Tell us about yourself</Text>,
}

function Flow() {
    const { renderStep, next, previous, state } = useOnboarding()
    return (
        <View>
            {renderStep()}
            <Pressable onPress={() => previous()} disabled={state?.isFirstStep}>
                <Text>Back</Text>
            </Pressable>
            <Pressable onPress={() => next()}>
                <Text>Next</Text>
            </Pressable>
        </View>
    )
}

export default function App() {
    return (
        <OnboardingProvider
            steps={steps}
            componentRegistry={registry}
            localStoragePersistence={{ key: 'my-app-onboarding' }}
        >
            <Flow />
        </OnboardingProvider>
    )
}
```

### Persistence

By default the provider persists progress with AsyncStorage when `localStoragePersistence` is set. To plug in a different store, pass a custom `storageAdapter`:

```tsx
import type { OnboardingStorageAdapter } from '@onboardjs/react-native'

const mmkvAdapter: OnboardingStorageAdapter = {
    load: (key) => storage.getString(key) ?? null,
    save: (key, value) => storage.set(key, value),
    remove: (key) => storage.delete(key),
}

<OnboardingProvider storageAdapter={mmkvAdapter} localStoragePersistence={{ key: 'onboarding' }}>
    {/* ... */}
</OnboardingProvider>
```

Or supply fully custom load/persist hooks with `customOnDataLoad` / `customOnDataPersist` (these take priority over the storage adapter).

## What's included

- `OnboardingProvider` — wraps the headless core provider with React Native defaults.
- `useOnboarding`, `useOnboardingAnalytics` — re-exported from the core.
- `OnboardingErrorBoundary`, `PersistenceStatus`, `LoadingFallback`, `StepNotFoundFallback` — native UI components.
- `asyncStorageAdapter` — the default storage adapter.

## License

MIT
