// src/services/CoreEngineService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CoreEngineService } from './CoreEngineService'
import { EventManager } from '../engine/EventManager'
import { OnboardingContext, OnboardingStep } from '../types'
import { FlowContext } from '../engine/types'

const createTestSteps = (): OnboardingStep<OnboardingContext>[] => [
    { id: 'step-1', type: 'INFORMATION', payload: { title: 'Step 1' } },
    { id: 'step-2', type: 'INFORMATION', payload: { title: 'Step 2' } },
    { id: 'step-3', type: 'INFORMATION', payload: { title: 'Step 3' } },
]

const createConditionalSteps = (): OnboardingStep<OnboardingContext>[] => [
    { id: 'step-1', type: 'INFORMATION', payload: { title: 'Step 1' } },
    {
        id: 'step-2',
        type: 'INFORMATION',
        payload: { title: 'Step 2' },
        condition: (ctx) => ctx.flowData.testValue === 'show',
    },
    { id: 'step-3', type: 'INFORMATION', payload: { title: 'Step 3' } },
]

const createFlowContext = (): FlowContext => ({
    flowId: 'test-flow',
    flowName: 'Test Flow',
    flowVersion: '1.0.0',
    flowMetadata: null,
    instanceId: 1,
    createdAt: Date.now(),
})

const createOnboardingContext = (): OnboardingContext => ({
    flowData: {},
})

