// @onboardjs/react — web React bindings for OnboardJS.
// Headless logic is re-exported from @onboardjs/react-core; this package adds the
// web platform layer (DOM components, localStorage persistence, web router adapters).

// Web onboarding provider (wraps the core provider with web defaults)
export { OnboardingProvider, type OnboardingProviderProps } from './context/OnboardingProvider'

// Headless surface re-exported from react-core
export { useOnboarding } from '@onboardjs/react-core'
export { useOnboardingAnalytics } from '@onboardjs/react-core'

export {
    BasePlugin,
    PluginManagerImpl,
    type OnboardingPlugin,
    type PluginManager,
    type PluginHooks,
    type PluginConfig,
    type PluginCleanup,
} from '@onboardjs/core'

export { ReactPlugin } from '@onboardjs/react-core'
export type { ReactPluginConfig, ReactPluginHooks } from '@onboardjs/react-core'

// Web components
export {
    OnboardingErrorBoundary,
    OnboardingContainer,
    PersistenceStatus,
    type OnboardingErrorBoundaryProps,
    type OnboardingErrorBoundaryFallbackProps,
    type OnboardingError,
    type OnboardingErrorType,
    type OnboardingContainerProps,
    type PersistenceStatusProps,
    type PersistenceMode,
} from './components'

// Utilities (from react-core)
export {
    createStepsHash,
    createConfigHash,
    areStepsEqual,
    getLoadingReason,
    createLoadingState,
} from '@onboardjs/react-core'
export type { LoadingState, LoadingReason } from '@onboardjs/react-core'

export { createUrlMapper, toUrlSlug, canAccessStep, type UrlMapper } from '@onboardjs/react-core'

export { useSuspenseEngine, clearSuspenseCache, type UseSuspenseEngineResult } from '@onboardjs/react-core'

// Web router adapters
export { createNextNavigator, type NextAppRouter } from './adapters/next'
export {
    createReactRouterNavigator,
    type ReactRouterNavigateFunction,
    type ReactRouterLocation,
} from './adapters/react-router'

// Storage adapter contract (web ships a localStorage adapter as the default)
export type { OnboardingStorageAdapter } from '@onboardjs/react-core'
export { localStorageAdapter } from './persistence/localStorageAdapter'

// Export types
export type {
    StepComponentProps,
    StepComponentRegistry,
    OnboardingStep,
    StepComponent,
    OnboardingNavigator,
    NavigatorOptions,
    NavigatorConfig,
    UrlMappingFunction,
} from '@onboardjs/react-core'
export type { UseOnboardingOptions, UseOnboardingReturn } from '@onboardjs/react-core'
export type { OnboardingContextValue, OnboardingActions, LocalStoragePersistenceOptions } from '@onboardjs/react-core'
