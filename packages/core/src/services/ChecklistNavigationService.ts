// src/services/ChecklistNavigationService.ts
// Handles checklist-specific functionality
// Extracted from NavigationService as part of decomposition.

import { Logger } from './Logger'
import { OnboardingContext, OnboardingStep, ChecklistStepPayload, ChecklistItemState } from '../types'
import { ErrorHandler } from '../engine/ErrorHandler'
import { EventManager } from '../engine/EventManager'

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
 * ChecklistNavigationService handles all checklist-specific operations.
 * Responsible for:
 * - Checklist state retrieval and initialization
 * - Completion validation
 * - Item updates and persistence
 * - Progress calculation
 *
 * Extracted from NavigationService as part of decomposition.
 */
export class ChecklistNavigationService<TContext extends OnboardingContext = OnboardingContext> {
    private readonly _logger: Logger

    constructor(
        private readonly _eventManager: EventManager<TContext>,
        private readonly _errorHandler: ErrorHandler<TContext>,
        logger?: Logger
    ) {
        this._logger = logger ?? new Logger({ prefix: 'ChecklistNavigationService' })
    }

    /**
     * Get checklist item state for a CHECKLIST step.
     * Initializes state if needed.
     */
    getChecklistState(step: OnboardingStep<TContext> & { type: 'CHECKLIST' }, context: TContext): ChecklistItemState[] {
        return this._getChecklistItemsState(step, context)
    }

    /**
     * Check if a checklist step is complete.
     */
    isChecklistComplete(step: OnboardingStep<TContext> & { type: 'CHECKLIST' }, context: TContext): boolean {
        return this._isChecklistStepComplete(step, context)
    }

    /**
     * Update a checklist item.
     */
    async updateChecklistItem(
        itemId: string,
        isCompleted: boolean,
        step: OnboardingStep<TContext> & { type: 'CHECKLIST' },
        context: TContext,
        persistCallback?: () => Promise<void>
    ): Promise<void> {
        await this._updateChecklistItem(itemId, isCompleted, step, context, persistCallback)
    }

    /**
     * Get checklist progress for a step.
     */
    getChecklistProgress(step: OnboardingStep<TContext> & { type: 'CHECKLIST' }, context: TContext): ChecklistProgress {
        const itemStates = this._getChecklistItemsState(step, context)
        const { items: itemDefinitions } = step.payload

        let totalItems = 0
        let completedItems = 0

        for (const def of itemDefinitions) {
            if (def.condition && !def.condition(context)) {
                continue
            }

            totalItems++
            const state = itemStates.find((s) => s.id === def.id)
            if (state?.isCompleted) {
                completedItems++
            }
        }

        const percentage = totalItems > 0 ? (completedItems / totalItems) * 100 : 0
        const isComplete = this._isChecklistStepComplete(step, context)

        return {
            completed: completedItems,
            total: totalItems,
            percentage: Math.round(percentage),
            isComplete,
        }
    }

    /**
     * Initialize checklist item states for a step.
     */
    initializeChecklistItems(step: OnboardingStep<TContext> & { type: 'CHECKLIST' }, context: TContext): void {
        this._getChecklistItemsState(step, context)
    }

    // =========================================================================
    // Private Methods
    // =========================================================================

    private _getChecklistItemsState(
        step: OnboardingStep<TContext> & { type: 'CHECKLIST' },
        context: TContext
    ): ChecklistItemState[] {
        const { dataKey, items: itemDefinitions } = step.payload
        let currentItemStates = context.flowData[dataKey] as ChecklistItemState[] | undefined

        if (!currentItemStates || currentItemStates.length !== itemDefinitions.length) {
            // Initialize or re-initialize if structure mismatch
            currentItemStates = itemDefinitions.map((def) => ({
                id: def.id,
                isCompleted: false,
            }))

            // Persist this initial state
            context.flowData = {
                ...context.flowData,
                [dataKey]: [...currentItemStates],
            }
        }

        return currentItemStates
    }

    private _isChecklistStepComplete(
        step: OnboardingStep<TContext> & { type: 'CHECKLIST' },
        context: TContext
    ): boolean {
        const itemStates = this._getChecklistItemsState(step, context)
        const { items: itemDefinitions, minItemsToComplete } = step.payload
        let completedCount = 0
        let mandatoryPending = 0

        for (const def of itemDefinitions) {
            if (def.condition && !def.condition(context)) {
                continue
            }

            const state = itemStates.find((s) => s.id === def.id)
            const isMandatory = def.isMandatory !== false

            if (state?.isCompleted) {
                completedCount++
            } else if (isMandatory) {
                mandatoryPending++
            }
        }

        if (typeof minItemsToComplete === 'number') {
            return completedCount >= minItemsToComplete
        } else {
            return mandatoryPending === 0
        }
    }

    private async _updateChecklistItem(
        itemId: string,
        isCompleted: boolean,
        step: OnboardingStep<TContext> & { type: 'CHECKLIST' },
        context: TContext,
        persistCallback?: () => Promise<void>
    ): Promise<void> {
        const payload = step.payload as ChecklistStepPayload
        const { dataKey } = payload

        let itemStates = (context.flowData[dataKey] as ChecklistItemState[] | undefined) || []
        const itemIndex = itemStates.findIndex((item) => item.id === itemId)

        // Ensure item definitions exist
        const itemDefExists = payload.items.some((def) => def.id === itemId)
        if (!itemDefExists) {
            this._logger.warn(
                `[ChecklistNavigationService] Attempted to update non-existent checklist item '${itemId}' for step '${step.id}'.`
            )
            return
        }

        this._eventManager.notifyListeners('checklistItemToggled', {
            itemId,
            isCompleted,
            step,
            context,
        })

        const progress = this.getChecklistProgress(step, context)
        this._eventManager.notifyListeners('checklistProgressChanged', {
            step,
            context,
            progress,
        })

        if (itemIndex !== -1) {
            const newItemStates = [...itemStates]
            newItemStates[itemIndex] = { ...newItemStates[itemIndex], isCompleted }
            itemStates = newItemStates
        } else {
            itemStates = [...itemStates, { id: itemId, isCompleted }]
        }

        // Update flowData
        const oldFlowDataJSON = JSON.stringify(context.flowData)
        context.flowData = {
            ...context.flowData,
            [dataKey]: itemStates,
        }

        if (JSON.stringify(context.flowData) !== oldFlowDataJSON && persistCallback) {
            try {
                await persistCallback()
            } catch (error) {
                this._errorHandler.handleError(error, 'updateChecklistItem persistence', context)
            }
        }
    }
}
