// @onboardjs/react/src/hooks/internal/useSuspenseEngine.ts
'use client'

import { useRef, useMemo } from 'react'
import {
    OnboardingEngine,
    OnboardingEngineConfig,
    OnboardingContext as OnboardingContextType,
    ConfigurationBuilder,
} from '@onboardjs/core'
import { createConfigHash } from '../../utils/configHash'

/**
 * Cache entry for a suspended engine initialization.
 * Uses a status discriminated union for type-safe state management.
 */
type SuspenseCache =
    | { status: 'pending'; promise: Promise<void> }
    | { status: 'resolved'; engine: OnboardingEngine<any> }
    | { status: 'rejected'; error: Error }

/**
 * Global cache for suspended engine initializations.
 * Keyed by configuration hash to support multiple providers.
 */
const suspenseCache = new Map<string, SuspenseCache>()

/**
 * Clears the suspense cache for a given configuration hash.
 * Useful for testing and manual cache invalidation.
 */
export function clearSuspenseCache(configHash?: string): void {
    if (configHash) {
        suspenseCache.delete(configHash)
    } else {
        suspenseCache.clear()
    }
}

export interface UseSuspenseEngineResult<TContext extends OnboardingContextType> {
    engine: OnboardingEngine<TContext>
    isReady: true
    error: null
}

/**
 * Suspense-enabled hook for engine initialization.
 * Throws a Promise during initialization to trigger React Suspense.
 *
 * @throws {Promise} During initialization - caught by Suspense boundary
 * @throws {Error} If initialization fails - caught by Error Boundary
 *
 * @example
 * ```tsx
 * function OnboardingUI() {
 *   // This will suspend until engine is ready
 *   const { engine } = useSuspenseEngine(config);
 *   // Engine is guaranteed to be ready here
 *   return <div>{engine.getState().currentStep?.id}</div>;
 * }
 *
 * function App() {
 *   return (
 *     <Suspense fallback={<Loading />}>
 *       <OnboardingUI />
 *     </Suspense>
 *   );
 * }
 * ```
 */
export function useSuspenseEngine<TContext extends OnboardingContextType>(
    config: OnboardingEngineConfig<TContext>
): UseSuspenseEngineResult<TContext> {
    // Track the engine instance for cleanup
    const engineRef = useRef<OnboardingEngine<TContext> | null>(null)

    // Create a stable configuration hash
    const configHash = useMemo(
        () =>
            createConfigHash({
                steps: config.steps,
                initialStepId: config.initialStepId,
                initialContext: config.initialContext,
                debug: config.debug,
                plugins: config.plugins,
            }),
        [config.steps, config.initialStepId, config.initialContext, config.debug, config.plugins]
    )

    // Check for SSR environment - don't throw Promise on server
    if (typeof window === 'undefined') {
        throw new Error(
            '[OnboardJS] useSuspenseEngine cannot be used during server-side rendering. ' +
                'Wrap your component in a client-side boundary or use the regular useEngineLifecycle hook.'
        )
    }

    // Check cache for existing initialization
    const cached = suspenseCache.get(configHash)

    if (cached) {
        switch (cached.status) {
            case 'pending':
                // Re-throw the same promise to suspend
                throw cached.promise
            case 'rejected':
                // Re-throw the error for Error Boundary
                throw cached.error
            case 'resolved':
                // Return the ready engine (type assertion is safe because configHash is unique per config)
                engineRef.current = cached.engine as OnboardingEngine<TContext>
                return {
                    engine: cached.engine as OnboardingEngine<TContext>,
                    isReady: true,
                    error: null,
                }
        }
    }

    // Validate configuration before creating engine
    const validation = ConfigurationBuilder.validateConfig(config)
    if (!validation.isValid) {
        const validationError = new Error(`Invalid Onboarding Configuration: ${validation.errors.join(', ')}`)
        suspenseCache.set(configHash, { status: 'rejected', error: validationError })
        throw validationError
    }

    // Create new engine and start initialization
    let engine: OnboardingEngine<TContext>
    try {
        engine = new OnboardingEngine<TContext>(config)
        engineRef.current = engine
    } catch (creationError) {
        const error = creationError instanceof Error ? creationError : new Error(String(creationError))
        suspenseCache.set(configHash, { status: 'rejected', error })
        throw error
    }

    // Create the initialization promise
    const promise = engine
        .ready()
        .then(() => {
            // Update cache to resolved state
            suspenseCache.set(configHash, { status: 'resolved', engine })
        })
        .catch((initError) => {
            // Update cache to rejected state
            const error = initError instanceof Error ? initError : new Error(String(initError))
            suspenseCache.set(configHash, { status: 'rejected', error })
            throw error
        })

    // Cache the pending state and throw to suspend
    suspenseCache.set(configHash, { status: 'pending', promise })
    throw promise
}
