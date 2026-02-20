// @onboardjs/react/src/hooks/internal/useEngineLifecycle.ts
'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { OnboardingEngine, OnboardingEngineConfig, OnboardingContext as OnboardingContextType } from '@onboardjs/core'
import { createConfigHash } from '../../utils/configHash'

export interface UseEngineLifecycleResult<TContext extends OnboardingContextType> {
    engine: OnboardingEngine<TContext> | null
    isReady: boolean
    error: Error | null
}

/**
 * Manages engine creation, initialization, and cleanup.
 *
 * IMPORTANT: Configuration validation is now performed at the OnboardingProvider level
 * with fail-fast semantics. This function assumes a valid configuration and focuses
 * solely on engine lifecycle management.
 *
 * Uses configuration hashing to ensure engine is only recreated when meaningful
 * configuration changes occur (not on callback reference changes).
 */
export function useEngineLifecycle<TContext extends OnboardingContextType>(
    config: OnboardingEngineConfig<TContext>
): UseEngineLifecycleResult<TContext> {
    const [engine, setEngine] = useState<OnboardingEngine<TContext> | null>(null)
    const [isReady, setIsReady] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    // Keep a ref to the latest config so we can access it in the effect
    // without adding config to the dependency array (which would cause
    // engine recreation on every callback reference change)
    const configRef = useRef(config)
    configRef.current = config

    // Create a stable configuration hash that only changes when meaningful config changes
    // This prevents engine re-creation when only callback references change
    const configHash = useMemo(
        () =>
            createConfigHash({
                steps: config.steps,
                initialStepId: config.initialStepId,
                initialContext: config.initialContext,
                debug: config.debug,
                plugins: config.plugins,
                analytics: config.analytics,
                publicKey: config.publicKey,
                apiHost: config.apiHost,
                userId: config.userId,
            }),
        [
            config.steps,
            config.initialStepId,
            config.initialContext,
            config.debug,
            config.plugins,
            config.analytics,
            config.publicKey,
            config.apiHost,
            config.userId,
        ]
    )

    useEffect(() => {
        // Use effect-scoped flag instead of useRef to prevent race conditions
        // in React 18 Strict Mode. Each effect invocation gets its own flag,
        // ensuring orphaned promises from previous effect runs cannot update state.
        let isEffectActive = true

        setIsReady(false)
        setEngine(null)
        setError(null)

        // Note: Configuration validation happens at OnboardingProvider level (fail-fast).
        // By the time we reach this hook, the config is guaranteed to be valid.

        let currentEngine: OnboardingEngine<TContext> | null = null

        // Use configRef.current to get the latest config without depending on config object reference
        const currentConfig = configRef.current

        try {
            currentEngine = new OnboardingEngine<TContext>(currentConfig)

            if (isEffectActive) {
                setEngine(currentEngine)
            }

            currentEngine
                .ready()
                .then(() => {
                    // Only update state if THIS specific effect is still active.
                    // This prevents race conditions in React 18 Strict Mode where
                    // Engine 1's promise could resolve after Engine 2 is created.
                    if (isEffectActive && currentEngine) {
                        setIsReady(true)
                        setError(null)
                    }
                })
                .catch((initError) => {
                    console.error('[OnboardJS] Engine initialization failed:', initError)
                    if (isEffectActive) {
                        setError(initError instanceof Error ? initError : new Error(String(initError)))
                        setIsReady(false)
                    }
                })
        } catch (engineError) {
            console.error('[OnboardJS] Error creating engine:', engineError)
            if (isEffectActive) {
                setError(engineError instanceof Error ? engineError : new Error(String(engineError)))
            }
        }

        return () => {
            // Mark this effect instance as inactive. Any pending promises
            // from this effect will see isEffectActive as false and skip state updates.
            isEffectActive = false
            // Engine cleanup is handled by the engine itself
        }
        // Only re-run when the configuration hash changes (meaningful structural changes)
        // We use configRef to access the latest config without adding it to dependencies,
        // which would cause engine recreation on every callback reference change
    }, [configHash])

    return { engine, isReady, error }
}
