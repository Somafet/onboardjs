// src/engine/StepValidator.ts
// Comprehensive step validation service with cycle detection and ID uniqueness checks

import { OnboardingStep, OnboardingContext } from '../types'
import { findStepById } from '../utils/step-utils'
import { Logger } from '../services/Logger'

export interface StepValidationResult {
    isValid: boolean
    errors: StepValidationError[]
    warnings: StepValidationWarning[]
}

export interface StepValidationError {
    stepId?: string | number
    errorType:
        | 'MISSING_ID'
        | 'DUPLICATE_ID'
        | 'CIRCULAR_NAVIGATION'
        | 'INVALID_REFERENCE'
        | 'MISSING_TYPE'
        | 'INVALID_PAYLOAD'
    message: string
    details?: Record<string, any>
}

export interface StepValidationWarning {
    stepId?: string | number
    warningType: 'UNREACHABLE_STEP' | 'MISSING_PAYLOAD' | 'BROKEN_LINK' | 'UNOPTIMIZED_CONDITION'
    message: string
    details?: Record<string, any>
}

export class StepValidator<TContext extends OnboardingContext = OnboardingContext> {
    private _logger: Logger
    private readonly _maxDepth: number

    constructor(maxDepth: number = 100, debugMode: boolean = false) {
        this._maxDepth = maxDepth
        this._logger = new Logger({
            debugMode,
            prefix: 'StepValidator',
        })
    }

    /**
     * Validates an array of steps for common configuration errors
     */
    validateSteps(steps: OnboardingStep<TContext>[]): StepValidationResult {
        const errors: StepValidationError[] = []
        const warnings: StepValidationWarning[] = []

        // Early exit for empty steps
        if (!steps || steps.length === 0) {
            warnings.push({
                warningType: 'MISSING_PAYLOAD',
                message: 'No steps defined in the flow',
            })
            return { isValid: true, errors, warnings }
        }

        // Task 031: Check for ID uniqueness
        this._validateIdUniqueness(steps, errors)

        // Validate each step structure
        steps.forEach((step) => {
            this._validateStepStructure(step, errors)
        })

        // Task 032: Check for circular navigation
        this._detectCircularNavigation(steps, errors)

        // Check for broken references (static only)
        this._validateStaticReferences(steps, warnings)

        // Check for unreachable steps
        this._detectUnreachableSteps(steps, warnings)

        const isValid = errors.length === 0

        if (!isValid) {
            this._logger.error(`Step validation failed with ${errors.length} error(s)`)
            errors.forEach((err) => this._logger.error(`  - ${err.message}`, err.details))
        }

        if (warnings.length > 0) {
            this._logger.warn(`Step validation completed with ${warnings.length} warning(s)`)
            warnings.forEach((warn) => this._logger.warn(`  - ${warn.message}`, warn.details))
        }

        return { isValid, errors, warnings }
    }

    /**
     * TASK-031: Validates that all step IDs are unique
     */
    private _validateIdUniqueness(steps: OnboardingStep<TContext>[], errors: StepValidationError[]): void {
        const stepIds = new Map<string | number, number>()

        steps.forEach((step, index) => {
            if (!step.id) {
                errors.push({
                    errorType: 'MISSING_ID',
                    message: `Step at index ${index} is missing an 'id' property`,
                    details: { index, stepType: step.type },
                })
                return
            }

            const existingIndex = stepIds.get(step.id)
            if (existingIndex !== undefined) {
                errors.push({
                    stepId: step.id,
                    errorType: 'DUPLICATE_ID',
                    message: `Duplicate step ID '${step.id}' found at indices ${existingIndex} and ${index}`,
                    details: { duplicateId: step.id, indices: [existingIndex, index] },
                })
            } else {
                stepIds.set(step.id, index)
            }
        })
    }

