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
    onLoadingChange: (loading: boolean) => void
}

/**
 * Wraps engine methods with loading state management.
 * Single responsibility: action execution with loading states.
 */
export function useEngineActions<TContext extends OnboardingContextType>(
    config: UseEngineActionsConfig<TContext>
): EngineActions<TContext> {
    const { engine, isEngineReady, stepData, onLoadingChange } = config

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

            onLoadingChange(true)
            try {
                await engine.next(dataToPass)
            } finally {
                onLoadingChange(false)
            }
        },
        [engine, isEngineReady, stepData, onLoadingChange]
    )

    const previous = useCallback(async () => {
        if (!engine || !isEngineReady) return

        onLoadingChange(true)
        try {
            await engine.previous()
        } finally {
            onLoadingChange(false)
        }
    }, [engine, isEngineReady, onLoadingChange])

    const skip = useCallback(async () => {
        if (!engine || !isEngineReady) return

        onLoadingChange(true)
        try {
            await engine.skip()
        } finally {
            onLoadingChange(false)
        }
    }, [engine, isEngineReady, onLoadingChange])

    const goToStep = useCallback(
        async (stepId: string, data?: Record<string, unknown>) => {
            if (!engine || !isEngineReady) return

            onLoadingChange(true)
            try {
                await engine.goToStep(stepId, data)
            } finally {
                onLoadingChange(false)
            }
        },
        [engine, isEngineReady, onLoadingChange]
    )

    const updateContext = useCallback(
        async (newContextData: Partial<TContext>) => {
            if (!engine || !isEngineReady) return

            onLoadingChange(true)
            try {
                await engine.updateContext(newContextData)
            } finally {
                onLoadingChange(false)
            }
        },
        [engine, isEngineReady, onLoadingChange]
    )

    const reset = useCallback(
        async (newConfig?: Partial<OnboardingEngineConfig<TContext>>) => {
            if (!engine) return

            onLoadingChange(true)
            try {
                await engine.reset(newConfig)
            } finally {
                onLoadingChange(false)
            }
        },
        [engine, onLoadingChange]
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
