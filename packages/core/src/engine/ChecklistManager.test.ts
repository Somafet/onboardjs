// src/engine/ChecklistManager.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ChecklistManager } from './ChecklistManager'
import { EventManager } from './EventManager'
import { ErrorHandler } from './ErrorHandler'
import { OnboardingContext, OnboardingStep } from '../types'

describe('ChecklistManager', () => {
    let checklistManager: ChecklistManager<OnboardingContext>
    let mockEventManager: EventManager<OnboardingContext>
    let mockErrorHandler: ErrorHandler<OnboardingContext>
    let context: OnboardingContext

    const createChecklistStep = (
        id: string,
        dataKey: string,
        items: { id: string; label: string; isMandatory?: boolean }[]
    ): OnboardingStep<OnboardingContext> & { type: 'CHECKLIST' } => ({
        id,
        type: 'CHECKLIST',
        payload: {
            dataKey,
            items: items.map((item) => ({
                id: item.id,
                label: item.label,
                isMandatory: item.isMandatory,
            })),
        },
    })

    beforeEach(() => {
        mockEventManager = new EventManager<OnboardingContext>()

        // Create a proper StateManager mock with required methods
        const mockStateManager = {
            setError: vi.fn(),
        } as any

        mockErrorHandler = new ErrorHandler<OnboardingContext>(mockEventManager, mockStateManager)

        // Spy on error handler methods
        vi.spyOn(mockErrorHandler, 'handleError')

        checklistManager = new ChecklistManager(mockEventManager, mockErrorHandler)

        context = {
            flowData: {
                _internal: {
                    completedSteps: {},
                    startedAt: Date.now(),
                    stepStartTimes: {},
                },
            },
        }
    })

    describe('getChecklistItemsState', () => {
        it('should initialize item states if not present', () => {
            const step = createChecklistStep('checklist-1', 'checklistData', [
                { id: 'item1', label: 'Item 1' },
                { id: 'item2', label: 'Item 2' },
            ])

            const itemStates = checklistManager.getChecklistItemsState(step, context)

            expect(itemStates).toHaveLength(2)
            expect(itemStates[0]).toEqual({ id: 'item1', isCompleted: false })
            expect(itemStates[1]).toEqual({ id: 'item2', isCompleted: false })
            expect(context.flowData.checklistData).toBeDefined()
        })

        it('should return existing item states', () => {
            const step = createChecklistStep('checklist-1', 'checklistData', [
                { id: 'item1', label: 'Item 1' },
                { id: 'item2', label: 'Item 2' },
            ])

            context.flowData.checklistData = [
                { id: 'item1', isCompleted: true },
                { id: 'item2', isCompleted: false },
            ]

            const itemStates = checklistManager.getChecklistItemsState(step, context)

            expect(itemStates).toHaveLength(2)
            expect(itemStates[0].isCompleted).toBe(true)
            expect(itemStates[1].isCompleted).toBe(false)
        })

        it('should re-initialize if structure mismatch', () => {
            const step = createChecklistStep('checklist-1', 'checklistData', [
                { id: 'item1', label: 'Item 1' },
                { id: 'item2', label: 'Item 2' },
            ])

            // Set mismatched state (only 1 item instead of 2)
            context.flowData.checklistData = [{ id: 'item1', isCompleted: true }]

            const itemStates = checklistManager.getChecklistItemsState(step, context)

            expect(itemStates).toHaveLength(2)
            expect(itemStates[0].isCompleted).toBe(false)
            expect(itemStates[1].isCompleted).toBe(false)
        })
    })

    describe('isChecklistStepComplete', () => {
        it('should return false if mandatory items are incomplete', () => {
            const step = createChecklistStep('checklist-1', 'checklistData', [
                { id: 'item1', label: 'Item 1', isMandatory: true },
                { id: 'item2', label: 'Item 2', isMandatory: true },
            ])

            context.flowData.checklistData = [
                { id: 'item1', isCompleted: true },
                { id: 'item2', isCompleted: false },
            ]

            const isComplete = checklistManager.isChecklistStepComplete(step, context)

            expect(isComplete).toBe(false)
        })

        it('should return true if all mandatory items are complete', () => {
            const step = createChecklistStep('checklist-1', 'checklistData', [
                { id: 'item1', label: 'Item 1', isMandatory: true },
                { id: 'item2', label: 'Item 2', isMandatory: false },
            ])

            context.flowData.checklistData = [
                { id: 'item1', isCompleted: true },
                { id: 'item2', isCompleted: false },
            ]

            const isComplete = checklistManager.isChecklistStepComplete(step, context)

            expect(isComplete).toBe(true)
        })

        it('should respect minItemsToComplete', () => {
            const step: OnboardingStep<OnboardingContext> & { type: 'CHECKLIST' } = {
                id: 'checklist-1',
                type: 'CHECKLIST',
                payload: {
                    dataKey: 'checklistData',
                    items: [
                        { id: 'item1', label: 'Item 1' },
                        { id: 'item2', label: 'Item 2' },
                        { id: 'item3', label: 'Item 3' },
                    ],
                    minItemsToComplete: 2,
                },
            }

            context.flowData.checklistData = [
                { id: 'item1', isCompleted: true },
                { id: 'item2', isCompleted: true },
                { id: 'item3', isCompleted: false },
            ]

            const isComplete = checklistManager.isChecklistStepComplete(step, context)

            expect(isComplete).toBe(true)
        })

        it('should handle conditional items', () => {
            const step: OnboardingStep<OnboardingContext> & { type: 'CHECKLIST' } = {
                id: 'checklist-1',
                type: 'CHECKLIST',
                payload: {
                    dataKey: 'checklistData',
                    items: [
                        { id: 'item1', label: 'Item 1', isMandatory: true },
                        {
                            id: 'item2',
                            label: 'Item 2',
                            isMandatory: true,
                            condition: (ctx) => (ctx as any).showItem2 === true,
                        },
                    ],
                },
            }

            context.flowData.checklistData = [
                { id: 'item1', isCompleted: true },
                { id: 'item2', isCompleted: false },
            ]

            // Item 2 condition is false, so it shouldn't be counted
            const isComplete = checklistManager.isChecklistStepComplete(step, context)

            expect(isComplete).toBe(true)
        })
    })

    describe('updateChecklistItem', () => {
        describe('safety guards', () => {
            it('should handle null or undefined step (TASK-036)', async () => {
                await checklistManager.updateChecklistItem('item1', true, null as any, context)

                expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
                    expect.objectContaining({
                        message: 'Cannot update checklist item: step is null or undefined',
                    }),
                    'updateChecklistItem - step existence',
                    context
                )
            })

            it('should reject non-CHECKLIST step type (TASK-037)', async () => {
                const nonChecklistStep = {
                    id: 'step-1',
                    type: 'INFORMATION',
                    payload: {},
                } as any

                await checklistManager.updateChecklistItem('item1', true, nonChecklistStep, context)

                expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
                    expect.objectContaining({
                        message: expect.stringContaining('is not a CHECKLIST step'),
                    }),
                    'updateChecklistItem - step type validation',
                    context
                )
            })

            it('should validate payload structure - missing dataKey (TASK-039)', async () => {
                const invalidStep = {
                    id: 'checklist-1',
                    type: 'CHECKLIST',
                    payload: {
                        items: [{ id: 'item1', label: 'Item 1' }],
                        // Missing dataKey
                    },
                } as any

                await checklistManager.updateChecklistItem('item1', true, invalidStep, context)

                expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
                    expect.objectContaining({
                        message: expect.stringContaining('invalid payload structure'),
                    }),
                    'updateChecklistItem - payload validation',
                    context
                )
            })

            it('should validate payload structure - missing items array (TASK-039)', async () => {
                const invalidStep = {
                    id: 'checklist-1',
                    type: 'CHECKLIST',
                    payload: {
                        dataKey: 'checklistData',
                        // Missing items array
                    },
                } as any

                await checklistManager.updateChecklistItem('item1', true, invalidStep, context)

                expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
                    expect.objectContaining({
                        message: expect.stringContaining('invalid payload structure'),
                    }),
                    'updateChecklistItem - payload validation',
                    context
                )
            })

            it('should validate payload structure - null payload (TASK-039)', async () => {
                const invalidStep = {
                    id: 'checklist-1',
                    type: 'CHECKLIST',
                    payload: null,
                } as any

                await checklistManager.updateChecklistItem('item1', true, invalidStep, context)

                expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
                    expect.objectContaining({
                        message: expect.stringContaining('invalid payload structure'),
                    }),
                    'updateChecklistItem - payload validation',
                    context
                )
            })

            it('should reject non-existent item ID (TASK-038)', async () => {
                const step = createChecklistStep('checklist-1', 'checklistData', [
                    { id: 'item1', label: 'Item 1' },
                    { id: 'item2', label: 'Item 2' },
                ])

                await checklistManager.updateChecklistItem('non-existent-item', true, step, context)

                expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
                    expect.objectContaining({
                        message: expect.stringContaining('does not exist in step'),
                    }),
                    'updateChecklistItem - item existence',
                    context
                )
            })

            it('should not update context if item does not exist', async () => {
                const step = createChecklistStep('checklist-1', 'checklistData', [{ id: 'item1', label: 'Item 1' }])

                const originalFlowData = { ...context.flowData }

                await checklistManager.updateChecklistItem('non-existent-item', true, step, context)

                // Context should not be modified
                expect(context.flowData).toEqual(originalFlowData)
            })
        })

        describe('successful updates', () => {
            it('should update existing item state', async () => {
                const step = createChecklistStep('checklist-1', 'checklistData', [
                    { id: 'item1', label: 'Item 1' },
                    { id: 'item2', label: 'Item 2' },
                ])

                context.flowData.checklistData = [
                    { id: 'item1', isCompleted: false },
                    { id: 'item2', isCompleted: false },
                ]

                await checklistManager.updateChecklistItem('item1', true, step, context)

                expect(context.flowData.checklistData).toEqual([
                    { id: 'item1', isCompleted: true },
                    { id: 'item2', isCompleted: false },
                ])
            })

            it('should create item state if not present', async () => {
                const step = createChecklistStep('checklist-1', 'checklistData', [
                    { id: 'item1', label: 'Item 1' },
                    { id: 'item2', label: 'Item 2' },
                ])

                context.flowData.checklistData = [{ id: 'item1', isCompleted: false }]

                await checklistManager.updateChecklistItem('item2', true, step, context)

                expect(context.flowData.checklistData).toHaveLength(2)
                expect(context.flowData.checklistData[1]).toEqual({
                    id: 'item2',
                    isCompleted: true,
                })
            })

            it('should emit checklistItemToggled event', async () => {
                const step = createChecklistStep('checklist-1', 'checklistData', [{ id: 'item1', label: 'Item 1' }])

                const eventSpy = vi.fn()
                mockEventManager.addEventListener('checklistItemToggled', eventSpy)

                await checklistManager.updateChecklistItem('item1', true, step, context)

                expect(eventSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        itemId: 'item1',
                        isCompleted: true,
                        step,
                        context,
                    })
                )
            })

            it('should emit checklistProgressChanged event', async () => {
                const step = createChecklistStep('checklist-1', 'checklistData', [
                    { id: 'item1', label: 'Item 1' },
                    { id: 'item2', label: 'Item 2' },
                ])

                const eventSpy = vi.fn()
                mockEventManager.addEventListener('checklistProgressChanged', eventSpy)

                await checklistManager.updateChecklistItem('item1', true, step, context)

                expect(eventSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        step,
                        context,
                        progress: expect.objectContaining({
                            completed: expect.any(Number),
                            total: expect.any(Number),
                            percentage: expect.any(Number),
                            isComplete: expect.any(Boolean),
                        }),
                    })
                )
            })

            it('should call persist callback when data changes', async () => {
                const step = createChecklistStep('checklist-1', 'checklistData', [{ id: 'item1', label: 'Item 1' }])

                const persistCallback = vi.fn().mockResolvedValue(undefined)

                await checklistManager.updateChecklistItem('item1', true, step, context, persistCallback)

                expect(persistCallback).toHaveBeenCalled()
            })

            it('should handle persist callback errors gracefully', async () => {
                const step = createChecklistStep('checklist-1', 'checklistData', [{ id: 'item1', label: 'Item 1' }])

                const persistError = new Error('Persistence failed')
                const persistCallback = vi.fn().mockRejectedValue(persistError)

                await checklistManager.updateChecklistItem('item1', true, step, context, persistCallback)

                expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
                    persistError,
                    'updateChecklistItem persistence',
                    context
                )
            })
        })
    })

    describe('getChecklistProgress', () => {
        it('should calculate progress correctly', () => {
            const step = createChecklistStep('checklist-1', 'checklistData', [
                { id: 'item1', label: 'Item 1' },
                { id: 'item2', label: 'Item 2' },
                { id: 'item3', label: 'Item 3' },
            ])

            context.flowData.checklistData = [
                { id: 'item1', isCompleted: true },
                { id: 'item2', isCompleted: true },
                { id: 'item3', isCompleted: false },
            ]

            const progress = checklistManager.getChecklistProgress(step, context)

            expect(progress.completed).toBe(2)
            expect(progress.total).toBe(3)
            expect(progress.percentage).toBe(67) // Math.round((2/3) * 100)
            expect(progress.isComplete).toBe(false)
        })

        it('should exclude conditional items not meeting condition', () => {
            const step: OnboardingStep<OnboardingContext> & { type: 'CHECKLIST' } = {
                id: 'checklist-1',
                type: 'CHECKLIST',
                payload: {
                    dataKey: 'checklistData',
                    items: [
                        { id: 'item1', label: 'Item 1' },
                        {
                            id: 'item2',
                            label: 'Item 2',
                            condition: () => false, // This item should be excluded
                        },
                        { id: 'item3', label: 'Item 3' },
                    ],
                },
            }

            context.flowData.checklistData = [
                { id: 'item1', isCompleted: true },
                { id: 'item2', isCompleted: false },
                { id: 'item3', isCompleted: true },
            ]

            const progress = checklistManager.getChecklistProgress(step, context)

            expect(progress.total).toBe(2) // Only item1 and item3
            expect(progress.completed).toBe(2)
            expect(progress.percentage).toBe(100)
        })

        it('should handle empty checklist', () => {
            const step = createChecklistStep('checklist-1', 'checklistData', [])

            const progress = checklistManager.getChecklistProgress(step, context)

            expect(progress.completed).toBe(0)
            expect(progress.total).toBe(0)
            expect(progress.percentage).toBe(0)
        })
    })

    describe('edge cases', () => {
        it('should handle empty dataKey gracefully', async () => {
            const step: OnboardingStep<OnboardingContext> & { type: 'CHECKLIST' } = {
                id: 'checklist-1',
                type: 'CHECKLIST',
                payload: {
                    dataKey: '',
                    items: [{ id: 'item1', label: 'Item 1' }],
                },
            }

            await checklistManager.updateChecklistItem('item1', true, step, context)

            expect(context.flowData['']).toBeDefined()
        })

        it('should handle items with special characters in IDs', async () => {
            const step = createChecklistStep('checklist-1', 'checklistData', [
                { id: 'item-1.test@special', label: 'Item 1' },
            ])

            await checklistManager.updateChecklistItem('item-1.test@special', true, step, context)

            expect(context.flowData.checklistData).toEqual([{ id: 'item-1.test@special', isCompleted: true }])
        })

        it('should handle toggling same item multiple times', async () => {
            const step = createChecklistStep('checklist-1', 'checklistData', [{ id: 'item1', label: 'Item 1' }])

            await checklistManager.updateChecklistItem('item1', true, step, context)
            expect((context.flowData.checklistData as any)[0].isCompleted).toBe(true)

            await checklistManager.updateChecklistItem('item1', false, step, context)
            expect((context.flowData.checklistData as any)[0].isCompleted).toBe(false)

            await checklistManager.updateChecklistItem('item1', true, step, context)
            expect((context.flowData.checklistData as any)[0].isCompleted).toBe(true)
        })
    })
})
