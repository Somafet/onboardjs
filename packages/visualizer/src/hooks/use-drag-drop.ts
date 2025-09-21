import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { OnboardingStep, OnboardingContext } from '@onboardjs/core'
import { FlowState, EnhancedStepNode } from '../types/flow-types'
import { getDefaultPayload, getStepLabel, getStepDescription } from '../utils/step.utils'
import { generateId } from '../utils/step.utils'
import { DragEvent } from 'react'

export function useDragAndDrop<TContext extends OnboardingContext = OnboardingContext>(
    flowState: FlowState,
    updateFlowState: (newFlowState: FlowState) => void,
    addStep: (stepType?: OnboardingStep<TContext>['type']) => void,
    readonly: boolean = false
) {
    const { screenToFlowPosition } = useReactFlow()

    // Drag and drop handlers
    const onDragOver = useCallback((event: DragEvent) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
    }, [])

    const onDrop = useCallback(
        (event: DragEvent) => {
            event.preventDefault()

            if (readonly) return

            const stepType = event.dataTransfer.getData('application/reactflow')

            // Validate step type
            const validStepTypes = [
                'INFORMATION',
                'SINGLE_CHOICE',
                'MULTIPLE_CHOICE',
                'CHECKLIST',
                'CONFIRMATION',
                'CUSTOM_COMPONENT',
            ]
            if (!stepType || !validStepTypes.includes(stepType)) {
                throw new Error(`Invalid step type: ${stepType}`)
            }

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            })

            const newId = generateId('step')
            const newStep: OnboardingStep<TContext> = {
                id: newId,
                type: stepType as OnboardingStep<TContext>['type'],
                payload: getDefaultPayload(stepType),
            } as OnboardingStep<TContext>

            // Create enhanced step node
            const newNode: EnhancedStepNode = {
                id: String(newId),
                type: 'stepNode',
                data: {
                    stepId: newId,
                    stepType: stepType as any,
                    label: getStepLabel(newStep),
                    description: getStepDescription(newStep),
                    isSkippable: Boolean(newStep.isSkippable),
                    hasCondition: typeof newStep.condition === 'function',
                    payload: newStep.payload,
                    condition: newStep.condition,
                    metadata: {},
                    nextStep: newStep.nextStep,
                    previousStep: newStep.previousStep,
                    skipToStep: newStep.skipToStep,
                },
                position,
            }

            const newFlowState: FlowState = {
                nodes: [...flowState.nodes, newNode],
                edges: flowState.edges,
            }

            updateFlowState(newFlowState)
        },
        [readonly, screenToFlowPosition, flowState, updateFlowState]
    )

    return {
        onDragOver,
        onDrop,
    }
}
