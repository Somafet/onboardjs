---
'@onboardjs/react-core': minor
'@onboardjs/react-native': minor
'@onboardjs/react': minor
---

Extract a headless `@onboardjs/react-core` package and add `@onboardjs/react-native`

The React bindings are now split into three packages that share one headless core:

- **`@onboardjs/react-core`** (new): platform-agnostic provider, hooks, utilities,
  types, plugin base, and persistence / step-fallback / error-boundary abstractions.
  Peers on `@onboardjs/core` and `react` only (no `react-dom`), so it is safe for
  any React renderer.
- **`@onboardjs/react`**: unchanged public API. It now re-exports the headless logic
  from `@onboardjs/react-core` and adds the web platform layer (DOM components,
  `window.localStorage` persistence, Next.js / React Router adapters). Existing
  imports keep working — the export surface is a superset of before. New additive
  exports: `OnboardingStorageAdapter`, `localStorageAdapter`, and the
  `storageAdapter` / `renderStepNotFound` provider props.
- **`@onboardjs/react-native`** (new): React Native bindings — AsyncStorage-backed
  persistence and native UI primitives. Install with
  `@onboardjs/core @onboardjs/react-native @react-native-async-storage/async-storage`.

Persistence is now driven through a pluggable `OnboardingStorageAdapter`; the
`customOnDataLoad` / `customOnDataPersist` priority, memory fallback, TTL handling,
and quota → memory recovery are unchanged. `useSuspenseEngine` accepts an optional
`isServer` override (web keeps throwing during SSR).

No migration is required for existing `@onboardjs/react` users.
