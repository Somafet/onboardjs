// @onboardjs/react/src/hooks/internal/useEngineState.ts
'use client'

import { useState, useEffect } from 'react'
import { OnboardingEngine, EngineState, OnboardingContext as OnboardingContextType } from '@onboardjs/core'

/**
 * Synchronizes engine state to React state via event listeners.
 * Single responsibility: state synchronization only.
 */
export function useEngineState<TContext extends OnboardingContextType>(
    engine: OnboardingEngine<TContext> | null,
    isEngineReady: boolean
): EngineState<TContext> | null {
    const [engineState, setEngineState] = useState<EngineState<TContext> | null>(null)

    useEffect(() => {
        if (!engine || !isEngineReady) {
            setEngineState(null)
            return
        }

        // Set initial state
        setEngineState(engine.getState())

        // Subscribe to state changes
        const unsubscribe = engine.addEventListener('stateChange', (event) => {
            setEngineState(event.state)
        })

        return () => {
            if (unsubscribe) {
                unsubscribe()
            }
        }
    }, [engine, isEngineReady])

    return engineState
}
