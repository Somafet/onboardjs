/**
 * This file is used for demonstrating A/B testing with PostHog in an onboarding flow.
 * It includes a progress indicator that changes based on the feature flag.
 *
 * Ensure you have the "motivational-progress-indicator" experiment flag set up in PostHog.
 * The progress indicator will show motivational messages and a progress bar based on the user's current step.
 */

'use client'

import { useOnboarding } from '@onboardjs/react'
import { useEffect, useState } from 'react'
import { Progress } from '../ui/progress'
import posthog from 'posthog-js'

const motivationalCopy = [
    'Let’s get started! 🚀',
    'You’re making great progress! 💪',
    'Almost there! 🎯',
    'All set! 🎉',
]

export default function OnboardingProgress() {
    const { state, currentStep } = useOnboarding()
    const withProgress = posthog.getFeatureFlag('motivational-progress-indicator') === 'with-progress'

    const [progress, setProgress] = useState(0)

    useEffect(() => {
        const totalSteps = state?.totalSteps || 1 // Avoid division by zero
        const currentStep = state?.currentStepNumber || 0
        const newProgress = (currentStep / totalSteps) * 100

        const timer = setTimeout(() => setProgress(newProgress), 300)
        return () => clearTimeout(timer)
    }, [state])

    if (!withProgress) {
        return null
    }

    return (
        <>
            {state && (
                <div className="mb-6 w-full">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">
                            Step {currentStep ? state.currentStepNumber : state.totalSteps + 1} of{' '}
                            {state.totalSteps + 1}
                        </span>
                        <span className="text-sm text-gray-500">
                            {motivationalCopy[currentStep ? state.currentStepNumber - 1 : state.totalSteps]}
                        </span>
                    </div>
                    <Progress value={currentStep ? progress : 100} />
                </div>
            )}
        </>
    )
}
