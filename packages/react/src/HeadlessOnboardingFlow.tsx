// @onboardjs/react/src/HeadlessOnboardingFlow.tsx (Example of a Render Prop version)
'use client'

import React, { ReactNode, useCallback, useEffect, useState } from 'react'
import {
    OnboardingEngineConfig,
    EngineState,
    OnboardingStep as CoreOnboardingStep,
    // Persistence related types if needed by render prop directly
    DataLoadFn,
    DataPersistFn,
} from '@onboardjs/core'
import {
    OnboardingProvider,
    LocalStoragePersistenceOptions, // Assuming this is exported
    OnboardingActions, // Assuming this is exported
} from './context/OnboardingProvider'
import { StepComponentRegistry } from './types'
import { useOnboarding } from './hooks/useOnboarding'

// Props for the render function provided by the user
export interface HeadlessFlowRenderProps extends OnboardingActions {
    state: EngineState // Current state from the engine
    currentStep: CoreOnboardingStep | null
    isLoading: boolean
    /**
     * Helper function to render the content of the current step using the registry.
     * The user can choose to use this or implement their own step rendering logic.
     */
    renderStepContent: () => ReactNode
}

interface HeadlessOnboardingFlowProps extends Omit<OnboardingEngineConfig, 'onDataLoad' | 'onDataPersist'> {
    children: (props: HeadlessFlowRenderProps) => ReactNode // The render prop
    stepComponentRegistry: StepComponentRegistry // Still needed for the default renderStepContent helper

    localStoragePersistence?: LocalStoragePersistenceOptions
    customOnDataLoad?: DataLoadFn
    customOnDataPersist?: DataPersistFn
}

// Internal component that consumes the context and calls the render prop
const HeadlessFlowRendererInternal: React.FC<{
    children: (props: HeadlessFlowRenderProps) => ReactNode
    stepComponentRegistry: StepComponentRegistry
}> = ({ children, stepComponentRegistry }) => {
    const { engine, state, isLoading, skip, next, previous, goToStep, reset, setComponentLoading, updateContext } =
        useOnboarding()

    // Local state for data/validity of the current step, if we want renderStepContent to be simpler
    // This makes HeadlessFlowRendererInternal a bit stateful regarding the current step's UI interaction.
    const [activeStepData, setActiveStepData] = useState<any>({})
    const [isStepUIValid, setIsStepUIValid] = useState<boolean>(true) // Default to true, step can override

    useEffect(() => {
        setActiveStepData({})
        setIsStepUIValid(true) // Reset when step changes
    }, [state?.currentStep?.id])

    const renderStepContent = useCallback((): ReactNode => {
        if (!state?.currentStep || !state.context) {
            return null
        }

        let ComponentToRender
        const step = state.currentStep
        if (step.type === 'CUSTOM_COMPONENT') {
            ComponentToRender = stepComponentRegistry[(step.payload as any)?.componentKey]
        } else {
            ComponentToRender = stepComponentRegistry[step.type ?? 'INFORMATION'] ?? stepComponentRegistry[step.id]
        }

        if (!ComponentToRender) {
            console.error(
                `No component registered for step type/key: ${step.type === 'CUSTOM_COMPONENT' ? (step.payload as any)?.componentKey : step.type}`
            )
            return <div>Step Component Not Found</div>
        }

        return (
            <ComponentToRender
                payload={step.payload}
                coreContext={state.context}
                context={state.context}
                initialData={activeStepData} // Or derive from state.context.flowData
                onDataChange={(data, isValid) => {
                    setActiveStepData(data)
                    setIsStepUIValid(isValid)
                }}
            />
        )
    }, [state?.currentStep, state?.context, stepComponentRegistry, activeStepData])

    if (!engine || !state) {
        // This should be covered by the isLoading state from useOnboarding
        return null
    }

    // We need to wrap actions to include the activeStepData if the user wants it automatically handled
    // Or, the user explicitly passes data to actions.next() in their render prop.
    // For simplicity, let's assume the user's render prop will call actions.next(dataFromTheirState).
    // The `actions` from `useOnboarding` are already wrapped with setComponentLoading.

    return children({
        state,
        skip,
        next,
        previous,
        goToStep,
        reset,
        updateContext,
        currentStep: state.currentStep,
        isLoading,
        renderStepContent,
    })
}

export const HeadlessOnboardingFlow: React.FC<HeadlessOnboardingFlowProps> = ({
    children,
    stepComponentRegistry,
    localStoragePersistence,
    customOnDataLoad,
    customOnDataPersist,
    ...engineConfig // steps, initialStepId, initialContext, onFlowComplete, onStepChange
}) => {
    return (
        <OnboardingProvider
            {...engineConfig}
            localStoragePersistence={localStoragePersistence}
            customOnDataLoad={customOnDataLoad}
            customOnDataPersist={customOnDataPersist}
            componentRegistry={stepComponentRegistry}
        >
            <HeadlessFlowRendererInternal stepComponentRegistry={stepComponentRegistry}>
                {children}
            </HeadlessFlowRendererInternal>
        </OnboardingProvider>
    )
}
