// @onboardjs/react-native — React Native bindings for OnboardJS.
// Headless logic is re-exported from @onboardjs/react-core; this package adds the
// React Native platform layer (native components + AsyncStorage persistence).

// React Native onboarding provider (wraps the core provider with RN defaults)
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

// React Native components
export { OnboardingErrorBoundary } from './components/OnboardingErrorBoundary'
export type {
    OnboardingError,
    OnboardingErrorType,
    OnboardingErrorBoundaryProps,
    OnboardingErrorBoundaryFallbackProps,
} from '@onboardjs/react-core'
export { PersistenceStatus, type PersistenceStatusProps, type PersistenceMode } from './components/PersistenceStatus'
export { LoadingFallback, type LoadingFallbackProps } from './components/LoadingFallback'
export { StepNotFoundFallback } from './components/StepNotFoundFallback'

// Utilities (from react-core)
export {
    createStepsHash,
    createConfigHash,
    areStepsEqual,
    getLoadingReason,
    createLoadingState,
} from '@onboardjs/react-core'
export type { LoadingState, LoadingReason } from '@onboardjs/react-core'

// Storage adapter contract (RN ships an AsyncStorage adapter as the default)
export type { OnboardingStorageAdapter } from '@onboardjs/react-core'
export { asyncStorageAdapter } from './persistence/asyncStorageAdapter'

// Types
export type { StepComponentProps, StepComponentRegistry, OnboardingStep, StepComponent } from '@onboardjs/react-core'
export type { UseOnboardingOptions, UseOnboardingReturn } from '@onboardjs/react-core'
export type { OnboardingContextValue, OnboardingActions, LocalStoragePersistenceOptions } from '@onboardjs/react-core'
