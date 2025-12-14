// src/engine/services/ChecklistManager.ts

import { OnboardingContext, OnboardingStep, ChecklistItemState, ChecklistStepPayload } from '../types'
import { ErrorHandler } from './ErrorHandler'
import { EventManager } from './EventManager'
import { Logger } from '../services/Logger'

export class ChecklistManager<TContext extends OnboardingContext> {
    private _logger: Logger

    constructor(
        private _eventManager: EventManager<TContext>,
        private _errorHandler: ErrorHandler<TContext>
    ) {
        this._logger = Logger.getInstance({ prefix: 'ChecklistManager' })
    }

    /**
     * Type guard to verify that a step has a valid ChecklistStepPayload
     */
    private _isValidChecklistPayload(payload: any): payload is ChecklistStepPayload<TContext> {
        return (
            payload &&
            typeof payload === 'object' &&
            'dataKey' in payload &&
            typeof payload.dataKey === 'string' &&
            'items' in payload &&
            Array.isArray(payload.items)
        )
    }

    getChecklistItemsState(
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

    isChecklistStepComplete(step: OnboardingStep<TContext> & { type: 'CHECKLIST' }, context: TContext): boolean {
        const itemStates = this.getChecklistItemsState(step, context)
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

    async updateChecklistItem(
        itemId: string,
        isCompleted: boolean,
        step: OnboardingStep<TContext> & { type: 'CHECKLIST' },
        context: TContext,
        persistCallback?: () => Promise<void>
    ): Promise<void> {
        // TASK-036: Step existence check
        if (!step) {
            const error = new Error('Cannot update checklist item: step is null or undefined')
            this._logger.error('Step existence check failed in updateChecklistItem')
            this._errorHandler.handleError(error, 'updateChecklistItem - step existence', context)
            return
        }

        // TASK-037: Step type validation
        if (step.type !== 'CHECKLIST') {
            const error = new Error(
                `Cannot update checklist item: step '${step.id}' is not a CHECKLIST step (type: ${step.type})`
            )
            this._logger.error(`Step type validation failed: expected CHECKLIST, got ${step.type}`)
            this._errorHandler.handleError(error, 'updateChecklistItem - step type validation', context)
            return
        }

        // TASK-039: Payload type guard validation
        if (!this._isValidChecklistPayload(step.payload)) {
            const error = new Error(`Cannot update checklist item: step '${step.id}' has invalid payload structure`)
            this._logger.error('Payload type guard validation failed in updateChecklistItem', {
                stepId: step.id,
                hasPayload: !!step.payload,
                hasDataKey: step.payload && 'dataKey' in step.payload,
                hasItems: step.payload && 'items' in step.payload,
            })
            this._errorHandler.handleError(error, 'updateChecklistItem - payload validation', context)
            return
        }

        const payload = step.payload as ChecklistStepPayload<TContext>
        const { dataKey } = payload

        // TASK-038: Item ID existence check
        const itemDefExists = payload.items.some((def) => def.id === itemId)
        if (!itemDefExists) {
            const error = new Error(
                `Cannot update checklist item: item '${itemId}' does not exist in step '${step.id}'`
            )
            this._logger.warn(`Item ID validation failed: '${itemId}' not found in checklist definitions`, {
                stepId: step.id,
                itemId,
                availableItems: payload.items.map((item) => item.id),
            })
            this._errorHandler.handleError(error, 'updateChecklistItem - item existence', context)
            return
        }

        let itemStates = (context.flowData[dataKey] as ChecklistItemState[] | undefined) || []
        const itemIndex = itemStates.findIndex((item) => item.id === itemId)

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
            // Create a new array for immutability
            const newItemStates = [...itemStates]
            newItemStates[itemIndex] = { ...newItemStates[itemIndex], isCompleted }
            itemStates = newItemStates
        } else {
            // Item state doesn't exist, create it
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

    getChecklistProgress(
        step: OnboardingStep<TContext> & { type: 'CHECKLIST' },
        context: TContext
    ): {
        completed: number
        total: number
        percentage: number
        isComplete: boolean
    } {
        const itemStates = this.getChecklistItemsState(step, context)
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
        const isComplete = this.isChecklistStepComplete(step, context)

        return {
            completed: completedItems,
            total: totalItems,
            percentage: Math.round(percentage),
            isComplete,
        }
    }
}