    /**
     * Validates the structure of a single step
     */
    private _validateStepStructure(step: OnboardingStep<TContext>, errors: StepValidationError[]): void {
        // Note: 'type' property is optional and defaults to 'INFORMATION' when not provided
        // So we don't validate for missing type

        // Validate type-specific payloads
        if (step.type === 'CUSTOM_COMPONENT') {
            const payload = step.payload as any
            if (!payload?.componentKey) {
                errors.push({
                    stepId: step.id,
                    errorType: 'INVALID_PAYLOAD',
                    message: `Step '${step.id}' of type 'CUSTOM_COMPONENT' must have a 'componentKey' in its payload`,
                    details: { stepType: step.type },
                })
            }
        }

        if (step.type === 'SINGLE_CHOICE' || step.type === 'MULTIPLE_CHOICE') {
            const payload = step.payload as any
            if (!payload?.options || !Array.isArray(payload.options) || payload.options.length === 0) {
                errors.push({
                    stepId: step.id,
                    errorType: 'INVALID_PAYLOAD',
                    message: `Step '${step.id}' of type '${step.type}' must have a non-empty 'options' array in its payload`,
                    details: { stepType: step.type },
                })
            }
        }

        if (step.type === 'CHECKLIST') {
            const payload = step.payload as any
            if (!payload?.dataKey) {
                errors.push({
                    stepId: step.id,
                    errorType: 'INVALID_PAYLOAD',
                    message: `Step '${step.id}' of type 'CHECKLIST' must have a 'dataKey' in its payload`,
                    details: { stepType: step.type },
                })
            }
            if (!payload?.items || !Array.isArray(payload.items) || payload.items.length === 0) {
                errors.push({
                    stepId: step.id,
                    errorType: 'INVALID_PAYLOAD',
                    message: `Step '${step.id}' of type 'CHECKLIST' must have a non-empty 'items' array in its payload`,
                    details: { stepType: step.type },
                })
            }
        }
    }

    /**
     * TASK-032: Detects circular navigation patterns up to maxDepth
     */
    private _detectCircularNavigation(steps: OnboardingStep<TContext>[], errors: StepValidationError[]): void {
        // Check each step as a potential starting point
        steps.forEach((step) => {
            if (!step.id) return

            const visited = new Set<string | number>()
            const path: (string | number)[] = []

            this._checkCircularPath(step.id, steps, visited, path, errors)
        })
    }

    /**
     * Recursively checks for circular paths using DFS
     */
    private _checkCircularPath(
        currentStepId: string | number,
        steps: OnboardingStep<TContext>[],
        visited: Set<string | number>,
        path: (string | number)[],
        errors: StepValidationError[]
    ): void {
        // Check depth limit
        if (path.length >= this._maxDepth) {
            errors.push({
                stepId: currentStepId,
                errorType: 'CIRCULAR_NAVIGATION',
                message: `Potential circular navigation detected: path depth exceeds ${this._maxDepth} steps`,
                details: {
                    startStep: path[0],
                    currentStep: currentStepId,
                    pathLength: path.length,
                    maxDepth: this._maxDepth,
                },
            })
            return
        }

        // Check for cycle
        if (visited.has(currentStepId)) {
            const cycleStart = path.indexOf(currentStepId)
            if (cycleStart !== -1) {
                const cycle = [...path.slice(cycleStart), currentStepId]
                errors.push({
                    stepId: currentStepId,
                    errorType: 'CIRCULAR_NAVIGATION',
                    message: `Circular navigation detected in path: ${cycle.join(' → ')}`,
                    details: {
                        cycle,
                        cycleLength: cycle.length - 1,
                    },
                })
            }
            return
        }

        visited.add(currentStepId)
        path.push(currentStepId)

        const currentStep = findStepById(steps, currentStepId)
        if (!currentStep) return

        // Check nextStep (only static strings for cycle detection)
        if (typeof currentStep.nextStep === 'string') {
            this._checkCircularPath(currentStep.nextStep, steps, new Set(visited), [...path], errors)
        }

        // Check skipToStep if step is skippable
        if (currentStep.isSkippable && typeof currentStep.skipToStep === 'string') {
            this._checkCircularPath(currentStep.skipToStep, steps, new Set(visited), [...path], errors)
        }

        // Note: We don't check previousStep for cycles as that's expected to form cycles
    }

