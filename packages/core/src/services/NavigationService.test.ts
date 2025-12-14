// src/services/NavigationService.test.ts
// Tests for the consolidated NavigationService
// Covers: navigation, checklist management, event handling

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { NavigationService } from './NavigationService'
import { Logger } from './Logger'
import { EventManager } from '../engine/EventManager'
import { StateManager } from '../engine/StateManager'
import { PersistenceManager } from '../engine/PersistenceManager'
import { ErrorHandler } from '../engine/ErrorHandler'
import type { OnboardingContext, OnboardingStep, ChecklistStepPayload } from '../types'

// Test step factory
function createStep(overrides: Partial<OnboardingStep<OnboardingContext>> = {}): OnboardingStep<OnboardingContext> {
    return {
        id: 'step1',
        type: 'INFORMATION',
        payload: { title: 'Test Step', description: 'Test description' },
        ...overrides,
    } as OnboardingStep<OnboardingContext>
}

// Test context factory
function createContext(): OnboardingContext {
    return {
        flowData: {
            _internal: {
                completedSteps: {},
                startedAt: Date.now(),
                stepStartTimes: {},
            },
        },
    }
}

// Create a checklist step
function createChecklistStep(
    overrides: Partial<OnboardingStep<OnboardingContext>> = {}
): OnboardingStep<OnboardingContext> & { type: 'CHECKLIST' } {
    return {
        id: 'checklist-step',
        type: 'CHECKLIST',
        payload: {
            dataKey: 'checklistData',
            items: [
                { id: 'item1', label: 'Item 1', isMandatory: true },
                { id: 'item2', label: 'Item 2', isMandatory: false },
                { id: 'item3', label: 'Item 3', isMandatory: true },
            ],
        } as ChecklistStepPayload,
        ...overrides,
    } as OnboardingStep<OnboardingContext> & { type: 'CHECKLIST' }
}

