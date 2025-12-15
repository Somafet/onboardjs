---
'@onboardjs/react': major
---

## Breaking Changes: v1.0.0 Release

### WHAT

This release introduces several breaking changes to prepare `@onboardjs/react` for stable v1.0:

1. **Removal of `analytics` object from `useOnboarding()` hook**
    - The `analytics.trackEvent()`, `analytics.flush()`, and `analytics.setUserId()` methods are no longer exposed
    - Analytics access is now exclusively through the `engine` object

2. **Replacement of `isLoading` boolean with granular `loading` object**
    - The single `isLoading` boolean is deprecated and removed
    - Replaced with `loading` object providing three distinct states: `isHydrating`, `isEngineProcessing`, `isComponentProcessing`, and `isAnyLoading`

3. **Type improvements for `StepComponentRegistry`**
    - Registry now uses discriminated union types for better type safety
    - Predefined step types (INFORMATION, SINGLE_CHOICE, CHECKLIST, etc.) now have type-safe payload inference
    - New `StepComponentPropsMap` type provides payload type mapping by step type
    - New `StepComponentByType` type for strict typing of predefined step components

4. **Refactored internal hook structure**
    - `useEngineActions` now uses `onEngineProcessingChange` callback instead of generic `onLoadingChange`
    - This clarifies that the hook manages specifically "engine processing" state
    - `setComponentLoading` callback remains separate for component-level validation/processing states

### WHY

1. **Separation of Concerns**: Analytics is a core engine concern and should be accessed through `engine` directly, not wrapped in React hooks
2. **Improved UX Patterns**: Granular loading states enable more sophisticated loading UI patterns (skeleton loaders for initial load, spinners for navigation, validation states for component processing)
3. **Type Safety**: Discriminated union types for step components prevent payload type mismatches at compile time
4. **Cleaner API**: Better naming (`onEngineProcessingChange` vs. generic `onLoadingChange`) makes the hook's responsibilities explicit
5. **v1 Stability**: These changes finalize the API surface for the v1 stable release

### HOW to Migrate

#### Analytics Tracking

**Before:**

```tsx
const { analytics } = useOnboarding()
analytics.trackEvent('custom_event', { data: 'value' })
await analytics.flush()
analytics.setUserId('user-123')
```

**After:**

```tsx
const { engine } = useOnboarding()

// Track custom events
engine.trackEvent('custom_event', { data: 'value' })
engine.trackCustomEvent(
    'my_event',
    {
        property: 'value',
        includeStepContext: true,
        includeFlowProgress: true,
    },
    { category: 'engagement', priority: 'high' }
)

// Flush analytics
await engine.flushAnalytics()

// Set user ID (via engine configuration or initialization)
engine.setAnalyticsUserId('user-123')
```

#### Loading State Management

**Before:**

```tsx
const { isLoading } = useOnboarding()

if (isLoading) {
    return <Spinner /> // Generic loading spinner
}
```

**After:**

```tsx
const { loading } = useOnboarding()

// Now you can differentiate loading reasons
if (loading.isHydrating) {
    return <SkeletonScreen /> // Initial data load
}
if (loading.isEngineProcessing) {
    return <NavigationSpinner /> // Step transition
}
if (loading.isComponentProcessing) {
    return <ValidationSpinner /> // Form validation
}
if (loading.isAnyLoading) {
    return <GenericSpinner /> // Equivalent to old `isLoading`
}
```

#### Step Component Registry Type Safety

**Before:**

```tsx
const stepRegistry: StepComponentRegistry<MyContext> = {
    welcome: WelcomeStep, // Any type accepted
    'my-custom-step': MyCustomStep,
}
```

**After:**

```tsx
// Predefined types now have type-safe props
const stepRegistry: StepComponentRegistry<MyContext> = {
    INFORMATION: (props) => {
        // props.payload is now typed as InformationStepPayload
        return <div>{props.payload.mainText}</div>
    },
    SINGLE_CHOICE: (props) => {
        // props.payload is now typed as SingleChoiceStepPayload
        return <ChoiceOptions options={props.payload.options} />
    },
    // Custom string-keyed steps still supported
    'my-custom-step': MyCustomStep,
}
```

### Updated Hook Signature

The `useOnboarding()` hook now returns:

```tsx
interface OnboardingContextValue<TContext> {
    engine: OnboardingEngine<TContext> | null
    state: EngineState<TContext> | null

    // NEW: Granular loading state
    loading: {
        isHydrating: boolean
        isEngineProcessing: boolean
        isComponentProcessing: boolean
        isAnyLoading: boolean
    }

    // DEPRECATED: Will be removed in v2.0
    isLoading: boolean

    // Actions
    next: (stepSpecificData?: Record<string, unknown>) => Promise<void>
    previous: () => Promise<void>
    skip: () => Promise<void>
    goToStep: (stepId: string, data?: Record<string, unknown>) => Promise<void>
    updateContext: (data: Partial<TContext>) => Promise<void>
    reset: (config?: Partial<OnboardingEngineConfig<TContext>>) => Promise<void>

    // UI Rendering
    renderStep: () => React.ReactNode
    setComponentLoading: (loading: boolean) => void

    // Flow state
    currentStep: OnboardingStep<TContext> | null | undefined
    isCompleted: boolean | undefined
    error: Error | null
}
```

### New Exports

The following utilities are now exported from `@onboardjs/react`:

```tsx
export type { LoadingState, LoadingReason } from '@onboardjs/react'
export { getLoadingReason, createLoadingState } from '@onboardjs/react'
```
