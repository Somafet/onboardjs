// src/engine/__tests__/EventManager.test.ts
import { describe, it, expect, beforeEach, vi, afterEach, MockInstance } from 'vitest'
import { OnboardingContext } from '../types'
import { EventManager } from './EventManager'
import { EventListenerMap, StepChangeEvent } from './types'

// Mock context and event listener map for testing
interface TestContext extends OnboardingContext {
    testData?: string
}

type TestEventListenerMap = EventListenerMap<TestContext> & {
    customEvent: (data: { detail: string }) => void | Promise<void>
}

describe('EventManager', () => {
    let eventManager: EventManager<TestContext>
    let consoleErrorSpy: MockInstance<typeof console.error>

    const knownEventTypes: (keyof TestEventListenerMap)[] = [
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

    beforeEach(() => {
        eventManager = new EventManager<TestContext>()
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.useRealTimers()
    })

    describe('Constructor', () => {
        it('should initialize listener sets for all predefined event types', () => {
            knownEventTypes.forEach((eventType) => {
                expect(eventManager.getListenerCount(eventType as keyof EventListenerMap<TestContext>)).toBe(0)
            })
        })
    })

    describe('addEventListener', () => {
        it('should add a listener and return an unsubscribe function', () => {
            const listener = vi.fn(() => {})
            const unsubscribe = eventManager.addEventListener('stepChange', listener)
            expect(eventManager.getListenerCount('stepChange')).toBe(1)
            expect(typeof unsubscribe).toBe('function')
        })

        it('should remove the listener when unsubscribe function is called', () => {
            const listener = vi.fn()
            const unsubscribe = eventManager.addEventListener('stepChange', listener)
            unsubscribe()
            expect(eventManager.getListenerCount('stepChange')).toBe(0)
        })

        it('should allow multiple listeners for the same event', () => {
            const listener1 = vi.fn()
            const listener2 = vi.fn()
            eventManager.addEventListener('stepChange', listener1)
            eventManager.addEventListener('stepChange', listener2)
            expect(eventManager.getListenerCount('stepChange')).toBe(2)
        })

        it('should throw an error if trying to add a listener for an unknown event type', () => {
            const listener = vi.fn()
            expect(() =>
                eventManager.addEventListener('unknownEvent' as keyof EventListenerMap<TestContext>, listener)
            ).toThrowError('Unknown event type: unknownEvent')
        })

        it('unsubscribe function should be idempotent', () => {
            const listener = vi.fn()
            const unsubscribe = eventManager.addEventListener('stepChange', listener)
            unsubscribe()
            expect(() => unsubscribe()).not.toThrow()
            expect(eventManager.getListenerCount('stepChange')).toBe(0)
        })
    })

    describe('notifyListeners', () => {
        it('should call all registered listeners with a single event object', () => {
            const listener1 = vi.fn()
            const listener2 = vi.fn()
            eventManager.addEventListener('stepChange', listener1)
            eventManager.addEventListener('stepChange', listener2)

            const eventPayload: StepChangeEvent<TestContext> = {
                newStep: { id: 'new', type: 'INFORMATION' } as any,
                oldStep: { id: 'old', type: 'INFORMATION' } as any,
                context: { flowData: {} } as TestContext,
            }

            eventManager.notifyListeners('stepChange', eventPayload)

            expect(listener1).toHaveBeenCalledWith(eventPayload)
            expect(listener2).toHaveBeenCalledWith(eventPayload)
        })

        it('should handle synchronous listeners that throw errors and log them', () => {
            const erroringListener = vi.fn(() => {
                throw new Error('Sync error')
            })
            const normalListener = vi.fn()
            eventManager.addEventListener('error', erroringListener)
            eventManager.addEventListener('error', normalListener)

            const eventPayload = {
                error: new Error('Test error'),
                context: {} as TestContext,
            }
            eventManager.notifyListeners('error', eventPayload)

            expect(erroringListener).toHaveBeenCalledWith(eventPayload)
            expect(normalListener).toHaveBeenCalledWith(eventPayload)
            // The new implementation just uses the eventType string in the error
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error in error listener:', new Error('Sync error'))
        })

        it('should handle async listeners that reject and log the error', async () => {
            const rejectingListener = vi.fn(async () => {
                throw new Error('Async reject')
            })
            eventManager.addEventListener('flowCompleted', rejectingListener)
            const eventPayload = { context: {} as TestContext, duration: 1000 }
            eventManager.notifyListeners('flowCompleted', eventPayload)

            expect(rejectingListener).toHaveBeenCalledWith(eventPayload)

            await vi.runAllTimersAsync()

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error in async onFlowHasCompleted listener:',
                new Error('Async reject')
            )
        })
    })

    describe('notifyListenersSequential', () => {
        it('should call all registered listeners sequentially and await promises', async () => {
            const executionOrder: number[] = []
            const listener1 = vi.fn(async () => {
                await new Promise((resolve) => setTimeout(resolve, 20))
                executionOrder.push(1)
            })
            const listener2 = vi.fn(() => {
                // Sync listener
                executionOrder.push(2)
            })
            const listener3 = vi.fn(async () => {
                await new Promise((resolve) => setTimeout(resolve, 10))
                executionOrder.push(3)
            })

            eventManager.addEventListener('beforeStepChange', listener1)
            eventManager.addEventListener('beforeStepChange', listener2)
            eventManager.addEventListener('beforeStepChange', listener3)

            const eventArg = {} as any // Mock BeforeStepChangeEvent
            const promise = eventManager.notifyListenersSequential('beforeStepChange', eventArg)

            // Advance timers to allow promises to resolve
            await vi.advanceTimersByTimeAsync(20) // For listener1
            await vi.advanceTimersByTimeAsync(10) // For listener3
            await promise

            expect(listener1).toHaveBeenCalledWith(eventArg)
            expect(listener2).toHaveBeenCalledWith(eventArg)
            expect(listener3).toHaveBeenCalledWith(eventArg)
            expect(executionOrder).toEqual([1, 2, 3])
        })

        it('should re-throw errors from synchronous listeners', async () => {
            const erroringListener = vi.fn(() => {
                throw new Error('Sequential sync error')
            })
            eventManager.addEventListener('beforeStepChange', erroringListener)
            const eventArg = {} as any

            await expect(eventManager.notifyListenersSequential('beforeStepChange', eventArg)).rejects.toThrow(
                'Sequential sync error'
            )
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[OnboardingEngine] Error in sequential beforeStepChange listener:',
                new Error('Sequential sync error')
            )
        })

        it('should re-throw errors from rejected async listeners', async () => {
            const rejectingListener = vi.fn(async () => {
                throw new Error('Sequential async reject')
            })
            eventManager.addEventListener('beforeStepChange', rejectingListener)
            const eventArg = {} as any

            await expect(eventManager.notifyListenersSequential('beforeStepChange', eventArg)).rejects.toThrow(
                'Sequential async reject'
            )
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[OnboardingEngine] Error in sequential beforeStepChange listener:',
                new Error('Sequential async reject')
            )
        })

        it('should do nothing if no listeners are registered for sequential notification', async () => {
            const eventArg = {} as any
            await expect(eventManager.notifyListenersSequential('beforeStepChange', eventArg)).resolves.toBeUndefined()
            expect(consoleErrorSpy).not.toHaveBeenCalled()
        })

        it('should stop execution and re-throw if a listener throws, not calling subsequent listeners', async () => {
            const listener1 = vi.fn()
            const erroringListener = vi.fn(() => {
                throw new Error('Stop here')
            })
            const listener3 = vi.fn()

            eventManager.addEventListener('beforeStepChange', listener1)
            eventManager.addEventListener('beforeStepChange', erroringListener)
            eventManager.addEventListener('beforeStepChange', listener3)

            const eventArg = {} as any
            await expect(eventManager.notifyListenersSequential('beforeStepChange', eventArg)).rejects.toThrow(
                'Stop here'
            )

            expect(listener1).toHaveBeenCalledTimes(1)
            expect(erroringListener).toHaveBeenCalledTimes(1)
            expect(listener3).not.toHaveBeenCalled()
        })
    })

    describe('getListenerCount', () => {
        it('should return the correct number of listeners for an event type', () => {
            eventManager.addEventListener('stepChange', vi.fn())
            eventManager.addEventListener('stepChange', vi.fn())
            expect(eventManager.getListenerCount('stepChange')).toBe(2)
        })

        it('should return 0 for an event type with no listeners', () => {
            expect(eventManager.getListenerCount('flowCompleted')).toBe(0)
        })

        it('should return 0 for an unknown event type', () => {
            // @ts-expect-error Testing unknown event type
            expect(eventManager.getListenerCount('unknownEvent')).toBe(0)
        })
    })

    describe('clearAllListeners', () => {
        it('should remove all listeners for all event types', () => {
            eventManager.addEventListener('stepChange', vi.fn())
            eventManager.addEventListener('flowCompleted', vi.fn())
            eventManager.addEventListener('error', vi.fn())

            eventManager.clearAllListeners()

            knownEventTypes.forEach((eventType) => {
                expect(eventManager.getListenerCount(eventType as keyof EventListenerMap<TestContext>)).toBe(0)
            })
        })

        it('should be idempotent', () => {
            eventManager.clearAllListeners()
            expect(() => eventManager.clearAllListeners()).not.toThrow()
        })
    })

    describe('getLegacyEventName', () => {
        // Access private method for testing (common pattern in JS/TS testing)
        const getLegacyName = (em: EventManager<any>, eventType: keyof EventListenerMap<any>) => {
            return (em as any).getLegacyEventName(eventType)
        }

        it('should return correct legacy names for specific event types', () => {
            expect(getLegacyName(eventManager, 'stepChange')).toBe('stepChange')
            expect(getLegacyName(eventManager, 'stateChange')).toBe('stateChange')
            expect(getLegacyName(eventManager, 'beforeStepChange')).toBe('beforeStepChange')
            expect(getLegacyName(eventManager, 'stepActive')).toBe('stepActive')
            expect(getLegacyName(eventManager, 'stepCompleted')).toBe('stepCompleted')
            expect(getLegacyName(eventManager, 'contextUpdate')).toBe('contextUpdate')
            expect(getLegacyName(eventManager, 'error')).toBe('error')
        })

        it('should return stringified event type for other event types (default case)', () => {
            // This requires adding a custom event type to our TestEventListenerMap
            // For this test, we'll cast to any to simulate an event type not in the switch
            expect(getLegacyName(eventManager, 'customEvent' as any)).toBe('customEvent')
            expect(getLegacyName(eventManager, 'anotherRandomEvent' as any)).toBe('anotherRandomEvent')
        })
    })
})