describe('CoreEngineService', () => {
    let eventManager: EventManager<OnboardingContext>
    let coreService: CoreEngineService<OnboardingContext>
    let steps: OnboardingStep<OnboardingContext>[]
    let flowContext: FlowContext

    beforeEach(() => {
        eventManager = new EventManager<OnboardingContext>()
        steps = createTestSteps()
        flowContext = createFlowContext()
        coreService = new CoreEngineService(eventManager, steps, 'step-1', flowContext)
    })

    describe('initial state', () => {
        it('should initialize with default values', () => {
            expect(coreService.isLoading).toBe(false)
            expect(coreService.isHydrating).toBe(true)
            expect(coreService.error).toBe(null)
            expect(coreService.isCompleted).toBe(false)
            expect(coreService.hasError).toBe(false)
        })
    })

    describe('state setters', () => {
        it('should set loading state', () => {
            coreService.setLoading(true)
            expect(coreService.isLoading).toBe(true)

            coreService.setLoading(false)
            expect(coreService.isLoading).toBe(false)
        })

        it('should set hydrating state', () => {
            coreService.setHydrating(false)
            expect(coreService.isHydrating).toBe(false)
        })

        it('should set error state', () => {
            const error = new Error('Test error')
            coreService.setError(error)
            expect(coreService.error).toBe(error)
            expect(coreService.hasError).toBe(true)

            coreService.setError(null)
            expect(coreService.error).toBe(null)
            expect(coreService.hasError).toBe(false)
        })

        it('should set completed state', () => {
            coreService.setCompleted(true)
            expect(coreService.isCompleted).toBe(true)
        })
    })

    describe('getState', () => {
        it('should return complete engine state', () => {
            const currentStep = steps[0]
            const context = createOnboardingContext()
            const history: string[] = []

            const state = coreService.getState(currentStep, context, history)

            expect(state.flowId).toBe('test-flow')
            expect(state.flowName).toBe('Test Flow')
            expect(state.flowVersion).toBe('1.0.0')
            expect(state.currentStep).toBe(currentStep)
            expect(state.context).toBe(context)
            expect(state.isFirstStep).toBe(true)
            expect(state.isLastStep).toBe(false)
            expect(state.canGoPrevious).toBe(false)
            expect(state.canGoNext).toBe(true)
            expect(state.isLoading).toBe(false)
            expect(state.isHydrating).toBe(true)
            expect(state.error).toBe(null)
            expect(state.isCompleted).toBe(false)
            expect(state.totalSteps).toBe(3)
            expect(state.completedSteps).toBe(0)
            expect(state.progressPercentage).toBe(0)
            expect(state.currentStepNumber).toBe(1)
        })

        it('should calculate next and previous step candidates', () => {
            const currentStep = steps[1] // middle step
            const context = createOnboardingContext()
            const history = ['step-1']

            const state = coreService.getState(currentStep, context, history)

            expect(state.nextStepCandidate?.id).toBe('step-3')
            expect(state.previousStepCandidate?.id).toBe('step-1')
            expect(state.isFirstStep).toBe(false)
            expect(state.isLastStep).toBe(false)
            expect(state.canGoPrevious).toBe(true)
            expect(state.canGoNext).toBe(true)
        })

        it('should identify last step', () => {
            const currentStep = steps[2] // last step
            const context = createOnboardingContext()
            const history = ['step-1', 'step-2']

            const state = coreService.getState(currentStep, context, history)

            expect(state.isLastStep).toBe(true)
            expect(state.nextStepCandidate).toBe(null)
            expect(state.canGoNext).toBe(false)
        })

        it('should calculate progress with completed steps', () => {
            const currentStep = steps[1]
            const context: OnboardingContext = {
                ...createOnboardingContext(),
                flowData: {
                    _internal: {
                        completedSteps: { 'step-1': Date.now() },
                        startedAt: Date.now(),
                        stepStartTimes: {},
                    },
                },
            }
            const history: string[] = []

            const state = coreService.getState(currentStep, context, history)

            expect(state.completedSteps).toBe(1)
            expect(state.progressPercentage).toBe(33) // 1/3 = 33%
        })

        it('should disable navigation when there is an error', () => {
            const testError = new Error('Test error')
            coreService.setError(testError)

            const currentStep = steps[1]
            const context = createOnboardingContext()
            const history = ['step-1']

            const state = coreService.getState(currentStep, context, history)

            expect(state.canGoPrevious).toBe(false)
            expect(state.canGoNext).toBe(false)
            expect(state.isSkippable).toBe(false)
        })
    })

    describe('setState', () => {
        it('should update state via updater function', () => {
            const currentStep = steps[0]
            const context = createOnboardingContext()
            const history: string[] = []

            coreService.setState(
                () => ({
                    isLoading: true,
                }),
                currentStep,
                context,
                history
            )

            expect(coreService.isLoading).toBe(true)
        })

        it('should notify state change listeners', () => {
            const listener = vi.fn()
            eventManager.addEventListener('stateChange', listener)

            const currentStep = steps[0]
            const context = createOnboardingContext()
            const history: string[] = []

            coreService.setState(
                () => ({
                    isLoading: true,
                }),
                currentStep,
                context,
                history
            )

            expect(listener).toHaveBeenCalled()
        })

        it('should call context change callback when context changes', () => {
            coreService.setHydrating(false) // Must not be hydrating

            const currentStep = steps[0]
            const context = createOnboardingContext()
            const history: string[] = []
            const onContextChange = vi.fn()

            coreService.setState(
                () => ({
                    context: { ...context, flowData: { testValue: 'updated' } },
                }),
                currentStep,
                context,
                history,
                onContextChange
            )

            expect(onContextChange).toHaveBeenCalled()
        })

        it('should not call context change callback during hydration', () => {
            // isHydrating is true by default
            const currentStep = steps[0]
            const context = createOnboardingContext()
            const history: string[] = []
            const onContextChange = vi.fn()

            coreService.setState(
                () => ({
                    context: { ...context, flowData: { testValue: 'updated' } },
                }),
                currentStep,
                context,
                history,
                onContextChange
            )

            expect(onContextChange).not.toHaveBeenCalled()
        })
    })

    describe('notifyStateChange', () => {
        it('should emit stateChange event', () => {
            const listener = vi.fn()
            eventManager.addEventListener('stateChange', listener)

            const currentStep = steps[0]
            const context = createOnboardingContext()
            const history: string[] = []

            coreService.notifyStateChange(currentStep, context, history)

            expect(listener).toHaveBeenCalledWith({
                state: expect.objectContaining({
                    currentStep,
                    context,
                }),
            })
        })
    })

    describe('step utilities', () => {
        describe('getRelevantSteps', () => {
            it('should return all steps when no conditions', () => {
                const context = createOnboardingContext()
                const relevantSteps = coreService.getRelevantSteps(context)
                expect(relevantSteps).toHaveLength(3)
            })

            it('should filter out steps with failing conditions', () => {
                const conditionalService = new CoreEngineService(
                    eventManager,
                    createConditionalSteps(),
                    'step-1',
                    flowContext
                )
                const context: OnboardingContext = {
                    ...createOnboardingContext(),
                    flowData: { testValue: 'hide' },
                }

                const relevantSteps = conditionalService.getRelevantSteps(context)
                expect(relevantSteps).toHaveLength(2)
                expect(relevantSteps.find((s) => s.id === 'step-2')).toBeUndefined()
            })

            it('should include steps with passing conditions', () => {
                const conditionalService = new CoreEngineService(
                    eventManager,
                    createConditionalSteps(),
                    'step-1',
                    flowContext
                )
                const context: OnboardingContext = {
                    ...createOnboardingContext(),
                    flowData: { testValue: 'show' },
                }

                const relevantSteps = conditionalService.getRelevantSteps(context)
                expect(relevantSteps).toHaveLength(3)
            })
        })

        describe('getStepById', () => {
            it('should find step by string ID', () => {
                const step = coreService.getStepById('step-2')
                expect(step?.id).toBe('step-2')
            })

            it('should return undefined for non-existent step', () => {
                const step = coreService.getStepById('non-existent')
                expect(step).toBeUndefined()
            })
        })

        describe('getCompletedSteps', () => {
            it('should return empty array when no steps completed', () => {
                const context = createOnboardingContext()
                const completedSteps = coreService.getCompletedSteps(context)
                expect(completedSteps).toHaveLength(0)
            })

            it('should return completed steps', () => {
                const context: OnboardingContext = {
                    ...createOnboardingContext(),
                    flowData: {
                        _internal: {
                            completedSteps: {
                                'step-1': Date.now(),
                                'step-2': Date.now(),
                            },
                            startedAt: Date.now(),
                            stepStartTimes: {},
                        },
                    },
                }

                const completedSteps = coreService.getCompletedSteps(context)
                expect(completedSteps).toHaveLength(2)
                expect(completedSteps.map((s) => s.id)).toContain('step-1')
                expect(completedSteps.map((s) => s.id)).toContain('step-2')
            })
        })
    })

    describe('navigation candidate calculations', () => {
        it('should follow explicit nextStep', () => {
            const stepsWithExplicitNext: OnboardingStep<OnboardingContext>[] = [
                {
                    id: 'step-1',
                    type: 'INFORMATION',
                    payload: { title: 'Step 1' },
                    nextStep: 'step-3', // Skip step-2
                },
                { id: 'step-2', type: 'INFORMATION', payload: { title: 'Step 2' } },
                { id: 'step-3', type: 'INFORMATION', payload: { title: 'Step 3' } },
            ]

            const service = new CoreEngineService(eventManager, stepsWithExplicitNext, 'step-1', flowContext)

            const state = service.getState(stepsWithExplicitNext[0], createOnboardingContext(), [])

            expect(state.nextStepCandidate?.id).toBe('step-3')
        })

        it('should follow explicit previousStep', () => {
            const stepsWithExplicitPrev: OnboardingStep<OnboardingContext>[] = [
                { id: 'step-1', type: 'INFORMATION', payload: { title: 'Step 1' } },
                { id: 'step-2', type: 'INFORMATION', payload: { title: 'Step 2' } },
                {
                    id: 'step-3',
                    type: 'INFORMATION',
                    payload: { title: 'Step 3' },
                    previousStep: 'step-1', // Skip step-2
                },
            ]

            const service = new CoreEngineService(eventManager, stepsWithExplicitPrev, 'step-1', flowContext)

            const state = service.getState(stepsWithExplicitPrev[2], createOnboardingContext(), ['step-1', 'step-2'])

            expect(state.previousStepCandidate?.id).toBe('step-1')
        })

        it('should return null for nextStep when flow ends explicitly', () => {
            const stepsWithNullNext: OnboardingStep<OnboardingContext>[] = [
                {
                    id: 'step-1',
                    type: 'INFORMATION',
                    payload: { title: 'Step 1' },
                    nextStep: null, // Explicitly end flow
                },
                { id: 'step-2', type: 'INFORMATION', payload: { title: 'Step 2' } },
            ]

            const service = new CoreEngineService(eventManager, stepsWithNullNext, 'step-1', flowContext)

            const state = service.getState(stepsWithNullNext[0], createOnboardingContext(), [])

            expect(state.nextStepCandidate).toBe(null)
            expect(state.isLastStep).toBe(true)
        })

        it('should use history for previous step when no explicit previousStep', () => {
            const state = coreService.getState(steps[2], createOnboardingContext(), ['step-1', 'step-2'])

            expect(state.previousStepCandidate?.id).toBe('step-2')
        })

        it('should fall back to array order when history is empty', () => {
            const state = coreService.getState(steps[2], createOnboardingContext(), [])

            expect(state.previousStepCandidate?.id).toBe('step-2')
        })
    })
})
