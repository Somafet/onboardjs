import { OnboardingStep } from '@onboardjs/core'

export const getStepLabel = (step: OnboardingStep<any>): string => {
    const payload = step.payload

    if (payload?.title) return payload.title
    if (payload?.label) return payload.label
    if (payload?.question) return payload.question
    if (payload?.componentKey) return payload.componentKey

    return String(step.id)
}

export const generateStepId = () => {
    return `step-${Math.random().toString(36).substr(2, 6)}`
}

export const getStepDescription = (step: OnboardingStep<any>): string | undefined => {
    const payload = step.payload as any

    if (payload?.description) return payload.description
    if (payload?.subtitle) return payload.subtitle
    if (payload?.options && Array.isArray(payload.options)) {
        return `${payload.options.length} options`
    }
    if (payload?.items && Array.isArray(payload.items)) {
        return `${payload.items.length} items`
    }

    return undefined
}

export const getDefaultPayload = (stepType: string): Record<string, any> => {
    switch (stepType) {
        case 'SINGLE_CHOICE':
        case 'MULTIPLE_CHOICE':
            return { options: [] }
        case 'CHECKLIST':
            return { dataKey: 'checklist_data', items: [] }
        case 'CUSTOM_COMPONENT':
            return { componentKey: 'DefaultComponent' }
        default:
            return {}
    }
}
