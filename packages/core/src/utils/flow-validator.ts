// @onboardjs/core/src/utils/flow-validator.ts

import { OnboardingStep, CustomComponentStepPayload } from '../types'
import { findStepById } from './step-utils'
import { StepValidator } from '../engine/StepValidator'

export interface ValidationIssue {
    level: 'error' | 'warning'
    message: string
    stepId?: string | number // The ID of the step where the issue was found
    relatedStepId?: string // For issues like broken links
}

/**
 * Enhanced validateFlow using StepValidator for comprehensive validation
 * This maintains backward compatibility while leveraging the new StepValidator
 */
export function validateFlowWithStepValidator(steps: OnboardingStep[], maxDepth: number = 100): ValidationIssue[] {
    const validator = new StepValidator(maxDepth, false)
    const result = validator.validateSteps(steps)

    const issues: ValidationIssue[] = []

    // Convert errors to ValidationIssue format
    result.errors.forEach((error) => {
        issues.push({
            level: 'error',
            message: error.message,
            stepId: error.stepId,
        })
    })

    // Convert warnings to ValidationIssue format
    result.warnings.forEach((warning) => {
        issues.push({
            level: 'warning',
            message: warning.message,
            stepId: warning.stepId,
        })
    })

    return issues
}

export function validateFlow(
    steps: OnboardingStep[]
    // Optional context for validating dynamic parts, though harder to do statically
    // context?: Partial<OnboardingContext>
): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    const stepIds = new Set<string | number>()

    if (!steps || steps.length === 0) {
        issues.push({
            level: 'warning',
            message: 'The onboarding flow has no steps defined.',
        })
        return issues
    }

    // Pass 1: Check for unique IDs and basic step structure
    steps.forEach((step, index) => {
        if (!step.id) {
            issues.push({
                level: 'error',
                message: `Step at index ${index} is missing an 'id'.`,
            })
            return // Cannot proceed with this step if no ID
        }
        if (stepIds.has(step.id)) {
            issues.push({
                level: 'error',
                message: `Duplicate step ID found: '${step.id}'. Step IDs must be unique.`,
                stepId: step.id,
            })
        }
        stepIds.add(step.id)

        if (!step.type) {
            issues.push({
                level: 'error',
                message: `Step '${(step as any).id ?? index}' is missing a 'type'.`,
                stepId: (step as any).id,
            })
        }

        if (!step.payload && step.type !== 'CUSTOM_COMPONENT') {
            // CUSTOM_COMPONENT might have an empty payload initially
            // More specific payload checks could be added per type if desired
        }

        if (step.type === 'CUSTOM_COMPONENT') {
            const payload = step.payload as CustomComponentStepPayload // Type assertion
            if (!payload || !payload.componentKey) {
                issues.push({
                    level: 'error',
                    message: `Step '${step.id}' is of type 'CUSTOM_COMPONENT' but is missing 'payload.componentKey'.`,
                    stepId: step.id,
                })
            }
        } else if (step.type === 'SINGLE_CHOICE') {
            const payload = step.payload

            if (!payload || !Array.isArray(payload.options) || payload.options.length === 0) {
                issues.push({
                    level: 'error',
                    message: `Step '${step.id}' is of type 'SINGLE_CHOICE' but has no valid 'options'.`,
                    stepId: step.id,
                })
            }
        } else if (step.type === 'MULTIPLE_CHOICE') {
            const payload = step.payload
            if (!payload || !Array.isArray(payload.options) || payload.options.length === 0) {
                issues.push({
                    level: 'error',
                    message: `Step '${step.id}' is of type 'MULTIPLE_CHOICE' but has no valid 'options'.`,
                    stepId: step.id,
                })
            }
        }
    })

    // Pass 2: Check for navigation link validity (for static string links)
    steps.forEach((step) => {
        if (!step.id) return // Already handled

        const checkLink = (link: any, linkName: string) => {
            if (typeof link === 'string' && !findStepById(steps, link)) {
                issues.push({
                    level: 'warning', // Warning because it might be intentional for dynamic flows or end-of-flow
                    message: `Step '${step.id}' has a '${linkName}' property pointing to a non-existent step ID: '${link}'.`,
                    stepId: step.id,
                    relatedStepId: link,
                })
            }
        }

        checkLink(step.nextStep, 'nextStep')
        // previousStep is often null for the first step, so less critical for a warning if missing
        // checkLink(step.previousStep, 'previousStep');
        if (step.isSkippable) {
            checkLink(step.skipToStep, 'skipToStep')
        }
    })

    return issues
}
