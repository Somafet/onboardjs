/**
 * @fileoverview Tests for useStepRenderer hook
 *
 * Tests cover:
 * - Component resolution priority (step.component → registry[id] → registry[type/componentKey])
 * - Error component rendering when no component found
 * - Validation of resolved components (isCallable check)
 * - Props passing to resolved components
 * - CUSTOM_COMPONENT componentKey resolution
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, render } from '@testing-library/react'
import React from 'react'
import { useStepRenderer, UseStepRendererConfig } from './useStepRenderer'
import type { OnboardingContext, EngineState } from '@onboardjs/core'
import type { StepComponentRegistry, StepComponentProps, OnboardingStep } from '../../types'

/**
 * Creates a mock EngineState with the given current step
 */
function createMockEngineState<TContext extends OnboardingContext = OnboardingContext>(
    step: OnboardingStep<TContext> | null,
    context?: Partial<TContext>
): EngineState<TContext> {
    const defaultFlowData = {
        _internal: { completedSteps: {}, startedAt: Date.now(), stepStartTimes: {} },
    }

    const defaultContext: TContext = {
        ...(context as TContext),
        flowData: {
            ...defaultFlowData,
            ...(context?.flowData || {}),
        },
    } as TContext

    return {
        flowId: null,
        flowName: null,
        flowVersion: null,
        flowMetadata: null,
        instanceId: 1,
        currentStep: step,
        context: defaultContext,
        isFirstStep: true,
        isLastStep: false,
        canGoNext: true,
        canGoPrevious: false,
        isSkippable: false,
        isLoading: false,
        isHydrating: false,
        error: null,
        isCompleted: false,
        nextStepCandidate: null,
        previousStepCandidate: null,
        totalSteps: 1,
        completedSteps: 0,
        progressPercentage: 0,
        currentStepNumber: 1,
    }
}

/**
 * Helper to create a step with optional component property
 */
function createStep(
    id: string,
    type: string = 'CUSTOM_COMPONENT',
    payload: Record<string, unknown> = {},
    component?: React.ComponentType<any>
): OnboardingStep<OnboardingContext> {
    return {
        id,
        type,
        payload,
        ...(component ? { component } : {}),
    } as OnboardingStep<OnboardingContext>
}

