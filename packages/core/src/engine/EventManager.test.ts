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
            // Logger now includes prefix and [ERROR] label
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[EventManager] [ERROR]',
                'Error in error listener:',
                new Error('Sync error')
            )
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
                '[EventManager] [ERROR]',
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
                '[EventManager] [ERROR]',
                'Error in sequential beforeStepChange listener:',
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
                '[EventManager] [ERROR]',
                'Error in sequential beforeStepChange listener:',
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

    describe('hasListeners', () => {
        it('should return true when listeners are registered', () => {
            eventManager.addEventListener('stepChange', vi.fn())
            expect(eventManager.hasListeners('stepChange')).toBe(true)
        })

        it('should return false when no listeners are registered', () => {
            expect(eventManager.hasListeners('flowCompleted')).toBe(false)
        })

        it('should return false for unknown event types', () => {
            // @ts-expect-error Testing unknown event type
            expect(eventManager.hasListeners('unknownEvent')).toBe(false)
        })

        it('should update correctly when listeners are added and removed', () => {
            const unsubscribe = eventManager.addEventListener('stepChange', vi.fn())
            expect(eventManager.hasListeners('stepChange')).toBe(true)

            unsubscribe()
            expect(eventManager.hasListeners('stepChange')).toBe(false)
        })

        it('should handle multiple listeners correctly', () => {
            const unsubscribe1 = eventManager.addEventListener('stepChange', vi.fn())
            const unsubscribe2 = eventManager.addEventListener('stepChange', vi.fn())

            expect(eventManager.hasListeners('stepChange')).toBe(true)

            unsubscribe1()
            expect(eventManager.hasListeners('stepChange')).toBe(true) // Still has one listener

            unsubscribe2()
            expect(eventManager.hasListeners('stepChange')).toBe(false) // Now has no listeners
        })

        it('should be consistent with getListenerCount', () => {
            expect(eventManager.hasListeners('stepChange')).toBe(eventManager.getListenerCount('stepChange') > 0)

            eventManager.addEventListener('stepChange', vi.fn())
            expect(eventManager.hasListeners('stepChange')).toBe(eventManager.getListenerCount('stepChange') > 0)
        })
    })

    describe('hasAnyListeners', () => {
        it('should return true if any of the specified events have listeners', () => {
            eventManager.addEventListener('stepChange', vi.fn())
            expect(eventManager.hasAnyListeners('stepChange', 'flowCompleted', 'error')).toBe(true)
        })

        it('should return false if none of the specified events have listeners', () => {
            expect(eventManager.hasAnyListeners('stepChange', 'flowCompleted', 'error')).toBe(false)
        })

        it('should handle single event type', () => {
            eventManager.addEventListener('stepChange', vi.fn())
            expect(eventManager.hasAnyListeners('stepChange')).toBe(true)
            expect(eventManager.hasAnyListeners('flowCompleted')).toBe(false)
        })

        it('should handle multiple event types with mixed listener states', () => {
            eventManager.addEventListener('stepChange', vi.fn())
            eventManager.addEventListener('error', vi.fn())

            expect(eventManager.hasAnyListeners('stepChange', 'flowCompleted')).toBe(true)
            expect(eventManager.hasAnyListeners('error', 'stepActive')).toBe(true)
            expect(eventManager.hasAnyListeners('flowCompleted', 'stepActive')).toBe(false)
        })
    })

    describe('Concurrent listener add/remove scenarios', () => {
        it('should handle rapid listener addition and removal', () => {
            const listeners: Array<() => void> = []

            // Rapidly add listeners
            for (let i = 0; i < 10; i++) {
                const unsubscribe = eventManager.addEventListener('stepChange', vi.fn())
                listeners.push(unsubscribe)
            }

            expect(eventManager.getListenerCount('stepChange')).toBe(10)
            expect(eventManager.hasListeners('stepChange')).toBe(true)

            // Rapidly remove listeners
            listeners.forEach((unsubscribe) => unsubscribe())

            expect(eventManager.getListenerCount('stepChange')).toBe(0)
            expect(eventManager.hasListeners('stepChange')).toBe(false)
        })

        it('should handle interleaved add and remove operations', () => {
            const unsubscribe1 = eventManager.addEventListener('stepChange', vi.fn())
            expect(eventManager.hasListeners('stepChange')).toBe(true)

            const unsubscribe2 = eventManager.addEventListener('stepChange', vi.fn())
            expect(eventManager.getListenerCount('stepChange')).toBe(2)

            unsubscribe1()
            expect(eventManager.hasListeners('stepChange')).toBe(true)
            expect(eventManager.getListenerCount('stepChange')).toBe(1)

            const unsubscribe3 = eventManager.addEventListener('stepChange', vi.fn())
            expect(eventManager.getListenerCount('stepChange')).toBe(2)

            unsubscribe2()
            unsubscribe3()
            expect(eventManager.hasListeners('stepChange')).toBe(false)
        })

        it('should maintain correct state when same listener is added multiple times', () => {
            const listener = vi.fn()

            const unsubscribe1 = eventManager.addEventListener('stepChange', listener)
            const unsubscribe2 = eventManager.addEventListener('stepChange', listener)
            const unsubscribe3 = eventManager.addEventListener('stepChange', listener)

            // Set only stores unique values, so count should be 1
            expect(eventManager.getListenerCount('stepChange')).toBe(1)
            expect(eventManager.hasListeners('stepChange')).toBe(true)

            // Removing once should clear the listener since it's the same reference
            unsubscribe1()
            expect(eventManager.hasListeners('stepChange')).toBe(false)

            // Additional unsubscribes should be no-ops
            unsubscribe2()
            unsubscribe3()
            expect(eventManager.hasListeners('stepChange')).toBe(false)
        })

        it('should handle rapid notifications during listener changes', () => {
            const listener1 = vi.fn()
            const listener2 = vi.fn()

            const unsubscribe1 = eventManager.addEventListener('stepChange', listener1)
            eventManager.addEventListener('stepChange', listener2)

            // Notify while listeners exist
            eventManager.notifyListeners('stepChange', {
                newStep: null,
                oldStep: null,
                context: {} as TestContext,
            })

            expect(listener1).toHaveBeenCalledTimes(1)
            expect(listener2).toHaveBeenCalledTimes(1)

            // Remove one listener and notify again
            unsubscribe1()
            eventManager.notifyListeners('stepChange', {
                newStep: null,
                oldStep: null,
                context: {} as TestContext,
            })

            expect(listener1).toHaveBeenCalledTimes(1) // Should not be called again
            expect(listener2).toHaveBeenCalledTimes(2)
        })

        it('should handle listener removal during notification', () => {
            let unsubscribe2: (() => void) | null = null

            const listener1 = vi.fn(() => {
                // Remove listener2 during listener1 execution
                if (unsubscribe2) {
                    unsubscribe2()
                }
            })
            const listener2 = vi.fn()

            eventManager.addEventListener('stepChange', listener1)
            unsubscribe2 = eventManager.addEventListener('stepChange', listener2)

            // This should not cause issues even though listener2 is removed during notification
            eventManager.notifyListeners('stepChange', {
                newStep: null,
                oldStep: null,
                context: {} as TestContext,
            })

            expect(listener1).toHaveBeenCalledTimes(1)
            // listener2 might or might not be called depending on Set iteration order,
            // but the important thing is no errors are thrown
            expect(eventManager.hasListeners('stepChange')).toBe(true) // listener1 still exists
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

        it('should clear listeners and affect hasListeners checks', () => {
            eventManager.addEventListener('stepChange', vi.fn())
            eventManager.addEventListener('flowCompleted', vi.fn())

            expect(eventManager.hasListeners('stepChange')).toBe(true)
            expect(eventManager.hasListeners('flowCompleted')).toBe(true)

            eventManager.clearAllListeners()

            expect(eventManager.hasListeners('stepChange')).toBe(false)
            expect(eventManager.hasListeners('flowCompleted')).toBe(false)
        })
    })

    // Note: _getLegacyEventName is a private method used only for error logging backward compatibility.
    // It doesn't need dedicated tests as its behavior is covered by error logging tests.
})
