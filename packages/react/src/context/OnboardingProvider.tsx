// @onboardjs/react/src/context/OnboardingProvider.tsx
'use client'

import React, { createContext, useState, useMemo, useCallback, ReactNode } from 'react'
import {
    OnboardingEngine,
    EngineState,
    OnboardingEngineConfig,
    OnboardingContext as OnboardingContextType,
    ConfigurationBuilder,
} from '@onboardjs/core'
import { OnboardingStep, StepComponentRegistry } from '../types'
import {
    useEngineLifecycle,
    useEngineState,
    usePersistence,
    useEngineActions,
    useStepRenderer,
    type LocalStoragePersistenceOptions,
    type UsePersistenceConfig,
} from '../hooks/internal'
import { createLoadingState, type LoadingState } from '../utils/loadingState'

// Define the actions type based on OnboardingEngine methods
export interface OnboardingActions<TContext extends OnboardingContextType = OnboardingContextType> {
    next: (stepSpecificData?: Record<string, unknown>) => Promise<void>
    previous: () => Promise<void>
    skip: () => Promise<void>
    goToStep: (stepId: string, stepSpecificData?: Record<string, unknown>) => Promise<void>
    updateContext: (newContextData: Partial<TContext>) => Promise<void>
    reset: (newConfig?: Partial<OnboardingEngineConfig<TContext>>) => Promise<void>
}

export interface OnboardingContextValue<TContext extends OnboardingContextType> extends OnboardingActions<TContext> {
    engine: OnboardingEngine<TContext> | null
    engineInstanceId?: number | undefined
    state: EngineState<TContext> | null

    /**
     * Granular loading state breakdown for better UX control.
     * Provides visibility into why the UI is blocked.
     *
     * @example
     * ```tsx
     * const { loading } = useOnboarding()
     *
     * if (loading.isHydrating) {
     *   return <InitialLoadScreen />
     * } else if (loading.isEngineProcessing) {
     *   return <NavigationSpinner />
     * } else if (loading.isComponentProcessing) {
     *   return <ValidationSpinner />
     * }
     * ```
     */
    loading: LoadingState

    /**
     * @deprecated Use `loading.isAnyLoading` instead. Will be removed in v2.0.
     * Convenience boolean that is true when any loading is occurring.
     */
    isLoading: boolean

    setComponentLoading: (loading: boolean) => void
    // Expose currentStep directly for convenience, derived from state
    currentStep: OnboardingStep<TContext> | null | undefined
    isCompleted: boolean | undefined
    /** The current error state of the engine, if any. */
    error: Error | null

    /**
     * A convenience method to render the current step's content.
     * This can be used by consumers to render the step UI.
     */
    renderStep: () => React.ReactNode
}

/**
 * Generic context factory function.
 * This approach avoids variance issues by creating a new context for each generic instantiation.
 * @internal This is internal API, use OnboardingContext for the default context.
 */
function createOnboardingContext<TContext extends OnboardingContextType = OnboardingContextType>(): React.Context<
    OnboardingContextValue<TContext> | undefined
> {
    return createContext<OnboardingContextValue<TContext> | undefined>(undefined)
}

/**
 * Default onboarding context for the base OnboardingContextType.
 * This is used by providers and consumers to manage state.
 */
export const OnboardingContext = createOnboardingContext<OnboardingContextType>()

/**
 * Create a typed onboarding context for a specific context type.
 * Useful for cases where you need type-safe context with a custom context shape.
 */
export { createOnboardingContext }

// Re-export for external use
export type { LocalStoragePersistenceOptions }

export interface OnboardingProviderProps<TContext extends OnboardingContextType> extends Omit<
    OnboardingEngineConfig<TContext>,
    'loadData' | 'persistData' | 'clearPersistedData' | 'onFlowComplete' | 'steps'