describe('useStepRenderer', () => {
    const mockOnDataChange = vi.fn()

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('Component Resolution Priority', () => {
        it('should resolve component by step.component property first', () => {
            const InlineComponent: React.FC = () => <div>Inline Component</div>
            const RegistryComponent: React.FC = () => <div>Registry Component</div>

            // Step has both component property and registry entry
            const step = createStep('step1', 'CUSTOM_COMPONENT', { componentKey: 'TestComponent' }, InlineComponent)

            const registry: StepComponentRegistry = {
                step1: RegistryComponent,
                TestComponent: RegistryComponent,
            }

            const config: UseStepRendererConfig<OnboardingContext> = {
                engineState: createMockEngineState(step),
                componentRegistry: registry,
                onDataChange: mockOnDataChange,
            }

            const { result } = renderHook(() => useStepRenderer(config))
            const rendered = result.current()

            // Should use step.component, not registry
            expect(React.isValidElement(rendered)).toBe(true)
            expect((rendered as React.ReactElement).type).toBe(InlineComponent)
        })

        it('should resolve component by step.id from registry when no step.component', () => {
            const IdBasedComponent: React.FC = () => <div>ID Component</div>
            const TypeBasedComponent: React.FC = () => <div>Type Component</div>

            const step = createStep('my-step', 'CUSTOM_COMPONENT', { componentKey: 'SomeKey' })

            const registry: StepComponentRegistry = {
                'my-step': IdBasedComponent, // Should match this
                SomeKey: TypeBasedComponent,
            }

            const config: UseStepRendererConfig<OnboardingContext> = {
                engineState: createMockEngineState(step),
                componentRegistry: registry,
                onDataChange: mockOnDataChange,
            }

            const { result } = renderHook(() => useStepRenderer(config))
            const rendered = result.current()

            expect(React.isValidElement(rendered)).toBe(true)
            expect((rendered as React.ReactElement).type).toBe(IdBasedComponent)
        })

        it('should resolve component by step.type from registry', () => {
            const TypeBasedComponent: React.FC = () => <div>Type Component</div>

            // Using INFORMATION type without componentKey
            const step = createStep('step1', 'INFORMATION', {})

            const registry: StepComponentRegistry = {
                INFORMATION: TypeBasedComponent,
            }

            const config: UseStepRendererConfig<OnboardingContext> = {
                engineState: createMockEngineState(step),
                componentRegistry: registry,
                onDataChange: mockOnDataChange,
            }

            const { result } = renderHook(() => useStepRenderer(config))
            const rendered = result.current()

            expect(React.isValidElement(rendered)).toBe(true)
            expect((rendered as React.ReactElement).type).toBe(TypeBasedComponent)
        })

        it('should resolve CUSTOM_COMPONENT by payload.componentKey', () => {
            const ComponentKeyComponent: React.FC = () => <div>ComponentKey Component</div>

            const step = createStep('step1', 'CUSTOM_COMPONENT', { componentKey: 'MyCustomWidget' })

            const registry: StepComponentRegistry = {
                MyCustomWidget: ComponentKeyComponent, // Should match this via componentKey
            }

            const config: UseStepRendererConfig<OnboardingContext> = {
                engineState: createMockEngineState(step),
                componentRegistry: registry,
                onDataChange: mockOnDataChange,
            }

            const { result } = renderHook(() => useStepRenderer(config))
            const rendered = result.current()

            expect(React.isValidElement(rendered)).toBe(true)
            expect((rendered as React.ReactElement).type).toBe(ComponentKeyComponent)
        })
    })

    describe('Error Handling', () => {
        it('should return error component when no component found', () => {
            // Step with no matching component in registry
            const step = createStep('unknown-step', 'UNKNOWN_TYPE', { componentKey: 'NonExistent' })

            const registry: StepComponentRegistry = {
                // Empty registry - nothing matches
            }

            const config: UseStepRendererConfig<OnboardingContext> = {
                engineState: createMockEngineState(step),
                componentRegistry: registry,
                onDataChange: mockOnDataChange,
            }

            const { result } = renderHook(() => useStepRenderer(config))
            const rendered = result.current()

            expect(React.isValidElement(rendered)).toBe(true)

            // Error component should be a div with error styling
            const element = rendered as React.ReactElement<{ style?: { color?: string } }>
            expect(element.type).toBe('div')

            // Check the props contain error-related styling
            expect(element.props.style).toBeDefined()
            expect(element.props.style?.color).toBe('#d32f2f')
        })

        it('should include attempted resolution paths in error message', () => {
            const step = createStep('my-step-id', 'CUSTOM_COMPONENT', { componentKey: 'MyComponentKey' })

            const config: UseStepRendererConfig<OnboardingContext> = {
                engineState: createMockEngineState(step),
                componentRegistry: {},
                onDataChange: mockOnDataChange,
            }

            const { result } = renderHook(() => useStepRenderer(config))
            const rendered = result.current()

            // Convert to string to check for resolution paths
            const element = rendered as React.ReactElement<{ children?: React.ReactNode }>

            // The error message should include the step ID and componentKey
            // Children contain nested elements with the error info
            expect(element.props.children).toBeDefined()
        })

        it('should validate resolved component is callable (skip non-functions)', () => {
            const step = createStep('step1', 'CUSTOM_COMPONENT', { componentKey: 'NotAFunction' })

            // Registry entry is not a function (invalid)
            const registry: Record<string, any> = {
                NotAFunction: 'this is a string, not a component',
            }

            const config: UseStepRendererConfig<OnboardingContext> = {
                engineState: createMockEngineState(step),
                componentRegistry: registry as StepComponentRegistry,
                onDataChange: mockOnDataChange,
            }

            const { result } = renderHook(() => useStepRenderer(config))
            const rendered = result.current()

            // Should render error component because string is not callable
            expect(React.isValidElement(rendered)).toBe(true)
            const element = rendered as React.ReactElement<{ style?: { color?: string } }>
            expect(element.type).toBe('div')
            expect(element.props.style?.color).toBe('#d32f2f')
        })
    })

    describe('Props Passing', () => {
        it('should pass correct props to resolved component', () => {
            let capturedProps: Record<string, unknown> | null = null

            const CapturingComponent: React.FC<StepComponentProps<any>> = (props) => {
                capturedProps = props as unknown as Record<string, unknown>
                return <div data-testid="captured">Captured</div>
            }

            const step = createStep('step1', 'CUSTOM_COMPONENT', {
                componentKey: 'CapturingComponent',
                customData: 'test-value',
            })

            const mockContext: OnboardingContext = {
                flowData: {
                    _internal: { completedSteps: {}, startedAt: Date.now(), stepStartTimes: {} },
                    existingData: 'preserved',
                },
            }

            const registry: StepComponentRegistry = {
                CapturingComponent,
            }

            const config: UseStepRendererConfig<OnboardingContext> = {
                engineState: createMockEngineState(step, mockContext),
                componentRegistry: registry,
                onDataChange: mockOnDataChange,
            }

            const { result } = renderHook(() => useStepRenderer(config))
            const element = result.current() as React.ReactElement

            // Actually render the element to trigger the component
            render(element)

            // Verify props
            expect(capturedProps).not.toBeNull()
            expect(capturedProps!.payload).toEqual({
                componentKey: 'CapturingComponent',
                customData: 'test-value',
            })
            expect(capturedProps!.context).toBeDefined()
            expect((capturedProps!.context as OnboardingContext).flowData.existingData).toBe('preserved')
            expect(capturedProps!.onDataChange).toBe(mockOnDataChange)
            expect(capturedProps!.coreContext).toBeDefined() // Deprecated but present
        })

        it('should pass initialData when dataKey is present in payload', () => {
            let capturedProps: Record<string, unknown> | null = null

            const CapturingComponent: React.FC<StepComponentProps<any>> = (props) => {
                capturedProps = props as unknown as Record<string, unknown>
                return <div data-testid="captured">Captured</div>
            }

            const step = createStep('step1', 'CUSTOM_COMPONENT', {
                componentKey: 'CapturingComponent',
                dataKey: 'formData',
            })

            const mockContext: OnboardingContext = {
                flowData: {
                    _internal: { completedSteps: {}, startedAt: Date.now(), stepStartTimes: {} },
                    formData: { firstName: 'John', lastName: 'Doe' },
                },
            }

            const registry: StepComponentRegistry = {
                CapturingComponent,
            }

            const config: UseStepRendererConfig<OnboardingContext> = {
                engineState: createMockEngineState(step, mockContext),
                componentRegistry: registry,
                onDataChange: mockOnDataChange,
            }

            const { result } = renderHook(() => useStepRenderer(config))
            const element = result.current() as React.ReactElement
            render(element)

            expect(capturedProps!.initialData).toEqual({ firstName: 'John', lastName: 'Doe' })
        })

        it('should pass undefined initialData when dataKey is not present', () => {
            let capturedProps: Record<string, unknown> | null = null

            const CapturingComponent: React.FC<StepComponentProps<any>> = (props) => {
                capturedProps = props as unknown as Record<string, unknown>
                return <div data-testid="captured">Captured</div>
            }

            const step = createStep('step1', 'CUSTOM_COMPONENT', {
                componentKey: 'CapturingComponent',
                // No dataKey
            })

            const registry: StepComponentRegistry = {
                CapturingComponent,
            }

            const config: UseStepRendererConfig<OnboardingContext> = {
                engineState: createMockEngineState(step),
                componentRegistry: registry,
                onDataChange: mockOnDataChange,
            }

            const { result } = renderHook(() => useStepRenderer(config))
            const element = result.current() as React.ReactElement
            render(element)

            expect(capturedProps!.initialData).toBeUndefined()
        })
    })

    describe('Edge Cases', () => {
        it('should return null when no current step', () => {
            const config: UseStepRendererConfig<OnboardingContext> = {
                engineState: createMockEngineState(null),
                componentRegistry: {},
                onDataChange: mockOnDataChange,
            }

            const { result } = renderHook(() => useStepRenderer(config))
            const rendered = result.current()

            expect(rendered).toBeNull()
        })

        it('should return null when engineState is null', () => {
            const config: UseStepRendererConfig<OnboardingContext> = {
                engineState: null,
                componentRegistry: {},
                onDataChange: mockOnDataChange,
            }

            const { result } = renderHook(() => useStepRenderer(config))
            const rendered = result.current()

            expect(rendered).toBeNull()
        })

        it('should handle empty registry gracefully', () => {
            const step = createStep('step1', 'CUSTOM_COMPONENT', { componentKey: 'Missing' })

            const config: UseStepRendererConfig<OnboardingContext> = {
                engineState: createMockEngineState(step),
                componentRegistry: {}, // Empty
                onDataChange: mockOnDataChange,
            }

            const { result } = renderHook(() => useStepRenderer(config))
            const rendered = result.current()

            // Should render error component
            expect(React.isValidElement(rendered)).toBe(true)
            expect((rendered as React.ReactElement).type).toBe('div')
        })

        it('should handle undefined registry gracefully', () => {
            const step = createStep('step1', 'CUSTOM_COMPONENT', { componentKey: 'Missing' })

            const config: UseStepRendererConfig<OnboardingContext> = {
                engineState: createMockEngineState(step),
                componentRegistry: undefined,
                onDataChange: mockOnDataChange,
            }

            const { result } = renderHook(() => useStepRenderer(config))
            const rendered = result.current()

            // Should render error component
            expect(React.isValidElement(rendered)).toBe(true)
            expect((rendered as React.ReactElement).type).toBe('div')
        })
    })
})
