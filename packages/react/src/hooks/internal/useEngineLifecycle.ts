// @onboardjs/react/src/hooks/internal/useEngineLifecycle.ts
'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
    OnboardingEngine,
    OnboardingEngineConfig,
    OnboardingContext as OnboardingContextType,
    ConfigurationBuilder,
} from '@onboardjs/core'
import { createConfigHash } from '../../utils/configHash'

export interface UseEngineLifecycleResult<TContext extends OnboardingContextType> {
    engine: OnboardingEngine<TContext> | null
    isReady: boolean
    error: Error | null
}

/**
 * Manages engine creation, initialization, and cleanup.
 * Uses configuration hashing to ensure engine is only recreated when meaningful
 * configuration changes occur (not on callback reference changes).
 */
export function useEngineLifecycle<TContext extends OnboardingContextType>(
    config: OnboardingEngineConfig<TContext>
): UseEngineLifecycleResult<TContext> {
    const [engine, setEngine] = useState<OnboardingEngine<TContext> | null>(null)
    const [isReady, setIsReady] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    // Track if component is mounted to prevent state updates after unmount
    const isMountedRef = useRef(true)

    // Store the latest config in a ref so we can access it without triggering re-initialization
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
            }),
        [config.steps, config.initialStepId, config.initialContext, config.debug, config.plugins]
    )

    useEffect(() => {
        isMountedRef.current = true
        setIsReady(false)
        setEngine(null)
        setError(null)

        // Use the latest config from ref to ensure we have current callbacks
        const currentConfig = configRef.current

        // Validate configuration before creating engine
        const validation = ConfigurationBuilder.validateConfig(currentConfig)
        if (!validation.isValid) {
            const validationError = new Error(`Invalid Onboarding Configuration: ${validation.errors.join(', ')}`)
            console.error('[OnboardJS] Configuration validation failed:', validationError.message)
            if (isMountedRef.current) {
                setError(validationError)
            }
            return
        }

        let currentEngine: OnboardingEngine<TContext> | null = null

        try {
            currentEngine = new OnboardingEngine<TContext>(currentConfig)

            if (isMountedRef.current) {
                setEngine(currentEngine)
            }

            currentEngine
                .ready()
                .then(() => {
                    if (isMountedRef.current && currentEngine) {
                        setIsReady(true)
                        setError(null)
                    }
                })
                .catch((initError) => {
                    console.error('[OnboardJS] Engine initialization failed:', initError)
                    if (isMountedRef.current) {
                        setError(initError instanceof Error ? initError : new Error(String(initError)))
                        setIsReady(false)
                    }
                })
        } catch (engineError) {
            console.error('[OnboardJS] Error creating engine:', engineError)
            if (isMountedRef.current) {
                setError(engineError instanceof Error ? engineError : new Error(String(engineError)))
            }
        }

        return () => {
            isMountedRef.current = false
            // Engine cleanup is handled by the engine itself
        }
        // Only re-run when the configuration hash changes (meaningful changes)
    }, [configHash])

    return { engine, isReady, error }
}
