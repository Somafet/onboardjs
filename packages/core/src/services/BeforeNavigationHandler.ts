// src/services/BeforeNavigationHandler.ts
// Handles beforeStepChange event emission and navigation cancellation/redirection
// Extracted from NavigationService as part of decomposition.

import { Logger } from './Logger'
import { OnboardingContext, OnboardingStep } from '../types'
import { ErrorHandler } from '../engine/ErrorHandler'
import { EventManager } from '../engine/EventManager'
import { StateManager } from '../engine/StateManager'
import { BeforeStepChangeEvent } from '../engine/types'

export interface BeforeNavigationResult {
    isCancelled: boolean
    finalTargetStepId: string | number | null | undefined
}

/**
 * BeforeNavigationHandler manages beforeStepChange event handling.
 * Responsible for:
 * - Checking listener count efficiently
 * - Notifying listeners sequentially
 * - Handling cancellation
 * - Handling redirection
 * - Error handling during event processing
 */
export class BeforeNavigationHandler<TContext extends OnboardingContext = OnboardingContext> {
    private readonly _logger: Logger

    constructor(
        private readonly _eventManager: EventManager<TContext>,
        private readonly _stateManager: StateManager<TContext>,
        private readonly _errorHandler: ErrorHandler<TContext>,
        logger?: Logger
    ) {
        this._logger = logger ?? Logger.getInstance({ prefix: 'BeforeNavigationHandler' })
    }

    /**
     * Process beforeStepChange event and return cancellation/redirection result.
     * Returns the final target step ID (which may be different from the requested one).
     * If cancelled, returns the original requestedTargetStepId along with cancellation flag.
     */
    async handle(
        requestedTargetStepId: string | number | null | undefined,
        direction: 'next' | 'previous' | 'skip' | 'goto' | 'initial',
        currentStep: OnboardingStep<TContext> | null,
        context: TContext
    ): Promise<BeforeNavigationResult> {
        // Early exit if no listeners
        if (this._eventManager.getListenerCount('beforeStepChange') === 0) {
            return {
                isCancelled: false,
                finalTargetStepId: requestedTargetStepId,
            }
        }

        let isCancelled = false
        let finalTargetStepId = requestedTargetStepId

        const event: BeforeStepChangeEvent<TContext> = {
            currentStep,
            targetStepId: requestedTargetStepId,
            direction,
            cancel: () => {
                isCancelled = true
                this._logger.debug('[BeforeNavigationHandler] Navigation cancelled by listener.')
            },
            redirect: (newTargetId) => {
                if (!isCancelled) {
                    finalTargetStepId = newTargetId
                    this._logger.debug(`[BeforeNavigationHandler] Navigation redirected to ${newTargetId}`)
                }
            },
        }

        try {
            await this._eventManager.notifyListenersSequential('beforeStepChange', event)
        } catch (error) {
            this._errorHandler.handleError(error, 'beforeStepChange listener', context)
            // On error during beforeStepChange, revert to loading state false and return current
            this._stateManager.setLoading(false)
            return {
                isCancelled: true,
                finalTargetStepId: requestedTargetStepId,
            }
        }

        return {
            isCancelled,
            finalTargetStepId,
        }
    }
}
