# OnboardJS

Headless onboarding engine for React and Next.js. Define multi-step flows as data, bring your own UI.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Discord](https://img.shields.io/discord/1380449826663301182?label=discord)](https://discord.gg/RnG5AdZjyR)
[![Documentation](https://img.shields.io/badge/docs-onboardjs.com-blue)](https://docs.onboardjs.com)

[![skills.sh skill](https://img.shields.io/badge/skills.sh%20skill-onboardjs--skill-blueviolet)](https://skills.sh/onboardjs/onboardjs-skills/onboardjs-react)

![OnboardJS Demo](./assets/demo.gif)

[Live Demo](https://vite.onboardjs.com)

## Features

- Headless: full control over UI and styling
- Declarative step definitions with conditional navigation
- Persistence hooks for localStorage, databases, or custom storage
- Built-in analytics and progress tracking
- Plugin system for extensibility
- TypeScript with strict typing
- Works with Next.js App Router and Pages Router

## Installation

```bash
npm install @onboardjs/core @onboardjs/react
```

```bash
pnpm add @onboardjs/core @onboardjs/react
# or
yarn add @onboardjs/core @onboardjs/react
```

## Quick Start

```tsx
'use client'

import { OnboardingProvider, useOnboarding } from '@onboardjs/react'

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

const steps = [
    { id: 'welcome', component: WelcomeStep, nextStep: 'name' },
    { id: 'name', component: NameStep, nextStep: null },
]

function OnboardingUI() {
    const { state, next, previous, loading, renderStep } = useOnboarding()

    if (!state?.currentStep) return <p>Loading...</p>
    if (state.isCompleted) return <p>Done</p>

    return (
        <div>
            {renderStep()}
            <button onClick={() => previous()} disabled={!state.canGoPrevious}>
                Back
            </button>
            <button onClick={() => next()} disabled={!state.canGoNext || loading.isAnyLoading}>
                Next
            </button>
        </div>
    )
}

export default function App() {
    return (
        <OnboardingProvider steps={steps} localStoragePersistence={{ key: 'onboarding' }}>
            <OnboardingUI />
        </OnboardingProvider>
    )
}
```

See the package READMEs for full API documentation:

- [@onboardjs/core](./packages/core/README.md) - Headless engine
- [@onboardjs/react](./packages/react/README.md) - React bindings

## Packages

This monorepo contains:

| Package                                        | Description                         |
| ---------------------------------------------- | ----------------------------------- |
| [@onboardjs/core](./packages/core)             | Headless, framework-agnostic engine |
| [@onboardjs/react](./packages/react)           | React hooks and provider            |
| [@onboardjs/visualizer](./packages/visualizer) | Visual flow builder component       |
| [apps/examples](./apps/examples)               | Example applications                |

## Development

```bash
git clone https://github.com/Somafet/onboardjs.git
cd onboardjs
pnpm install
pnpm build
pnpm test
```

## Community

- [GitHub Issues](https://github.com/Somafet/onboardjs/issues) - Bug reports and feature requests
- [Discord](https://discord.gg/RnG5AdZjyR) - Chat and support
- [Documentation](https://docs.onboardjs.com) - Guides and API reference

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions and guidelines.

## License

MIT - see [LICENSE.md](./LICENSE.md)
