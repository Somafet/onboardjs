# @onboardjs/core

[![npm version](https://badge.fury.io/js/%40onboardjs%2Fcore.svg)](https://badge.fury.io/js/%40onboardjs%2Fcore)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Discord](https://img.shields.io/discord/1380449826663301182?label=discord)](https://discord.gg/RnG5AdZjyR)
[![Build Status](https://github.com/Somafet/onboardjs/actions/workflows/core-tests.yml/badge.svg?branch=main&path=packages/core)](#)
[![npm downloads](https://img.shields.io/npm/dm/@onboardjs/core.svg)](https://www.npmjs.com/package/@onboardjs/core)

[![skills.sh skill](https://img.shields.io/badge/skills.sh%20skill-onboardjs--skill-blueviolet)](https://skills.sh/onboardjs/onboardjs-skills/onboardjs-react)

`@onboardjs/core` is a headless, framework-agnostic engine for building multi-step user onboarding flows. It handles state management, navigation, persistence, and analytics while leaving the UI entirely up to you.

This library can be integrated into any JavaScript or TypeScript application. For React projects, use [`@onboardjs/react`](https://github.com/Somafet/onboardjs/tree/main/packages/react) which provides hooks and context built on top of this core engine.

**Resources:**

- React integration: [`@onboardjs/react`](https://github.com/Somafet/onboardjs/tree/main/packages/react)
- Documentation: [docs.onboardjs.com](https://docs.onboardjs.com)
- Discord: [Join the community](https://discord.gg/RnG5AdZjyR)

## Why This Library

Building user onboarding typically requires managing step state, handling navigation logic, persisting progress, and tracking completion. This library provides a tested implementation of these concerns so you can focus on the actual onboarding content.

**What it provides:**

- State machine for step transitions with loading and error states
- Conditional navigation based on collected data
- Step visibility conditions for personalized flows
- Lifecycle hooks for async operations (API calls, data validation)
- Persistence hooks for saving and restoring progress
- Plugin system for extending functionality
- Built-in analytics tracking with session, performance, and milestone metrics
- Progress tracking with completion percentage
- SSR-safe registry for server-side rendering

## Installation

```bash
npm install @onboardjs/core
```

```bash
pnpm add @onboardjs/core
# or
yarn add @onboardjs/core
# or
bun add @onboardjs/core
```

## Quick Start

```typescript
import { OnboardingEngine, OnboardingStep, OnboardingContext } from '@onboardjs/core'

// Define your steps
const steps: OnboardingStep[] = [
    {
        id: 'welcome',
        type: 'INFORMATION',
        payload: {
            title: 'Welcome',
            mainText: 'Let us get you set up.',
        },
        nextStep: 'profile-setup',
    },
    {
        id: 'profile-setup',
        type: 'CUSTOM_COMPONENT',
        payload: {
            componentKey: 'ProfileSetupComponent',
        },
        previousStep: 'welcome',
        nextStep: (context: OnboardingContext) => {
            return context.flowData?.userName ? 'confirmation' : 'profile-setup'
        },
        onStepComplete: async (stepData, context) => {
            // Make API calls, validate data, etc.
            console.log('Profile submitted:', stepData)
        },
    },
    {
        id: 'confirmation',
        type: 'CONFIRMATION',
        payload: { title: 'All set' },
        previousStep: 'profile-setup',
        nextStep: null,
    },
]

// Create the engine
const engine = new OnboardingEngine({
    flowId: 'user-onboarding',
    flowName: 'User Onboarding',
    flowVersion: '1.0.0',
    steps,
    initialContext: {
        currentUser: { id: 'user123', email: 'user@example.com' },
    },
    onFlowComplete: (context) => {
        console.log('Onboarding complete:', context.flowData)
    },
})

// Subscribe to state changes
engine.addEventListener('stateChange', ({ state }) => {
    console.log('Current step:', state.currentStep?.id)
    console.log('Progress:', state.progressPercentage + '%')
})

// Wait for initialization (handles async data loading)
await engine.ready()

// Navigate through the flow
await engine.next({ userName: 'Jane' })
```

## Core Concepts

### OnboardingEngine

The main class that manages the flow. It handles step transitions, maintains context, emits events, and coordinates plugins.

```typescript
const engine = new OnboardingEngine({
    flowId: 'my-flow',           // Unique identifier
    flowName: 'My Flow',         // Human-readable name
    flowVersion: '1.0.0',        // Semantic version
    steps: [...],
    initialStepId: 'step-1',     // Optional, defaults to first step
    initialContext: {...},       // Pre-populate context
    onFlowComplete: (ctx) => {}, // Called when flow ends
    onStepChange: (newStep, oldStep, ctx) => {},
    loadData: async () => {...}, // Restore saved progress
    persistData: async (ctx, stepId) => {...},
    plugins: [...],
    debug: false,
    analytics: true,             // Enable built-in analytics
})
```

### OnboardingStep

Each step defines navigation, conditions, and lifecycle hooks:

```typescript
interface BaseOnboardingStep {
    id: string | number
    type?: 'INFORMATION' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'CONFIRMATION' | 'CHECKLIST' | 'CUSTOM_COMPONENT'
    payload?: any
    nextStep?: string | number | null | ((context) => string | null | undefined)
    previousStep?: string | number | null | ((context) => string | null | undefined)
    condition?: (context) => boolean
    onStepActive?: (context) => Promise<void> | void
    onStepComplete?: (stepData, context) => Promise<void> | void
    isSkippable?: boolean
    skipToStep?: string | number | null | ((context) => string | null | undefined)
    meta?: Record<string, any>
}
```

### OnboardingContext

Shared state available throughout the flow:

```typescript
interface OnboardingContext {
    flowData: {
        // Data collected from steps
        [key: string]: any
        _internal?: {
            completedSteps: Record<string | number, number>
            startedAt: number
            stepStartTimes: Record<string | number, number>
        }
    }
    currentUser?: any
    [key: string]: any
}
```

### EngineState

The current state of the engine, available via `getState()` and state change events:

```typescript
interface EngineState {
    // Flow identification
    flowId: string | null
    flowName: string | null
    flowVersion: string | null
    flowMetadata: Record<string, unknown> | null
    instanceId: number

    // Current state
    currentStep: OnboardingStep | null
    context: OnboardingContext
    isLoading: boolean
    isHydrating: boolean
    isCompleted: boolean
    error: Error | null

    // Navigation
    isFirstStep: boolean
    isLastStep: boolean
    canGoNext: boolean
    canGoPrevious: boolean
    isSkippable: boolean
    nextStepCandidate: OnboardingStep | null
    previousStepCandidate: OnboardingStep | null

    // Progress
    totalSteps: number
    completedSteps: number
    progressPercentage: number
    currentStepNumber: number
}
```

## Engine Methods

```typescript
// State
engine.getState(): EngineState
engine.ready(): Promise<void>  // Wait for initialization

// Navigation
engine.next(stepData?: any): Promise<void>
engine.previous(): Promise<void>
engine.skip(): Promise<void>
engine.goToStep(stepId: string, stepData?: any): Promise<void>

// Context
engine.updateContext(data: Partial<OnboardingContext>): Promise<void>

// Reset
engine.reset(newConfig?: Partial<OnboardingEngineConfig>): Promise<void>

// Checklist steps
engine.updateChecklistItem(itemId: string, isCompleted: boolean, stepId?: string): Promise<void>

// Events
engine.addEventListener(event: string, listener: Function): UnsubscribeFunction
```

## Event System

Subscribe to events to react to flow changes:

```typescript
// State changes (fires on every state update)
engine.addEventListener('stateChange', ({ state }) => {
    console.log(state.currentStep, state.progressPercentage)
})

// Before navigation (can cancel or redirect)
engine.addEventListener('beforeStepChange', (event) => {
    if (someCondition) {
        event.cancel()
        // or
        event.redirect('different-step')
    }
})

// Step lifecycle
engine.addEventListener('stepActive', ({ step, context }) => {})
engine.addEventListener('stepCompleted', ({ step, stepData, context }) => {})

// Flow lifecycle
engine.addEventListener('flowStarted', ({ context, startMethod }) => {})
engine.addEventListener('flowCompleted', ({ context, duration }) => {})

// Navigation
engine.addEventListener('navigationBack', ({ fromStep, toStep }) => {})
engine.addEventListener('navigationForward', ({ fromStep, toStep }) => {})

// Checklist
engine.addEventListener('checklistItemToggled', ({ itemId, isCompleted }) => {})
engine.addEventListener('checklistProgressChanged', ({ progress }) => {})

// Persistence
engine.addEventListener('persistenceSuccess', ({ persistenceTime }) => {})
engine.addEventListener('persistenceFailure', ({ error }) => {})

// Errors
engine.addEventListener('error', ({ error, context }) => {})
```

## Persistence

Save and restore progress using the `loadData` and `persistData` hooks:

```typescript
const engine = new OnboardingEngine({
    steps,
    async loadData() {
        const saved = await api.getOnboardingState(userId)
        if (saved) {
            return {
                flowData: saved.flowData,
                currentStepId: saved.currentStepId,
            }
        }
        return null
    },
    async persistData(context, currentStepId) {
        await api.saveOnboardingState(userId, {
            flowData: context.flowData,
            currentStepId,
        })
    },
    clearPersistedData() {
        return api.clearOnboardingState(userId)
    },
})
```

## Conditional Navigation

Use functions for dynamic navigation based on collected data:

```typescript
const steps: OnboardingStep[] = [
    {
        id: 'user-type',
        type: 'SINGLE_CHOICE',
        payload: {
            dataKey: 'userRole',
            options: [{ value: 'admin' }, { value: 'user' }],
        },
        nextStep: (context) => {
            return context.flowData.userRole === 'admin' ? 'admin-setup' : 'user-setup'
        },
    },
    {
        id: 'admin-feature',
        type: 'INFORMATION',
        payload: { title: 'Admin Settings' },
        // Only show this step to admins
        condition: (context) => context.currentUser?.role === 'admin',
        nextStep: 'next-step',
    },
]
```

## Plugin System

Extend the engine with plugins:

```typescript
import { OnboardingPlugin, BasePlugin } from '@onboardjs/core'

class MyPlugin extends BasePlugin {
    name = 'my-plugin'
    version = '1.0.0'

    install(engine) {
        const unsubscribe = engine.addEventListener('stepCompleted', ({ step, stepData }) => {
            // Custom logic
        })

        return () => {
            unsubscribe()
        }
    }
}

const engine = new OnboardingEngine({
    steps,
    plugins: [new MyPlugin()],
})
```

## Analytics

Built-in analytics tracking can be enabled with a boolean or configured in detail:

```typescript
const engine = new OnboardingEngine({
    steps,
    analytics: true, // Enable with defaults
    // or
    analytics: {
        enabled: true,
        providers: [customProvider],
        beforeSend: (event) => {
            // Modify or filter events
            return event
        },
    },
})
```

The engine tracks sessions, step performance, and progress milestones. Use the exported trackers for custom integrations:

```typescript
import { AnalyticsManager, SessionTracker, PerformanceTracker, ProgressMilestoneTracker } from '@onboardjs/core'
```

## SSR Support

For server-side rendering, use a dedicated registry to avoid cross-request state pollution:

```typescript
import { createRegistry, OnboardingEngine } from '@onboardjs/core'

// Create a request-scoped registry
const registry = createRegistry()

const engine = new OnboardingEngine({
    flowId: 'my-flow',
    steps,
    registry, // Pass the registry instance
})
```

## Utilities

```typescript
import { validateFlow, getEligibleSteps, calculateFlowProgress } from '@onboardjs/core'

// Validate step definitions
const issues = validateFlow(steps)

// Get steps that pass their conditions
const eligible = getEligibleSteps(steps, context)

// Calculate progress
const progress = calculateFlowProgress(steps, completedStepIds)
```

## Contributing

Contributions are welcome. See the [Contributing Guidelines](https://github.com/Somafet/onboardjs/blob/main/CONTRIBUTING.md) for setup instructions, coding standards, and the PR process.

Areas where help is useful:

- Core engine improvements
- New step type definitions
- Plugins for common integrations
- Documentation and examples
- Test coverage

## Community

- GitHub Issues: [Report bugs or request features](https://github.com/Somafet/onboardjs/issues)
- Discord: [Real-time chat and support](https://discord.gg/RnG5AdZjyR)
- Stack Overflow: Tag questions with `onboardjs`

## License

MIT - see [LICENSE.md](https://github.com/Somafet/onboardjs/blob/main/LICENSE.md)
