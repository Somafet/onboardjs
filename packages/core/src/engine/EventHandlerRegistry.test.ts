// src/engine/__tests__/EventHandlerRegistry.test.ts
import { describe, it, expect, beforeEach, vi, afterEach, Mock, MockInstance } from 'vitest'
import { OnboardingContext, OnboardingStep } from '../types'
import { EventHandlerRegistry } from './EventHandlerRegistry'
import { EventManager } from './EventManager'
import { EventListenerMap, UnsubscribeFunction, BeforeStepChangeEvent } from './types'

interface TestContext extends OnboardingContext {
    testData?: string
}

type AddEventListenerFn = <E extends keyof EventListenerMap<TestContext>>(
    eventType: E,
    listener: EventListenerMap<TestContext>[E]
) => UnsubscribeFunction

type GetListenerCountFn = (eventType: keyof EventListenerMap<TestContext>) => number
type ClearAllListenersFn = () => void
type NotifyListenersFn = <E extends keyof EventListenerMap<TestContext>>(
    eventType: E,
    ...args: Parameters<EventListenerMap<TestContext>[E]>
) => void
type NotifyListenersSequentialFn = <E extends keyof EventListenerMap<TestContext>>(
    eventType: E,
    ...args: Parameters<EventListenerMap<TestContext>[E]>
) => Promise<void>

const sharedMockUnsubscribeFn: Mock<UnsubscribeFunction> = vi.fn()

vi.mock('../EventManager', () => ({
    EventManager: vi.fn(),
}))

