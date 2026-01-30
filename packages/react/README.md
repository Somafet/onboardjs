# @onboardjs/react

[![npm version](https://badge.fury.io/js/%40onboardjs%2Freact.svg)](https://badge.fury.io/js/%40onboardjs%2Freact)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Discord](https://img.shields.io/discord/1380449826663301182?label=discord)](https://discord.gg/RnG5AdZjyR)
[![Build Status](https://github.com/Somafet/onboardjs/actions/workflows/react-tests.yml/badge.svg?branch=main&path=packages/react)](#)
[![npm downloads](https://img.shields.io/npm/dm/@onboardjs/react.svg)](https://www.npmjs.com/package/@onboardjs/react)

[![skills.sh skill](https://img.shields.io/badge/skills.sh%20skill-onboardjs--skill-blueviolet)](https://skills.sh/onboardjs/onboardjs-skills/onboardjs-react)

React bindings for [`@onboardjs/core`](https://github.com/Somafet/onboardjs/tree/main/packages/core). Build multi-step onboarding flows in React and Next.js with your own UI components.

**Resources:**

- Core engine: [`@onboardjs/core`](https://github.com/Somafet/onboardjs/tree/main/packages/core)
- Documentation: [docs.onboardjs.com](https://docs.onboardjs.com)
- Examples: [apps/examples](https://github.com/Somafet/onboardjs/tree/main/apps/examples)
- Discord: [Join the community](https://discord.gg/RnG5AdZjyR)

## Features

- Headless design: you control the UI
- `useOnboarding()` hook for state and navigation
- `OnboardingProvider` for context-based state management
- Inline component definitions on steps for simple setup
- Built-in localStorage persistence or custom handlers
- Granular loading states (hydrating, engine processing, component processing)
- Plugin system for extending functionality
- TypeScript with full type inference
- Works with Next.js App Router and Pages Router

## Installation

```bash
npm install @onboardjs/core @onboardjs/react
```

```bash
pnpm add @onboardjs/core @onboardjs/react
# or
yarn add @onboardjs/core @onboardjs/react
# or
bun add @onboardjs/core @onboardjs/react
```

## Quick Start

### 1. Define Steps with Components

```tsx
// config/onboarding.tsx
import { useOnboarding } from '@onboardjs/react'

function WelcomeStep() {
    return (
        <div>
            <h1>Welcome</h1>
            <p>Let's get you set up.</p>
        </div>
    )
}

function NameStep() {
    const { updateContext, state } = useOnboarding()

    return (
        <input
            placeholder="Your name"
            value={state.context.flowData.userName || ''}
            onChange={(e) => updateContext({ flowData: { userName: e.target.value } })}
        />
    )
}

export const steps = [
    {
        id: 'welcome',
        component: WelcomeStep,
        nextStep: 'name',
    },
    {
        id: 'name',
        component: NameStep,
        nextStep: null,
    },
]
```

### 2. Wrap Your App

```tsx
'use client'

import { OnboardingProvider } from '@onboardjs/react'
import { steps } from '@/config/onboarding'

export default function OnboardingPage() {
    return (
        <OnboardingProvider
            flowId="user-onboarding"
            flowName="User Onboarding"
            flowVersion="1.0.0"
            steps={steps}
            localStoragePersistence={{ key: 'onboarding_v1' }}
        >
            <OnboardingUI />
        </OnboardingProvider>
    )
}
```

### 3. Build Your UI

```tsx
'use client'

import { useOnboarding } from '@onboardjs/react'

function OnboardingUI() {
    const { state, next, previous, loading, renderStep } = useOnboarding()

    if (!state?.currentStep) return <p>Loading...</p>
    if (state.isCompleted) return <p>Onboarding complete</p>

    return (
        <div>
            <div>
                Step {state.currentStepNumber} of {state.totalSteps}
            </div>

            {renderStep()}

            <div>
                <button onClick={() => previous()} disabled={!state.canGoPrevious || loading.isAnyLoading}>
                    Back
                </button>
                <button onClick={() => next()} disabled={!state.canGoNext || loading.isAnyLoading}>
                    Next
                </button>
            </div>
        </div>
    )
}
```

## OnboardingProvider

The provider initializes the engine and manages state. All engine config options are supported.

```tsx
<OnboardingProvider
    // Flow identification
    flowId="my-flow"
    flowName="My Flow"
    flowVersion="1.0.0"
    flowMetadata={{ audience: 'new-users' }}
    // Steps
    steps={steps}
    initialStepId="welcome"
    initialContext={{ currentUser: user }}
    // Persistence
    localStoragePersistence={{ key: 'onboarding', ttl: 86400000 }}
    // or custom persistence
    customOnDataLoad={async () => await api.load()}
    customOnDataPersist={async (ctx, stepId) => await api.save(ctx, stepId)}
    customOnClearPersistedData={async () => await api.clear()}
    // Callbacks
    onFlowComplete={(context) => console.log('Done', context)}
    onStepChange={(newStep, oldStep, context) => {}}
    // Plugins and analytics
    plugins={[myPlugin]}
    analytics={true}
    debug={false}
>
    {children}
</OnboardingProvider>
```

## useOnboarding Hook

Access state and actions from any component inside the provider.

```tsx
const {
    // Engine instance
    engine,

    // Current state
    state,
    currentStep,
    isCompleted,

    // Loading states
    loading,
    isLoading, // deprecated, use loading.isAnyLoading

    // Navigation
    next,
    previous,
    skip,
    goToStep,

    // Data
    updateContext,
    setStepData,
    resetFlow,

    // UI
    renderStep,
    setComponentLoading,

    // Plugins
    pluginManager,
    installPlugin,
    uninstallPlugin,
    getInstalledPlugins,
    isPluginInstalled,
} = useOnboarding()
```

### Updating Data

Use `updateContext` to store data collected from your step components:

```tsx
function ProfileStep() {
    const { updateContext, state } = useOnboarding()

    const handleChange = (field: string, value: string) => {
        updateContext({
            flowData: {
                ...state.context.flowData,
                [field]: value,
            },
        })
    }

    return (
        <form>
            <input value={state.context.flowData.name || ''} onChange={(e) => handleChange('name', e.target.value)} />
            <input value={state.context.flowData.email || ''} onChange={(e) => handleChange('email', e.target.value)} />
        </form>
    )
}
```

### Hook Options

Pass callbacks specific to this hook instance:

```tsx
const { state } = useOnboarding({
    onFlowCompleted: ({ context, duration }) => {
        console.log('Completed in', duration, 'ms')
    },
    onStepChange: (newStep, oldStep, context) => {
        analytics.track('step_viewed', { stepId: newStep?.id })
    },
    onBeforeStepChange: (event) => {
        if (shouldPreventNavigation) {
            event.cancel()
        }
    },
})
```

## Loading States

The `loading` object provides granular visibility into what's causing the UI to block:

```tsx
const { loading, setComponentLoading } = useOnboarding()

// Individual states
loading.isHydrating // Loading persisted data on mount
loading.isEngineProcessing // Navigation in progress
loading.isComponentProcessing // Step component is processing
loading.isAnyLoading // Any of the above

// In a step component with async validation
const handleSubmit = async () => {
    setComponentLoading(true)
    try {
        await validateWithServer()
    } finally {
        setComponentLoading(false)
    }
}
```

Use `getLoadingReason()` to show contextual feedback:

```tsx
import { getLoadingReason } from '@onboardjs/react'

const reason = getLoadingReason(loading)

if (reason === 'hydrating') return <SkeletonLoader />
if (reason === 'engine-processing') return <TransitionSpinner />
if (reason === 'component-processing') return <ValidationIndicator />
```

## Step Components

Step components are regular React components. Use the `useOnboarding` hook to access state and update data:

```tsx
function MyStep() {
    const { state, updateContext } = useOnboarding()

    return (
        <div>
            <p>Current data: {JSON.stringify(state.context.flowData)}</p>
            <button onClick={() => updateContext({ flowData: { selected: true } })}>Select</button>
        </div>
    )
}

const steps = [
    {
        id: 'my-step',
        component: MyStep,
        nextStep: 'next-step',
    },
]
```

### Step Props (Alternative)

Step components can also receive props directly from the engine via `StepComponentProps`:

```tsx
import { StepComponentProps } from '@onboardjs/react'

function MyStep({ payload, context }: StepComponentProps<{ title: string }>) {
    return <h1>{payload.title}</h1>
}

const steps = [
    {
        id: 'my-step',
        component: MyStep,
        payload: { title: 'Welcome' },
        nextStep: 'next',
    },
]
```

## Component Registry (Alternative)

For larger applications, you can use a component registry to map step types or IDs to components instead of inline `component` properties:

```tsx
const componentRegistry = {
    // By step type
    INFORMATION: InfoStepComponent,
    SINGLE_CHOICE: ChoiceStepComponent,

    // By step ID or componentKey
    welcome: WelcomeStep,
    'profile-setup': ProfileSetupStep,
}

<OnboardingProvider steps={steps} componentRegistry={componentRegistry}>
    {children}
</OnboardingProvider>
```

The registry checks in order:

1. `step.component` if defined on the step
2. `payload.componentKey` in the registry
3. `step.id` in the registry
4. `step.type` in the registry

## Components

### OnboardingContainer

Wraps step rendering with loading and error handling:

```tsx
import { OnboardingContainer } from '@onboardjs/react'
;<OnboardingContainer loadingComponent={<Spinner />} completedComponent={<CompletionScreen />}>
    {/* Your navigation UI */}
</OnboardingContainer>
```

### OnboardingErrorBoundary

Catches errors in step components:

```tsx
import { OnboardingErrorBoundary } from '@onboardjs/react'
;<OnboardingErrorBoundary
    fallback={({ error, resetErrorBoundary }) => (
        <div>
            <p>Something went wrong: {error.message}</p>
            <button onClick={resetErrorBoundary}>Try again</button>
        </div>
    )}
>
    {renderStep()}
</OnboardingErrorBoundary>
```

### PersistenceStatus

Shows persistence state for debugging:

```tsx
import { PersistenceStatus } from '@onboardjs/react'
;<PersistenceStatus showDetails />
```

## Analytics

Track aha moments and custom events:

```tsx
import { useOnboardingAnalytics } from '@onboardjs/react'

function MyStep() {
    const { trackAha } = useOnboardingAnalytics()

    const handleSuccess = async () => {
        await trackAha({
            aha_type: 'value_demonstration',
            context: { feature_name: 'profile_complete' },
        })
    }

    return <button onClick={handleSuccess}>Complete</button>
}
```

For custom events, use the engine directly:

```tsx
const { engine } = useOnboarding()

engine.trackCustomEvent('button_clicked', {
    button_name: 'continue',
    includeStepContext: true,
})
```

## Plugin System

Install plugins at runtime:

```tsx
import { ReactPlugin } from '@onboardjs/react'

const myPlugin = new ReactPlugin({
    name: 'my-plugin',
    version: '1.0.0',
    hooks: {
        onStepActive: ({ step }) => {
            console.log('Step active:', step.id)
        },
    },
})

// Via provider
<OnboardingProvider plugins={[myPlugin]} steps={steps} />

// Or at runtime
const { installPlugin, uninstallPlugin } = useOnboarding()
await installPlugin(myPlugin)
await uninstallPlugin('my-plugin')
```

## Suspense Support

For React Suspense integration:

```tsx
import { useSuspenseEngine, clearSuspenseCache } from '@onboardjs/react'

function SuspenseOnboarding() {
    const { engine, state } = useSuspenseEngine({
        steps,
        flowId: 'my-flow',
    })

    // Engine is guaranteed to be ready
    return <div>{state.currentStep?.id}</div>
}

// Wrap with Suspense
;<Suspense fallback={<Loading />}>
    <SuspenseOnboarding />
</Suspense>
```

## Next.js Notes

- `OnboardingProvider` and components using `useOnboarding` must be Client Components (`'use client'`)
- Use `localStoragePersistence` for device-bound progress, or custom handlers for server-side storage
- The provider handles hydration automatically

## TypeScript

Generic context types flow through the entire API:

```tsx
interface MyContext extends OnboardingContext {
    currentUser: { id: string; plan: 'free' | 'pro' }
}

const { state } = useOnboarding<MyContext>()
// state.context.currentUser is typed as { id: string; plan: 'free' | 'pro' }
```

## Contributing

See the [Contributing Guidelines](https://github.com/Somafet/onboardjs/blob/main/CONTRIBUTING.md).

## License

MIT
