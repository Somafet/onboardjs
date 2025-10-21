'use client'

import { useCallback, useEffect } from 'react'
import { useOnboarding } from './useOnboarding'
import { AhaTracker, TrackAhaParams, aha, type OnboardingContext as OnboardingContextType } from '@onboardjs/core'

/**
 * Context and engine-aware version of aha moment tracking.
 *
 * This hook automatically:
 * - Links the AhaTracker to the current OnboardingEngine for auto user_id detection
 * - Provides a wrapped `trackAha` function that includes engine context
 * - Handles initialization and cleanup
 *
 * Usage:
 * ```tsx
 * const { trackAha } = useOnboardingAnalytics()
 *
 * const handleClick = async () => {
 *   await trackAha({
 *     aha_type: 'value_demonstration',
 *     context: { feature_name: 'my_feature' }
 *   })
 * }
 * ```
 *
 * @returns Object with `trackAha` function and direct `aha` export
 */
export function useOnboardingAnalytics<TContext extends OnboardingContextType = OnboardingContextType>() {
    const { engine } = useOnboarding<TContext>()

    // Initialize and link tracker to engine on mount
    useEffect(() => {
        if (!engine) return

        const tracker = AhaTracker.getInstance({
            debug: true,
        })

        const context = engine.getContext()
        const state = engine.getState()

        // Link tracker to engine for auto user_id detection
        tracker.linkToEngine({
            getUserId: () => context.userId || context.flowData?.userId || undefined,
            getFlowData: () => ({
                flow_id: engine.getFlowId() || undefined,
                flow_version: engine.getFlowVersion() || undefined,
                current_step_id: state.currentStep?.id?.toString(),
                current_step_index: state.currentStepNumber,
                total_steps: engine.getRelevantSteps().length,
            }),
        })
    }, [engine])

    /**
     * Track an aha moment with automatic engine context.
     * The user_id is auto-detected from the linked engine. But can be overridden in params.
     *
     * @param params Track aha parameters
     * @returns Promise that resolves when tracking is complete
     *
     * @example
     * ```tsx
     * await trackAha({
     *   aha_type: 'workflow_completion',
     *   journey_stage: 'adoption',
     *   context: {
     *     feature_name: 'form_completion',
     *     product_area: 'onboarding'
     *   }
     * })
     * ```
     */
    const trackAha = useCallback(async (params: TrackAhaParams) => {
        return aha(params)
    }, [])

    return {
        trackAha,
        aha,
    }
}

export type { TrackAhaParams }
