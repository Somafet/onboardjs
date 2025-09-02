'use client'

// config/demoOnboardingConfig.ts
import { StepComponentRegistry } from '@onboardjs/react'
import { OnboardingStep } from '@onboardjs/core'

// Import custom step components
import DemoWelcomeStep from '@/components/onboarding/DemoWelcomeStep'
import { simpleFlowRegistry, simpleFlowSteps } from './simple-flow/simple-flow-config'
import { User } from '@supabase/supabase-js'
import { conditionalFlowRegistry, conditionalFlowSteps } from './conditional-flow/conditional-flow-config'
import { persistenceFlowSteps, persistenceRegistry } from './peristence-flow/persistence-flow-config'

export type AppOnboardingContext = {
    flowData: {
        selectedOption?: string // Store the selected option from the welcome step
        userType?: string
        userName?: string
        orgName?: string
    }
    currentUser?: User
}

export const commonFlowSteps: OnboardingStep<AppOnboardingContext>[] = [
    {
        id: 'welcome',
        type: 'CUSTOM_COMPONENT', // All steps will be custom for this demo
        payload: {
            componentKey: 'welcome',
            title: 'Build Your Onboarding Flow',
            description: 'We just need a few details to better tailor your experience.',
            mainText: 'Welcome to OnboardJs!',
            subText:
                'Thanks for checking out OnboardJS. In just a few steps, you’ll see how easy it is to build powerful, custom onboarding flows for your own apps.',
            ctaLabel: "Let's Go!",
            options: [
                {
                    id: 'simple-flow',
                    label: 'Simple Onboarding Flow',
                    value: 'simple-flow',
                    description: 'See how a simple onboarding flow works',
                },
                {
                    id: 'conditional-flow',
                    label: 'Conditional Onboarding Flow',
                    value: 'conditional-flow',
                    description: 'See how a conditional onboarding flow works',
                },
                {
                    id: 'persistence',
                    label: 'Persistent w/ Supabase',
                    value: 'persistence',
                    description: 'See how persistence works with Supabase',
                },
            ],
        },
        meta: {
            // We disable the CTA for this step as we want to position the CTA button in the step component itself
            disableCta: true,
        },
    },
    ...simpleFlowSteps,
    ...conditionalFlowSteps,
    ...persistenceFlowSteps,
]

export const commonRegistry: StepComponentRegistry<AppOnboardingContext> = {
    welcome: DemoWelcomeStep,
    ...simpleFlowRegistry,
    ...conditionalFlowRegistry,
    ...persistenceRegistry,
}
