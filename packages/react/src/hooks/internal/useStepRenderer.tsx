// @onboardjs/react/src/hooks/internal/useStepRenderer.ts
'use client'

import React, { useCallback, createElement } from 'react'
import { EngineState, OnboardingContext as OnboardingContextType } from '@onboardjs/core'
import { OnboardingStep, StepComponentProps, StepComponentRegistry, StepComponent } from '../../types'

export interface UseStepRendererConfig<TContext extends OnboardingContextType> {
    engineState: EngineState<TContext> | null
    componentRegistry?: StepComponentRegistry<TContext>
    onDataChange: (data: unknown, isValid: boolean) => void
}

/**
 * Handles component registry resolution and step rendering.
 * Single responsibility: UI rendering logic.
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

        // Look for component: first by step component property, then by ID, then by type
        let ResolvedComponent: StepComponent<any, TContext> | undefined =
            (currentStep as OnboardingStep<TContext>).component ?? componentRegistry?.[currentStep.id]

        const typeKey =
            currentStep.type === 'CUSTOM_COMPONENT'
                ? (currentStep.payload as Record<string, unknown>)?.componentKey
                : currentStep.type

        if (!ResolvedComponent && typeKey) {
            ResolvedComponent = componentRegistry?.[String(typeKey)]
        }

        if (!ResolvedComponent) {
            console.warn(
                `[OnboardJS] No component found for step "${currentStep.id}". Tried: step.component, registry["${currentStep.id}"], registry["${typeKey}"]`
            )
            return <div>Component for step &quot;{currentStep.id}&quot; not found.</div>
        }

        // Find initial data if dataKey is present
        const dataKey = (currentStep.payload as Record<string, unknown>)?.dataKey
        const initialData = dataKey ? (context.flowData[String(dataKey)] as Record<string, unknown>) : undefined

        // Build props object with full StepComponentProps
        // The component will receive all props and use what it needs
        const props: StepComponentProps<unknown, TContext> = {
            payload: currentStep.payload,
            coreContext: context, // Deprecated but kept for backward compatibility
            context,
            onDataChange,
            initialData,
        }

        // Use createElement for component instantiation
        // The StepComponent type uses `any` for payload to allow flexible component assignment
        return createElement(ResolvedComponent, props)
    }, [engineState, componentRegistry, onDataChange])

    return renderStep
}
