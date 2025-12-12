import { OnboardingContext } from '../types'
import { EventListenerMap, UnsubscribeFunction } from './types'
import { Logger } from '../services'

const logger = new Logger({ prefix: '[EventManager]' })

/**
 * Unified event listener handler with consistent error management
 */
export class EventManager<TContext extends OnboardingContext = OnboardingContext> {
    private _listeners: Map<keyof EventListenerMap<TContext>, Set<any>> = new Map()

    constructor() {
        // Initialize listener sets for each event type
        const eventTypes: (keyof EventListenerMap<TContext>)[] = [
            'stateChange',
            'beforeStepChange',
            'stepChange',
            'flowCompleted',
            'stepActive',
            'stepCompleted',
            'contextUpdate',
            'error',

            // Flow-level
            'flowStarted',
            'flowPaused',
            'flowResumed',
            'flowAbandoned',
            'flowReset',
            'flowRegistered',
            'flowUnregistered',

            // Step-level
            'stepSkipped',
            'stepRetried',
            'stepValidationFailed',
            'stepHelpRequested',
            'stepAbandoned',

            // Navigation
            'navigationBack',
            'navigationForward',
            'navigationJump',

            // Interaction
            'userIdle',
            'userReturned',
            'dataChanged',

            // Performance
            'stepRenderTime',
            'persistenceSuccess',
            'persistenceFailure',

            // Checklist
            'checklistItemToggled',
            'checklistProgressChanged',

            // Plugin
            'pluginInstalled',
            'pluginError',
        ]

        eventTypes.forEach((eventType) => {
            this._listeners.set(eventType, new Set())
        })
    }

    /**
     * Add an event listener with unified error handling
     */
    addEventListener<T extends keyof EventListenerMap<TContext>>(
        eventType: T,
        listener: EventListenerMap<TContext>[T]
    ): UnsubscribeFunction {
        const listenerSet = this._listeners.get(eventType)
        if (!listenerSet) {
            throw new Error(`Unknown event type: ${String(eventType)}`)
        }

        listenerSet.add(listener)
        return () => listenerSet.delete(listener)
    }

    /**
     * Notify all listeners for a specific event with consistent error handling
     */
    notifyListeners<T extends keyof EventListenerMap<TContext>>(
        eventType: T,
        ...args: Parameters<EventListenerMap<TContext>[T]>
    ): void {
        const listenerSet = this._listeners.get(eventType)
        if (!listenerSet) return

        listenerSet.forEach((listener) => {
            try {
                const result = (listener as any)(...args)
                if (result instanceof Promise) {
                    result.catch((err) => {
                        // Use legacy error message format for backward compatibility
                        const legacyEventName =
                            eventType === 'flowCompleted'
                                ? 'async onFlowHasCompleted'
                                : this._getLegacyEventName(eventType)
                        logger.error(`Error in ${legacyEventName} listener:`, err)
                    })
                }
            } catch (err) {
                // Use legacy error message format for backward compatibility
                const legacyEventName =
                    eventType === 'flowCompleted' ? 'sync onFlowHasCompleted' : this._getLegacyEventName(eventType)
                logger.error(`Error in ${legacyEventName} listener:`, err)
            }
        })
    }

    /**
     * Get legacy event name for error messages to maintain backward compatibility
     */
    private _getLegacyEventName<T extends keyof EventListenerMap<TContext>>(eventType: T): string {
        switch (eventType) {
            case 'stepChange':
                return 'stepChange'
            case 'stateChange':
                return 'stateChange'
            case 'beforeStepChange':
                return 'beforeStepChange'
            case 'stepActive':
                return 'stepActive'
            case 'stepCompleted':
                return 'stepCompleted'
            case 'contextUpdate':
                return 'contextUpdate'
            case 'error':
                return 'error'
            default:
                return String(eventType)
        }
    }

    /**
     * Notify listeners with promise resolution for sequential execution
     */
    async notifyListenersSequential<T extends keyof EventListenerMap<TContext>>(
        eventType: T,
        ...args: Parameters<EventListenerMap<TContext>[T]>
    ): Promise<void> {
        const listenerSet = this._listeners.get(eventType)
        if (!listenerSet) return

        for (const listener of listenerSet) {
            try {
                const result = (listener as any)(...args)
                if (result instanceof Promise) {
                    await result
                }
            } catch (err) {
                logger.error(`Error in sequential ${String(eventType)} listener:`, err)
                throw err // Re-throw for beforeStepChange cancellation logic
            }
        }
    }

    /**
     * Get the number of listeners for an event type
     */
    getListenerCount<T extends keyof EventListenerMap<TContext>>(eventType: T): number {
        return this._listeners.get(eventType)?.size || 0
    }

    /**
     * Clear all listeners
     */
    clearAllListeners(): void {
        this._listeners.forEach((listenerSet) => listenerSet.clear())
    }
}
