import { OnboardingStep } from '@onboardjs/core'

export const steps: OnboardingStep[] = [
    {
        id: 'welcome',
        type: 'INFORMATION',
        payload: {
            name: 'Add projects',
        },
    },
    {
        id: 'budget',
        type: 'INFORMATION',
        payload: {
            name: 'Define work budget',
        },
        nextStep: null,
    },
]
