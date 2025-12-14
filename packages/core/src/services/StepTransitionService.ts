// src/services/StepTransitionService.ts
// Handles direction-aware step navigation without event handling
// Focuses on: next, previous, skip, and conditional step logic

import { Logger } from './Logger'
import { OnboardingContext, OnboardingStep } from '../types'
import { findStepById, evaluateStepId } from '../utils/step-utils'

/**
 * StepTransitionService handles direction-aware navigation logic.
 * Calculates next/previous steps based on context, conditions, and history.
 * Does NOT handle event emission or beforeStepChange hooks.
 *
 * Extracted from NavigationService as part of decomposition.
 */
export class StepTransitionService<TContext extends OnboardingContext = OnboardingContext> {
    private readonly _logger: Logger

    constructor(
        private readonly _steps: OnboardingStep<TContext>[],
        logger?: Logger
    ) {
        this._logger = logger ?? Logger.getInstance({ prefix: 'StepTransitionService' })
    }

    /**
     * Find the next step candidate based on context.
     * Priority: explicit nextStep → array order
     */
    findNextStepCandidate(
        currentStep: OnboardingStep<TContext>,
        context: TContext
    ): OnboardingStep<TContext> | undefined | null {
        // Priority 1: Explicit `nextStep` property
        const explicitNextStepId = evaluateStepId(currentStep.nextStep, context)

        if (explicitNextStepId !== undefined) {
            if (explicitNextStepId === null) {
                return null // Flow explicitly ended
            }
            return findStepById(this._steps, explicitNextStepId) || undefined
        }

        // Priority 2: Array order
        const currentIndex = this._steps.findIndex((s) => s.id === currentStep.id)
        if (currentIndex === -1) {
            return undefined
        }

        // Find the first valid step after current
        for (let i = currentIndex + 1; i < this._steps.length; i++) {
            const candidateStep = this._steps[i]
            if (!candidateStep.condition || candidateStep.condition(context)) {
                return candidateStep
            }
        }

        return undefined
    }

    /**
     * Find the previous step candidate based on context and history.
     * Priority: explicit previousStep → history → array order
     */
    findPreviousStepCandidate(
        currentStep: OnboardingStep<TContext>,
        context: TContext,
        history: string[]
    ): OnboardingStep<TContext> | undefined {
        // Priority 1: Explicit `previousStep` property
        let targetId = evaluateStepId(currentStep.previousStep, context)

        if (targetId !== undefined) {
            return findStepById(this._steps, targetId) || undefined
        }

        // Priority 2: History
        if (history.length > 0) {
            targetId = history[history.length - 1]
            return findStepById(this._steps, targetId) || undefined
        }

        // Priority 3: Array order
        const currentIndex = this._steps.findIndex((s) => s.id === currentStep.id)
        if (currentIndex > 0) {
            for (let i = currentIndex - 1; i >= 0; i--) {
                const candidateStep = this._steps[i]
                if (!candidateStep.condition || candidateStep.condition(context)) {
                    return candidateStep
                }
            }
        }

        return undefined
    }

    /**
     * Calculate the skip target step.
     * Priority: skipToStep → nextStep → next in array
     */
    calculateSkipTarget(currentStep: OnboardingStep<TContext>, context: TContext): string | number | null {
        // Determine target: skipToStep > nextStep > next in array
        let evaluatedSkipTarget = evaluateStepId(currentStep.skipToStep, context)
        if (evaluatedSkipTarget === undefined) {
            evaluatedSkipTarget = evaluateStepId(currentStep.nextStep, context)
        }

        if (evaluatedSkipTarget !== undefined) {
            return evaluatedSkipTarget
        }

        // Fallback to next step in array
        const currentIndex = this._steps.findIndex((s) => s.id === currentStep.id)
        if (currentIndex !== -1 && currentIndex < this._steps.length - 1) {
            for (let i = currentIndex + 1; i < this._steps.length; i++) {
                const step = this._steps[i]
                if (!step.condition || step.condition(context)) {
                    this._logger.debug(
                        `[StepTransitionService] calculateSkipTarget(): No explicit skip/next target. Using next valid step: '${step.id}'`
                    )
                    return step.id
                }
            }
        }

        return null
    }

    /**
     * Skip conditional steps that don't meet the current context.
     * Recursively advances through steps while their conditions fail.
     */
    skipConditionalSteps(
        candidateStep: OnboardingStep<TContext> | undefined | null,
        context: TContext,
        direction: 'next' | 'previous' = 'next'
    ): OnboardingStep<TContext> | undefined | null {
        let current = candidateStep

        while (current && current.condition && !current.condition(context)) {
            this._logger.debug(`[StepTransitionService] Skipping conditional step: ${current.id}`)

            if (direction === 'previous') {
                // For backward navigation, we can't use history here
                current = this.findPreviousStepCandidate(current, context, [])
            } else {
                current = this.findNextStepCandidate(current, context)
            }
        }

        return current
    }
}
