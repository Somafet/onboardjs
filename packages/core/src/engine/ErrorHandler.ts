// src/engine/services/ErrorHandler.ts

import { OnboardingContext } from '../types'
import { EventManager } from './EventManager'
import { StateManager } from './StateManager'

export interface ErrorContext {
    operation: string
    stepId?: string | number
    timestamp: number
    stack?: string
}

export class ErrorHandler<TContext extends OnboardingContext> {
    private errorHistory: Array<{
        error: Error
        context: ErrorContext
        engineContext: TContext
    }> = []
    private maxHistorySize = 50

    constructor(
        private eventManager: EventManager<TContext>,
        private stateManager: StateManager<TContext>
    ) {}

    handleError(error: unknown, operation: string, engineContext: TContext, stepId?: string | number): Error {
        const processedError = error instanceof Error ? error : new Error(String(error))

        const errorContext: ErrorContext = {
            operation,
            stepId,
            timestamp: Date.now(),
            stack: processedError.stack,
        }

        this.errorHistory.push({
            error: processedError,
            context: errorContext,
            engineContext: { ...engineContext }, // Store a snapshot
        })

        // Trim history if needed
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory.shift()
        }

        console.error(`[OnboardingEngine] ${operation}:`, processedError, errorContext)

        this.stateManager.setError(processedError)

        // Notify error listeners
        this.eventManager.notifyListeners('error', {
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
    ): Promise<T | null> {
        try {
            return await operation()
        } catch (error) {
            this.handleError(error, operationName, engineContext, stepId)
            return null
        }
    }

    safeExecuteSync<T>(
        operation: () => T,
        operationName: string,
        engineContext: TContext,
        stepId?: string | number
    ): T | null {
        try {
            return operation()
        } catch (error) {
            this.handleError(error, operationName, engineContext, stepId)
            return null
        }
    }

    getErrorHistory(): Array<{
        error: Error
        context: ErrorContext
        engineContext: TContext
    }> {
        return [...this.errorHistory]
    }

    getRecentErrors(count: number = 10): Array<{
        error: Error
        context: ErrorContext
        engineContext: TContext
    }> {
        if (count <= 0) {
            return []
        }
        return this.errorHistory.slice(-count)
    }

    clearErrorHistory(): void {
        this.errorHistory = []
    }

    hasErrors(): boolean {
        return this.errorHistory.length > 0
    }

    getErrorsByOperation(operation: string): Array<{
        error: Error
        context: ErrorContext
        engineContext: TContext
    }> {
        return this.errorHistory.filter((entry) => entry.context.operation.includes(operation))
    }

    getErrorsByStep(stepId: string | number): Array<{
        error: Error
        context: ErrorContext
        engineContext: TContext
    }> {
        return this.errorHistory.filter((entry) => entry.context.stepId === stepId)
    }
}
