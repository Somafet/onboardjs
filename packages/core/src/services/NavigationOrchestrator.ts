// src/services/NavigationOrchestrator.ts
// Orchestrates navigation using StepTransitionService, BeforeNavigationHandler,
// and ChecklistNavigationService
// Extracted from NavigationService as part of decomposition.

import { Logger } from './Logger'
import { OnboardingContext, OnboardingStep } from '../types'
import { evaluateStepId, findStepById } from '../utils/step-utils'
import { ErrorHandler } from '../engine/ErrorHandler'
import { EventManager } from '../engine/EventManager'
import { StateManager } from '../engine/StateManager'
import type { IPersistenceService } from './interfaces'
import { StepTransitionService } from './StepTransitionService'
import { BeforeNavigationHandler } from './BeforeNavigationHandler'
import { ChecklistNavigationService } from './ChecklistNavigationService'

/**
 * NavigationOrchestrator coordinates the three navigation services:
 * - StepTransitionService: Direction-aware step navigation
 * - BeforeNavigationHandler: Event handling and cancellation
 * - ChecklistNavigationService: Checklist-specific operations
 *
 * This replaces the monolithic NavigationService with a more modular design.
 * It maintains the same public API while delegating to specialized services.
 */
export class NavigationOrchestrator<TContext extends OnboardingContext = OnboardingContext> {
    private readonly _logger: Logger
    private readonly _stepTransitionService: StepTransitionService<TContext>
    private readonly _beforeNavigationHandler: BeforeNavigationHandler<TContext>
    private readonly _checklistService: ChecklistNavigationService<TContext>

    constructor(
        private readonly _steps: OnboardingStep<TContext>[],
        private readonly _eventManager: EventManager<TContext>,
        private readonly _stateManager: StateManager<TContext>,
        private readonly _persistenceService: IPersistenceService<TContext>,
        private readonly _errorHandler: ErrorHandler<TContext>,
        logger?: Logger
    ) {
        this._logger = logger ?? new Logger({ prefix: 'NavigationOrchestrator' })

        // Initialize delegated services
        this._stepTransitionService = new StepTransitionService(this._steps, this._logger)
        this._beforeNavigationHandler = new BeforeNavigationHandler(
            this._eventManager,
            this._stateManager,
            this._errorHandler,
            this._logger
        )
        this._checklistService = new ChecklistNavigationService(this._eventManager, this._errorHandler, this._logger)
    }

    /**
     * Navigate to a specific step with full event handling.
     * Orchestrates the three services: beforeStepChange → transition → activation.
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
        this._stateManager.setLoading(true)
        this._stateManager.setError(null)

        // Step 1: Handle beforeStepChange event
        const { isCancelled, finalTargetStepId } = await this._beforeNavigationHandler.handle(
            requestedTargetStepId,
            direction,
            currentStep,
            context
        )

        if (isCancelled) {
            this._logger.debug('[NavigationOrchestrator] Navigation cancelled.')
            this._stateManager.setLoading(false)
            return currentStep
        }

        // Step 2: Find candidate step and skip conditionals
        let candidateStep: OnboardingStep<TContext> | undefined | null = findStepById(this._steps, finalTargetStepId)
        candidateStep = this._stepTransitionService.skipConditionalSteps(
            candidateStep,
            context,
            direction === 'previous' ? 'previous' : 'next'
        )

        const oldStep = currentStep
        const newCurrentStep = candidateStep ?? null

        // Step 3: Emit navigation events
        this._emitNavigationEvents(direction, currentStep, newCurrentStep, context)

        // Step 4: Handle step activation or flow completion
        if (newCurrentStep) {
            await this._handleStepActivation(newCurrentStep, oldStep, direction, context, history)
        } else {
            await this._handleFlowComplete(oldStep, direction, context, onFlowComplete)
        }

        // Step 5: Execute change callback
        if (onStepChangeCallback) {
            try {
                onStepChangeCallback(newCurrentStep, oldStep, context)
            } catch (error) {
                this._errorHandler.handleError(error, 'onStepChangeCallback', context)
            }
        }

        // Step 6: Emit stepChange event
        this._eventManager.notifyListeners('stepChange', {
            oldStep,
            newStep: newCurrentStep,
            context,
        })

        this._stateManager.setLoading(false)
        return newCurrentStep
    }

    /**
     * Calculate the next step without navigating.
     */
    calculateNextStep(currentStep: OnboardingStep<TContext>, context: TContext): OnboardingStep<TContext> | null {
        return this._stepTransitionService.findNextStepCandidate(currentStep, context) ?? null
    }

    /**
     * Calculate the previous step without navigating.
     */
    calculatePreviousStep(
        currentStep: OnboardingStep<TContext>,
        context: TContext,
        history: string[]
    ): OnboardingStep<TContext> | null {
        return this._stepTransitionService.findPreviousStepCandidate(currentStep, context, history) ?? null
    }

