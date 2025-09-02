'use client'

import { OnboardingStep } from '@onboardjs/core'
import { OnboardingProvider } from '@onboardjs/react'
import { PropsWithChildren } from 'react'
import FirstStep from './first-step'
import PersonaStep from './persona-step'
import { ProjectSetupStep } from './project-setup-step'
import { createPostHogPlugin } from '@onboardjs/posthog-plugin'
import posthog from 'posthog-js'

const steps: OnboardingStep[] = [
    {
        id: 'first-step',
    },
    {
        id: 'persona-step',
        nextStep: 'project-setup-step',
    },
    {
        id: 'project-setup-step',
    },
]

const componentRegistry = {
    'first-step': FirstStep,
    'persona-step': PersonaStep,
    'project-setup-step': ProjectSetupStep,
}

const posthogPlugin = createPostHogPlugin({
    // Import the initialised PostHog instance
    posthogInstance: posthog,
    // You can specify the feature flags you want to track
    // This will automatically track the feature flags used in the onboarding process
    experimentFlags: ['motivational-progress-indicator'],
    // Enable experiment tracking to capture user interactions with the onboarding steps
    enableExperimentTracking: true,
})

export default function OnboardingWrapper({ children }: PropsWithChildren) {
    return (
        <OnboardingProvider steps={steps} componentRegistry={componentRegistry} plugins={[posthogPlugin]}>
            {children}
        </OnboardingProvider>
    )
}