> {
    children: ReactNode
    localStoragePersistence?: LocalStoragePersistenceOptions
    customOnDataLoad?: UsePersistenceConfig<TContext>['customOnDataLoad']
    customOnDataPersist?: UsePersistenceConfig<TContext>['customOnDataPersist']
    customOnClearPersistedData?: UsePersistenceConfig<TContext>['customOnClearPersistedData']
    onFlowComplete?: (context: TContext) => Promise<void> | void

    /**
     * A registry mapping step types and ids to their React components.
     * This allows users to provide their own custom step components.
     * This prop is now optional and will be overridden by the `OnboardingStep.component` property
     * if defined.
     */
    componentRegistry?: StepComponentRegistry<TContext>

    /**
     * The array of steps to initialize the onboarding flow.
     */
    steps: OnboardingStep<TContext>[]
}

export function OnboardingProvider<TContext extends OnboardingContextType = OnboardingContextType>({
    children,
    steps,
    initialStepId,
    initialContext,
    onFlowComplete: passedOnFlowComplete,
    onStepChange,
    localStoragePersistence,
    customOnDataLoad,
    customOnDataPersist,
    customOnClearPersistedData,
    plugins,
    componentRegistry,
    debug,
    // Forwarded engine config fields (not previously passed through)
    flowId,
    flowName,
    flowVersion,
    flowMetadata,
    publicKey,
    apiHost,
    cloudOptions,
    analytics,
    userId,
}: OnboardingProviderProps<TContext>) {
    // ============================================================================
    // CONFIGURATION VALIDATION (Fail Fast at Provider Level)
    // ============================================================================
    // Validate configuration immediately before any state initialization.
    // This ensures errors surface during provider instantiation, not async.
    const configValidation = useMemo(() => {
        return ConfigurationBuilder.validateConfig({
            steps,
            initialStepId,
            initialContext,
            plugins,
            debug,
        })
    }, [steps, initialStepId, initialContext, plugins, debug])

    // Fail fast: throw error immediately if config is invalid
    if (!configValidation.isValid) {
        throw new Error(`[OnboardJS] Invalid Onboarding Configuration:\n${configValidation.errors.join('\n')}`)
    }

    // Log warnings only in debug mode
    if (configValidation.warnings.length > 0 && debug) {
        console.warn('[OnboardJS] Configuration warnings:', configValidation.warnings)
    }

    // ============================================================================
    // STATE & PERSISTENCE SETUP
    // ============================================================================
    // Component loading state
    const [componentLoading, setComponentLoading] = useState(false)

    // Step-specific data tracking
    const [stepSpecificData, setStepSpecificData] = useState<{
        data: unknown
        isValid: boolean
    }>({ data: null, isValid: true })

    // Setup persistence handlers - memoize config to prevent unnecessary re-initialization
    const { onDataLoad, onDataPersist, onClearPersistedData } = usePersistence({
        localStoragePersistence,
        customOnDataLoad,
        customOnDataPersist,
        customOnClearPersistedData,
    })

    // ============================================================================
    // THREE-TIER CONFIGURATION APPROACH
    // ============================================================================
    // Tier 1: Structural config (triggers engine re-creation on change)
    // These are configuration changes that meaningfully affect the flow structure
    const structuralConfig = useMemo(
        () => ({
            steps,
            initialStepId,
            initialContext,
            debug,
            plugins: plugins || [],
        }),
        [steps, initialStepId, initialContext, debug, plugins]
    )

    // Tier 2: Behavioral config (passed via callbacks, doesn't re-create engine)
    // These are configuration changes that affect behavior but not flow structure.
    // Includes callbacks like onFlowComplete, onStepChange, and persistence handlers.
    const behavioralConfig = useMemo(
        () => ({
            onFlowComplete: passedOnFlowComplete,
            onStepChange,
            loadData: onDataLoad,
            persistData: onDataPersist,
            clearPersistedData: onClearPersistedData,
        }),
        [passedOnFlowComplete, onStepChange, onDataLoad, onDataPersist, onClearPersistedData]
    )

    // Tier 3: Cloud/Analytics config (additional engine configuration)
    // These are settings that don't affect core flow but enhance analytics and cloud features
    const cloudConfig = useMemo(
        () => ({
            flowId,
            flowName,
            flowVersion,
            flowMetadata,
            publicKey,
            apiHost,
            cloudOptions,
            analytics,
            userId,
        }),
        [flowId, flowName, flowVersion, flowMetadata, publicKey, apiHost, cloudOptions, analytics, userId]
    )

    // Build engine configuration by merging all three tiers.
    // This reduces dependency array complexity from 19 to just 3 dependencies.
    const engineConfig: OnboardingEngineConfig<TContext> = useMemo(
        () => ({
            ...structuralConfig,
            ...behavioralConfig,
            ...cloudConfig,
        }),
        [structuralConfig, behavioralConfig, cloudConfig]
    )

    // Initialize and manage engine lifecycle
    const { engine, isReady, error: engineError } = useEngineLifecycle(engineConfig)

    // Synchronize engine state to React state
    const engineState = useEngineState(engine, isReady)

    // Engine processing state (navigation, persistence, etc.)
    const [engineProcessing, setEngineProcessing] = useState(false)

    // Setup step rendering
    const handleDataChange = useCallback((data: unknown, isValid: boolean) => {
        setStepSpecificData({ data, isValid })
    }, [])

    const renderStep = useStepRenderer({
        engineState,
        componentRegistry,
        onDataChange: handleDataChange,
    })

    // Setup engine actions with engine processing state callback
    const actions = useEngineActions<TContext>({
        engine,
        isEngineReady: isReady,
        stepData: stepSpecificData,
        onEngineProcessingChange: setEngineProcessing,
    })

    // Compute granular loading state
    const isHydrating = engineState?.isHydrating ?? false
    const isEngineProcessing = engineProcessing || (engineState?.isLoading ?? false)
    const isComponentProcessing = componentLoading

    const loading = useMemo(
        () => createLoadingState(isHydrating, isEngineProcessing, isComponentProcessing),
        [isHydrating, isEngineProcessing, isComponentProcessing]
    )

    // Deprecated: kept for backward compatibility, maps to loading.isAnyLoading
    const isLoading = loading.isAnyLoading

    // Build context value
    const value = useMemo(
        (): OnboardingContextValue<TContext> => ({
            engine: isReady ? engine : null,
            engineInstanceId: isReady ? engine?.instanceId : undefined,
            state: isReady ? engineState : null,
            loading,
            isLoading,
            setComponentLoading,
            currentStep: (engineState?.currentStep as OnboardingStep<TContext>) ?? null,
            isCompleted: engineState?.isCompleted,
            error: engineError ?? engineState?.error ?? null,
            renderStep,
            ...actions,
        }),
        [engine, engineState, loading, isLoading, isReady, engineError, actions, renderStep]
    )

    // Type assertion explanation:
    // OnboardingContext is typed to OnboardingContextType (the base type) for backwards compatibility.
    // However, our value is OnboardingContextValue<TContext> where TContext extends OnboardingContextType.
    //
    // TypeScript won't allow the direct assignment due to contravariance in the engine's method parameters:
    // - OnboardingEngine<TContext> has methods that accept OnboardingPlugin<TContext> (contravariant position)
    // - OnboardingEngine<OnboardingContextType> has methods that accept OnboardingPlugin<OnboardingContextType>
    // - These are incompatible in TypeScript's type system, even though TContext extends OnboardingContextType
    //
    // At runtime, this is safe because:
    // 1. The context provider is used with a generic parameter that matches the value's type
    // 2. The consumer (useOnboarding<TContext>) casts the result back to the correct type
    // 3. TypeScript enforces generic constraints, so TContext is always compatible with OnboardingContextType
    //
    // This is the standard pattern for generic Context in React with TypeScript.
    const contextValue = value as unknown as OnboardingContextValue<OnboardingContextType>

    return <OnboardingContext.Provider value={contextValue}>{children}</OnboardingContext.Provider>
}
