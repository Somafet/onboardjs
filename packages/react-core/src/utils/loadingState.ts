// @onboardjs/react/src/utils/loadingState.ts
'use client'

/**
 * Represents the different reasons why the onboarding UI might be in a loading state.
 * Returns `null` if no loading is occurring.
 */
export type LoadingReason = 'hydrating' | 'engine-processing' | 'component-processing' | null

/**
 * Granular loading state breakdown for the onboarding flow.
 * Provides clear visibility into what is causing the UI to be blocked.
 */
export interface LoadingState {
    /** Engine is initializing from persisted data */
    isHydrating: boolean
    /** Engine is executing async operations (navigation, persistence, etc.) */
    isEngineProcessing: boolean
    /** Current step component is validating or fetching data */
    isComponentProcessing: boolean
    /** Any of the above: convenient for "disable UI" logic */
    isAnyLoading: boolean
}

/**
 * Determines the primary reason for the current loading state.
 * Useful for displaying different UI feedback based on loading context.
 *
 * @param loading - The current loading state object
 * @returns The primary loading reason, or `null` if not loading
 *
 * @example
 * ```tsx
 * const { loading } = useOnboarding()
 * const reason = getLoadingReason(loading)
 *
 * if (reason === 'hydrating') {
 *   return <SkeletonLoader /> // Initial data load
 * } else if (reason === 'engine-processing') {
 *   return <StepTransition /> // Navigation in progress
 * } else if (reason === 'component-processing') {
 *   return <ValidationSpinner /> // Form validation
 * }
 * ```
 */
export function getLoadingReason(loading: LoadingState): LoadingReason {
    // Priority order: hydrating > engine processing > component processing
    if (loading.isHydrating) return 'hydrating'
    if (loading.isEngineProcessing) return 'engine-processing'
    if (loading.isComponentProcessing) return 'component-processing'
    return null
}

/**
 * Creates a loading state object from individual state values.
 * Utility function for composing loading state in the provider.
 *
 * @param isHydrating - Whether the engine is hydrating from persisted data
 * @param isEngineProcessing - Whether the engine is performing async operations
 * @param isComponentProcessing - Whether a step component is processing
 * @returns A complete LoadingState object
 */
export function createLoadingState(
    isHydrating: boolean,
    isEngineProcessing: boolean,
    isComponentProcessing: boolean
): LoadingState {
    return {
        isHydrating,
        isEngineProcessing,
        isComponentProcessing,
        isAnyLoading: isHydrating || isEngineProcessing || isComponentProcessing,
    }
}

/**
 * Creates an initial loading state (all values false).
 */
export function createInitialLoadingState(): LoadingState {
    return {
        isHydrating: false,
        isEngineProcessing: false,
        isComponentProcessing: false,
        isAnyLoading: false,
    }
}
