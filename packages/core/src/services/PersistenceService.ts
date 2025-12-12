// src/services/PersistenceService.ts
// Data persistence service that handles loading, saving, and clearing persisted data.
// This is the consolidated service maintaining PersistenceManager functionality.

import { OnboardingContext } from '../types'
import { ErrorHandler } from '../engine/ErrorHandler'
import { EventManager } from '../engine/EventManager'
import { Logger } from './Logger'
import { DataLoadFn, DataPersistFn, LoadedData } from '../engine/types'
import type { IPersistenceService } from './interfaces'

/**
 * PersistenceService handles data persistence operations for the onboarding flow.
 *
 * This service is responsible for:
 * - Loading persisted state on initialization
 * - Persisting state changes during navigation
 * - Clearing persisted data on reset
 * - Emitting persistence events for monitoring
 *
 * @example
 * ```typescript
 * const persistenceService = new PersistenceService(
 *   async () => localStorage.getItem('onboarding'),
 *   async (context, stepId) => localStorage.setItem('onboarding', JSON.stringify({ context, stepId })),
 *   async () => localStorage.removeItem('onboarding'),
 *   errorHandler,
 *   eventManager
 * )
 *
 * // Load persisted data
 * const { data, error } = await persistenceService.loadPersistedData()
 *
 * // Persist current state
 * await persistenceService.persistDataIfNeeded(context, 'step-1', false)
 * ```
 */
export class PersistenceService<
    TContext extends OnboardingContext = OnboardingContext,
> implements IPersistenceService<TContext> {
    private _loadData?: DataLoadFn<TContext>
    private _persistData?: DataPersistFn<TContext>
    private _clearPersistedData?: () => Promise<void> | void
    private _logger: Logger

    constructor(
        loadData?: DataLoadFn<TContext>,
        persistData?: DataPersistFn<TContext>,
        clearPersistedData?: () => Promise<void> | void,
        private readonly _errorHandler?: ErrorHandler<TContext>,
        private readonly _eventManager?: EventManager<TContext>,
        debugMode?: boolean
    ) {
        this._loadData = loadData
        this._persistData = persistData
        this._clearPersistedData = clearPersistedData
        this._logger = new Logger({
            debugMode: debugMode ?? false,
            prefix: 'PersistenceService',
        })
    }

    // =============================================================================
    // CORE OPERATIONS
    // =============================================================================

    /**
     * Load persisted data from storage
     */
    async loadPersistedData(): Promise<{
        data: LoadedData<TContext> | null
        error: Error | null
    }> {
        if (!this._loadData) {
            return { data: null, error: null }
        }

        try {
            this._logger.debug('Attempting to load persisted data...')
            const loadedData = await this._loadData()
            this._logger.debug('Data loaded successfully:', {
                hasFlowData: !!loadedData?.flowData,
                currentStepId: loadedData?.currentStepId,
                otherKeys: loadedData
                    ? Object.keys(loadedData).filter((k) => k !== 'flowData' && k !== 'currentStepId')
                    : [],
            })
            return { data: loadedData ?? null, error: null }
        } catch (error) {
            this._logger.error('Error during loadData:', error)
            const processedError = error instanceof Error ? error : new Error(String(error))
            const finalError = new Error(`Failed to load onboarding state: ${processedError.message}`)
            return { data: null, error: finalError }
        }
    }

    /**
     * Persist data if persistence is configured and not currently hydrating
     */
    async persistDataIfNeeded(
        context: TContext,
        currentStepId: string | number | null,
        isHydrating: boolean
    ): Promise<void> {
        if (isHydrating || !this._persistData) {
            return
        }

        const startTime = Date.now()

        try {
            this._logger.debug('Persisting data for step:', currentStepId)
            await this._persistData(context, currentStepId)

            const persistenceTime = Date.now() - startTime

            this._eventManager?.notifyListeners('persistenceSuccess', {
                context,
                persistenceTime,
            })

            this._logger.debug('Data persisted successfully')
        } catch (error) {
            this._eventManager?.notifyListeners('persistenceFailure', {
                context,
                error: error as Error,
            })
            this._logger.error('Error during persistData:', error)
            if (this._errorHandler) {
                this._errorHandler.handleError(error, 'persistData', context)
            }
            // Don't throw - persistence errors shouldn't block core functionality
        }
    }

    /**
     * Clear all persisted data
     */
    async clearData(): Promise<void> {
        if (!this._clearPersistedData) {
            this._logger.debug('No clearPersistedData handler configured')
            return
        }

        try {
            this._logger.debug('Clearing persisted data...')
            await this._clearPersistedData()
            this._logger.debug('Persisted data cleared successfully')
        } catch (error) {
            this._logger.error('Error during clearPersistedData:', error)
            throw error
        }
    }

    // =============================================================================
    // HANDLER MANAGEMENT
    // =============================================================================

    /**
     * Set the data load handler
     */
    setDataLoadHandler(handler?: DataLoadFn<TContext>): void {
        this._loadData = handler
    }

    /**
     * Set the data persist handler
     */
    setDataPersistHandler(handler?: DataPersistFn<TContext>): void {
        this._persistData = handler
    }

    /**
     * Set the clear persisted data handler
     */
    setClearPersistedDataHandler(handler?: () => Promise<void> | void): void {
        this._clearPersistedData = handler
    }

    // =============================================================================
    // HANDLER GETTERS
    // =============================================================================

    /**
     * Get the current data load handler
     */
    getDataLoadHandler(): DataLoadFn<TContext> | undefined {
        return this._loadData
    }

    /**
     * Get the current data persist handler
     */
    getDataPersistHandler(): DataPersistFn<TContext> | undefined {
        return this._persistData
    }

    /**
     * Get the current clear persisted data handler
     */
    getClearPersistedDataHandler(): (() => Promise<void> | void) | undefined {
        return this._clearPersistedData
    }
}
