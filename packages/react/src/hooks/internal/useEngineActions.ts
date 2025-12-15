// @onboardjs/react/src/hooks/internal/useEngineActions.ts
'use client'

import { useCallback } from 'react'
import { OnboardingEngine, OnboardingEngineConfig, OnboardingContext as OnboardingContextType } from '@onboardjs/core'

export interface EngineActions<TContext extends OnboardingContextType> {
    next: (stepSpecificData?: Record<string, unknown>) => Promise<void>
    previous: () => Promise<void>
    skip: () => Promise<void>
    goToStep: (stepId: string, stepSpecificData?: Record<string, unknown>) => Promise<void>
    updateContext: (newContextData: Partial<TContext>) => Promise<void>
    reset: (newConfig?: Partial<OnboardingEngineConfig<TContext>>) => Promise<void>
}

export interface UseEngineActionsConfig<TContext extends OnboardingContextType> {
    engine: OnboardingEngine<TContext> | null
    isEngineReady: boolean
    stepData: { data: unknown; isValid: boolean }
    /**
     * Callback to update engine processing state.
     * Called with `true` when an engine action starts, `false` when it completes.
     */
    onEngineProcessingChange: (processing: boolean) => void
}

/**
 * Wraps engine methods with loading state management.
 * Single responsibility: action execution with engine processing state.
 *
 * Sets `isEngineProcessing` to true during async operations like:
 * - Navigation (next, previous, skip, goToStep)
 * - Context updates
 * - Engine reset
 */
export function useEngineActions<TContext extends OnboardingContextType>(
    config: UseEngineActionsConfig<TContext>
): EngineActions<TContext> {
    const { engine, isEngineReady, stepData, onEngineProcessingChange } = config

    const next = useCallback(
        async (overrideData?: Record<string, unknown>) => {
            if (!engine || !isEngineReady) return

            const dataToPass =
                overrideData !== undefined ? overrideData : (stepData.data as Record<string, unknown> | undefined)

            if (!stepData.isValid && overrideData === undefined) {
                console.warn(
                    '[OnboardJS] next() called, but the current step component reports invalid state. Navigation blocked.'
                )
                return
            }

            onEngineProcessingChange(true)
            try {
                await engine.next(dataToPass)
            } finally {
                onEngineProcessingChange(false)
            }
        },
        [engine, isEngineReady, stepData, onEngineProcessingChange]
    )

    const previous = useCallback(async () => {
        if (!engine || !isEngineReady) return

        onEngineProcessingChange(true)
        try {
            await engine.previous()
        } finally {
            onEngineProcessingChange(false)
        }
    }, [engine, isEngineReady, onEngineProcessingChange])

    const skip = useCallback(async () => {
        if (!engine || !isEngineReady) return

        onEngineProcessingChange(true)
        try {
            await engine.skip()
        } finally {
            onEngineProcessingChange(false)
        }
    }, [engine, isEngineReady, onEngineProcessingChange])

    const goToStep = useCallback(
        async (stepId: string, data?: Record<string, unknown>) => {
            if (!engine || !isEngineReady) return

            onEngineProcessingChange(true)
            try {
                await engine.goToStep(stepId, data)
            } finally {
                onEngineProcessingChange(false)
            }
        },
        [engine, isEngineReady, onEngineProcessingChange]
    )

    const updateContext = useCallback(
        async (newContextData: Partial<TContext>) => {
            if (!engine || !isEngineReady) return

            onEngineProcessingChange(true)
            try {
                await engine.updateContext(newContextData)
            } finally {
                onEngineProcessingChange(false)
            }
        },
        [engine, isEngineReady, onEngineProcessingChange]
    )

    const reset = useCallback(
        async (newConfig?: Partial<OnboardingEngineConfig<TContext>>) => {
            if (!engine) return

            onEngineProcessingChange(true)
            try {
                await engine.reset(newConfig)
            } finally {
                onEngineProcessingChange(false)
            }
        },
        [engine, onEngineProcessingChange]
    )

    return {
        next,
        previous,
        skip,
        goToStep,
        updateContext,
        reset,
    }
}
