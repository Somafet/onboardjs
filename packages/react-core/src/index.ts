// @onboardjs/react-core — headless, platform-agnostic React bindings for OnboardJS.
// Consumed by @onboardjs/react (web) and @onboardjs/react-native.

export { OnboardingProvider } from './context/OnboardingProvider'
export { useOnboarding } from './hooks/useOnboarding'
export { useOnboardingAnalytics } from './hooks/useOnboardingAnalytics'

// Re-export plugin primitives from core for convenience
export {
    BasePlugin,
    PluginManagerImpl,
    type OnboardingPlugin,
    type PluginManager,
    type PluginHooks,
    type PluginConfig,
    type PluginCleanup,
} from '@onboardjs/core'

export { ReactPlugin } from './plugins/ReactPlugin'
export type { ReactPluginConfig, ReactPluginHooks } from './plugins/ReactPlugin'

// Utilities
export { createStepsHash, createConfigHash, areStepsEqual, getLoadingReason, createLoadingState } from './utils'
export type { LoadingState, LoadingReason } from './utils'

export { createUrlMapper, toUrlSlug, canAccessStep, type UrlMapper } from './utils/urlMapping'

export {
    useSuspenseEngine,
    clearSuspenseCache,
    type UseSuspenseEngineResult,
    type UseSuspenseEngineOptions,
} from './hooks/internal/useSuspenseEngine'

// Persistence abstractions (platform packages supply concrete adapters)
export type { OnboardingStorageAdapter } from './persistence/storageAdapter'
export { getStatusText, type PersistenceMode } from './persistence/persistenceMode'

// Step rendering fallback contract (platform packages supply concrete UI)
export type { StepNotFoundInfo } from './hooks/internal/useStepRenderer'

// Types
export type {
    StepComponentProps,
    StepComponentRegistry,
    OnboardingStep,
    StepComponent,
    OnboardingNavigator,
    NavigatorOptions,
    NavigatorConfig,
    UrlMappingFunction,
} from './types'
export type { UseOnboardingOptions, UseOnboardingReturn } from './hooks/useOnboarding.types'
export type {
    OnboardingContextValue,
    OnboardingActions,
    LocalStoragePersistenceOptions,
    OnboardingProviderProps,
} from './context/OnboardingProvider'
