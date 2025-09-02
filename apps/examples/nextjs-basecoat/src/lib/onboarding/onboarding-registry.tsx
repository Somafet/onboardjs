'use client'

import AddProjectsStep from '@/components/onboarding/steps/add-projects-step'
import BudgetStep from '@/components/onboarding/steps/budget-step'
import CompleteStep from '@/components/onboarding/steps/complete-step'
import { StepComponentRegistry } from '@onboardjs/react'

export const componentRegistry: StepComponentRegistry = {
    welcome: AddProjectsStep,
    budget: BudgetStep,
    goals: CompleteStep,
}
