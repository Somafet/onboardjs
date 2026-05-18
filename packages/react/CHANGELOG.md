# @onboardjs/react

## 1.0.0-rc.5

### Patch Changes

- Fix React 18 Strict Mode race condition causing `isHydrating` to get stuck. Replaced shared `useRef` in `useEngineLifecycle` with an effect-scoped flag to prevent orphaned promises from previous effect runs from updating state during Strict Mode double-mounting. ([#103](https://github.com/Somafet/onboardjs/pull/103))

## 1.0.0-rc.4

### Minor Changes

- feat(react): add navigator system with URL-based step synchronization and router adapters for Next.js and React Router. fix(posthog-plugin): replace direct PostHog type with minimal PostHogInstance interface to avoid version incompatibilities. fix(supabase-plugin): correct install method return type and async handling.
