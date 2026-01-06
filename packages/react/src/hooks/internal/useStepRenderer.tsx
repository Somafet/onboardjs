// @onboardjs/react/src/hooks/internal/useStepRenderer.ts
'use client'

import React, { useCallback, createElement } from 'react'
import { EngineState, OnboardingContext as OnboardingContextType } from '@onboardjs/core'
import { OnboardingStep, StepComponentProps, StepComponentRegistry } from '../../types'

export interface UseStepRendererConfig<TContext extends OnboardingContextType> {
    engineState: EngineState<TContext> | null
    componentRegistry?: StepComponentRegistry<TContext>
    onDataChange: (data: unknown, isValid: boolean) => void
}

/**
 * Resolves a component for rendering a step using a strict type-safe approach.
 *
 * Resolution priority:
 * 1. step.component property
 * 2. registry[step.id]
 * 3. registry[step.type] or registry[step.payload.componentKey] (for CUSTOM_COMPONENT)
 *
 * @returns The resolved component, or null if no component found
 */
function resolveStepComponent<TContext extends OnboardingContextType>(
    step: OnboardingStep<TContext>,
    componentRegistry?: StepComponentRegistry<TContext>
): React.ComponentType<any> | null {
    // Priority 1: Explicit step.component property
    const componentFromStep = (step as OnboardingStep<TContext>).component
    if (componentFromStep && isCallable(componentFromStep)) {
        return componentFromStep
    }

    // Priority 2: Registry by step ID
    const componentFromId = componentRegistry?.[step.id]
    if (componentFromId && isCallable(componentFromId)) {
        return componentFromId
    }

    // Priority 3: Registry by step type or componentKey
    const typeKey =
        step.type === 'CUSTOM_COMPONENT' ? (step.payload as Record<string, unknown>)?.componentKey : step.type

    if (typeKey) {
        const componentFromType = componentRegistry?.[String(typeKey)]
        if (componentFromType && isCallable(componentFromType)) {
            return componentFromType
        }
    }

    return null
}

/**
 * Type guard to validate that a value is callable (a component).
 */
function isCallable(value: unknown): value is React.ComponentType<any> {
    return typeof value === 'function'
}

/**
 * Handles component registry resolution and step rendering.
 * Single responsibility: UI rendering logic with strict type-safe resolution.
 */
export function useStepRenderer<TContext extends OnboardingContextType>(
    config: UseStepRendererConfig<TContext>
): () => React.ReactNode {
    const { engineState, componentRegistry, onDataChange } = config

    const renderStep = useCallback((): React.ReactNode => {
        if (!engineState?.currentStep) {
            return null
        }

        const { currentStep, context } = engineState

        // Resolve component using strict, type-safe resolution
        const resolvedComponent = resolveStepComponent(currentStep, componentRegistry)

        if (!resolvedComponent) {
            // Build helpful error message with resolution attempts
            const typeKey =
                currentStep.type === 'CUSTOM_COMPONENT'
                    ? (currentStep.payload as Record<string, unknown>)?.componentKey
                    : currentStep.type

            const attemptedKeys = [currentStep.id, String(typeKey)]
            return (
                <div style={{ padding: '16px', color: '#d32f2f', backgroundColor: '#ffebee', borderRadius: '4px' }}>
                    <strong>❌ Component Not Found for Step: &quot;{currentStep.id}&quot;</strong>
                    <p style={{ marginTop: '8px', marginBottom: '0', fontSize: '14px' }}>
                        OnboardJS tried to resolve a component from the registry but none of the following keys matched:
                    </p>
                    <ul style={{ marginTop: '4px', paddingLeft: '20px', marginBottom: '0' }}>
                        {attemptedKeys.map((key) => (
                            <li key={key}>registry[&quot;{key}&quot;]</li>
                        ))}
                        <li>step.component property</li>
                    </ul>
                    <p style={{ marginTop: '8px', marginBottom: '0', fontSize: '13px' }}>
                        Make sure the component is registered in the <code>componentRegistry</code> prop or defined
                        directly in the step&apos;s <code>component</code> property.
                    </p>
                </div>
            )
        }

        // Find initial data if dataKey is present
        const dataKey = (currentStep.payload as Record<string, unknown>)?.dataKey
        const initialData = dataKey ? (context.flowData[String(dataKey)] as Record<string, unknown>) : undefined

        // Build props object with full StepComponentProps
        const props: StepComponentProps<unknown, TContext> = {
            payload: currentStep.payload,
            coreContext: context, // Deprecated but kept for backward compatibility
            context,
            onDataChange,
            initialData,
        }

        // Use createElement for component instantiation
        return createElement(resolvedComponent, props)
    }, [engineState, componentRegistry, onDataChange])

    return renderStep
}
