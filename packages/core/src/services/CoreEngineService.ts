// src/services/CoreEngineService.ts
// Core state management service that handles engine state, lifecycle, and notifications.
// This is the consolidated service replacing StateManager with a cleaner interface.

import { OnboardingContext, OnboardingStep } from '../types'
import { evaluateStepId, findStepById } from '../utils/step-utils'
import { EventManager } from '../engine/EventManager'
import { Logger } from './Logger'
import { EngineState, FlowContext } from '../engine/types'
import type { ICoreEngineService } from './interfaces'

/**
 * CoreEngineService manages the engine's internal state and lifecycle.
 *
 * This service is responsible for:
 * - Tracking loading, hydration, error, and completion states
 * - Computing the full engine state including navigation candidates
 * - Notifying listeners of state changes
 * - Providing step utilities for flow navigation
 *
 * @example
 * ```typescript
 * const coreService = new CoreEngineService(eventManager, steps, initialStepId, flowContext)
 *
 * // Get current state
 * const state = coreService.getState(currentStep, context, history)
 *
 * // Update loading state
 * coreService.setLoading(true)
 * ```
 */
export class CoreEngineService<
    TContext extends OnboardingContext = OnboardingContext,
> implements ICoreEngineService<TContext> {
    private _isLoading = false
    private _isHydrating = true
    private _error: Error | null = null
    private _isCompleted = false
    private _logger: Logger

    constructor(
        private readonly _eventManager: EventManager<TContext>,
        private readonly _steps: OnboardingStep<TContext>[],
        private readonly _initialStepId: string | number | null,
        private readonly _flowContext: FlowContext,
        debugMode?: boolean
    ) {
        this._logger = new Logger({
            debugMode: debugMode ?? false,
            prefix: 'CoreEngineService',
        })
    }

    // =============================================================================
    // STATE GETTERS
    // =============================================================================

    get isLoading(): boolean {
        return this._isLoading
    }

    get isHydrating(): boolean {
        return this._isHydrating
    }

    get error(): Error | null {
        return this._error
    }

    get isCompleted(): boolean {
        return this._isCompleted
    }

    get hasError(): boolean {
        return this._error !== null
    }

    // =============================================================================
    // STATE MANAGEMENT
    // =============================================================================

    /**
     * Get the complete engine state snapshot
     */
    getState(
        currentStep: OnboardingStep<TContext> | null,
        context: TContext,
        history: string[]
    ): EngineState<TContext> {
        let nextStepCandidate: OnboardingStep<TContext> | null = null
        let previousStepCandidate: OnboardingStep<TContext> | null = null

        if (currentStep) {
            nextStepCandidate = this._findNextStep(currentStep, context)
            previousStepCandidate = this._findPreviousStep(currentStep, context, history)
        }

        const isFirstStep = !!currentStep && currentStep.id === this._initialStepId

        const completedIds = new Set(Object.keys(context.flowData?._internal?.completedSteps || {}))

        // Determine relevant steps based on conditions
        const relevantSteps = this._steps.filter((step) => !step.condition || step.condition(context))
        const totalRelevantSteps = relevantSteps.length

        // Calculate completed steps
        const completedRelevantSteps = relevantSteps.filter((step) => completedIds.has(String(step.id))).length

        const progressPercentage =
            totalRelevantSteps > 0 ? Math.round((completedRelevantSteps / totalRelevantSteps) * 100) : 0

        // Find current step index
        const currentStepIndex = currentStep ? relevantSteps.findIndex((step) => step.id === currentStep.id) : -1
        const currentStepNumber = currentStepIndex !== -1 ? currentStepIndex + 1 : 0

        return {
            // Flow identification
            flowId: this._flowContext.flowId,
            flowName: this._flowContext.flowName,
            flowVersion: this._flowContext.flowVersion,
            flowMetadata: this._flowContext.flowMetadata,
            instanceId: this._flowContext.instanceId,

            // Current state
            currentStep,
            context,
            isFirstStep,
            isLastStep: currentStep ? !nextStepCandidate : this._isCompleted,
            canGoPrevious: !isFirstStep && !!currentStep && !!previousStepCandidate && !this._error,
            canGoNext: !!(currentStep && nextStepCandidate && !this._error),
            isSkippable: !!(currentStep && currentStep.isSkippable && !this._error),
            isLoading: this._isLoading,
            isHydrating: this._isHydrating,
            error: this._error,
            isCompleted: this._isCompleted,
            previousStepCandidate: previousStepCandidate,
            nextStepCandidate: nextStepCandidate,
            totalSteps: totalRelevantSteps,
            completedSteps: completedRelevantSteps,
            progressPercentage,
            currentStepNumber,
        }
    }

    /**
     * Update engine state with a partial update function
     */
    setState(
        updater: (prevState: EngineState<TContext>) => Partial<EngineState<TContext>>,
        currentStep: OnboardingStep<TContext> | null,
        context: TContext,
        history: string[],
        onContextChange?: (oldContext: TContext, newContext: TContext) => void
    ): void {
        const currentState = this.getState(currentStep, context, history)
        const oldContext = { ...context }
        const changes = updater(currentState)

        let contextChanged = false
        let stateChanged = false

        if (changes.isLoading !== undefined && changes.isLoading !== this._isLoading) {
            this._isLoading = changes.isLoading
            stateChanged = true
        }
        if (changes.isHydrating !== undefined && changes.isHydrating !== this._isHydrating) {
            this._isHydrating = changes.isHydrating
            stateChanged = true
        }
        if (changes.error !== undefined && changes.error !== this._error) {
            this._error = changes.error
            stateChanged = true
        }
        if (changes.isCompleted !== undefined && changes.isCompleted !== this._isCompleted) {
            this._isCompleted = changes.isCompleted
            stateChanged = true
        }
        if (changes.context) {
            if (JSON.stringify(context) !== JSON.stringify(changes.context)) {
                Object.assign(context, changes.context)
                contextChanged = true
                stateChanged = true
            }
        }

        // Only notify if there was a meaningful change
        if (stateChanged) {
            this._notifyStateChangeListeners(currentStep, context, history)
        }

        if (contextChanged && !this._isHydrating && onContextChange) {
            onContextChange(oldContext, context)
        }
    }

    /**
     * Manually trigger state change notification
     */
    notifyStateChange(currentStep: OnboardingStep<TContext> | null, context: TContext, history: string[]): void {
        this._notifyStateChangeListeners(currentStep, context, history)
    }

    // =============================================================================
    // STATE SETTERS
    // =============================================================================

    setLoading(loading: boolean): void {
        this._isLoading = loading
    }

    setHydrating(hydrating: boolean): void {
        this._isHydrating = hydrating
    }

    setError(error: Error | null): void {
        this._error = error
        if (error) {
            this._logger.error('Error set:', error)
        }
    }

    setCompleted(completed: boolean): void {
        this._isCompleted = completed
    }

    // =============================================================================
    // STEP UTILITIES
    // =============================================================================

    /**
     * Get all relevant steps based on current context conditions
     */
    getRelevantSteps(context: TContext): OnboardingStep<TContext>[] {
        return this._steps.filter((step) => !step.condition || step.condition(context))
    }

    /**
     * Find a step by ID
     */
    getStepById(stepId: string | number): OnboardingStep<TContext> | undefined {
        return findStepById(this._steps, stepId)
    }

    /**
     * Get all completed steps based on context
     */
    getCompletedSteps(context: TContext): OnboardingStep<TContext>[] {
        const completedIds = new Set(Object.keys(context.flowData?._internal?.completedSteps || {}))
        return this._steps.filter((step) => completedIds.has(String(step.id)))
    }

    // =============================================================================
    // PRIVATE METHODS
    // =============================================================================

    private _notifyStateChangeListeners(
        currentStep: OnboardingStep<TContext> | null,
        context: TContext,
        history: string[]
    ): void {
        const state = this.getState(currentStep, context, history)
        this._eventManager.notifyListeners('stateChange', { state })
    }

    private _findNextStep(currentStep: OnboardingStep<TContext>, context: TContext): OnboardingStep<TContext> | null {
        // 1. Check for an explicit nextStep first
        const explicitNextStepId = evaluateStepId(currentStep.nextStep, context)

        if (explicitNextStepId) {
            return findStepById(this._steps, explicitNextStepId) || null
        }

        if (explicitNextStepId === null) {
            // Flow is explicitly ended
            return null
        }

        // 2. If nextStep is undefined, fall back to array order
        if (explicitNextStepId === undefined) {
            const currentIndex = this._steps.findIndex((s) => s.id === currentStep.id)
            if (currentIndex === -1 || currentIndex >= this._steps.length - 1) {
                return null
            }

            // Find the next step that satisfies its condition
            for (let i = currentIndex + 1; i < this._steps.length; i++) {
                const candidateStep = this._steps[i]
                if (!candidateStep.condition || candidateStep.condition(context)) {
                    return candidateStep
                }
            }
            return null
        }

        return null
    }

    private _findPreviousStep(
        currentStep: OnboardingStep<TContext>,
        context: TContext,
        history: string[]
    ): OnboardingStep<TContext> | null {
        // Priority 1: Explicit previousStep
        let targetId: string | number | null | undefined = evaluateStepId(currentStep.previousStep, context)

        if (targetId === undefined) {
            // Priority 2: History
            if (history.length > 0) {
                targetId = history[history.length - 1]
            } else {
                // Priority 3: Array Order
                const currentIndex = this._steps.findIndex((s) => s.id === currentStep.id)
                if (currentIndex > 0) {
                    targetId = this._steps[currentIndex - 1].id
                }
            }
        }

        if (!targetId) {
            return null
        }

        // Validate candidate and traverse backwards if condition fails
        let candidateStep = findStepById(this._steps, targetId)

        while (candidateStep) {
            if (!candidateStep.condition || candidateStep.condition(context)) {
                return candidateStep
            }

            const nextTargetIdInChain = evaluateStepId(candidateStep.previousStep, context)

            if (!nextTargetIdInChain) {
                return null
            }
            candidateStep = findStepById(this._steps, nextTargetIdInChain)
        }

        return null
    }
}
