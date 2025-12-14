// src/engine/services/ErrorHandler.ts

import { Logger } from '../services'
import { OnboardingContext } from '../types'
import { err, ok, Result } from '../types/Result'
import { EventManager } from './EventManager'
import { StateManager } from './StateManager'

export interface ErrorContext {
    operation: string
    stepId?: string | number
    timestamp: number
    stack?: string
}

export class ErrorHandler<TContext extends OnboardingContext> {
    private _errorHistory: Array<{
        error: Error
        context: ErrorContext
        engineContext: TContext
    }> = []
    private _maxHistorySize = 50
    private _logger: Logger

    constructor(
        private _eventManager: EventManager<TContext>,
        private _stateManager: StateManager<TContext>
    ) {
        this._logger = Logger.getInstance({
            prefix: '[ErrorHandler]',
        })
    }

    handleError(error: unknown, operation: string, engineContext: TContext, stepId?: string | number): Error {
        const processedError = error instanceof Error ? error : new Error(String(error))

        const errorContext: ErrorContext = {
            operation,
            stepId,
            timestamp: Date.now(),
            stack: processedError.stack,
        }

        this._errorHistory.push({
            error: processedError,
            context: errorContext,
            engineContext: { ...engineContext }, // Store a snapshot
        })

        // Trim history if needed
        if (this._errorHistory.length > this._maxHistorySize) {
            this._errorHistory.shift()
        }

        this._logger.error(`[OnboardingEngine] ${operation}:`, processedError, errorContext)

        this._stateManager.setError(processedError)

        // Notify error listeners
        this._eventManager.notifyListeners('error', {
            error: processedError,
            context: engineContext,
        })

        return processedError
    }

    async safeExecute<T>(
        operation: () => Promise<T>,
        operationName: string,
        engineContext: TContext,
        stepId?: string | number
    ): Promise<Result<T, Error>> {
        try {
            return ok(await operation())
        } catch (error) {
            this.handleError(error, operationName, engineContext, stepId)
            return err(error as Error)
        }
    }

    safeExecuteSync<T>(
        operation: () => T,
        operationName: string,
        engineContext: TContext,
        stepId?: string | number
    ): Result<T, Error> {
        try {
            return ok(operation())
        } catch (error) {
            this.handleError(error, operationName, engineContext, stepId)
            return err(error as Error)
        }
    }

    getErrorHistory(): Array<{
        error: Error
        context: ErrorContext
        engineContext: TContext
    }> {
        return [...this._errorHistory]
    }

    getRecentErrors(count: number = 10): Array<{
        error: Error
        context: ErrorContext
        engineContext: TContext
    }> {
        if (count <= 0) {
            return []
        }
        return this._errorHistory.slice(-count)
    }

    clearErrorHistory(): void {
        this._errorHistory = []
    }

    hasErrors(): boolean {
        return this._errorHistory.length > 0
    }

    getErrorsByOperation(operation: string): Array<{
        error: Error
        context: ErrorContext
        engineContext: TContext
    }> {
        return this._errorHistory.filter((entry) => entry.context.operation.includes(operation))
    }

    getErrorsByStep(stepId: string | number): Array<{
        error: Error
        context: ErrorContext
        engineContext: TContext
    }> {
        return this._errorHistory.filter((entry) => entry.context.stepId === stepId)
    }
}
