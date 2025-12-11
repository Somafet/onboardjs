export { OnboardingProvider } from './context/OnboardingProvider'
export { useOnboarding } from './hooks/useOnboarding'
export { useOnboardingAnalytics } from './hooks/useOnboardingAnalytics'

// Re-export plugin system from core for convenience
export {
    BasePlugin,
    PluginManagerImpl,
    type OnboardingPlugin,
    type PluginManager,
    type PluginHooks,
    type PluginConfig,
    type PluginCleanup,
} from '@onboardjs/core'

// Export React-specific plugin utilities
export { ReactPlugin } from './plugins/ReactPlugin'
export type { ReactPluginConfig, ReactPluginHooks } from './plugins/ReactPlugin'

// Export components
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

// Export utilities
export { createStepsHash, createConfigHash, areStepsEqual } from './utils'

// Export Suspense-related utilities
export { useSuspenseEngine, clearSuspenseCache, type UseSuspenseEngineResult } from './hooks/internal/useSuspenseEngine'

// Export types
export type { StepComponentProps, StepComponentRegistry, OnboardingStep, StepComponent } from './types'
export type { UseOnboardingOptions, UseOnboardingReturn } from './hooks/useOnboarding.types'
export type {
    OnboardingContextValue,
    OnboardingActions,
    LocalStoragePersistenceOptions,
    OnboardingProviderProps,
} from './context/OnboardingProvider'
