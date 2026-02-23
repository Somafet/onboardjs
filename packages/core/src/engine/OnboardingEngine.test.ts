import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { OnboardingEngine } from './OnboardingEngine'
import type { OnboardingEngineConfig, BeforeStepChangeEvent, LoadedData } from './types'
import type { OnboardingStep, OnboardingContext, ChecklistStepPayload, ChecklistItemState } from '../types'

describe('OnboardingEngine', () => {
    let engine: OnboardingEngine
    let basicConfig: OnboardingEngineConfig
    let mockSteps: OnboardingStep[]

    beforeEach(() => {
        // Reset console mocks
        vi.clearAllMocks()

        mockSteps = [
            {
                id: 'step1',
                payload: { mainText: 'Welcome to onboarding' },
                nextStep: 'step2',
            },
            {
                id: 'step2',
                type: 'SINGLE_CHOICE',
                payload: {
                    question: 'What is your role?',
                    options: [
                        { id: 'dev', label: 'Developer', value: 'developer' },
                        { id: 'designer', label: 'Designer', value: 'designer' },
                    ],
                    dataKey: 'userRole',
                },
                nextStep: 'step3',
                previousStep: 'step1',
            },
            {
                id: 'step3',
                type: 'CONFIRMATION',
                payload: { confirmationMessage: 'Are you ready?' },
                previousStep: 'step2',
            },
        ]

        basicConfig = {
            steps: mockSteps,
            onFlowComplete: vi.fn(),
            onStepChange: vi.fn(),
        }
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('Initialization', () => {
        it('should initialize with first step when no initial step is specified', async () => {
            engine = new OnboardingEngine(basicConfig)
            await engine.ready()

            // Wait for initialization to complete

            const state = engine.getState()
            expect(state.currentStep).toEqual(mockSteps[0])
            expect(state.isHydrating).toBe(false)
            expect(state.isLoading).toBe(false)
        })

        it('should initialize with specified initial step', async () => {
            const config = { ...basicConfig, initialStepId: 'step2' }
            engine = new OnboardingEngine(config)

            await engine.ready()

            const state = engine.getState()
            expect(state.currentStep).toEqual(mockSteps[1])
        })

        it('should handle empty steps array', async () => {
            const config = { ...basicConfig, steps: [] }
            engine = new OnboardingEngine(config)
            await engine.ready()

            const state = engine.getState()
            expect(state.currentStep).toBeNull()
            expect(state.isCompleted).toBe(true)
        })

        it('should merge initial context with default context', async () => {
            const initialContext = {
                flowData: { existingData: 'test' },
                currentUser: { name: 'John' },
            }
            const config = { ...basicConfig, initialContext }
            engine = new OnboardingEngine(config)

            const state = engine.getState()
            expect(state.context.flowData.existingData).toBe('test')
            expect(state.context.currentUser.name).toBe('John')
        })

        it('should emit stateChange event with isHydrating: false when initialization completes', async () => {
            const stateChangeSpy = vi.fn()

            engine = new OnboardingEngine(basicConfig)
            engine.addEventListener('stateChange', stateChangeSpy)

            await engine.ready()

            // At least one stateChange event should have been emitted
            expect(stateChangeSpy).toHaveBeenCalled()

            // The final state should have isHydrating: false
            const lastCall = stateChangeSpy.mock.calls[stateChangeSpy.mock.calls.length - 1]
            expect(lastCall[0].state.isHydrating).toBe(false)

            // Also verify the engine state directly
            const state = engine.getState()
            expect(state.isHydrating).toBe(false)
        })

        it('should notify listeners of hydration completion even if subscribed during initialization', async () => {
            // This test ensures that listeners added while the engine is still initializing
            // will receive the final state with isHydrating: false
            const stateChangeSpy = vi.fn()

            engine = new OnboardingEngine(basicConfig)

            // Subscribe immediately after construction (while engine is still hydrating)
            engine.addEventListener('stateChange', stateChangeSpy)

            // The engine should be hydrating right now
            const initialState = engine.getState()
            expect(initialState.isHydrating).toBe(true)

            await engine.ready()

            // After ready(), a stateChange with isHydrating: false should have been emitted
            const statesWithHydratingFalse = stateChangeSpy.mock.calls.filter(
                (call) => call[0].state.isHydrating === false
            )
            expect(statesWithHydratingFalse.length).toBeGreaterThan(0)
        })
    })

    describe('Data Loading and Persistence', () => {
        it('should load data on initialization when loadData is provided', async () => {
            const loadedData: LoadedData = {
                currentStepId: 'step2',
                flowData: { userRole: 'developer' },
                currentUser: { name: 'Jane' },
            }

            const loadData = vi.fn().mockResolvedValue(loadedData)
            const config = { ...basicConfig, loadData }

            engine = new OnboardingEngine(config)
            await engine.ready()

            expect(loadData).toHaveBeenCalled()
            const state = engine.getState()
            expect(state.currentStep?.id).toBe('step2')
            expect(state.context.flowData.userRole).toBe('developer')
            expect(state.context.currentUser.name).toBe('Jane')
        })

        it('should handle data loading errors gracefully', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
            const loadData = vi.fn().mockRejectedValue(new Error('Load failed'))
            const config = { ...basicConfig, loadData }

            engine = new OnboardingEngine(config)

            // The engine should still initialize successfully even with load errors
            await engine.ready()

            // Check that the error was logged
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('CoreEngineService [ERROR]'),
                expect.stringContaining('Error set'),
                expect.any(Error)
            )

            const state = engine.getState()
            expect(state.currentStep).toBe(null) // Should not have a current step
            expect(state.error).toBeInstanceOf(Error) // Should have an error in state
            expect(state.error?.message).toContain('Failed to load onboarding state')
            expect(state.isLoading).toBe(false) // Should not be loading
            expect(state.isHydrating).toBe(false) // Should not be hydrating
        })

        it('should persist data when context changes', async () => {
            const persistData = vi.fn().mockResolvedValue(undefined)
            const config = { ...basicConfig, persistData }

            engine = new OnboardingEngine(config)
            await engine.ready()

            await engine.updateContext({ flowData: { newData: 'value' } })

            expect(persistData).toHaveBeenCalledWith(
                expect.objectContaining({
                    flowData: expect.objectContaining({ newData: 'value' }),
                }),
                'step1'
            )
        })

        it('should handle persistence errors gracefully', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
            const persistData = vi.fn().mockRejectedValue(new Error('Persist failed'))
            const config = { ...basicConfig, persistData }

            engine = new OnboardingEngine(config)

            await engine.ready()

            await engine.updateContext({ flowData: { test: 'data' } })

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('CoreEngineService [ERROR]'),
                expect.stringContaining('Error set'),
                expect.any(Error)
            )
        })

        // It should handle no data returned from loadData
        it('should handle no data returned from loadData', async () => {
            const loadData = vi.fn().mockResolvedValue(null)
            const config = { ...basicConfig, loadData }

            engine = new OnboardingEngine(config)
            await engine.ready()

            const state = engine.getState()
            expect(state.currentStep).toBe(mockSteps[0]) // Should default to first step
        })

        // Ensure existing flowData (if any from constructor) is not lost if loadedData is sparse
        it('should not lose existing flowData when loadedData is sparse', async () => {
            const initialContext: OnboardingContext = {
                flowData: { existingData: 'initial' },
            }
            const loadData = vi.fn().mockResolvedValue({
                currentStepId: 'step2',
                flowData: {}, // Sparse data
            })
            const config = { ...basicConfig, loadData, initialContext }

            engine = new OnboardingEngine(config)
            await engine.ready()

            const state = engine.getState()
            expect(state.context.flowData.existingData).toBe('initial')
        })

        // Check if context actually changed to avoid unnecessary persists
        it('should not persist if context did not change', async () => {
            const persistData = vi.fn()
            const config = { ...basicConfig, persistData }

            engine = new OnboardingEngine(config)

            const initialContext = engine.getState().context
            await engine.updateContext(initialContext) // Same data

            expect(persistData).not.toHaveBeenCalled() // Should not persist
        })

        // Ensure Persist data if context changed and not hydrating
        it('should persist data if context changed and not hydrating', async () => {
            const persistData = vi.fn()
            const config = { ...basicConfig, persistData }

            engine = new OnboardingEngine(config)
            await engine.ready()

            await engine.updateContext({ flowData: { newData: 'value' } })

            expect(persistData).toHaveBeenCalledWith(
                expect.objectContaining({
                    flowData: expect.objectContaining({ newData: 'value' }),
                }),
                'step1'
            )
        })

        // It should load to step2 and be able to navigate back to step1
        it('should load to step2 and be able to navigate back to step1', async () => {
            const loadedData: LoadedData = {
                flowData: {
                    userRole: 'developer',
                    _internal: {
                        completedSteps: { step1: 1749553875099 },
                        startedAt: 1749553871180,
                        stepStartTimes: { step1: 1749553871180 },
                    },
                },
                currentStepId: 'step2',
            }

            const loadData = vi.fn().mockResolvedValue(loadedData)
            const config = { ...basicConfig, loadData }

            engine = new OnboardingEngine(config)
            await engine.ready()

            const state = engine.getState()
            expect(state.currentStep?.id).toBe('step2')
            expect(state.context.flowData.userRole).toBe('developer')

            await engine.previous() // Navigate back to step1
            const previousState = engine.getState()
            expect(previousState.currentStep?.id).toBe('step1')
        })

        it('should handle loading completed flow state', async () => {
            const loadedData: LoadedData = {
                currentStepId: null, // No current step means flow is completed
                flowData: { userRole: 'developer' },
            }

            const loadData = vi.fn().mockResolvedValue(loadedData)
            const config = { ...basicConfig, loadData }

            engine = new OnboardingEngine(config)
            await engine.ready()

            const state = engine.getState()
            expect(state.isCompleted).toBe(true)
            expect(state.currentStep).toBeNull()
            expect(state.context.flowData.userRole).toBe('developer')
        })

        it('Should handle loading state with no current step and no flowData', async () => {
            const loadedData: LoadedData = {
                currentStepId: undefined, // No current step means flow is completed
                flowData: {}, // No flow data
            }

            const loadData = vi.fn().mockResolvedValue(loadedData)
            const config = { ...basicConfig, loadData }

            engine = new OnboardingEngine(config)
            await engine.ready()

            const state = engine.getState()
            // State should not be completed
            expect(state.isCompleted).toBe(false)
            // currrentStep should be the first step
            expect(state.currentStep?.id).toBe('step1')
        })
    })

    describe('Navigation', () => {
        beforeEach(async () => {
            engine = new OnboardingEngine(basicConfig)
            await engine.ready()
        })

        it('should navigate to next step', async () => {
            await engine.next()

            const state = engine.getState()
            expect(state.currentStep?.id).toBe('step2')
        })

        it('should navigate to previous step', async () => {
            await engine.next() // Go to step2
            await engine.previous() // Back to step1

            const state = engine.getState()
            expect(state.currentStep?.id).toBe('step1')
        })

        it('canGoPrevious should be false if navigating back to the first step', async () => {
            await engine.next() // Go to step2
            await engine.previous() // Back to step1

            const state = engine.getState()
            expect(state.canGoPrevious).toBe(false) // Should not be able to go back from step1
        })

        // It should navigate to previous step even if no previous step is defined
        it('should handle previous step when no previous step is defined', async () => {
            await engine.next() // Go to step2
            await engine.previous() // Back to step1
            await engine.previous() // Try to go back again

            const state = engine.getState()
            expect(state.currentStep?.id).toBe('step1') // Should remain on step1
        })

        // It should navigate to previous step even when previousStep is not defined
        it('should handle previous step when previousStep is not defined', async () => {
            const stepsWithoutPrevious: OnboardingStep[] = [
                {
                    id: 'step1',
                    type: 'INFORMATION',
                    payload: { mainText: 'First step' },
                    nextStep: 'step2',
                },
                {
                    id: 'step2',
                    type: 'INFORMATION',
                    payload: { mainText: 'Second step' },
                    previousStep: undefined, // No previous step defined
                },
            ]

            const config = { ...basicConfig, steps: stepsWithoutPrevious }
            engine = new OnboardingEngine(config)

            await engine.next() // Go to step2
            await engine.previous() // Back to step1

            const state = engine.getState()
            expect(state.currentStep?.id).toBe('step1')
        })

        it('should navigate to specific step using goToStep', async () => {
            await engine.goToStep('step3')

            const state = engine.getState()
            expect(state.currentStep?.id).toBe('step3')
        })

        it('should handle navigation with step data', async () => {
            const stepData = { userRole: 'developer' }
            await engine.next(stepData)

            const state = engine.getState()
            expect(state.context.flowData.userRole).toBe('developer')
        })

        it('should handle goToStep navigation with step data', async () => {
            const stepData = { confirmation: true }
            await engine.goToStep('step3', stepData)

            const state = engine.getState()
            expect(state.currentStep?.id).toBe('step3')
            expect(state.context.flowData.confirmation).toBe(true)
        })

        it('should maintain navigation history', async () => {
            await engine.next() // step1 -> step2
            await engine.goToStep('step3') // step2 -> step3
            await engine.previous() // step3 -> step2 (from history)

            const state = engine.getState()
            expect(state.currentStep?.id).toBe('step2')
        })

        it('should complete flow when reaching end', async () => {
            await engine.next() // step1 -> step2
            await engine.next() // step2 -> step3
            await engine.next() // step3 -> complete

            const state = engine.getState()
            expect(state.isCompleted).toBe(true)
            expect(state.currentStep).toBeNull()
            expect(basicConfig.onFlowComplete).toHaveBeenCalledWith(state.context)
        })

        // it should handle errors when onFlowComplete throws
        it('should handle errors when onFlowComplete throws', async () => {
            const error = new Error('Flow complete error')
            const onFlowComplete = vi.fn().mockImplementation(() => {
                throw error
            })
            const config = { ...basicConfig, onFlowComplete }
            engine = new OnboardingEngine(config)
            await engine.ready()

            await engine.next() // step1 -> step2
            await engine.next() // step2 -> step3
            await engine.next() // step3 -> complete

            const state = engine.getState()
            expect(state.isCompleted).toBe(true)
            expect(state.error).toBe(error)
        })

        it('should navigate to a valid step by id', async () => {
            await engine.ready()
            await engine.goToStep('step2')
            const state = engine.getState()
            expect(state.currentStep?.id).toBe('step2')
        })

        it('should set currentStep to null if step id does not exist', async () => {
            await engine.ready()
            await engine.goToStep('non-existent')
            const state = engine.getState()
            expect(state.currentStep).toBeNull()
            expect(state.isCompleted).toBe(true)
        })

        it('should skip steps with unmet condition', async () => {
            const conditionalSteps: OnboardingStep[] = [
                {
                    id: 'step1',
                    type: 'INFORMATION',
                    payload: { mainText: 'First step' },
                    nextStep: 'step2',
                },
                {
                    id: 'step2',
                    type: 'INFORMATION',
                    payload: { mainText: 'Conditional step' },
                    condition: () => false,
                    nextStep: 'step3',
                },
                {
                    id: 'step3',
                    type: 'INFORMATION',
                    payload: { mainText: 'Final step' },
                },
            ]
            engine = new OnboardingEngine({
                ...basicConfig,
                steps: conditionalSteps,
            })
            await engine.ready()
            await engine.goToStep('step2')
            const state = engine.getState()
            expect(state.currentStep?.id).toBe('step3')
        })

        it('should call beforeStepChange listeners and allow cancellation', async () => {
            await engine.ready()
            const cancelListener = vi.fn((event: BeforeStepChangeEvent) => {
                event.cancel()
            })
            engine.addEventListener('beforeStepChange', cancelListener)
            await engine.goToStep('step2')
            const state = engine.getState()
            expect(cancelListener).toHaveBeenCalled()
            expect(state.currentStep?.id).toBe('step1')
        })

        it('should allow beforeStepChange listener to redirect navigation', async () => {
            await engine.ready()
            const redirectListener = vi.fn((event: BeforeStepChangeEvent) => {
                if (event.redirect) event.redirect('step3')
            })
            engine.addEventListener('beforeStepChange', redirectListener)
            await engine.goToStep('step2')
            const state = engine.getState()
            expect(redirectListener).toHaveBeenCalled()
            expect(state.currentStep?.id).toBe('step3')
        })

        it('should call onStepActive when entering a step', async () => {
            const onStepActive = vi.fn()
            const stepsWithHook = [{ ...basicConfig.steps[0], onStepActive }, ...basicConfig.steps.slice(1)]
            engine = new OnboardingEngine({ ...basicConfig, steps: stepsWithHook })
            await engine.ready()
            await engine.goToStep('step2')
            expect(onStepActive).toHaveBeenCalled()
        })

        it('should set error if onStepActive throws', async () => {
            const error = new Error('onStepActive error')
            const onStepActive = vi.fn().mockRejectedValue(error)
            const stepsWithHook = [
                {
                    ...basicConfig.steps[0],
                    id: 'step1',
                    type: 'CUSTOM_COMPONENT' as const,
                    payload: {
                        componentKey: 'testComponent',
                    },
                    nextStep: 'step2',
                }, // Ensure IDs are clear
                {
                    ...basicConfig.steps.slice(1)[0],
                    id: 'step2',
                    type: 'CUSTOM_COMPONENT' as const,
                    payload: {
                        componentKey: 'testComponent',
                    },
                    onStepActive,
                },
            ]
            engine = new OnboardingEngine({
                ...basicConfig,
                steps: stepsWithHook,
                initialStepId: 'step1',
            })

            await engine.ready()
            // Now engine is past initial loading. Current step should be "step1".

            // Call the method that triggers the error
            // We expect navigateToStep to complete, including its internal async operations and state updates
            await engine.goToStep('step2')

            // Yield to the event loop to ensure all async operations complete
            await new Promise((resolve) => setTimeout(resolve, 0))

            const state = engine.getState()
            expect(onStepActive).toHaveBeenCalled() // Make sure the mock was called
            expect(state.error).toBe(error) // Now check the error
            expect(state.currentStep?.id).toBe('step2')
            expect(state.isLoading).toBe(false)
        })

        it('should call onFlowComplete when navigating from the last step (which has no nextStep)', async () => {
            // engine is instantiated in the beforeEach with basicConfig
            // basicConfig.onFlowComplete is a vi.fn()

            // Ensure engine is ready and on the first step
            await engine.ready()
            expect(engine.getState().currentStep?.id).toBe('step1')

            // Navigate to the last defined step ("step3")
            await engine.goToStep('step3')
            let state = engine.getState()
            expect(state.currentStep?.id).toBe('step3')
            expect(state.isCompleted).toBe(false)
            expect(basicConfig.onFlowComplete).not.toHaveBeenCalled() // Not yet completed

            // Now, attempt to navigate *from* step3. Since step3 has no nextStep, this should complete the flow.
            await engine.next() // This is the action that triggers completion

            // It's good practice to allow microtasks to settle after the action that triggers the callback
            await new Promise((resolve) => setTimeout(resolve, 0))

            // Assertions after completion
            expect(basicConfig.onFlowComplete).toHaveBeenCalledTimes(1)
            // You can also check the context passed to onFlowComplete if needed:
            // expect(basicConfig.onFlowComplete).toHaveBeenCalledWith(expect.objectContaining({ flowData: ... }));

            state = engine.getState()
            expect(state.isCompleted).toBe(true)
            expect(state.currentStep).toBeNull()
        })

        it('should persist data when flow is completed', async () => {
            const persistData = vi.fn()
            engine = new OnboardingEngine({
                ...basicConfig,
                persistData: persistData,
            })
            await engine.ready()

            // Navigate through all steps to complete the flow
            await engine.next() // step1 -> step2
            await engine.next() // step2 -> step3
            await engine.next() // step3 -> complete (flow finished)

            expect(persistData).toHaveBeenCalled()
        })

        it('should update history when navigating forward', async () => {
            await engine.ready()
            await engine.goToStep('step2')
            // @ts-expect-error: access private property for test
            expect(engine._history).toContain('step1')
        })

        it('should not update history when navigating previous', async () => {
            await engine.ready()
            await engine.next()
            await engine.previous()
            // @ts-expect-error: access private property for test
            expect(engine._history).not.toContain('step2')
        })

        it('should handle circular navigation patterns', async () => {
            const circularSteps: OnboardingStep[] = [
                {
                    id: 'step1',
                    type: 'INFORMATION',
                    payload: { mainText: 'Step 1' },
                    nextStep: 'step2',
                },
                {
                    id: 'step2',
                    type: 'INFORMATION',
                    payload: { mainText: 'Step 2' },
                    nextStep: (context) => (context.flowData.goBack ? 'step1' : 'step3'),
                    previousStep: 'step1',
                },
                {
                    id: 'step3',
                    type: 'INFORMATION',
                    payload: { mainText: 'Step 3' },
                    previousStep: 'step2',
                },
            ]

            engine = new OnboardingEngine({ ...basicConfig, steps: circularSteps })
            await engine.ready()

            await engine.next() // step1 -> step2
            await engine.previous() // step2 -> step1 (circular)
            await engine.next() // step1 -> step2
            await engine.next() // step2 -> step3

            const state = engine.getState()
            expect(state.currentStep?.id).toBe('step3')
        })

        it('should handle circular navigation patterns with goBack flag', async () => {
            const circularSteps: OnboardingStep[] = [
                {
                    id: 'step1',
                    type: 'INFORMATION',
                    payload: { mainText: 'Step 1' },
                    nextStep: 'step2',
                },
                {
                    id: 'step2',
                    type: 'INFORMATION',
                    payload: { mainText: 'Step 2' },
                    nextStep: (context) => (context.flowData.goBack ? 'step1' : 'step3'),
                    previousStep: 'step1',
                },
                {
                    id: 'step3',
                    type: 'INFORMATION',
                    payload: { mainText: 'Step 3' },
                    previousStep: 'step2',
                },
            ]

            engine = new OnboardingEngine({ ...basicConfig, steps: circularSteps })
            await engine.ready()

            await engine.next() // step1 -> step2
            await engine.next({ goBack: true }) // step2 -> step1 (circular)
            await engine.next({ goBack: false }) // step1 -> step2 (clear the goBack flag)
            await engine.next() // step2 -> step3

            const state = engine.getState()
            expect(state.currentStep?.id).toBe('step3')
        })

        it('should handle deeply nested conditional navigation', async () => {
            const conditionalSteps: OnboardingStep[] = [
                {
                    id: 'start',
                    type: 'INFORMATION',
                    payload: { mainText: 'Start' },
                    nextStep: (context) => {
                        if (context.flowData.userType === 'admin') return 'admin-flow'
                        if (context.flowData.userType === 'user') return 'user-flow'
                        return 'guest-flow'
                    },
                },
                {
                    id: 'admin-flow',
                    type: 'INFORMATION',
                    payload: { mainText: 'Admin' },
                    condition: (context) => context.flowData.userType === 'admin',
                    nextStep: 'end',
                },
                {
                    id: 'user-flow',
                    type: 'INFORMATION',
                    payload: { mainText: 'User' },
                    condition: (context) => context.flowData.userType === 'user',
                    nextStep: 'end',
                },
                {
                    id: 'guest-flow',
                    type: 'INFORMATION',
                    payload: { mainText: 'Guest' },
                    nextStep: 'end',
                },
                {
                    id: 'end',
                    type: 'INFORMATION',
                    payload: { mainText: 'End' },
                },
            ]

            engine = new OnboardingEngine({
                ...basicConfig,
                steps: conditionalSteps,
            })
            await engine.ready()

            await engine.next({ userType: 'admin' })
            expect(engine.getState().currentStep?.id).toBe('admin-flow')

            await engine.next()
            expect(engine.getState().currentStep?.id).toBe('end')
        })
    })

    describe('Step Conditions', () => {
        it('should skip steps that do not meet conditions', async () => {
            const conditionalSteps: OnboardingStep[] = [
                {
                    id: 'step1',
                    type: 'INFORMATION',
                    payload: { mainText: 'First step' },
                    nextStep: 'step2',
                },
                {
                    id: 'step2',
                    type: 'INFORMATION',
                    payload: { mainText: 'Conditional step' },
                    condition: (context) => context.flowData.showStep2 === true,
                    nextStep: 'step3',
                },
                {
                    id: 'step3',
                    type: 'INFORMATION',
                    payload: { mainText: 'Final step' },
                },
            ]

            const config = { ...basicConfig, steps: conditionalSteps }
            engine = new OnboardingEngine(config)
            await engine.ready()

            await engine.next() // Should skip step2 and go to step3

            const state = engine.getState()
            expect(state.currentStep?.id).toBe('step3')
        })
    })

    describe('Dynamic Navigation Functions', () => {
        it('should handle function-based nextStep', async () => {
            const dynamicSteps: OnboardingStep[] = [
                {
                    id: 'step1',
                    type: 'INFORMATION',
                    payload: { mainText: 'Choose path' },
                    nextStep: (context) => (context.flowData.userRole === 'admin' ? 'admin-step' : 'user-step'),
                },
                {
                    id: 'admin-step',
                    type: 'INFORMATION',
                    payload: { mainText: 'Admin content' },
                },
                {
                    id: 'user-step',
                    type: 'INFORMATION',
                    payload: { mainText: 'User content' },
                },
            ]

            const config = { ...basicConfig, steps: dynamicSteps }
            engine = new OnboardingEngine(config)
            await engine.ready()

            await engine.next({ userRole: 'admin' })

            const state = engine.getState()
            expect(state.currentStep?.id).toBe('admin-step')
        })

        // It should handle empty nextStep property (no next step defined) by getting to the next step in the steps array
        it('should handle empty nextStep property', async () => {
            const stepsWithEmptyNext: OnboardingStep[] = [
                {
                    id: 'step1',
                    type: 'INFORMATION',
                    payload: { mainText: 'First step' },
                    nextStep: undefined, // No next step defined
                },
                {
                    id: 'step2',
                    type: 'INFORMATION',
                    payload: { mainText: 'Second step' },
                },
            ]

            const config = { ...basicConfig, steps: stepsWithEmptyNext }
            engine = new OnboardingEngine(config)
            await engine.ready()
            expect(engine.getState().currentStep?.id).toBe('step1')

            await engine.next() // Should go to step2

            const state = engine.getState()
            expect(state.currentStep?.id).toBe('step2')
        })

        it('should handle empty nextStep property with Flow Finish if no other steps are provided', async () => {
            const stepsWithEmptyNext: OnboardingStep[] = [
                {
                    id: 'step1',
                    type: 'INFORMATION',
                    payload: { mainText: 'First step' },
                    nextStep: undefined, // No next step defined
                },
            ]
            const onFlowComplete = vi.fn()

            const config = {
                ...basicConfig,
                onFlowComplete,
                steps: stepsWithEmptyNext,
            }
            engine = new OnboardingEngine(config)
            await engine.ready()
            expect(engine.getState().currentStep?.id).toBe('step1')

            await engine.next()

            const state = engine.getState()
            expect(state.currentStep).toBe(null)
            expect(state.isCompleted).toBe(true)
            expect(onFlowComplete).toHaveBeenCalledWith(state.context)
        })
    })

    describe('Skip Functionality', () => {
        it('should skip step when skippable', async () => {
            const skippableSteps: OnboardingStep[] = [
                {
                    id: 'step1',
                    type: 'INFORMATION',
                    payload: { mainText: 'You can skip this' },
                    isSkippable: true,
                    nextStep: 'step2',
                    skipToStep: 'step3',
                },
                {
                    id: 'step2',
                    type: 'INFORMATION',
                    payload: { mainText: 'Regular step' },
                    nextStep: 'step3',
                },
                {
                    id: 'step3',
                    type: 'INFORMATION',
                    payload: { mainText: 'Final step' },
                },
            ]

            const config = { ...basicConfig, steps: skippableSteps }
            engine = new OnboardingEngine(config)
            await engine.ready()

            await engine.skip()

            const state = engine.getState()
            expect(state.currentStep?.id).toBe('step3')
        })

        it('should not skip non-skippable step', async () => {
            const testSteps: OnboardingStep[] = [
                {
                    id: 'step1',
                    type: 'INFORMATION',
                    payload: { mainText: 'You can skip this' },
                    isSkippable: false,
                    nextStep: 'step2',
                },
                {
                    id: 'step2',
                    type: 'INFORMATION',
                    payload: { mainText: 'Regular step' },
                    nextStep: 'step3',
                },
                {
                    id: 'step3',
                    type: 'INFORMATION',
                    payload: { mainText: 'Final step' },
                },
            ]
            const config = { ...basicConfig, steps: testSteps }
            engine = new OnboardingEngine(config)
            await engine.skip() // step1 is non-skippable

            const state = engine.getState()
            expect(state.currentStep?.id).toBe('step1') // Should remain on step1
        })
    })

    describe('Checklist Steps', () => {
        let checklistSteps: OnboardingStep[]

        beforeEach(() => {
            checklistSteps = [
                {
                    id: 'checklist-step',
                    type: 'CHECKLIST',
                    payload: {
                        items: [
                            { id: 'task1', label: 'Task 1', isMandatory: true },
                            { id: 'task2', label: 'Task 2', isMandatory: true },
                            { id: 'task3', label: 'Task 3', isMandatory: false },
                        ],
                        dataKey: 'checklistData',
                    } as ChecklistStepPayload,
                    nextStep: 'next-step',
                },
                {
                    id: 'next-step',
                    type: 'INFORMATION',
                    payload: { mainText: 'Checklist completed' },
                },
            ]
        })

        it('should initialize checklist items state', async () => {
            const config = { ...basicConfig, steps: checklistSteps }
            engine = new OnboardingEngine(config)
            await engine.ready()

            const state = engine.getState()
            const checklistData = state.context.flowData.checklistData as ChecklistItemState[]

            expect(checklistData).toHaveLength(3)
            expect(checklistData.every((item) => !item.isCompleted)).toBe(true)
        })

        it('should update checklist item state', async () => {
            const config = { ...basicConfig, steps: checklistSteps }
            engine = new OnboardingEngine(config)
            await engine.ready()

            await engine.updateChecklistItem('task1', true)

            const state = engine.getState()
            const checklistData = state.context.flowData.checklistData as ChecklistItemState[]
            const task1 = checklistData.find((item) => item.id === 'task1')

            expect(task1?.isCompleted).toBe(true)
        })

        it('should prevent navigation when mandatory items not completed', async () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
            const config = { ...basicConfig, steps: checklistSteps }
            engine = new OnboardingEngine(config)
            await engine.ready()

            await engine.updateChecklistItem('task1', true) // Only complete task1
            await engine.next() // Should fail

            const state = engine.getState()
            expect(state.currentStep?.id).toBe('checklist-step')
            expect(state.error?.message).toContain('Checklist criteria not met')
            expect(consoleWarnSpy).toHaveBeenCalled()
        })

        it('should allow navigation when all mandatory items completed', async () => {
            const config = { ...basicConfig, steps: checklistSteps }
            engine = new OnboardingEngine(config)
            await engine.ready()

            await engine.updateChecklistItem('task1', true)
            await engine.updateChecklistItem('task2', true)
            await engine.next()

            const state = engine.getState()
            expect(state.currentStep?.id).toBe('next-step')
        })

        it('should handle minItemsToComplete rule', async () => {
            const modifiedChecklistSteps = [...checklistSteps]
            ;(modifiedChecklistSteps[0].payload as ChecklistStepPayload).minItemsToComplete = 2

            const config = { ...basicConfig, steps: modifiedChecklistSteps }
            engine = new OnboardingEngine(config)
            await engine.ready()

            await engine.updateChecklistItem('task1', true)
            await engine.updateChecklistItem('task3', true) // Non-mandatory item
            await engine.next()

            const state = engine.getState()
            expect(state.currentStep?.id).toBe('next-step')
        })

        it('should handle conditional checklist items', async () => {
            const conditionalChecklistSteps: OnboardingStep[] = [
                {
                    id: 'conditional-checklist',
                    type: 'CHECKLIST',
                    payload: {
                        items: [
                            { id: 'task1', label: 'Task 1', isMandatory: true },
                            {
                                id: 'task2',
                                label: 'Task 2',
                                isMandatory: true,
                                condition: (context) => context.flowData.showTask2 === true,
                            },
                        ],
                        dataKey: 'conditionalChecklistData',
                    } as ChecklistStepPayload,
                },
            ]

            const config = { ...basicConfig, steps: conditionalChecklistSteps }
            engine = new OnboardingEngine(config)
            await engine.ready()

            // With showTask2 false, only task1 should be required
            await engine.updateChecklistItem('task1', true)
            await engine.next()

            const state = engine.getState()
            expect(state.isCompleted).toBe(true)
        })
    })

    describe('State Management', () => {
        beforeEach(async () => {
            engine = new OnboardingEngine(basicConfig)
            await engine.ready()
        })

        it('should provide correct state information', () => {
            const state = engine.getState()

            expect(state.currentStep).toEqual(mockSteps[0])
            expect(state.isFirstStep).toBe(true)
            expect(state.isLastStep).toBe(false)
            expect(state.canGoNext).toBe(true)
            expect(state.canGoPrevious).toBe(false)
            expect(state.isSkippable).toBe(false)
            expect(state.isLoading).toBe(false)
            expect(state.isHydrating).toBe(false)
            expect(state.isCompleted).toBe(false)
            expect(state.error).toBeNull()
        })

        it('should update state when navigating', async () => {
            await engine.next()

            const state = engine.getState()
            expect(state.isFirstStep).toBe(false)
            expect(state.canGoPrevious).toBe(true)
        })

        it('should update context correctly', async () => {
            const newContextData = {
                flowData: { userPreference: 'dark' },
                customField: 'value',
            }

            await engine.updateContext(newContextData)

            const state = engine.getState()
            expect(state.context.flowData.userPreference).toBe('dark')
            expect(state.context.customField).toBe('value')
        })
    })

    describe('Event Listeners', () => {
        beforeEach(async () => {
            engine = new OnboardingEngine(basicConfig)
            await engine.ready()
        })

        it('should notify state change listeners', async () => {
            const listener = vi.fn()
            engine.addEventListener('stateChange', listener)

            await engine.next()

            expect(listener).toHaveBeenCalled()
        })

        it('should unsubscribe state change listeners', async () => {
            const listener = vi.fn()
            const unsubscribe = engine.addEventListener('stateChange', listener)

            unsubscribe()
            await engine.next()

            expect(listener).not.toHaveBeenCalled()
        })

        it('should handle beforeStepChange listeners', async () => {
            const listener = vi.fn().mockImplementation(() => {
                // Allow navigation
            })

            engine.addEventListener('beforeStepChange', listener)
            await engine.next()

            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    currentStep: expect.objectContaining({ id: 'step1' }),
                    targetStepId: 'step2',
                    direction: 'next',
                })
            )
        })

        it('should allow beforeStepChange listeners to cancel navigation', async () => {
            const listener = vi.fn().mockImplementation((event: BeforeStepChangeEvent) => {
                event.cancel()
            })

            engine.addEventListener('beforeStepChange', listener)
            await engine.next()

            const state = engine.getState()
            expect(state.currentStep?.id).toBe('step1') // Should remain on step1
        })

        it('should allow beforeStepChange listeners to redirect navigation', async () => {
            const listener = vi.fn().mockImplementation((event: BeforeStepChangeEvent) => {
                if (event.redirect) {
                    event.redirect('step3')
                }
            })

            engine.addEventListener('beforeStepChange', listener)
            await engine.next()

            const state = engine.getState()
            expect(state.currentStep?.id).toBe('step3') // Should redirect to step3
        })
    })

    describe('Step Lifecycle Hooks', () => {
        it('should call onStepActive when entering a step', async () => {
            const onStepActive = vi.fn()
            const stepsWithHooks: OnboardingStep[] = [
                {
                    ...mockSteps[0],
                    onStepActive,
                },
                ...mockSteps.slice(1),
            ]

            const config = { ...basicConfig, steps: stepsWithHooks }
            engine = new OnboardingEngine(config)
            await engine.ready()

            expect(onStepActive).toHaveBeenCalledWith(expect.any(Object))
        })

        it('should call onStepComplete when leaving a step', async () => {
            const onStepComplete = vi.fn()
            const stepsWithHooks: OnboardingStep[] = [
                {
                    ...mockSteps[0],
                    onStepComplete,
                },
                ...mockSteps.slice(1),
            ]

            const config = { ...basicConfig, steps: stepsWithHooks }
            engine = new OnboardingEngine(config)
            await engine.ready()

            const stepData = { userData: 'test' }
            await engine.next(stepData)

            expect(onStepComplete).toHaveBeenCalledWith(stepData, expect.any(Object))
        })
    })

    describe('Reset Functionality', () => {
        beforeEach(async () => {
            engine = new OnboardingEngine(basicConfig)

            await engine.next() // Move to step2
        })

        it('should reset to initial state', async () => {
            await engine.reset()

            const state = engine.getState()
            expect(state.currentStep?.id).toBe('step1')
            expect(state.isCompleted).toBe(false)
            expect(state.error).toBeNull()
        })

        it('should reset with new configuration', async () => {
            const newSteps: OnboardingStep[] = [
                {
                    id: 'new-step',
                    type: 'INFORMATION',
                    payload: { mainText: 'New content' },
                },
            ]
            await engine.ready()

            await engine.reset({ steps: newSteps, initialStepId: 'new-step' })

            const state = engine.getState()
            expect(state.currentStep?.id).toBe('new-step')
        })

        it('should preserve persistence handlers when not overridden', async () => {
            const persistData = vi.fn()
            const configWithPersist = { ...basicConfig, persistData }
            engine = new OnboardingEngine(configWithPersist)

            await engine.reset() // Reset without new persistence config
            await engine.updateContext({ flowData: { test: 'data' } })

            expect(persistData).toHaveBeenCalled()
        })

        // it should handle reset with overridden persistence handlers
        it('should handle reset with overridden persistence handlers', async () => {
            const persistData = vi.fn()
            const loadData = vi.fn()
            const onFlowComplete = vi.fn()
            const onStepChange = vi.fn()
            const configWithPersist = { ...basicConfig, persistData }
            engine = new OnboardingEngine(configWithPersist)
            await engine.ready()

            await engine.reset({
                persistData: vi.fn(),
                loadData: vi.fn(),
                onFlowComplete: vi.fn(),
                onStepChange: vi.fn(),
            }) // Reset with new persistence config

            await engine.ready() // Ensure the engine is ready after reset
            await engine.updateContext({ flowData: { test: 'data' } })

            expect(persistData).not.toHaveBeenCalled() // Should not call old handler
            expect(loadData).not.toHaveBeenCalled() // Should not call old handler
            expect(onFlowComplete).not.toHaveBeenCalled() // Should not call old handler
            expect(onStepChange).not.toHaveBeenCalled() // Should not call old handler
        })

        // It should call clearPersistedData when it is provided
        it('should call clearPersistedData when provided', async () => {
            const clearPersistedData = vi.fn()
            engine = new OnboardingEngine({
                ...basicConfig,
                clearPersistedData: clearPersistedData,
            })
            await engine.ready()

            await engine.reset()

            expect(clearPersistedData).toHaveBeenCalled()
        })

        // Mock a persistence data store and ensure that during the reset, it is cleared if the clearPersistedData handler is provided
        it('should clear persisted data when clearPersistedData is provided', async () => {
            const fakeStorage = {
                items: {} as Record<string | number, any>,
                get: function (key: string | number) {
                    return this.items[key]
                },
                set: function (key: string | number, value: any) {
                    this.items[key] = value
                },
            }
            const clearPersistedData = vi.fn(() => {
                // Actually clear the fake storage
                fakeStorage.items = {}
            })
            const persistData = vi.fn((data, stepId) => {
                if (stepId) {
                    fakeStorage.set(stepId, data)
                }
            })

            const loadData = vi.fn(async () => {
                // Simulate loading from storage
                return fakeStorage.items
            })

            engine = new OnboardingEngine({
                ...basicConfig,
                clearPersistedData: clearPersistedData,
                persistData: persistData,
                loadData: loadData,
            })

            await engine.ready() // Ensure engine is ready

            // Simulate some persisted data for a step
            await engine.next({ test: 'data' })
            expect(persistData).toHaveBeenCalledWith(
                expect.objectContaining({
                    flowData: expect.objectContaining({ test: 'data' }),
                }),
                'step2'
            )

            // Reset the engine
            await engine.reset()

            expect(clearPersistedData).toHaveBeenCalled()
            expect(fakeStorage.items).toMatchObject({}) // Ensure storage is cleared
        })

        // it should handle errors when clearPersistedData throws
        it('should handle errors when clearPersistedData throws', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
            const clearPersistedData = vi.fn().mockImplementation(() => {
                throw new Error('Clear error')
            })

            engine = new OnboardingEngine({
                ...basicConfig,
                clearPersistedData: clearPersistedData,
            })
            await engine.ready()

            await engine.reset()

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining(`OnboardingEngine[${engine.getInstanceId()}] [ERROR]`),
                expect.stringContaining('Error during clearPersistedData'),
                expect.any(Error)
            )
        })
    })

    describe('Error Handling', () => {
        beforeEach(async () => {
            engine = new OnboardingEngine(basicConfig)
        })

        it('should handle invalid step ID in goToStep', async () => {
            await engine.goToStep('non-existent-step')

            const state = engine.getState()
            expect(state.currentStep).toBeNull()
        })

        it('should handle errors in next() method', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
            const errorStep: OnboardingStep = {
                ...mockSteps[0],
                onStepComplete: vi.fn().mockRejectedValue(new Error('Step error')),
            }

            const stepsWithError = [errorStep, ...mockSteps.slice(1)]
            const config = { ...basicConfig, steps: stepsWithError }
            engine = new OnboardingEngine(config)
            await engine.ready()

            await engine.next()

            const state = engine.getState()
            expect(state.error?.message).toBe('Step error')
            expect(state.isLoading).toBe(false)
            expect(consoleErrorSpy).toHaveBeenCalled()
        })

        it('should queue operations during loading state', async () => {
            // Mock a slow operation to keep loading state
            const slowOnStepComplete = vi
                .fn()
                .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)))

            const slowStep: OnboardingStep = {
                ...mockSteps[0],
                onStepComplete: slowOnStepComplete,
            }

            const stepsWithSlow = [slowStep, ...mockSteps.slice(1)]
            const config = { ...basicConfig, steps: stepsWithSlow }
            engine = new OnboardingEngine(config)
            await engine.ready()

            // Start navigation
            const nextPromise = engine.next() // step1 -> step2

            // Queue more operations while loading
            const previousPromise = engine.previous() // step2 -> step1
            const goToPromise = engine.goToStep('step3') // step1 -> step3

            // Wait for all operations to complete
            await Promise.all([nextPromise, previousPromise, goToPromise])

            const state = engine.getState()
            expect(state.currentStep?.id).toBe('step3') // Should be on step3 (final operation)
        })

        it('should allow external code to report errors', async () => {
            const error = new Error('External error')
            engine = new OnboardingEngine(basicConfig)
            await engine.ready()

            // Report an error
            engine.reportError(error, 'test-error')

            const state = engine.getState()
            expect(state.error).toEqual(error)
            expect(state.isLoading).toBe(false)
        })
    })

    describe('Concurrent Operations', () => {
        it('should handle rapid successive navigation calls', async () => {
            engine = new OnboardingEngine(basicConfig)
            await engine.ready()

            // Fire multiple navigation calls rapidly
            // Sequence: step1 -> step2, step2 -> step2, step2 -> step1, step1 -> step2
            // End result should be step2 (which has a nextStep, so flow doesn't complete)
            const promises = [engine.next(), engine.goToStep('step2'), engine.previous(), engine.next()]

            await Promise.all(promises)

            // Should end up in a consistent state
            const state = engine.getState()
            expect(state.currentStep).not.toBeNull()
            expect(state.isLoading).toBe(false)
        })

        it('should handle concurrent context updates by processing them sequentially with merging', async () => {
            engine = new OnboardingEngine(basicConfig)
            await engine.ready()

            // These should be processed sequentially due to the operation queue
            // and each should merge with the existing context
            const updates = [
                engine.updateContext({ flowData: { key1: 'value1' } }),
                engine.updateContext({ flowData: { key2: 'value2' } }),
                engine.updateContext({ flowData: { key3: 'value3' } }),
            ]

            await Promise.all(updates)

            const state = engine.getState()
            expect(state.context.flowData).toEqual(
                expect.objectContaining({
                    key1: 'value1',
                    key2: 'value2',
                    key3: 'value3',
                })
            )
        })
    })

    describe('Edge Cases', () => {
        it('should handle steps with identical IDs gracefully', async () => {
            const duplicateSteps: OnboardingStep[] = [
                {
                    id: 'duplicate',
                    type: 'INFORMATION',
                    payload: { mainText: 'First' },
                },
                {
                    id: 'duplicate', // Same ID
                    type: 'INFORMATION',
                    payload: { mainText: 'Second' },
                },
            ]

            expect(
                () =>
                    new OnboardingEngine({
                        ...basicConfig,
                        steps: duplicateSteps,
                    })
            ).toThrow(/Duplicate step ID/)
        })

        it('should handle extremely deep navigation history', async () => {
            const deepSteps: OnboardingStep[] = Array.from({ length: 50 }, (_, i) => ({
                id: `step-${i}`,
                type: 'INFORMATION',
                payload: { mainText: `Step ${i}` },
                nextStep: i < 49 ? `step-${i + 1}` : undefined,
            }))

            engine = new OnboardingEngine({ ...basicConfig, steps: deepSteps })
            await engine.ready()

            // Navigate forward through all steps
            for (let i = 0; i < 49; i++) {
                await engine.next()
            }

            // Navigate back through all steps
            for (let i = 0; i < 49; i++) {
                await engine.previous()
            }

            expect(engine.getState().currentStep?.id).toBe('step-0')
        })

        it('should handle malformed step data gracefully', async () => {
            const malformedSteps: OnboardingStep[] = [
                {
                    id: 'normal',
                    type: 'INFORMATION',
                    payload: { mainText: 'Normal step' },
                    nextStep: 'malformed',
                },
                {
                    // @ts-expect-error: Testing malformed data
                    id: null,
                    type: 'INFORMATION',
                    payload: { mainText: 'Malformed step' },
                },
            ]

            expect(
                () =>
                    new OnboardingEngine({
                        ...basicConfig,
                        steps: malformedSteps,
                    })
            ).toThrow()
        })

        it('should handle updateChecklistItem on non-checklist step', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
            engine = new OnboardingEngine(basicConfig)

            await engine.updateChecklistItem('item1', true, 'step1') // step1 is INFORMATION type

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining(`OnboardingEngine[${engine.getInstanceId()}] [ERROR]`),
                expect.stringContaining('Cannot update checklist item')
            )
        })

        it('should not persist data during hydration', async () => {
            const persistData = vi.fn()
            const loadData = vi.fn().mockResolvedValue({
                currentStepId: 'step2',
                flowData: { test: 'data' },
            })

            const config = {
                ...basicConfig,
                loadData,
                persistData,
                initialContext: { flowData: { initial: 'data' } },
            }

            engine = new OnboardingEngine(config)

            // persistData should not be called during hydration
            // Only after explicit context updates
            expect(persistData).not.toHaveBeenCalled()
        })

        it("should handle context updates that don't actually change data", async () => {
            const persistData = vi.fn()
            const config = { ...basicConfig, persistData }

            engine = new OnboardingEngine(config)

            const originalContext = engine.getState().context
            await engine.updateContext(originalContext) // Same data

            // Should not persist since nothing changed
            expect(persistData).not.toHaveBeenCalled()
        })

        describe('ready()', () => {
            it('should resolve after initialization is complete', async () => {
                const config = { ...basicConfig }
                engine = new OnboardingEngine(config)

                // ready should resolve (not throw) and after it resolves, engine should be initialized
                await expect(engine.ready()).resolves.toBeUndefined()

                const state = engine.getState()
                expect(state.currentStep).toEqual(config.steps[0])
                expect(state.isHydrating).toBe(false)
            })

            it('should resolve after data loading if loadData is async', async () => {
                const loadedData: LoadedData = {
                    currentStepId: 'step2',
                    flowData: { foo: 'bar' },
                }
                const loadData = vi.fn().mockResolvedValue(loadedData)
                const config = { ...basicConfig, loadData }

                engine = new OnboardingEngine(config)

                await expect(engine.ready()).resolves.toBeUndefined()

                const state = engine.getState()
                expect(state.currentStep?.id).toBe('step2')
                expect(state.context.flowData.foo).toBe('bar')
            })

            it('should resolve even if data loading fails', async () => {
                const onStepActive = vi.fn().mockRejectedValue(new Error('Hook error'))

                const stepsWithHooks: OnboardingStep[] = [
                    {
                        ...mockSteps[0],
                        onStepActive,
                    },
                    ...mockSteps.slice(1),
                ]

                const config = { ...basicConfig, steps: stepsWithHooks }

                engine = new OnboardingEngine(config)

                await expect(engine.ready()).resolves.toBeUndefined()

                const state = engine.getState()

                expect(state.error).not.toBeNull()
                expect(state.currentStep?.id).toBe('step1')
            })

            it('should allow calling ready() multiple times', async () => {
                engine = new OnboardingEngine(basicConfig)

                await Promise.all([engine.ready(), engine.ready(), engine.ready()])

                const state = engine.getState()
                expect(state.currentStep?.id).toBe('step1')
            })
        })
    })
    describe('Event Handlers', () => {
        beforeEach(async () => {
            engine = new OnboardingEngine(basicConfig)
            await engine.ready()
        })

        describe('Step Change Listeners', () => {
            it('should notify step change listeners when navigating', async () => {
                const listener = vi.fn()
                const unsubscribe = engine.addEventListener('stepChange', listener)

                await engine.next()

                expect(listener).toHaveBeenCalledWith({
                    newStep: expect.objectContaining({ id: 'step2' }),
                    oldStep: expect.objectContaining({ id: 'step1' }),
                    context: expect.objectContaining({
                        flowData: expect.any(Object),
                    }),
                })

                unsubscribe()
            })

            it('should unsubscribe step change listeners', async () => {
                const listener = vi.fn()
                const unsubscribe = engine.addEventListener('stepChange', listener)

                unsubscribe()
                await engine.next()

                expect(listener).not.toHaveBeenCalled()
            })

            it('should handle errors in step change listeners gracefully', async () => {
                const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
                const errorListener = vi.fn().mockImplementation(() => {
                    throw new Error('Listener error')
                })

                engine.addEventListener('stepChange', errorListener)
                await engine.next()

                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    '[EventManager] [ERROR]',
                    expect.stringContaining('Error in stepChange listener:'),
                    expect.any(Error)
                )
                expect(errorListener).toHaveBeenCalled()
            })

            it('should notify multiple step change listeners', async () => {
                const listener1 = vi.fn()
                const listener2 = vi.fn()
                const listener3 = vi.fn()

                engine.addEventListener('stepChange', listener1)
                engine.addEventListener('stepChange', listener2)
                engine.addEventListener('stepChange', listener3)

                await engine.next()

                expect(listener1).toHaveBeenCalled()
                expect(listener2).toHaveBeenCalled()
                expect(listener3).toHaveBeenCalled()
            })
        })

        describe('Flow Complete Listeners', () => {
            it('should notify flow complete listeners when flow completes', async () => {
                const listener = vi.fn()
                const unsubscribe = engine.addEventListener('flowCompleted', listener)

                // Navigate to last step and complete the flow
                await engine.goToStep('step3')
                await engine.next() // This should complete the flow

                expect(listener).toHaveBeenCalledWith(
                    expect.objectContaining({
                        context: expect.objectContaining({
                            flowData: expect.any(Object),
                        }),
                    })
                )

                unsubscribe()
            })

            it('should unsubscribe flow complete listeners', async () => {
                const listener = vi.fn()
                const unsubscribe = engine.addEventListener('flowCompleted', listener)

                unsubscribe()

                // Complete the flow
                await engine.goToStep('step3')
                await engine.next()

                expect(listener).not.toHaveBeenCalled()
            })

            it('should handle errors in sync flow complete listeners gracefully', async () => {
                const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
                const errorListener = vi.fn().mockImplementation(() => {
                    throw new Error('Sync listener error')
                })

                engine.addEventListener('flowCompleted', errorListener)

                // Complete the flow
                await engine.goToStep('step3')
                await engine.next()

                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    '[EventManager] [ERROR]',
                    expect.stringContaining('Error in sync onFlowHasCompleted listener:'),
                    expect.any(Error)
                )
                expect(errorListener).toHaveBeenCalled()
            })

            it('should handle errors in async flow complete listeners gracefully', async () => {
                const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
                const asyncErrorListener = vi.fn().mockImplementation(async () => {
                    throw new Error('Error in async flowComplete listener:')
                })

                engine.addEventListener('flowCompleted', asyncErrorListener)

                // Complete the flow
                await engine.goToStep('step3')
                await engine.next()

                // Wait for async error handling
                await new Promise((resolve) => setTimeout(resolve, 10))

                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    '[EventManager] [ERROR]',
                    expect.stringContaining('Error in async onFlowHasCompleted listener:'),
                    expect.any(Error)
                )
                expect(asyncErrorListener).toHaveBeenCalled()
            })

            it('should notify multiple flow complete listeners', async () => {
                const listener1 = vi.fn()
                const listener2 = vi.fn()
                const listener3 = vi.fn()

                engine.addEventListener('flowCompleted', listener1)
                engine.addEventListener('flowCompleted', listener2)
                engine.addEventListener('flowCompleted', listener3)

                // Complete the flow
                await engine.goToStep('step3')
                await engine.next()

                expect(listener1).toHaveBeenCalled()
                expect(listener2).toHaveBeenCalled()
                expect(listener3).toHaveBeenCalled()
            })
        })

        describe('Before Step Change Listeners', () => {
            it('should call before step change listeners before navigation', async () => {
                const listener = vi.fn()
                engine.addEventListener('beforeStepChange', listener)

                await engine.next()

                expect(listener).toHaveBeenCalledWith(
                    expect.objectContaining({
                        currentStep: expect.objectContaining({ id: 'step1' }),
                        targetStepId: 'step2',
                        direction: 'next',
                        cancel: expect.any(Function),
                        redirect: expect.any(Function),
                    })
                )
            })

            it('should allow before step change listeners to cancel navigation', async () => {
                const cancelListener = vi.fn((event: BeforeStepChangeEvent) => {
                    event.cancel()
                })
                engine.addEventListener('beforeStepChange', cancelListener)

                await engine.next()

                const state = engine.getState()
                expect(state.currentStep?.id).toBe('step1') // Should remain on step1
                expect(cancelListener).toHaveBeenCalled()
            })

            it('should allow before step change listeners to redirect navigation', async () => {
                const redirectListener = vi.fn((event: BeforeStepChangeEvent) => {
                    if (event.redirect) {
                        event.redirect('step3')
                    }
                })
                engine.addEventListener('beforeStepChange', redirectListener)

                await engine.next()

                const state = engine.getState()
                expect(state.currentStep?.id).toBe('step3') // Should redirect to step3
                expect(redirectListener).toHaveBeenCalled()
            })

            it('should not allow redirect after cancel is called', async () => {
                const cancelAndRedirectListener = vi.fn((event: BeforeStepChangeEvent) => {
                    event.cancel()
                    if (event.redirect) {
                        event.redirect('step3') // This should be ignored
                    }
                })
                engine.addEventListener('beforeStepChange', cancelAndRedirectListener)

                await engine.next()

                const state = engine.getState()
                expect(state.currentStep?.id).toBe('step1') // Should remain on step1
            })

            it('should unsubscribe before step change listeners', async () => {
                const listener = vi.fn()
                const unsubscribe = engine.addEventListener('beforeStepChange', listener)

                unsubscribe()
                await engine.next()

                expect(listener).not.toHaveBeenCalled()
            })

            it('should handle async before step change listeners', async () => {
                const asyncListener = vi.fn(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 10))
                    // Allow navigation
                })
                engine.addEventListener('beforeStepChange', asyncListener)

                await engine.next()

                expect(asyncListener).toHaveBeenCalled()
                const state = engine.getState()
                expect(state.currentStep?.id).toBe('step2')
            })

            it('should call multiple before step change listeners sequentially', async () => {
                const listener1 = vi.fn(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 5))
                })
                const listener2 = vi.fn()
                const listener3 = vi.fn()

                engine.addEventListener('beforeStepChange', listener1)
                engine.addEventListener('beforeStepChange', listener2)
                engine.addEventListener('beforeStepChange', listener3)

                await engine.next()

                expect(listener1).toHaveBeenCalled()
                expect(listener2).toHaveBeenCalled()
                expect(listener3).toHaveBeenCalled()
            })

            it('should pass correct direction for different navigation types', async () => {
                const listener = vi.fn()
                engine.addEventListener('beforeStepChange', listener)

                // Test next
                await engine.next()
                expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ direction: 'next' }))

                // Test previous
                await engine.previous()
                expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ direction: 'previous' }))

                // Test goto
                await engine.goToStep('step3')
                expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ direction: 'goto' }))

                // Test skip
                const skippableSteps: OnboardingStep[] = [
                    {
                        id: 'step1',
                        type: 'INFORMATION',
                        payload: { mainText: 'You can skip this' },
                        isSkippable: true,
                        nextStep: 'step2',
                        skipToStep: 'step3',
                    },
                    mockSteps[1],
                    mockSteps[2],
                ]
                const skippableEngine = new OnboardingEngine({
                    ...basicConfig,
                    steps: skippableSteps,
                })
                await skippableEngine.ready()

                const skipListener = vi.fn()
                skippableEngine.addEventListener('beforeStepChange', skipListener)

                await skippableEngine.skip()
                expect(skipListener).toHaveBeenCalledWith(expect.objectContaining({ direction: 'skip' }))
            })
        })

        describe('State Change Listeners', () => {
            it('should notify state change listeners when state changes', async () => {
                const listener = vi.fn()
                const unsubscribe = engine.addEventListener('stateChange', listener)

                await engine.next()

                expect(listener).toHaveBeenCalledWith({
                    state: expect.objectContaining({
                        currentStep: expect.objectContaining({ id: 'step2' }),
                        isLoading: false,
                    }),
                })

                unsubscribe()
            })

            it('should unsubscribe state change listeners', async () => {
                const listener = vi.fn()
                const unsubscribe = engine.addEventListener('stateChange', listener)

                unsubscribe()
                await engine.next()

                expect(listener).not.toHaveBeenCalled()
            })

            it('should notify state change listeners during navigation', async () => {
                const listener = vi.fn()
                engine.addEventListener('stateChange', listener)

                // Clear initial calls
                listener.mockClear()

                // Perform navigation
                await engine.next()

                // Should have been called at least once during navigation
                expect(listener).toHaveBeenCalled()

                // Check that the final state is correct
                expect(listener).toHaveBeenLastCalledWith({
                    state: expect.objectContaining({
                        currentStep: expect.objectContaining({ id: 'step2' }),
                        isLoading: false,
                    }),
                })
            })

            it('should notify state change listeners on error state changes', async () => {
                const listener = vi.fn()
                engine.addEventListener('stateChange', listener)

                // Create a step with onStepActive that throws an error
                const errorSteps: OnboardingStep[] = [
                    mockSteps[0],
                    {
                        ...mockSteps[1],
                        onStepActive: async () => {
                            throw new Error('Step activation error')
                        },
                    },
                    mockSteps[2],
                ]

                const errorEngine = new OnboardingEngine({
                    ...basicConfig,
                    steps: errorSteps,
                })
                await errorEngine.ready()

                const errorListener = vi.fn()
                errorEngine.addEventListener('stateChange', errorListener)

                await errorEngine.next()

                expect(errorListener).toHaveBeenCalledWith(
                    expect.objectContaining({
                        state: expect.objectContaining({
                            error: expect.any(Error),
                        }),
                    })
                )
            })

            it('should notify multiple state change listeners', async () => {
                const listener1 = vi.fn()
                const listener2 = vi.fn()
                const listener3 = vi.fn()

                engine.addEventListener('stateChange', listener1)
                engine.addEventListener('stateChange', listener2)
                engine.addEventListener('stateChange', listener3)

                await engine.next()

                expect(listener1).toHaveBeenCalled()
                expect(listener2).toHaveBeenCalled()
                expect(listener3).toHaveBeenCalled()
            })
        })

        describe('Integration - Multiple Event Types', () => {
            it('should call all event handlers in correct order during navigation', async () => {
                const callOrder: string[] = []

                const beforeStepChangeListener = vi.fn(() => {
                    callOrder.push('beforeStepChange')
                })
                const stepChangeListener = vi.fn(() => {
                    callOrder.push('stepChange')
                })
                const stateChangeListener = vi.fn(() => {
                    callOrder.push('stateChange')
                })

                engine.addEventListener('beforeStepChange', beforeStepChangeListener)
                engine.addEventListener('stepChange', stepChangeListener)
                engine.addEventListener('stateChange', stateChangeListener)

                await engine.next()

                expect(callOrder).toEqual([
                    'beforeStepChange',
                    'stepChange',
                    'stateChange', // Final state change
                ])
            })

            it('should handle event handler errors without affecting other handlers', async () => {
                const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

                const errorStepChangeListener = vi.fn(() => {
                    throw new Error('Step change error')
                })
                const workingStepChangeListener = vi.fn()
                const stateChangeListener = vi.fn()

                engine.addEventListener('stepChange', errorStepChangeListener)
                engine.addEventListener('stepChange', workingStepChangeListener)
                engine.addEventListener('stateChange', stateChangeListener)

                await engine.next()

                expect(errorStepChangeListener).toHaveBeenCalled()
                expect(workingStepChangeListener).toHaveBeenCalled()
                expect(stateChangeListener).toHaveBeenCalled()
                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    '[EventManager] [ERROR]',
                    expect.stringContaining('Error in stepChange listener:'),
                    expect.any(Error)
                )
            })
        })
    })

    describe('Plugin Integration', () => {
        it('should install and use plugins correctly', async () => {
            const mockPlugin = {
                version: '1.0.0',
                name: 'test-plugin',
                install: vi.fn(async (engine) => {
                    engine.setDataPersistHandler(vi.fn())

                    return () => {
                        // Cleanup logic if needed
                    }
                }),
            }

            const config = { ...basicConfig, plugins: [mockPlugin] }
            engine = new OnboardingEngine(config)
            await engine.ready()

            expect(mockPlugin.install).toHaveBeenCalledWith(engine)
        })

        it('should handle plugin installation failures gracefully', async () => {
            const failingPlugin = {
                version: '1.0.0',
                name: 'failing-plugin',
                install: vi.fn().mockRejectedValue(new Error('Plugin failed')),
            }

            const config = { ...basicConfig, plugins: [failingPlugin] }

            engine = new OnboardingEngine(config) // Constructor succeeds

            // The error happens during initialization
            await expect(engine.ready()).rejects.toThrow(/Plugin installation failed/)
        })

        it('should handle plugin installation failures gracefully', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            const failingPlugin = {
                version: '1.0.0',
                name: 'failing-plugin',
                install: vi.fn().mockRejectedValue(new Error('Plugin failed')),
            }

            const config = { ...basicConfig, plugins: [failingPlugin] }

            engine = new OnboardingEngine(config)

            // Wait for initialization to complete (should handle error gracefully)
            await expect(engine.ready()).rejects.toThrow(/Plugin installation failed/)

            // Verify error was logged
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining(`OnboardingEngine[${engine.getInstanceId()}] [ERROR]`),
                expect.stringContaining('Plugin installation failed')
            )
        })

        it('should allow plugins to override persistence handlers', async () => {
            const originalPersist = vi.fn()
            const pluginPersist = vi.fn()

            const plugin = {
                version: '1.0.0',
                name: 'persistence-plugin',
                install: vi.fn(async (engine) => {
                    engine.setDataPersistHandler(pluginPersist)

                    return () => {
                        engine.setDataPersistHandler(originalPersist)
                    }
                }),
            }

            const config = {
                ...basicConfig,
                persistData: originalPersist,
                plugins: [plugin],
            }

            engine = new OnboardingEngine(config)
            await engine.ready()
            await engine.updateContext({ flowData: { test: 'data' } })

            expect(pluginPersist).toHaveBeenCalled()
            expect(originalPersist).not.toHaveBeenCalled()
        })
    })

    describe('External System Integration', () => {
        it('should handle async persistence with network delays', async () => {
            const slowPersist = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 200)))

            engine = new OnboardingEngine({
                ...basicConfig,
                persistData: slowPersist,
            })
            await engine.ready()

            const startTime = performance.now()
            await engine.updateContext({ flowData: { test: 'data' } })
            const endTime = performance.now()

            expect(endTime - startTime).toBeGreaterThan(190)
            expect(slowPersist).toHaveBeenCalled()
        })

        it('should handle persistence failures without blocking navigation', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
            const failingPersist = vi.fn().mockRejectedValue(new Error('Network error'))

            engine = new OnboardingEngine({
                ...basicConfig,
                persistData: failingPersist,
            })
            await engine.ready()

            await engine.updateContext({ flowData: { test: 'data' } })
            await engine.next() // Should still work despite persistence failure

            expect(engine.getState().currentStep?.id).toBe('step2')
            expect(consoleErrorSpy).toHaveBeenCalled()
        })
    })

    describe('Analytics and Custom Event Tracking', () => {
        let mockAnalyticsManager: any
        let trackEventSpy: any

        beforeEach(() => {
            // Mock the analytics manager to capture calls
            trackEventSpy = vi.fn()
            mockAnalyticsManager = {
                trackEvent: trackEventSpy,
                registerProvider: vi.fn(),
                flush: vi.fn(),
                setUserId: vi.fn(),
                setFlowInfo: vi.fn(),
                providerCount: 0,
            }
        })

        describe('trackEvent', () => {
            it('should delegate simple event tracking to analytics manager', async () => {
                engine = new OnboardingEngine(basicConfig)
                await engine.ready()

                // Replace the analytics manager with our mock
                ;(engine as any)._analyticsManager = mockAnalyticsManager

                engine.trackEvent('custom_button_click', {
                    buttonId: 'cta',
                    page: 'welcome',
                })

                expect(trackEventSpy).toHaveBeenCalledWith('custom_button_click', {
                    buttonId: 'cta',
                    page: 'welcome',
                })
            })

            it('should handle empty properties', async () => {
                engine = new OnboardingEngine(basicConfig)
                await engine.ready()
                ;(engine as any)._analyticsManager = mockAnalyticsManager

                engine.trackEvent('simple_event')

                expect(trackEventSpy).toHaveBeenCalledWith('simple_event', {})
            })
        })

        describe('trackCustomEvent', () => {
            beforeEach(async () => {
                engine = new OnboardingEngine(basicConfig)
                await engine.ready()
                ;(engine as any)._analyticsManager = mockAnalyticsManager
            })

            it('should track custom event with default options and step context', async () => {
                engine.trackCustomEvent('user_interaction', {
                    action: 'click',
                    element: 'button',
                })

                expect(trackEventSpy).toHaveBeenCalledWith('custom.user_interaction', {
                    action: 'click',
                    element: 'button',
                    category: 'custom',
                    priority: 'normal',
                    timestamp: expect.any(Number),
                    stepContext: {
                        currentStepId: 'step1',
                        currentStepType: undefined,
                        stepIndex: 0,
                        isFirstStep: true,
                        isLastStep: false,
                    },
                    flowProgress: {
                        totalSteps: 3,
                        currentStepNumber: 1,
                        progressPercentage: 33,
                        isCompleted: false,
                    },
                })
            })

            it('should track custom event with custom category and priority', async () => {
                engine.trackCustomEvent(
                    'payment_completed',
                    { amount: 99.99, currency: 'USD' },
                    { category: 'business', priority: 'critical' }
                )

                expect(trackEventSpy).toHaveBeenCalledWith('custom.payment_completed', {
                    amount: 99.99,
                    currency: 'USD',
                    category: 'business',
                    priority: 'critical',
                    timestamp: expect.any(Number),
                    stepContext: expect.any(Object),
                    flowProgress: expect.any(Object),
                })
            })

            it('should include sanitized context data when requested', async () => {
                // Update context with some test data including sensitive info
                await engine.updateContext({
                    flowData: { userName: 'John', preferences: { theme: 'dark' } },
                    currentUser: { id: '123', email: 'john@example.com' },
                    apiKeys: { provider: 'fake_key_12345' }, // Should be sanitized
                    password: 'secret123', // Should be sanitized
                })

                engine.trackCustomEvent('profile_updated', { field: 'email' }, { includeContextData: true })

                const call = trackEventSpy.mock.calls[0]
                const eventProperties = call[1]

                expect(eventProperties.contextData).toBeDefined()
                expect(eventProperties.contextData.flowData).toEqual({
                    userName: 'John',
                    preferences: { theme: 'dark' },
                })
                expect(eventProperties.contextData.currentUser).toEqual({
                    id: '123',
                    email: 'john@example.com',
                })
                // Sensitive data should be removed
                expect(eventProperties.contextData.apiKeys).toBeUndefined()
                expect(eventProperties.contextData.password).toBeUndefined()
                expect(eventProperties.contextData.secret).toBeUndefined()
                expect(eventProperties.contextData.tokens).toBeUndefined()
            })

            it('should handle options to exclude step context', async () => {
                engine.trackCustomEvent('background_sync', { status: 'completed' }, { includeStepContext: false })

                const call = trackEventSpy.mock.calls[0]
                const eventProperties = call[1]

                expect(eventProperties.stepContext).toBeUndefined()
                expect(eventProperties.flowProgress).toBeDefined() // Should still include by default
            })

            it('should handle options to exclude flow progress', async () => {
                engine.trackCustomEvent('ui_component_rendered', { component: 'modal' }, { includeFlowProgress: false })

                const call = trackEventSpy.mock.calls[0]
                const eventProperties = call[1]

                expect(eventProperties.stepContext).toBeDefined() // Should still include by default
                expect(eventProperties.flowProgress).toBeUndefined()
            })

            it('should handle event when no current step is set', async () => {
                // Navigate to completion to have no current step
                await engine.next() // step2
                await engine.next() // step3 (final)
                await engine.next() // completed

                engine.trackCustomEvent('post_completion_event', { type: 'feedback' })

                const call = trackEventSpy.mock.calls[0]
                const eventProperties = call[1]

                expect(eventProperties.stepContext).toBeUndefined()
                expect(eventProperties.flowProgress).toEqual({
                    totalSteps: 3,
                    currentStepNumber: 0, // -1 + 1
                    progressPercentage: 0,
                    isCompleted: true,
                })
            })

            it('should track event with all options disabled', async () => {
                engine.trackCustomEvent(
                    'minimal_event',
                    { data: 'test' },
                    {
                        includeStepContext: false,
                        includeFlowProgress: false,
                        includeContextData: false,
                        category: 'debug',
                        priority: 'low',
                    }
                )

                expect(trackEventSpy).toHaveBeenCalledWith('custom.minimal_event', {
                    data: 'test',
                    category: 'debug',
                    priority: 'low',
                    timestamp: expect.any(Number),
                })
            })

            it('should correctly calculate step position for last step', async () => {
                // Navigate to the last step
                await engine.next() // step2
                await engine.next() // step3 (last step)

                engine.trackCustomEvent('last_step_event', {})

                const call = trackEventSpy.mock.calls[0]
                const eventProperties = call[1]

                expect(eventProperties.stepContext.isLastStep).toBe(true)
                expect(eventProperties.stepContext.isFirstStep).toBe(false)
                expect(eventProperties.stepContext.stepIndex).toBe(2)
                expect(eventProperties.flowProgress.progressPercentage).toBe(100)
            })
        })

        describe('sanitizeContextForAnalytics', () => {
            it('should remove sensitive fields from context', () => {
                const contextWithSensitiveData = {
                    flowData: {
                        userName: 'John',
                        preferences: { theme: 'dark' },
                        _internal: {
                            completedSteps: {},
                            startedAt: Date.now(),
                            stepStartTimes: {},
                        },
                    },
                    currentUser: { id: '123', email: 'john@example.com' },
                    apiKeys: { provider: 'fake_key_12345', aws: 'fake_aws_key' },
                    tokens: { jwt: 'eyJ0eXAi...' },
                    password: 'secret123',
                    secret: 'my-secret-key',
                    normalData: 'should-remain',
                }

                // Access the private method using type assertion
                const sanitized = (engine as any)._sanitizeContextForAnalytics(contextWithSensitiveData)

                // Should keep normal data and currentUser
                expect(sanitized.normalData).toBe('should-remain')
                expect(sanitized.currentUser).toEqual({
                    id: '123',
                    email: 'john@example.com',
                })

                // Should remove sensitive fields
                expect(sanitized.apiKeys).toBeUndefined()
                expect(sanitized.tokens).toBeUndefined()
                expect(sanitized.password).toBeUndefined()
                expect(sanitized.secret).toBeUndefined()

                // Should remove _internal from flowData but keep other flowData
                expect(sanitized.flowData.userName).toBe('John')
                expect(sanitized.flowData.preferences).toEqual({ theme: 'dark' })
                expect(sanitized.flowData._internal).toBeUndefined()
            })

            it('should handle context without flowData', () => {
                const contextWithoutFlowData = {
                    currentUser: { id: '123' },
                    apiKeys: { provider: 'fake_key_12345' },
                    normalData: 'test',
                }

                const sanitized = (engine as any)._sanitizeContextForAnalytics(contextWithoutFlowData)

                expect(sanitized.normalData).toBe('test')
                expect(sanitized.currentUser).toEqual({ id: '123' })
                expect(sanitized.apiKeys).toBeUndefined()
            })

            it('should handle context with flowData but no _internal', () => {
                const contextWithFlowData = {
                    flowData: {
                        userName: 'John',
                        userPrefs: { theme: 'dark' },
                    },
                    secret: 'should-be-removed',
                }

                const sanitized = (engine as any)._sanitizeContextForAnalytics(contextWithFlowData)

                expect(sanitized.flowData).toEqual({
                    userName: 'John',
                    userPrefs: { theme: 'dark' },
                })
                expect(sanitized.secret).toBeUndefined()
            })

            it('should not mutate the original context', () => {
                const originalContext = {
                    flowData: {
                        userName: 'John',
                        _internal: { completedSteps: {} },
                    },
                    apiKeys: { provider: 'fake_key_12345' },
                }

                const originalContextCopy = JSON.parse(JSON.stringify(originalContext))
                ;(engine as any)._sanitizeContextForAnalytics(originalContext)

                // Original context should remain unchanged
                expect(originalContext).toEqual(originalContextCopy)
            })
        })

        describe('analytics integration methods', () => {
            beforeEach(async () => {
                engine = new OnboardingEngine(basicConfig)
                await engine.ready()
                ;(engine as any)._analyticsManager = mockAnalyticsManager
            })

            it('should register analytics provider', () => {
                const mockProvider = { name: 'test-provider', trackEvent: vi.fn() }
                engine.registerAnalyticsProvider(mockProvider)

                expect(mockAnalyticsManager.registerProvider).toHaveBeenCalledWith(mockProvider)
            })

            it('should flush analytics', async () => {
                await engine.flushAnalytics()

                expect(mockAnalyticsManager.flush).toHaveBeenCalled()
            })

            it('should set analytics user ID', () => {
                engine.setAnalyticsUserId('user123')

                expect(mockAnalyticsManager.setUserId).toHaveBeenCalledWith('user123')
            })
        })

        describe('cloud analytics configuration', () => {
            it('should enable analytics when publicKey and apiHost are provided', () => {
                const configWithCloud = {
                    ...basicConfig,
                    publicKey: 'pk_test_123',
                    apiHost: 'https://api.onboardjs.com',
                }

                engine = new OnboardingEngine(configWithCloud)

                // Analytics should be automatically enabled when cloud config is provided
                const analyticsManager = (engine as any)._analyticsManager
                expect(analyticsManager).toBeDefined()
            })

            it('should work without cloud configuration', async () => {
                engine = new OnboardingEngine(basicConfig)
                await engine.ready()

                // Should not throw errors when tracking events without cloud config
                expect(() => {
                    engine.trackEvent('test_event')
                    engine.trackCustomEvent('test_custom_event')
                }).not.toThrow()
            })
        })
    })
})
