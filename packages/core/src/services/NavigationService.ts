// src/services/NavigationService.ts
// Refactored to delegate to NavigationOrchestrator and specialized services
// Maintains backward compatibility while improving code quality

import { Logger } from './Logger'
import { OnboardingContext, OnboardingStep, ChecklistItemState } from '../types'
import { ErrorHandler } from '../engine/ErrorHandler'
import { EventManager } from '../engine/EventManager'
import { StateManager } from '../engine/StateManager'
import type { INavigationService, IPersistenceService } from './interfaces'
import { NavigationOrchestrator } from './NavigationOrchestrator'
import { ChecklistNavigationService } from './ChecklistNavigationService'

/**
 * Checklist progress information
 */
export interface ChecklistProgress {
    completed: number
    total: number
    percentage: number
    isComplete: boolean
}

/**
 * NavigationService provides unified navigation and checklist management.
 * Now delegates to NavigationOrchestrator and specialized services.
 *
 * This refactored version maintains backward compatibility while
 * reducing complexity and improving testability through delegation.
 */
export class NavigationService<
    TContext extends OnboardingContext = OnboardingContext,
> implements INavigationService<TContext> {
    private readonly _logger: Logger
    private readonly _orchestrator: NavigationOrchestrator<TContext>
    private readonly _checklistService: ChecklistNavigationService<TContext>

    constructor(
        private readonly _steps: OnboardingStep<TContext>[],
        private readonly _eventManager: EventManager<TContext>,
        private readonly _stateManager: StateManager<TContext>,
        private readonly _persistenceService: IPersistenceService<TContext>,
        private readonly _errorHandler: ErrorHandler<TContext>,
        logger?: Logger
    ) {
        this._logger = logger ?? new Logger({ prefix: 'NavigationService' })

        // Delegate to orchestrator
        this._orchestrator = new NavigationOrchestrator(
            this._steps,
            this._eventManager,
            this._stateManager,
            this._persistenceService,
            this._errorHandler,
            this._logger
        )

        // Expose checklist service
        this._checklistService = this._orchestrator.getChecklistService()
    }

    // =========================================================================
    // INavigationService Implementation
    // =========================================================================

    /**
     * Navigate to a specific step with full event handling.
     */
    async navigateToStep(
        requestedTargetStepId: string | number | null | undefined,
        direction: 'next' | 'previous' | 'skip' | 'goto' | 'initial' = 'goto',
        currentStep: OnboardingStep<TContext> | null,
        context: TContext,
        history: string[],
        onStepChangeCallback?: (
            newStep: OnboardingStep<TContext> | null,
            oldStep: OnboardingStep<TContext> | null,
            context: TContext
        ) => void,
        onFlowComplete?: (context: TContext) => Promise<void> | void
    ): Promise<OnboardingStep<TContext> | null> {
        return this._orchestrator.navigateToStep(
            requestedTargetStepId,
            direction,
            currentStep,
            context,
            history,
            onStepChangeCallback,
            onFlowComplete
        )
    }

    /**
     * Calculate the next step without navigating.
     */
    calculateNextStep(currentStep: OnboardingStep<TContext>, context: TContext): OnboardingStep<TContext> | null {
        return this._orchestrator.calculateNextStep(currentStep, context)
    }

    /**
     * Calculate the previous step without navigating.
     */
    calculatePreviousStep(
        currentStep: OnboardingStep<TContext>,
        context: TContext,
        history: string[]
    ): OnboardingStep<TContext> | null {
        return this._orchestrator.calculatePreviousStep(currentStep, context, history)
    }

    /**
     * Get checklist item state for a CHECKLIST step.
     */
    getChecklistState(step: OnboardingStep<TContext>, context: TContext): ChecklistItemState[] {
        return this._orchestrator.getChecklistState(step, context)
    }

    /**
     * Check if a checklist step is complete.
     */
    isChecklistComplete(step: OnboardingStep<TContext>, context: TContext): boolean {
        return this._orchestrator.isChecklistComplete(step, context)
    }

    /**
     * Update a checklist item.
     */
    async updateChecklistItem(
        itemId: string,
        isCompleted: boolean,
        step: OnboardingStep<TContext>,
        context: TContext,
        persistCallback?: () => Promise<void>
    ): Promise<void> {
        return this._orchestrator.updateChecklistItem(itemId, isCompleted, step, context, persistCallback)
    }

    // =========================================================================
    // High-Level Navigation Methods
    // =========================================================================

    /**
     * Navigate to the next step with data persistence.
     */
    async next(
        currentStep: OnboardingStep<TContext> | null,
        stepSpecificData: any,
        context: TContext,
        history: string[],
        onStepChangeCallback?: (
            newStep: OnboardingStep<TContext> | null,
            oldStep: OnboardingStep<TContext> | null,
            context: TContext
        ) => void,
        onFlowComplete?: (context: TContext) => Promise<void> | void
    ): Promise<OnboardingStep<TContext> | null> {
        if (!currentStep || this._stateManager.isLoading) {
            return currentStep
        }

        // Handle checklist completion check
        if (currentStep.type === 'CHECKLIST') {
            if (!this._checklistService.isChecklistComplete(currentStep as any, context)) {
                const error = new Error('Checklist criteria not met.')
                this._logger.warn(
                    `[NavigationService] Cannot proceed from checklist step '${currentStep.id}': Not all completion criteria met.`
                )
                this._stateManager.setError(error)
                this._eventManager.notifyListeners('error', { error, context })
                return currentStep
            }

            // Include checklist data in stepSpecificData
            const checklistPayload: any = currentStep.payload
            stepSpecificData = {
                ...stepSpecificData,
                [checklistPayload.dataKey]: context.flowData[checklistPayload.dataKey] || [],
            }
        }

        this._stateManager.setLoading(true)
        this._stateManager.setError(null)

        try {
            // Update context with step-specific data
            if (stepSpecificData && Object.keys(stepSpecificData).length > 0) {
                const newFlowData = {
                    ...context.flowData,
                    ...stepSpecificData,
                }
                if (JSON.stringify(context.flowData) !== JSON.stringify(newFlowData)) {
                    context.flowData = newFlowData
                }
            }

            // Execute step completion logic
            if (currentStep.onStepComplete) {
                await currentStep.onStepComplete(stepSpecificData || {}, context)
            }

            this._eventManager.notifyListeners('stepCompleted', {
                step: currentStep,
                stepData: stepSpecificData || {},
                context,
            })

            // Mark step as completed
            this._markStepCompleted(currentStep, context)

            // Determine next step
            const nextStepCandidate = this._orchestrator.calculateNextStep(currentStep, context)
            const finalNextStepId = nextStepCandidate ? nextStepCandidate.id : null

            const newCurrentStep = await this.navigateToStep(
                finalNextStepId,
                'next',
                currentStep,
                context,
                history,
                onStepChangeCallback,
                onFlowComplete
            )

            await this._persistenceService.persistDataIfNeeded(
                context,
                newCurrentStep?.id || null,
                this._stateManager.isHydrating
            )

            return newCurrentStep
        } catch (error) {
            this._errorHandler.handleError(error, `next() for step ${currentStep.id}`, context)
            this._stateManager.setLoading(false)
            return currentStep
        }
    }

    /**
     * Navigate to the previous step.
     */
    async previous(
        currentStep: OnboardingStep<TContext> | null,
        context: TContext,
        history: string[],
        onStepChangeCallback?: (
            newStep: OnboardingStep<TContext> | null,
            oldStep: OnboardingStep<TContext> | null,
            context: TContext
        ) => void,
        onFlowComplete?: (context: TContext) => Promise<void> | void
    ): Promise<OnboardingStep<TContext> | null> {
        if (!currentStep || this._stateManager.isLoading) {
            return currentStep
        }

        // Determine the previous step candidate
        const candidate = this._orchestrator.calculatePreviousStep(currentStep, context, history)
        const prevStepId = candidate ? candidate.id : null

        // Pop from history if history was the source and previousStep was undefined
        if (history.length > 0 && history[history.length - 1] === prevStepId) {
            history.pop()
        }

        if (prevStepId) {
            return this.navigateToStep(
                prevStepId,
                'previous',
                currentStep,
                context,
                history,
                onStepChangeCallback,
                onFlowComplete
            )
        }

        return currentStep
    }

    /**
     * Skip the current step.
     */
    async skip(
        currentStep: OnboardingStep<TContext> | null,
        context: TContext,
        history: string[],
        onStepChangeCallback?: (
            newStep: OnboardingStep<TContext> | null,
            oldStep: OnboardingStep<TContext> | null,
            context: TContext
        ) => void,
        onFlowComplete?: (context: TContext) => Promise<void> | void
    ): Promise<OnboardingStep<TContext> | null> {
        if (!currentStep || !currentStep.isSkippable || this._stateManager.isLoading) {
            this._logger.debug(
                `[NavigationService] skip(): Cannot skip from step '${currentStep?.id}'. Not skippable or engine loading.`
            )
            return currentStep
        }

        const skipReason = currentStep.skipToStep ? 'explicit_skip_target' : 'default_skip'
        this._eventManager.notifyListeners('stepSkipped', {
            step: currentStep,
            context,
            skipReason,
        })

        const skipService = this._orchestrator.getStepTransitionService()
        const finalSkipTargetId = skipService.calculateSkipTarget(currentStep, context)

        return await this.navigateToStep(
            finalSkipTargetId,
            'skip',
            currentStep,
            context,
            history,
            onStepChangeCallback,
            onFlowComplete
        )
    }

    /**
     * Navigate directly to a specific step by ID.
     */
    async goToStep(
        stepId: string,
        stepSpecificData: unknown,
        currentStep: OnboardingStep<TContext> | null,
        context: TContext,
        history: string[],
        onStepChangeCallback?: (
            newStep: OnboardingStep<TContext> | null,
            oldStep: OnboardingStep<TContext> | null,
            context: TContext
        ) => void,
        onFlowComplete?: (context: TContext) => Promise<void> | void
    ): Promise<OnboardingStep<TContext> | null> {
        if (this._stateManager.isLoading) {
            this._logger.debug(`[NavigationService] goToStep(): Ignoring - engine is loading.`)
            return currentStep
        }

        if (stepSpecificData) {
            if (!context.flowData) {
                context.flowData = {}
            }
            context.flowData = {
                ...context.flowData,
                ...stepSpecificData,
            }
            this._logger.debug(`[NavigationService] goToStep(): Context flowData updated with step-specific data.`)
        }

        return await this.navigateToStep(
            stepId,
            'goto',
            currentStep,
            context,
            history,
            onStepChangeCallback,
            onFlowComplete
        )
    }

    // =========================================================================
    // Checklist Methods
    // =========================================================================

    /**
     * Get checklist progress for a step.
     */
    getChecklistProgress(step: OnboardingStep<TContext> & { type: 'CHECKLIST' }, context: TContext): ChecklistProgress {
        return this._checklistService.getChecklistProgress(step, context)
    }

    // =========================================================================
    // Private Helper Methods
    // =========================================================================

    private _markStepCompleted(step: OnboardingStep<TContext>, context: TContext): void {
        if (!context.flowData._internal) {
            context.flowData._internal = {
                completedSteps: {},
                startedAt: Date.now(),
                stepStartTimes: {},
            }
        }
        context.flowData._internal.completedSteps = {
            ...(context.flowData._internal.completedSteps || {}),
            [step.id]: Date.now(),
        }
    }
}