describe('NavigationService', () => {
    let service: NavigationService<OnboardingContext>
    let eventManager: EventManager<OnboardingContext>
    let stateManager: StateManager<OnboardingContext>
    let persistenceManager: PersistenceManager<OnboardingContext>
    let errorHandler: ErrorHandler<OnboardingContext>
    let logger: Logger
    let steps: OnboardingStep<OnboardingContext>[]

    beforeEach(() => {
        logger = new Logger({ prefix: 'NavigationService' })
        vi.spyOn(logger, 'debug').mockImplementation(() => {})
        // Don't mock warn/error - they should work normally for tests that check them
        // Only mock debug since tests don't check that output
        vi.spyOn(logger, 'error').mockImplementation(() => {})

        steps = [createStep({ id: 'step1' }), createStep({ id: 'step2' }), createStep({ id: 'step3' })]

        eventManager = new EventManager<OnboardingContext>()
        const flowContext = {
            flowId: 'test',
            flowName: 'Test',
            flowVersion: '1.0.0',
            instanceId: 1,
            createdAt: Date.now(),
            flowMetadata: null,
        }
        stateManager = new StateManager(eventManager, steps, 'step1', flowContext)
        persistenceManager = new PersistenceManager(() => null)
        errorHandler = new ErrorHandler<OnboardingContext>(eventManager, stateManager)

        service = new NavigationService(steps, eventManager, stateManager, persistenceManager, errorHandler, logger)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('calculateNextStep', () => {
        it('should return next step in array when no explicit nextStep', () => {
            const context = createContext()
            const result = service.calculateNextStep(steps[0], context)
            expect(result?.id).toBe('step2')
        })

        it('should return explicit nextStep when defined', () => {
            const stepsWithExplicit = [
                createStep({ id: 'step1', nextStep: 'step3' }),
                createStep({ id: 'step2' }),
                createStep({ id: 'step3' }),
            ]
            const svc = new NavigationService(
                stepsWithExplicit,
                eventManager,
                stateManager,
                persistenceManager,
                errorHandler,
                logger
            )

            const context = createContext()
            const result = svc.calculateNextStep(stepsWithExplicit[0], context)
            expect(result?.id).toBe('step3')
        })

        it('should skip steps with false conditions', () => {
            const stepsWithCondition = [
                createStep({ id: 'step1' }),
                createStep({ id: 'step2', condition: () => false }),
                createStep({ id: 'step3' }),
            ]
            const svc = new NavigationService(
                stepsWithCondition,
                eventManager,
                stateManager,
                persistenceManager,
                errorHandler,
                logger
            )

            const context = createContext()
            const result = svc.calculateNextStep(stepsWithCondition[0], context)
            expect(result?.id).toBe('step3')
        })

        it('should return null when no valid next step exists', () => {
            const context = createContext()
            const result = service.calculateNextStep(steps[2], context)
            expect(result).toBeNull()
        })

        it('should handle dynamic nextStep function', () => {
            const stepsWithFn = [
                createStep({
                    id: 'step1',
                    nextStep: (ctx) => (ctx.flowData.goToThree ? 'step3' : 'step2'),
                }),
                createStep({ id: 'step2' }),
                createStep({ id: 'step3' }),
            ]
            const svc = new NavigationService(
                stepsWithFn,
                eventManager,
                stateManager,
                persistenceManager,
                errorHandler,
                logger
            )

            const context = createContext()
            context.flowData.goToThree = true
            const result = svc.calculateNextStep(stepsWithFn[0], context)
            expect(result?.id).toBe('step3')
        })
    })

    describe('calculatePreviousStep', () => {
        it('should return previous step in array when no explicit previousStep', () => {
            const context = createContext()
            const result = service.calculatePreviousStep(steps[1], context, [])
            expect(result?.id).toBe('step1')
        })

        it('should return explicit previousStep when defined', () => {
            const stepsWithExplicit = [
                createStep({ id: 'step1' }),
                createStep({ id: 'step2' }),
                createStep({ id: 'step3', previousStep: 'step1' }),
            ]
            const svc = new NavigationService(
                stepsWithExplicit,
                eventManager,
                stateManager,
                persistenceManager,
                errorHandler,
                logger
            )

            const context = createContext()
            const result = svc.calculatePreviousStep(stepsWithExplicit[2], context, [])
            expect(result?.id).toBe('step1')
        })

        it('should use history when available', () => {
            const context = createContext()
            const history = ['step1']
            const result = service.calculatePreviousStep(steps[2], context, history)
            expect(result?.id).toBe('step1')
        })

        it('should return null for first step', () => {
            const context = createContext()
            const result = service.calculatePreviousStep(steps[0], context, [])
            expect(result).toBeNull()
        })
    })

    describe('navigateToStep', () => {
        it('should navigate to the specified step', async () => {
            const context = createContext()
            const result = await service.navigateToStep('step2', 'goto', null, context, [])
            expect(result?.id).toBe('step2')
        })

        it('should skip conditional steps that return false', async () => {
            const stepsWithCondition = [
                createStep({ id: 'step1' }),
                createStep({ id: 'step2', condition: () => false }),
                createStep({ id: 'step3' }),
            ]
            const svc = new NavigationService(
                stepsWithCondition,
                eventManager,
                stateManager,
                persistenceManager,
                errorHandler,
                logger
            )

            const context = createContext()
            const result = await svc.navigateToStep('step2', 'next', stepsWithCondition[0], context, [])
            expect(result?.id).toBe('step3')
        })

        it('should handle beforeStepChange cancellation', async () => {
            eventManager.addEventListener('beforeStepChange', (event) => {
                event.cancel()
            })

            const context = createContext()
            const result = await service.navigateToStep('step2', 'goto', steps[0], context, [])
            expect(result?.id).toBe('step1') // Should stay on current step
        })

        it('should handle beforeStepChange redirect', async () => {
            eventManager.addEventListener('beforeStepChange', (event) => {
                event.redirect('step3')
            })

            const context = createContext()
            const result = await service.navigateToStep('step2', 'goto', steps[0], context, [])
            expect(result?.id).toBe('step3')
        })

        it('should emit stepChange event', async () => {
            const stepChangeListener = vi.fn()
            eventManager.addEventListener('stepChange', stepChangeListener)

            const context = createContext()
            await service.navigateToStep('step2', 'goto', steps[0], context, [])

            expect(stepChangeListener).toHaveBeenCalledWith(
                expect.objectContaining({
                    oldStep: steps[0],
                    newStep: steps[1],
                })
            )
        })

        it('should emit stepActive event when navigating to a new step', async () => {
            const stepActiveListener = vi.fn()
            eventManager.addEventListener('stepActive', stepActiveListener)

            const context = createContext()
            await service.navigateToStep('step2', 'goto', null, context, [])

            expect(stepActiveListener).toHaveBeenCalledWith(
                expect.objectContaining({
                    step: steps[1],
                })
            )
        })

        it('should call onStepActive hook when navigating', async () => {
            const onStepActive = vi.fn()
            const stepsWithHook = [createStep({ id: 'step1' }), createStep({ id: 'step2', onStepActive })]
            const svc = new NavigationService(
                stepsWithHook,
                eventManager,
                stateManager,
                persistenceManager,
                errorHandler,
                logger
            )

            const context = createContext()
            await svc.navigateToStep('step2', 'goto', null, context, [])

            expect(onStepActive).toHaveBeenCalledWith(context)
        })
    })

    describe('next', () => {
        it('should navigate to the next step', async () => {
            const context = createContext()
            const result = await service.next(steps[0], {}, context, [])
            expect(result?.id).toBe('step2')
        })

        it('should merge step-specific data into context', async () => {
            const context = createContext()
            await service.next(steps[0], { userName: 'Test User' }, context, [])
            expect(context.flowData.userName).toBe('Test User')
        })

        it('should call onStepComplete hook', async () => {
            const onStepComplete = vi.fn()
            const stepsWithHook = [createStep({ id: 'step1', onStepComplete }), createStep({ id: 'step2' })]
            const svc = new NavigationService(
                stepsWithHook,
                eventManager,
                stateManager,
                persistenceManager,
                errorHandler,
                logger
            )

            const context = createContext()
            await svc.next(stepsWithHook[0], { data: 'test' }, context, [])

            expect(onStepComplete).toHaveBeenCalledWith({ data: 'test' }, context)
        })

        it('should mark step as completed', async () => {
            const context = createContext()
            await service.next(steps[0], {}, context, [])
            expect(context.flowData._internal?.completedSteps?.step1).toBeDefined()
        })

        it('should emit stepCompleted event', async () => {
            const stepCompletedListener = vi.fn()
            eventManager.addEventListener('stepCompleted', stepCompletedListener)

            const context = createContext()
            await service.next(steps[0], { formData: 'test' }, context, [])

            expect(stepCompletedListener).toHaveBeenCalledWith(
                expect.objectContaining({
                    step: steps[0],
                    stepData: { formData: 'test' },
                })
            )
        })

        it('should not navigate when loading', async () => {
            stateManager.setLoading(true)
            const context = createContext()
            const result = await service.next(steps[0], {}, context, [])
            expect(result).toBe(steps[0])
        })
    })

    describe('previous', () => {
        it('should navigate to the previous step', async () => {
            const context = createContext()
            const result = await service.previous(steps[1], context, ['step1'])
            expect(result?.id).toBe('step1')
        })

        it('should stay on current step when no previous step exists', async () => {
            const context = createContext()
            const result = await service.previous(steps[0], context, [])
            expect(result?.id).toBe('step1')
        })

        it('should pop from history when used', async () => {
            const context = createContext()
            const history = ['step1']
            await service.previous(steps[1], context, history)
            expect(history).toHaveLength(0)
        })
    })

    describe('skip', () => {
        it('should skip to the next step', async () => {
            const stepsWithSkippable = [createStep({ id: 'step1', isSkippable: true }), createStep({ id: 'step2' })]
            const svc = new NavigationService(
                stepsWithSkippable,
                eventManager,
                stateManager,
                persistenceManager,
                errorHandler,
                logger
            )

            const context = createContext()
            const result = await svc.skip(stepsWithSkippable[0], context, [])
            expect(result?.id).toBe('step2')
        })

        it('should not skip non-skippable steps', async () => {
            const context = createContext()
            const result = await service.skip(steps[0], context, [])
            expect(result?.id).toBe('step1')
        })

        it('should use explicit skipToStep when defined', async () => {
            const stepsWithSkipTo = [
                createStep({ id: 'step1', isSkippable: true, skipToStep: 'step3' }),
                createStep({ id: 'step2' }),
                createStep({ id: 'step3' }),
            ]
            const svc = new NavigationService(
                stepsWithSkipTo,
                eventManager,
                stateManager,
                persistenceManager,
                errorHandler,
                logger
            )

            const context = createContext()
            const result = await svc.skip(stepsWithSkipTo[0], context, [])
            expect(result?.id).toBe('step3')
        })

        it('should emit stepSkipped event', async () => {
            const skipListener = vi.fn()
            eventManager.addEventListener('stepSkipped', skipListener)

            const stepsWithSkippable = [createStep({ id: 'step1', isSkippable: true }), createStep({ id: 'step2' })]
            const svc = new NavigationService(
                stepsWithSkippable,
                eventManager,
                stateManager,
                persistenceManager,
                errorHandler,
                logger
            )

            const context = createContext()
            await svc.skip(stepsWithSkippable[0], context, [])

            expect(skipListener).toHaveBeenCalledWith(
                expect.objectContaining({
                    step: stepsWithSkippable[0],
                    skipReason: 'default_skip',
                })
            )
        })
    })

    describe('goToStep', () => {
        it('should navigate directly to the specified step', async () => {
            const context = createContext()
            const result = await service.goToStep('step3', null, steps[0], context, [])
            expect(result?.id).toBe('step3')
        })

        it('should merge step-specific data into context', async () => {
            const context = createContext()
            await service.goToStep('step2', { customData: 'value' }, steps[0], context, [])
            expect(context.flowData.customData).toBe('value')
        })

        it('should not navigate when loading', async () => {
            stateManager.setLoading(true)
            const context = createContext()
            const result = await service.goToStep('step3', null, steps[0], context, [])
            expect(result).toBe(steps[0])
        })
    })

    describe('Checklist Management', () => {
        let checklistSteps: OnboardingStep<OnboardingContext>[]
        let checklistService: NavigationService<OnboardingContext>

        beforeEach(() => {
            checklistSteps = [createStep({ id: 'step1' }), createChecklistStep(), createStep({ id: 'step3' })]
            checklistService = new NavigationService(
                checklistSteps,
                eventManager,
                stateManager,
                persistenceManager,
                errorHandler,
                logger
            )
        })

        describe('getChecklistState', () => {
            it('should return empty array for non-checklist steps', () => {
                const context = createContext()
                const result = checklistService.getChecklistState(checklistSteps[0], context)
                expect(result).toEqual([])
            })

            it('should initialize checklist state on first call', () => {
                const context = createContext()
                const result = checklistService.getChecklistState(checklistSteps[1], context)

                expect(result).toHaveLength(3)
                expect(result.every((item) => !item.isCompleted)).toBe(true)
            })

            it('should persist initialized state to context', () => {
                const context = createContext()
                checklistService.getChecklistState(checklistSteps[1], context)

                expect(context.flowData.checklistData).toBeDefined()
                expect(context.flowData.checklistData).toHaveLength(3)
            })
        })

        describe('isChecklistComplete', () => {
            it('should return true for non-checklist steps', () => {
                const context = createContext()
                const result = checklistService.isChecklistComplete(checklistSteps[0], context)
                expect(result).toBe(true)
            })

            it('should return false when mandatory items are not completed', () => {
                const context = createContext()
                checklistService.getChecklistState(checklistSteps[1], context) // Initialize

                const result = checklistService.isChecklistComplete(checklistSteps[1], context)
                expect(result).toBe(false)
            })

            it('should return true when all mandatory items are completed', () => {
                const context = createContext()
                context.flowData.checklistData = [
                    { id: 'item1', isCompleted: true },
                    { id: 'item2', isCompleted: false }, // Not mandatory
                    { id: 'item3', isCompleted: true },
                ]

                const result = checklistService.isChecklistComplete(checklistSteps[1], context)
                expect(result).toBe(true)
            })
        })

        describe('updateChecklistItem', () => {
            it('should update item completion status', async () => {
                const context = createContext()
                checklistService.getChecklistState(checklistSteps[1], context) // Initialize

                await checklistService.updateChecklistItem('item1', true, checklistSteps[1], context)

                expect(context.flowData.checklistData[0].isCompleted).toBe(true)
            })

            it('should emit checklistItemToggled event', async () => {
                const toggleListener = vi.fn()
                eventManager.addEventListener('checklistItemToggled', toggleListener)

                const context = createContext()
                checklistService.getChecklistState(checklistSteps[1], context) // Initialize

                await checklistService.updateChecklistItem('item1', true, checklistSteps[1], context)

                expect(toggleListener).toHaveBeenCalledWith(
                    expect.objectContaining({
                        itemId: 'item1',
                        isCompleted: true,
                    })
                )
            })

            it('should emit checklistProgressChanged event', async () => {
                const progressListener = vi.fn()
                eventManager.addEventListener('checklistProgressChanged', progressListener)

                const context = createContext()
                checklistService.getChecklistState(checklistSteps[1], context) // Initialize

                await checklistService.updateChecklistItem('item1', true, checklistSteps[1], context)

                expect(progressListener).toHaveBeenCalledWith(
                    expect.objectContaining({
                        step: checklistSteps[1],
                        progress: expect.objectContaining({
                            completed: expect.any(Number),
                            total: expect.any(Number),
                        }),
                    })
                )
            })

            it('should not update non-existent items', async () => {
                const context = createContext()
                checklistService.getChecklistState(checklistSteps[1], context) // Initialize

                const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
                await checklistService.updateChecklistItem('non-existent', true, checklistSteps[1], context)

                expect(consoleWarn).toHaveBeenCalled()
                consoleWarn.mockRestore()
            })

            it('should call persist callback when state changes', async () => {
                const persistCallback = vi.fn()
                const context = createContext()
                checklistService.getChecklistState(checklistSteps[1], context) // Initialize

                await checklistService.updateChecklistItem('item1', true, checklistSteps[1], context, persistCallback)

                expect(persistCallback).toHaveBeenCalled()
            })
        })

        describe('getChecklistProgress', () => {
            it('should calculate progress correctly', () => {
                const context = createContext()
                context.flowData.checklistData = [
                    { id: 'item1', isCompleted: true },
                    { id: 'item2', isCompleted: false },
                    { id: 'item3', isCompleted: false },
                ]

                const checklistStep = checklistSteps[1] as OnboardingStep<OnboardingContext> & { type: 'CHECKLIST' }
                const progress = checklistService.getChecklistProgress(checklistStep, context)

                expect(progress.completed).toBe(1)
                expect(progress.total).toBe(3)
                expect(progress.percentage).toBe(33)
            })

            it('should skip conditional items that return false', () => {
                const stepWithConditional = createChecklistStep({
                    payload: {
                        dataKey: 'checklistData',
                        items: [
                            { id: 'item1', label: 'Item 1', isMandatory: true },
                            { id: 'item2', label: 'Item 2', condition: () => false },
                            { id: 'item3', label: 'Item 3', isMandatory: true },
                        ],
                    } as ChecklistStepPayload,
                })
                const svc = new NavigationService(
                    [stepWithConditional],
                    eventManager,
                    stateManager,
                    persistenceManager,
                    errorHandler,
                    logger
                )

                const context = createContext()
                context.flowData.checklistData = [
                    { id: 'item1', isCompleted: true },
                    { id: 'item2', isCompleted: false },
                    { id: 'item3', isCompleted: true },
                ]

                const progress = svc.getChecklistProgress(stepWithConditional, context)
                expect(progress.total).toBe(2) // item2 is excluded
                expect(progress.completed).toBe(2)
            })
        })

        describe('Checklist navigation blocking', () => {
            it('should prevent next() when checklist criteria not met', async () => {
                const context = createContext()
                checklistService.getChecklistState(checklistSteps[1], context) // Initialize

                const result = await checklistService.next(checklistSteps[1], {}, context, [])

                expect(result?.id).toBe('checklist-step') // Should stay on checklist step
            })

            it('should allow next() when checklist criteria are met', async () => {
                const context = createContext()
                context.flowData.checklistData = [
                    { id: 'item1', isCompleted: true },
                    { id: 'item2', isCompleted: false },
                    { id: 'item3', isCompleted: true },
                ]

                const result = await checklistService.next(checklistSteps[1], {}, context, [])

                expect(result?.id).toBe('step3')
            })
        })
    })

    describe('Flow completion', () => {
        it('should set completed state when navigating past last step', async () => {
            const context = createContext()
            await service.next(steps[2], {}, context, [])

            expect(stateManager.isCompleted).toBe(true)
        })

        it('should emit flowCompleted event', async () => {
            const flowCompletedListener = vi.fn()
            eventManager.addEventListener('flowCompleted', flowCompletedListener)

            const context = createContext()
            await service.next(steps[2], {}, context, [])

            expect(flowCompletedListener).toHaveBeenCalledWith(
                expect.objectContaining({
                    context,
                    duration: expect.any(Number),
                })
            )
        })

        it('should call onFlowComplete callback', async () => {
            const onFlowComplete = vi.fn()

            const context = createContext()
            await service.next(steps[2], {}, context, [], undefined, onFlowComplete)

            expect(onFlowComplete).toHaveBeenCalledWith(context)
        })
    })

    describe('History management', () => {
        it('should push to history when moving forward', async () => {
            const context = createContext()
            const history: string[] = []

            await service.navigateToStep('step2', 'next', steps[0], context, history)

            expect(history).toContain('step1')
        })

        it('should not push to history when moving backward', async () => {
            const context = createContext()
            const history = ['step1']

            await service.navigateToStep('step1', 'previous', steps[1], context, history)

            // History should not grow when going back
            expect(history).toEqual(['step1'])
        })
    })
})
