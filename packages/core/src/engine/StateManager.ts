// src/engine/services/StateManager.ts

import { OnboardingContext, OnboardingStep } from '../types'
import { evaluateStepId, findStepById } from '../utils/step-utils'
import { EventManager } from './EventManager'
import { Logger } from '../services/Logger'
import { EngineState, FlowContext } from './types'
import deepEqual from 'fast-deep-equal'

export class StateManager<TContext extends OnboardingContext> {
    private _isLoadingInternal = false
    private _isHydratingInternal = true
    private _errorInternal: Error | null = null
    private _isCompletedInternal = false
    private _logger: Logger

    constructor(
        private _eventManager: EventManager<TContext>,
        private _steps: OnboardingStep<TContext>[],
        private _initialStepId: string | number | null,
        private _flowContext: FlowContext,
        debugMode?: boolean
    ) {
        this._logger = Logger.getInstance({
            debugMode: debugMode ?? false,
            prefix: 'StateManager',
        })
    }

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

        if (changes.isLoading !== undefined && changes.isLoading !== this._isLoadingInternal) {
            this._isLoadingInternal = changes.isLoading
            stateChanged = true
        }
        if (changes.isHydrating !== undefined && changes.isHydrating !== this._isHydratingInternal) {
            this._isHydratingInternal = changes.isHydrating
            stateChanged = true
        }
        if (changes.error !== undefined && changes.error !== this._errorInternal) {
            this._errorInternal = changes.error
            stateChanged = true
        }
        if (changes.isCompleted !== undefined && changes.isCompleted !== this._isCompletedInternal) {
            this._isCompletedInternal = changes.isCompleted
            stateChanged = true
        }
        if (changes.context) {
            if (!deepEqual(context, changes.context)) {
                Object.assign(context, changes.context)
                contextChanged = true
                stateChanged = true
            }
        }

        // Only notify if there was a meaningful change to the state object
        if (stateChanged) {
            this._notifyStateChangeListeners(currentStep, context, history)
        }

        if (contextChanged && !this._isHydratingInternal && onContextChange) {
            onContextChange(oldContext, context)
        }
    }

    notifyStateChange(currentStep: OnboardingStep<TContext> | null, context: TContext, history: string[]): void {
        this._notifyStateChangeListeners(currentStep, context, history)
    }

    get hasError(): boolean {
        return this._errorInternal !== null
    }

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

        // First, determine the list of steps that are currently relevant based on conditions.
        const relevantSteps = this._steps.filter((step) => !step.condition || step.condition(context))

        const totalRelevantSteps = relevantSteps.length

        // Calculate completed steps based on the relevant list.
        const completedRelevantSteps = relevantSteps.filter((step) => completedIds.has(String(step.id))).length

        const progressPercentage =
            totalRelevantSteps > 0 ? Math.round((completedRelevantSteps / totalRelevantSteps) * 100) : 0

        // Find the 0-based index of the current step within the relevant steps.
        const currentStepIndex = currentStep ? relevantSteps.findIndex((step) => step.id === currentStep.id) : -1

        // Convert to a 1-based number for UI display, or 0 if not found/null.
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
            isLastStep: currentStep ? !nextStepCandidate : this._isCompletedInternal,
            canGoPrevious: !isFirstStep && !!currentStep && !!previousStepCandidate && !this._errorInternal,
            canGoNext: !!(currentStep && nextStepCandidate && !this._errorInternal),
            isSkippable: !!(currentStep && currentStep.isSkippable && !this._errorInternal),
            isLoading: this._isLoadingInternal,
            isHydrating: this._isHydratingInternal,
            error: this._errorInternal,
            isCompleted: this._isCompletedInternal,
            previousStepCandidate: previousStepCandidate,
            nextStepCandidate: nextStepCandidate,
            totalSteps: totalRelevantSteps,
            completedSteps: completedRelevantSteps,
            progressPercentage,
            currentStepNumber,
        }
    }

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
            // An explicit target is set, find it. NavigationManager will handle its condition.
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
                return null // Not found or is the last step
            }

            // Find the next step in the array that satisfies its condition
            for (let i = currentIndex + 1; i < this._steps.length; i++) {
                const candidateStep = this._steps[i]
                if (!candidateStep.condition || candidateStep.condition(context)) {
                    return candidateStep // Found the next valid step
                }
            }
            return null // No subsequent valid steps found
        }

        return null
    }

    private _findPreviousStep(
        currentStep: OnboardingStep<TContext>,
        context: TContext,
        history: string[]
    ): OnboardingStep<TContext> | null {
        // --- STEP 1: Find the initial candidate ID using the 3-priority system ---
        let targetId: string | number | null | undefined = evaluateStepId(currentStep.previousStep, context)

        if (targetId === undefined) {
            // Priority 2: History
            if (history.length > 0) {
                targetId = history[history.length - 1]
            } else {
                // Priority 3: Array Order (The fix for persisted state)
                const currentIndex = this._steps.findIndex((s) => s.id === currentStep.id)
                if (currentIndex > 0) {
                    targetId = this._steps[currentIndex - 1].id
                }
            }
        }

        if (!targetId) {
            return null // No possible previous step from any source.
        }

        // --- STEP 2: Validate the candidate and traverse backwards if its condition fails ---
        let candidateStep = findStepById(this._steps, targetId)

        while (candidateStep) {
            // If the candidate's condition passes (or it has no condition), we've found our step.
            if (!candidateStep.condition || candidateStep.condition(context)) {
                return candidateStep
            }

            // Condition failed. We MUST follow the explicit `previousStep` chain from here
            // to ensure a predictable backward traversal. We do not consult history or
            // array order again inside this loop.
            const nextTargetIdInChain = evaluateStepId(candidateStep.previousStep, context)

            if (!nextTargetIdInChain) {
                return null // The backward chain is broken by a failed condition.
            }
            candidateStep = findStepById(this._steps, nextTargetIdInChain)
        }

        return null // Loop finished (e.g., a bad ID was found in the chain).
    }

    // Getters for internal state
    get isLoading(): boolean {
        return this._isLoadingInternal
    }

    get isHydrating(): boolean {
        return this._isHydratingInternal
    }

    get error(): Error | null {
        return this._errorInternal
    }

    get isCompleted(): boolean {
        return this._isCompletedInternal
    }

    /**
     * Get all relevant steps in the flow based on the current context.
     * @param context The current onboarding context.
     * @returns An array of relevant onboarding steps in the current flow.
     */
    public getRelevantSteps(context: TContext): OnboardingStep<TContext>[] {
        return this._steps.filter((step) => !step.condition || step.condition(context))
    }

    public getStepById(stepId: string | number) {
        return findStepById(this._steps, stepId)
    }

    public getCompletedSteps(context: TContext): OnboardingStep<TContext>[] {
        const completedIds = new Set(Object.keys(context.flowData?._internal?.completedSteps || {}))
        return this._steps.filter((step) => completedIds.has(String(step.id)))
    }

    // Setters for internal state
    setLoading(loading: boolean): void {
        this._isLoadingInternal = loading
    }

    setHydrating(hydrating: boolean): void {
        this._isHydratingInternal = hydrating
    }

    setError(error: Error | null): void {
        this._errorInternal = error
        if (error) {
            this._logger.error('Error set:', error)
        }
    }

    setCompleted(completed: boolean): void {
        this._isCompletedInternal = completed
    }
}
