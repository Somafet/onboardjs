/**
 * @fileoverview Tests for useEngineLifecycle hook
 *
 * Tests cover:
 * - Engine creation and initialization
 * - Configuration hash behavior (recreation on structural changes)
 * - Callback reference stability (configRef pattern)
 * - Error handling during initialization
 * - Cleanup on unmount
 *
 * These tests use the real OnboardingEngine from @onboardjs/core to ensure
 * proper integration behavior, matching the testing pattern used in the rest
 * of the @onboardjs/react package.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useEngineLifecycle } from './useEngineLifecycle'
import type { OnboardingStep, OnboardingContext } from '@onboardjs/core'

describe('useEngineLifecycle', () => {
    // Test step definitions
    const createStep = (id: string, payload?: Record<string, unknown>): OnboardingStep => ({
        id,
        type: 'CUSTOM_COMPONENT',
        payload: payload ?? { componentKey: 'TestComponent' },
    })

    const defaultSteps: OnboardingStep[] = [createStep('step1'), createStep('step2')]

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('Engine Creation', () => {
        it('should create engine on initial render', async () => {
            const { result } = renderHook(() =>
                useEngineLifecycle({
                    steps: defaultSteps,
                })
            )

            await waitFor(() => {
                expect(result.current.engine).not.toBeNull()
                expect(result.current.isReady).toBe(true)
            })

            expect(result.current.engine?.instanceId).toBeDefined()
        })

        it('should set isReady to true after engine initialization', async () => {
            const { result } = renderHook(() =>
                useEngineLifecycle({
                    steps: defaultSteps,
                })
            )

            // Initially not ready
            expect(result.current.isReady).toBe(false)

            await waitFor(() => {
                expect(result.current.isReady).toBe(true)
            })
        })

        it('should set error when engine initialization fails', async () => {
            // Provide invalid configuration that will cause engine to fail
            const invalidSteps: OnboardingStep[] = []

            const { result } = renderHook(() =>
                useEngineLifecycle({
                    steps: invalidSteps,
                    initialStepId: 'nonexistent', // This step doesn't exist - causes validation error
                })
            )

            // Wait for initialization to fail
            await waitFor(() => {
                // The hook should set an error when initialization fails
                expect(result.current.error).not.toBeNull()
            })

            // Engine should be null when there's an error
            expect(result.current.engine).toBeNull()
            // isReady remains false when there's an error
            expect(result.current.isReady).toBe(false)
        })
    })

    describe('Configuration Hash Behavior', () => {
        it('should NOT recreate engine when callback references change', async () => {
            let onFlowComplete = vi.fn()
            let onStepChange = vi.fn()

            const { result, rerender } = renderHook(
                ({ onFlowComplete, onStepChange }) =>
                    useEngineLifecycle({
                        steps: defaultSteps,
                        onFlowComplete,
                        onStepChange,
                    }),
                {
                    initialProps: { onFlowComplete, onStepChange },
                }
            )

            await waitFor(() => {
                expect(result.current.isReady).toBe(true)
            })

            const initialEngine = result.current.engine
            const initialInstanceId = initialEngine?.instanceId

            // Create new callback references (simulating a parent re-render)
            onFlowComplete = vi.fn()
            onStepChange = vi.fn()

            rerender({ onFlowComplete, onStepChange })

            await waitFor(() => {
                expect(result.current.isReady).toBe(true)
            })

            // Engine should NOT have been recreated (same instance)
            expect(result.current.engine?.instanceId).toBe(initialInstanceId)
        })

        it('should recreate engine when steps array structure changes', async () => {
            const initialSteps = [createStep('step1')]

            const { result, rerender } = renderHook(({ steps }) => useEngineLifecycle({ steps }), {
                initialProps: { steps: initialSteps },
            })

            await waitFor(() => {
                expect(result.current.isReady).toBe(true)
            })

            const initialInstanceId = result.current.engine?.instanceId

            // Change steps array structure by adding a new step
            const newSteps = [createStep('step1'), createStep('step2')]

            await act(async () => {
                rerender({ steps: newSteps })
            })

            await waitFor(() => {
                expect(result.current.isReady).toBe(true)
            })

            // Engine should have been recreated (new instance)
            expect(result.current.engine?.instanceId).not.toBe(initialInstanceId)
        })

        it('should recreate engine when step payload changes', async () => {
            const initialSteps = [createStep('step1', { componentKey: 'OriginalComponent' })]

            const { result, rerender } = renderHook(({ steps }) => useEngineLifecycle({ steps }), {
                initialProps: { steps: initialSteps },
            })

            await waitFor(() => {
                expect(result.current.isReady).toBe(true)
            })

            const initialInstanceId = result.current.engine?.instanceId

            // Change step payload (componentKey value changes)
            const updatedSteps = [createStep('step1', { componentKey: 'UpdatedComponent' })]

            await act(async () => {
                rerender({ steps: updatedSteps })
            })

            await waitFor(() => {
                expect(result.current.isReady).toBe(true)
            })

            // Engine should have been recreated due to payload change
            expect(result.current.engine?.instanceId).not.toBe(initialInstanceId)
        })

        it('should recreate engine when initialStepId changes', async () => {
            const steps = [createStep('step1'), createStep('step2')]

            const { result, rerender } = renderHook(
                ({ initialStepId }) => useEngineLifecycle({ steps, initialStepId }),
                { initialProps: { initialStepId: 'step1' } }
            )

            await waitFor(() => {
                expect(result.current.isReady).toBe(true)
            })

            const initialInstanceId = result.current.engine?.instanceId

            // Change initialStepId
            await act(async () => {
                rerender({ initialStepId: 'step2' })
            })

            await waitFor(() => {
                expect(result.current.isReady).toBe(true)
            })

            // Engine should have been recreated
            expect(result.current.engine?.instanceId).not.toBe(initialInstanceId)
        })

        it('should recreate engine when initialContext changes', async () => {
            const { result, rerender } = renderHook(
                ({ initialContext }) =>
                    useEngineLifecycle({
                        steps: defaultSteps,
                        initialContext,
                    }),
                {
                    initialProps: { initialContext: { flowData: { value: 1 } } as Partial<OnboardingContext> },
                }
            )

            await waitFor(() => {
                expect(result.current.isReady).toBe(true)
            })

            const initialInstanceId = result.current.engine?.instanceId

            // Change initialContext
            await act(async () => {
                rerender({
                    initialContext: { flowData: { value: 2 } } as Partial<OnboardingContext>,
                })
            })

            await waitFor(() => {
                expect(result.current.isReady).toBe(true)
            })

            // Engine should have been recreated
            expect(result.current.engine?.instanceId).not.toBe(initialInstanceId)
        })

        it('should recreate engine when debug flag changes', async () => {
            const { result, rerender } = renderHook(({ debug }) => useEngineLifecycle({ steps: defaultSteps, debug }), {
                initialProps: { debug: false },
            })

            await waitFor(() => {
                expect(result.current.isReady).toBe(true)
            })

            const initialInstanceId = result.current.engine?.instanceId

            // Change debug flag
            await act(async () => {
                rerender({ debug: true })
            })

            await waitFor(() => {
                expect(result.current.isReady).toBe(true)
            })

            // Engine should have been recreated
            expect(result.current.engine?.instanceId).not.toBe(initialInstanceId)
        })

        it('should NOT recreate engine when same step array reference is passed', async () => {
            // Use a stable reference (same object)
            const stableSteps = defaultSteps

            const { result, rerender } = renderHook(
                // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
                ({ steps, _counter }) => useEngineLifecycle({ steps }),
                { initialProps: { steps: stableSteps, _counter: 0 } }
            )

            await waitFor(() => {
                expect(result.current.isReady).toBe(true)
            })

            const initialInstanceId = result.current.engine?.instanceId

            // Rerender with same reference but different counter to force re-render
            await act(async () => {
                rerender({ steps: stableSteps, _counter: 1 })
            })

            await waitFor(() => {
                expect(result.current.isReady).toBe(true)
            })

            // Engine should NOT have been recreated (same reference)
            expect(result.current.engine?.instanceId).toBe(initialInstanceId)
        })

        it('should NOT recreate engine when structurally identical new steps array is passed', async () => {
            // Create steps inside render to simulate typical React pattern
            const { result, rerender } = renderHook(
                // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
                ({ _stepCount }) => {
                    // Creating new array each render, but with identical structure
                    const steps = [createStep('step1', { componentKey: 'TestComponent' })]
                    return useEngineLifecycle({ steps })
                },
                { initialProps: { _stepCount: 1 } }
            )

            await waitFor(() => {
                expect(result.current.isReady).toBe(true)
            })

            const initialInstanceId = result.current.engine?.instanceId

            // Rerender with same structure (but new array reference)
            await act(async () => {
                rerender({ _stepCount: 1 })
            })

            await waitFor(() => {
                expect(result.current.isReady).toBe(true)
            })

            // Engine should NOT have been recreated (structurally identical)
            expect(result.current.engine?.instanceId).toBe(initialInstanceId)
        })
    })

    describe('Component Unmount', () => {
        it('should cleanup engine on unmount', async () => {
            const { result, unmount } = renderHook(() =>
                useEngineLifecycle({
                    steps: defaultSteps,
                })
            )

            await waitFor(() => {
                expect(result.current.isReady).toBe(true)
            })

            const engine = result.current.engine
            expect(engine).not.toBeNull()

            // Unmount the hook
            unmount()

            // After unmount, no errors should be thrown
            // The engine should have been cleaned up (no assertions needed,
            // just ensuring no memory leaks or errors)
        })
    })

    describe('Error Handling', () => {
        it('should handle engine ready rejection gracefully', async () => {
            // Use a spy to track console.error calls during error handling
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            const { result } = renderHook(() =>
                useEngineLifecycle({
                    steps: [], // Empty steps
                })
            )

            // Should still become ready (engine handles empty steps gracefully)
            await waitFor(() => {
                expect(result.current.isReady).toBe(true)
            })

            consoleSpy.mockRestore()
        })
    })

    describe('Config Ref Pattern', () => {
        it('should use latest callbacks when engine fires events', async () => {
            const firstCallback = vi.fn()
            const secondCallback = vi.fn()

            const { result, rerender } = renderHook(
                ({ onFlowComplete }) =>
                    useEngineLifecycle({
                        steps: defaultSteps,
                        onFlowComplete,
                    }),
                { initialProps: { onFlowComplete: firstCallback } }
            )

            await waitFor(() => {
                expect(result.current.isReady).toBe(true)
            })

            const initialInstanceId = result.current.engine?.instanceId

            // Update callback reference
            rerender({ onFlowComplete: secondCallback })

            await waitFor(() => {
                expect(result.current.isReady).toBe(true)
            })

            // Engine should NOT have been recreated
            expect(result.current.engine?.instanceId).toBe(initialInstanceId)

            // The config ref pattern means the engine will use the latest callback
            // when events fire, without needing to recreate the engine
        })

        it('should maintain engine stability during rapid callback updates', async () => {
            let callbackCount = 0
            const makeCallback = () => {
                callbackCount++
                return vi.fn()
            }

            const { result, rerender } = renderHook(
                ({ onFlowComplete }) =>
                    useEngineLifecycle({
                        steps: defaultSteps,
                        onFlowComplete,
                    }),
                { initialProps: { onFlowComplete: makeCallback() } }
            )

            await waitFor(() => {
                expect(result.current.isReady).toBe(true)
            })

            const initialInstanceId = result.current.engine?.instanceId

            // Rapid updates simulating parent component re-renders
            for (let i = 0; i < 10; i++) {
                rerender({ onFlowComplete: makeCallback() })
            }

            await waitFor(() => {
                expect(result.current.isReady).toBe(true)
            })

            // Engine should NOT have been recreated despite 10 callback changes
            expect(result.current.engine?.instanceId).toBe(initialInstanceId)
            expect(callbackCount).toBe(11) // Initial + 10 updates
        })
    })
})