describe('EventHandlerRegistry', () => {
    interface MockEventManagerType {
        addEventListener: Mock<AddEventListenerFn>
        clearAllListeners: Mock<ClearAllListenersFn>
        getListenerCount: Mock<GetListenerCountFn>
        hasListeners: Mock<(eventType: keyof EventListenerMap<TestContext>) => boolean>
        notifyListeners: Mock<NotifyListenersFn>
        notifyListenersSequential: Mock<NotifyListenersSequentialFn>
    }

    let mockEventManager: MockEventManagerType
    let registry: EventHandlerRegistry<TestContext>

    beforeEach(() => {
        sharedMockUnsubscribeFn.mockClear()

        mockEventManager = {
            addEventListener: vi.fn(() => sharedMockUnsubscribeFn),
            clearAllListeners: vi.fn(),
            getListenerCount: vi.fn(() => 0),
            hasListeners: vi.fn(() => false),
            notifyListeners: vi.fn(),
            notifyListenersSequential: vi.fn(),
        }

        registry = new EventHandlerRegistry<TestContext>(mockEventManager as any as EventManager<TestContext>)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('Constructor', () => {
        it('should store the provided EventManager instance', () => {
            expect((registry as any)._eventManager).toBe(mockEventManager)
        })
    })

    describe('addEventListener (Unified Method)', () => {
        it('should call eventManager.addEventListener with correct arguments', () => {
            const listener = vi.fn()
            const eventType = 'stateChange'
            registry.addEventListener(eventType, listener)
            expect(mockEventManager.addEventListener).toHaveBeenCalledWith(eventType, listener)
        })

        it('should return the unsubscribe function from eventManager', () => {
            const listener = vi.fn()
            const unsubscribe = registry.addEventListener('stateChange', listener)
            expect(unsubscribe).toBe(sharedMockUnsubscribeFn)
        })
    })

    const convenienceMethodsConfig: {
        eventType: keyof EventListenerMap<TestContext>
        methodName: keyof EventHandlerRegistry<TestContext>
    }[] = [
        { eventType: 'stepChange', methodName: 'onStepChange' },
        { eventType: 'flowCompleted', methodName: 'onFlowCompleted' },
        { eventType: 'stepActive', methodName: 'onStepActive' },
        { eventType: 'stepCompleted', methodName: 'onStepCompleted' },
        { eventType: 'contextUpdate', methodName: 'onContextUpdate' },
        { eventType: 'error', methodName: 'onError' },
        { eventType: 'stateChange', methodName: 'onStateChange' },
        { eventType: 'beforeStepChange', methodName: 'onBeforeStepChange' },
    ]

    convenienceMethodsConfig.forEach(({ eventType, methodName }) => {
        describe(`${String(methodName)} (Convenience)`, () => {
            it(`should call eventManager.addEventListener with '${eventType}' and the listener`, () => {
                const listener = vi.fn()

                // Explicitly call the known methods to ensure 'this' context
                // This is verbose but rules out dynamic dispatch issues.
                switch (methodName) {
                    case 'onStepChange':
                        registry.onStepChange(listener)
                        break
                    case 'onFlowCompleted':
                        registry.onFlowCompleted(listener)
                        break
                    case 'onStepActive':
                        registry.onStepActive(listener)
                        break
                    case 'onStepCompleted':
                        registry.onStepCompleted(listener)
                        break
                    case 'onContextUpdate':
                        registry.onContextUpdate(listener)
                        break
                    case 'onError':
                        registry.onError(listener)
                        break
                    case 'onStateChange':
                        registry.onStateChange(listener)
                        break
                    case 'onBeforeStepChange':
                        // Ensure listener type matches for onBeforeStepChange
                        registry.onBeforeStepChange(listener)
                        break
                    default:
                        // This case should not be reached if convenienceMethodsConfig is correct
                        throw new Error(`Test setup error: Unhandled method name ${String(methodName)}`)
                }

                expect(mockEventManager.addEventListener).toHaveBeenCalledWith(eventType, listener)
            })

            it(`should return the unsubscribe function`, () => {
                const listener = vi.fn()
                let unsubscribe: UnsubscribeFunction

                switch (methodName) {
                    case 'onStepChange':
                        unsubscribe = registry.onStepChange(listener)
                        break
                    case 'onFlowCompleted':
                        unsubscribe = registry.onFlowCompleted(listener)
                        break
                    case 'onStepActive':
                        unsubscribe = registry.onStepActive(listener)
                        break
                    case 'onStepCompleted':
                        unsubscribe = registry.onStepCompleted(listener)
                        break
                    case 'onContextUpdate':
                        unsubscribe = registry.onContextUpdate(listener)
                        break
                    case 'onError':
                        unsubscribe = registry.onError(listener)
                        break
                    case 'onStateChange':
                        unsubscribe = registry.onStateChange(listener)
                        break
                    case 'onBeforeStepChange':
                        unsubscribe = registry.onBeforeStepChange(listener)
                        break
                    default:
                        throw new Error(`Test setup error: Unhandled method name ${String(methodName)} for unsubscribe`)
                }
                expect(unsubscribe).toBe(sharedMockUnsubscribeFn)
            })
        })
    })

    // ... (Plugin Compatibility Methods - apply similar explicit call or ensure dynamic dispatch is safe)
    describe('Plugin Compatibility Methods', () => {
        describe('addBeforeStepChangeListener', () => {
            let findStepByIdSpy: MockInstance<any>
            const mockCurrentStep = {
                id: 'current',
                type: 'INFO',
            } as unknown as OnboardingStep<TestContext>
            const mockNextStep = {
                id: 'next',
                type: 'INFO',
            } as unknown as OnboardingStep<TestContext>

            beforeEach(() => {
                // Spy on the private method for testing its interaction
                findStepByIdSpy = vi.spyOn(registry as any, '_findStepById')
            })

            it("should add a wrapped listener for 'beforeStepChange'", () => {
                const originalListener = vi.fn()
                registry.addBeforeStepChangeListener(originalListener)

                expect(mockEventManager.addEventListener).toHaveBeenCalledWith(
                    'beforeStepChange',
                    expect.any(Function) // The wrapped listener
                )
            })

            it('wrapped listener should call findStepById with targetStepId', async () => {
                const originalListener = vi.fn()
                registry.addBeforeStepChangeListener(originalListener)
                const wrappedListener = (mockEventManager.addEventListener as Mock).mock.calls[0][1]

                const event: BeforeStepChangeEvent<TestContext> = {
                    currentStep: mockCurrentStep,
                    targetStepId: 'nextStepId',
                    direction: 'next',
                    cancel: vi.fn(),
                    redirect: vi.fn(),
                }
                findStepByIdSpy.mockReturnValue(mockNextStep)

                await wrappedListener(event)
                expect(findStepByIdSpy).toHaveBeenCalledWith('nextStepId')
            })

            it('wrapped listener should call original listener if targetStepId and nextStep exist', async () => {
                const originalListener = vi.fn()
                registry.addBeforeStepChangeListener(originalListener)
                const wrappedListener = (mockEventManager.addEventListener as Mock).mock.calls[0][1]

                const event: BeforeStepChangeEvent<TestContext> = {
                    currentStep: mockCurrentStep,
                    targetStepId: 'nextStepId',
                    direction: 'next',
                    cancel: vi.fn(),
                    redirect: vi.fn(),
                }
                findStepByIdSpy.mockReturnValue(mockNextStep)

                await wrappedListener(event)
                expect(originalListener).toHaveBeenCalledWith(
                    expect.objectContaining({
                        currentStep: mockCurrentStep,
                        targetStepId: 'nextStepId',
                        direction: 'next',
                        cancel: expect.any(Function),
                        redirect: expect.any(Function),
                    })
                )
            })

            it('wrapped listener should not call original listener if targetStepId is null', async () => {
                const originalListener = vi.fn()
                registry.addBeforeStepChangeListener(originalListener)
                const wrappedListener = (mockEventManager.addEventListener as Mock).mock.calls[0][1]

                const event: BeforeStepChangeEvent<TestContext> = {
                    currentStep: mockCurrentStep,
                    targetStepId: null,
                    direction: 'next',
                    cancel: vi.fn(),
                    redirect: vi.fn(),
                }

                await wrappedListener(event)
                expect(findStepByIdSpy).not.toHaveBeenCalled() // or called with null
                expect(originalListener).not.toHaveBeenCalled()
            })

            it('wrapped listener should not call original listener if findStepById returns undefined', async () => {
                const originalListener = vi.fn()
                registry.addBeforeStepChangeListener(originalListener)
                const wrappedListener = (mockEventManager.addEventListener as Mock).mock.calls[0][1]

                const event: BeforeStepChangeEvent<TestContext> = {
                    currentStep: mockCurrentStep,
                    targetStepId: 'nonExistentStepId',
                    direction: 'next',
                    cancel: vi.fn(),
                    redirect: vi.fn(),
                }
                findStepByIdSpy.mockReturnValue(undefined)

                await wrappedListener(event)
                expect(findStepByIdSpy).toHaveBeenCalledWith('nonExistentStepId')
                expect(originalListener).not.toHaveBeenCalled()
            })

            it('should return the unsubscribe function', () => {
                const originalListener = vi.fn()
                const unsubscribe = registry.addBeforeStepChangeListener(originalListener)
                expect(unsubscribe).toBe(sharedMockUnsubscribeFn)
            })
        })

        // Test other plugin compatibility methods (they are mostly aliases)
        const pluginAliasMethods: {
            methodName: keyof EventHandlerRegistry<TestContext>
            eventType: keyof EventListenerMap<TestContext>
        }[] = [
            { methodName: 'addAfterStepChangeListener', eventType: 'stepChange' },
            { methodName: 'addStepActiveListener', eventType: 'stepActive' },
            { methodName: 'addStepCompletedListener', eventType: 'stepCompleted' },
            { methodName: 'addFlowCompletedListener', eventType: 'flowCompleted' },
            { methodName: 'addContextUpdateListener', eventType: 'contextUpdate' },
            { methodName: 'addErrorListener', eventType: 'error' },
        ]

        pluginAliasMethods.forEach(({ methodName, eventType }) => {
            describe(`${String(methodName)} (Plugin Compatibility)`, () => {
                it(`should call eventManager.addEventListener with '${eventType}' and the listener`, () => {
                    const listener = vi.fn()
                    ;(registry[methodName] as any)(listener)
                    expect(mockEventManager.addEventListener).toHaveBeenCalledWith(eventType, listener)
                })

                it(`should return the unsubscribe function`, () => {
                    const listener = vi.fn()
                    const unsubscribe = (registry[methodName] as any)(listener)
                    expect(unsubscribe).toBe(sharedMockUnsubscribeFn)
                })
            })
        })
    })

    describe('Utility Methods', () => {
        describe('removeAllListeners', () => {
            it('should call eventManager.clearAllListeners', () => {
                registry.removeAllListeners()
                expect(mockEventManager.clearAllListeners).toHaveBeenCalledTimes(1)
            })
        })

        describe('getListenerCount', () => {
            it('should call eventManager.getListenerCount and return its result', () => {
                ;(mockEventManager.getListenerCount as Mock).mockReturnValue(5)
                const count = registry.getListenerCount('stateChange')
                expect(mockEventManager.getListenerCount).toHaveBeenCalledWith('stateChange')
                expect(count).toBe(5)
            })
        })

        describe('hasListeners', () => {
            it('should return true if listener count > 0', () => {
                ;(mockEventManager.hasListeners as Mock).mockReturnValue(true)
                expect(registry.hasListeners('stateChange')).toBe(true)
                expect(mockEventManager.hasListeners).toHaveBeenCalledWith('stateChange')
            })

            it('should return false if listener count is 0', () => {
                ;(mockEventManager.hasListeners as Mock).mockReturnValue(false)
                expect(registry.hasListeners('stateChange')).toBe(false)
                expect(mockEventManager.hasListeners).toHaveBeenCalledWith('stateChange')
            })
        })
    })

    describe('findStepById (Private Helper)', () => {
        // This is a simple implementation that currently returns undefined
        it('should return undefined as per its current implementation', () => {
            const result = (registry as any)._findStepById('anyStepId')
            expect(result).toBeUndefined()
        })
    })
})