    /**
     * Get checklist state for a CHECKLIST step.
     */
    getChecklistState(
        step: OnboardingStep<TContext>,
        context: TContext
    ): {
        id: string
        isCompleted: boolean
    }[] {
        if (step.type !== 'CHECKLIST') {
            return []
        }
        return this._checklistService.getChecklistState(
            step as OnboardingStep<TContext> & { type: 'CHECKLIST' },
            context
        )
    }

    /**
     * Check if a checklist step is complete.
     */
    isChecklistComplete(step: OnboardingStep<TContext>, context: TContext): boolean {
        if (step.type !== 'CHECKLIST') {
            return true // Non-checklist steps are always "complete"
        }
        return this._checklistService.isChecklistComplete(
            step as OnboardingStep<TContext> & { type: 'CHECKLIST' },
            context
        )
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
        if (step.type !== 'CHECKLIST') {
            this._logger.warn(`[NavigationOrchestrator] Cannot update checklist item on non-CHECKLIST step: ${step.id}`)
            return
        }

        await this._checklistService.updateChecklistItem(
            itemId,
            isCompleted,
            step as OnboardingStep<TContext> & { type: 'CHECKLIST' },
            context,
            persistCallback
        )
    }

    /**
     * Get exposed services for advanced usage.
     */
    getStepTransitionService(): StepTransitionService<TContext> {
        return this._stepTransitionService
    }

    getChecklistService(): ChecklistNavigationService<TContext> {
        return this._checklistService
    }

    // =========================================================================
    // Private Helper Methods
    // =========================================================================

    private _emitNavigationEvents(
        direction: string,
        currentStep: OnboardingStep<TContext> | null,
        newCurrentStep: OnboardingStep<TContext> | null,
        context: TContext
    ): void {
        if (currentStep && newCurrentStep && currentStep.id !== newCurrentStep.id) {
            switch (direction) {
                case 'previous':
                    this._eventManager.notifyListeners('navigationBack', {
                        fromStep: currentStep,
                        toStep: newCurrentStep,
                        context,
                    })
                    break
                case 'next':
                    this._eventManager.notifyListeners('navigationForward', {
                        fromStep: currentStep,
                        toStep: newCurrentStep,
                        context,
                    })
                    break
                case 'goto':
                    this._eventManager.notifyListeners('navigationJump', {
                        fromStep: currentStep,
                        toStep: newCurrentStep,
                        context,
                    })
                    break
            }
        }
    }

    private async _handleStepActivation(
        newCurrentStep: OnboardingStep<TContext>,
        oldStep: OnboardingStep<TContext> | null,
        direction: string,
        context: TContext,
        history: string[]
    ): Promise<void> {
        const startTime = Date.now()

        // Record step start time
        context.flowData._internal!.stepStartTimes![String(newCurrentStep.id)] = startTime
        this._logger.debug(`[NavigationOrchestrator] Recorded step start time for '${newCurrentStep.id}': ${startTime}`)

        // Initialize checklist data on activation
        if (newCurrentStep.type === 'CHECKLIST') {
            this._checklistService.initializeChecklistItems(
                newCurrentStep as OnboardingStep<TContext> & { type: 'CHECKLIST' },
                context
            )
        }

        // Update history
        if (direction !== 'previous' && oldStep && oldStep.id !== newCurrentStep.id) {
            if (history[history.length - 1] !== String(oldStep.id)) {
                history.push(String(oldStep.id))
            }
        }

        // Execute step activation logic
        try {
            if (newCurrentStep.onStepActive) {
                await newCurrentStep.onStepActive(context)
            }
            this._eventManager.notifyListeners('stepActive', {
                step: newCurrentStep,
                context,
                startTime,
            })
        } catch (error) {
            this._errorHandler.handleError(error, `onStepActive for ${newCurrentStep.id}`, context)
        }
    }

    private async _handleFlowComplete(
        oldStep: OnboardingStep<TContext> | null,
        direction: string,
        context: TContext,
        onFlowComplete?: (context: TContext) => Promise<void> | void
    ): Promise<void> {
        this._stateManager.setCompleted(true)
        const finalContext = context

        // Calculate flow duration
        const flowStartedAt = finalContext.flowData._internal?.startedAt
        const flowDuration = flowStartedAt && flowStartedAt > 0 ? Date.now() - flowStartedAt : 0

        if (
            onFlowComplete &&
            direction !== 'initial' &&
            (!oldStep || !evaluateStepId(oldStep.nextStep, finalContext))
        ) {
            try {
                await onFlowComplete(finalContext)
            } catch (error) {
                const processedError = error instanceof Error ? error : new Error(String(error))
                this._stateManager.setError(processedError)
                this._errorHandler.handleError(error, 'onFlowComplete', context)
            }
        }

        this._eventManager.notifyListeners('flowCompleted', {
            context: finalContext,
            duration: Math.round(flowDuration),
        })

        await this._persistenceService.persistDataIfNeeded(context, null, this._stateManager.isHydrating)
    }
}