    /**
     * Validates static navigation references
     */
    private _validateStaticReferences(steps: OnboardingStep<TContext>[], warnings: StepValidationWarning[]): void {
        steps.forEach((step) => {
            if (!step.id) return

            // Check nextStep
            if (typeof step.nextStep === 'string' && !findStepById(steps, step.nextStep)) {
                warnings.push({
                    stepId: step.id,
                    warningType: 'BROKEN_LINK',
                    message: `Step '${step.id}' has a 'nextStep' reference to non-existent step '${step.nextStep}'`,
                    details: { targetStep: step.nextStep },
                })
            }

            // Check previousStep
            if (typeof step.previousStep === 'string' && !findStepById(steps, step.previousStep)) {
                warnings.push({
                    stepId: step.id,
                    warningType: 'BROKEN_LINK',
                    message: `Step '${step.id}' has a 'previousStep' reference to non-existent step '${step.previousStep}'`,
                    details: { targetStep: step.previousStep },
                })
            }

            // Check skipToStep
            if (step.isSkippable && typeof step.skipToStep === 'string' && !findStepById(steps, step.skipToStep)) {
                warnings.push({
                    stepId: step.id,
                    warningType: 'BROKEN_LINK',
                    message: `Step '${step.id}' has a 'skipToStep' reference to non-existent step '${step.skipToStep}'`,
                    details: { targetStep: step.skipToStep },
                })
            }
        })
    }

    /**
     * Detects steps that may be unreachable from the first step
     */
    private _detectUnreachableSteps(steps: OnboardingStep<TContext>[], warnings: StepValidationWarning[]): void {
        if (steps.length === 0) return

        // Check if any step has dynamic navigation
        const hasDynamicNavigation = steps.some(
            (step) =>
                typeof step.nextStep === 'function' ||
                typeof step.previousStep === 'function' ||
                typeof step.skipToStep === 'function' ||
                !!step.condition
        )

        // If there's any dynamic navigation in the flow, we can't reliably detect unreachable steps
        // because the navigation might reach them through runtime conditions
        if (hasDynamicNavigation) {
            return
        }

        const reachable = new Set<string | number>()
        const toVisit: (string | number)[] = [steps[0].id]

        // BFS to find all reachable steps (only works for static navigation)
        while (toVisit.length > 0) {
            const currentId = toVisit.shift()!
            if (reachable.has(currentId)) continue

            reachable.add(currentId)
            const currentStep = findStepById(steps, currentId)
            if (!currentStep) continue

            // Add nextStep
            if (typeof currentStep.nextStep === 'string' && !reachable.has(currentStep.nextStep)) {
                toVisit.push(currentStep.nextStep)
            }

            // Add skipToStep
            if (
                currentStep.isSkippable &&
                typeof currentStep.skipToStep === 'string' &&
                !reachable.has(currentStep.skipToStep)
            ) {
                toVisit.push(currentStep.skipToStep)
            }
        }

        // Check which steps are not reachable
        steps.forEach((step, index) => {
            // Skip the first step
            if (index === 0) return

            if (!reachable.has(step.id)) {
                warnings.push({
                    stepId: step.id,
                    warningType: 'UNREACHABLE_STEP',
                    message: `Step '${step.id}' may be unreachable from the first step (no static navigation path found)`,
                    details: { stepIndex: index },
                })
            }
        })
    }

    /**
     * Quick validation check - returns true if valid, false if errors found
     */
    isValid(steps: OnboardingStep<TContext>[]): boolean {
        const result = this.validateSteps(steps)
        return result.isValid
    }

    /**
     * Gets only errors from validation
     */
    getErrors(steps: OnboardingStep<TContext>[]): StepValidationError[] {
        const result = this.validateSteps(steps)
        return result.errors
    }

    /**
     * Gets only warnings from validation
     */
    getWarnings(steps: OnboardingStep<TContext>[]): StepValidationWarning[] {
        const result = this.validateSteps(steps)
        return result.warnings
    }
}
