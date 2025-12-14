// @onboardjs/react/src/hooks/useOnboarding.ts
'use client'

import { useContext, useEffect, useRef } from 'react'
import { OnboardingContext, OnboardingContextValue } from '../context/OnboardingProvider'
import { UseOnboardingOptions } from './useOnboarding.types'
import { FlowCompletedEvent, OnboardingContext as OnboardingContextType } from '@onboardjs/core'

/**
 * Hook for accessing the onboarding flow state and actions.
 *
 * @template TContext - The type of context used in the onboarding flow
 * @param options - Optional configuration for event handlers
 * @returns The onboarding context value containing state, loading, and actions
 *
 * @example
 * ```tsx
 * const { state, loading, next, previous, renderStep } = useOnboarding()
 *
 * // Access granular loading states
 * if (loading.isHydrating) return <SkeletonLoader />
 * if (loading.isEngineProcessing) return <TransitionSpinner />
 *
 * // Navigate through the flow
 * const handleNext = () => next({ fieldValue: 'user input' })
 *
 * // Render current step
 * return (
 *   <div>
 *     {renderStep()}
 *     <button onClick={handleNext} disabled={loading.isAnyLoading}>
 *       Next
 *     </button>
 *   </div>
 * )
 * ```
 *
 * @throws Error if used outside of an OnboardingProvider
 */
export function useOnboarding<
    TContext extends OnboardingContextType = OnboardingContextType, // Default generic
>(options?: UseOnboardingOptions<TContext>): OnboardingContextValue<TContext> {
    const contextValue = useContext(OnboardingContext) as OnboardingContextValue<TContext> | undefined
    if (contextValue === undefined) {
        throw new Error('useOnboarding must be used within an OnboardingProvider')
    }

    const {
        engine,
        state,
        loading,
        isLoading,
        skip,
        next,
        previous,
        goToStep,
        reset,
        setComponentLoading,
        updateContext,
        error,
        renderStep,
    } = contextValue

    // Use refs to store the latest callbacks to avoid re-subscribing unnecessarily
    const onFlowCompletedRef = useRef(options?.onFlowCompleted)
    const onStepChangeRef = useRef(options?.onStepChange)

    // Update refs when callback props change
    useEffect(() => {
        onFlowCompletedRef.current = options?.onFlowCompleted
    }, [options?.onFlowCompleted])

    useEffect(() => {
        onStepChangeRef.current = options?.onStepChange
    }, [options?.onStepChange])

    // Effect for onFlowComplete
    useEffect(() => {
        if (!engine || !onFlowCompletedRef.current) {
            return
        }

        const listener = (event: FlowCompletedEvent<TContext>) => {
            if (onFlowCompletedRef.current) {
                onFlowCompletedRef.current(event)
            }
        }

        const unsubscribe = engine.addFlowCompletedListener(listener)

        return () => {
            if (unsubscribe) {
                unsubscribe()
            }
        }
    }, [engine])

    // Effect for onStepChange
    useEffect(() => {
        if (!engine || !onStepChangeRef.current) {
            return
        }
        const unsubscribe = engine.addAfterStepChangeListener(({ oldStep, newStep, context }) => {
            if (onStepChangeRef.current) {
                onStepChangeRef.current(newStep, oldStep, context)
            }
        })
        return () => {
            if (unsubscribe) unsubscribe()
        }
    }, [engine])

    // Derive shorthand status values for convenience
    const isCompleted = state?.isCompleted ?? false
    const currentStep = state?.currentStep

    return {
        engine,
        state,
        loading,
        isLoading,
        skip,
        next,
        previous,
        goToStep,
        reset,
        setComponentLoading,
        updateContext,
        renderStep,
        isCompleted,
        currentStep,
        error,
    }
}
