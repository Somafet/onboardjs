import { useCallback } from 'react'
import { Connection, MarkerType } from '@xyflow/react'
import { OnboardingStep, OnboardingContext } from '@onboardjs/core'
import { FlowState, EnhancedStepNode, EnhancedConditionNode, ConditionalFlowEdge } from '../types/flow-types'
import { generateId } from '../utils/step.utils'
import { getDefaultPayload, getStepLabel, getStepDescription } from '../utils/step.utils'

export function useFlowOperations<TContext extends OnboardingContext = OnboardingContext>(
    flowState: FlowState,
    updateFlowState: (newFlowState: FlowState) => void,
    updateStepsFromFlow: (newNodes?: any[], newEdges?: ConditionalFlowEdge[]) => any,
    readonly: boolean = false
) {
    // Connection handlers
    const onConnect = useCallback(
        (params: Connection) => {
            if (readonly) return

            // Determine edge type based on source handle
            let edgeType: 'next' | 'skip' | 'previous' | 'then' | 'else' = 'next'
            let label = 'Next'
            let markerEnd: { type: MarkerType } | undefined = {
                type: MarkerType.ArrowClosed,
            }
            let markerStart: { type: MarkerType } | undefined = undefined

            if (params.sourceHandle === 'skip') {
                edgeType = 'skip'
                label = 'Skip'
            } else if (params.sourceHandle === 'previous') {
                edgeType = 'previous'
                label = 'Back'
                markerStart = { type: MarkerType.ArrowClosed }
                markerEnd = undefined
            } else if (params.sourceHandle === 'then') {
                edgeType = 'then'
                label = 'Then'
            } else if (params.sourceHandle === 'else') {
                edgeType = 'else'
                label = 'Else'
            }

            const newEdge: ConditionalFlowEdge = {
                id: `edge-${params.source}-${edgeType}-${params.target}`,
                ...params,
                markerStart,
                markerEnd,
                type: 'conditional',
                data: {
                    edgeType,
                    label,
                },
            }

            // Prevent multiple outgoing edges of the same type from a single node
            const filteredEdges = flowState.edges.filter(
                (e) => !(e.source === params.source && e.data?.edgeType === edgeType)
            )

            updateStepsFromFlow(undefined, [...filteredEdges, newEdge])
        },
        [readonly, flowState.edges, updateStepsFromFlow]
    )

    // Validate connections - ensure proper flow logic
    const isValidConnection = useCallback(
        (connection: ConditionalFlowEdge | Connection) => {
            // Don't allow self-connections
            if (connection.source === connection.target) {
                return false
            }

            // Allow connections from condition nodes (then/else handles) to any step node
            const sourceNode = flowState.nodes.find((n) => n.id === connection.source)
            const targetNode = flowState.nodes.find((n) => n.id === connection.target)

            if (!sourceNode || !targetNode) {
                return false
            }

            // Condition nodes can connect to step nodes or end nodes
            if (
                sourceNode.type === 'conditionNode' &&
                (connection.sourceHandle === 'then' || connection.sourceHandle === 'else')
            ) {
                return targetNode.type === 'stepNode' || targetNode.type === 'endNode'
            }

            // Step nodes can connect to other step nodes, end nodes, or condition nodes
            if (sourceNode.type === 'stepNode') {
                return (
                    targetNode.type === 'stepNode' ||
                    targetNode.type === 'endNode' ||
                    targetNode.type === 'conditionNode'
                )
            }

            // Don't allow connections from end nodes
            if (sourceNode.type === 'endNode') {
                return false
            }

            return true
        },
        [flowState.nodes]
    )

    // Step management functions
    const addStep = useCallback(
        (stepType: OnboardingStep<TContext>['type'] = 'INFORMATION') => {
            if (readonly) return

            const newId = generateId('step')
            const newStep: OnboardingStep<TContext> = {
                id: newId,
                type: stepType,
                payload: getDefaultPayload(stepType),
            } as OnboardingStep<TContext>

            // Create enhanced step node
            const newNode: EnhancedStepNode = {
                id: String(newId),
                type: 'stepNode',
                data: {
                    stepId: newId,
                    stepType: stepType,
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
                position: { x: Math.random() * 300, y: Math.random() * 300 },
            }

            const newFlowState: FlowState = {
                nodes: [...flowState.nodes, newNode],
                edges: flowState.edges,
            }

            updateFlowState(newFlowState)
        },
        [readonly, flowState, updateFlowState]
    )

    const updateStep = useCallback(
        (updatedStep: OnboardingStep<TContext>) => {
            if (readonly) return

            // Find and update the corresponding node
            const updatedNodes = flowState.nodes.map((node) => {
                if (node.type === 'stepNode' && node.data.stepId === updatedStep.id) {
                    const updatedNode: EnhancedStepNode = {
                        ...node,
                        data: {
                            ...node.data,
                            stepId: updatedStep.id,
                            stepType: updatedStep.type ?? 'INFORMATION',
                            label: getStepLabel(updatedStep),
                            description: getStepDescription(updatedStep),
                            isSkippable: Boolean(updatedStep.isSkippable),
                            hasCondition: typeof updatedStep.condition === 'function',
                            payload: updatedStep.payload,
                            condition: updatedStep.condition,
                            nextStep: updatedStep.nextStep,
                            previousStep: updatedStep.previousStep,
                            skipToStep: updatedStep.skipToStep,
                        },
                    }
                    return updatedNode
                }
                return node
            })

            const newFlowState: FlowState = {
                nodes: updatedNodes,
                edges: flowState.edges,
            }

            updateFlowState(newFlowState)
        },
        [readonly, flowState, updateFlowState]
    )

    const deleteStep = useCallback(
        (stepId: string | number) => {
            if (readonly) return

            const nodeIdToDelete = String(stepId)

            // Filter out the node
            const remainingNodes = flowState.nodes.filter((node) => node.id !== nodeIdToDelete)

            // Filter out edges connected to the deleted node
            const remainingEdges = flowState.edges.filter(
                (edge) => edge.source !== nodeIdToDelete && edge.target !== nodeIdToDelete
            )

            const newFlowState: FlowState = {
                nodes: remainingNodes,
                edges: remainingEdges,
            }

            updateFlowState(newFlowState)
        },
        [readonly, flowState, updateFlowState]
    )

    const updateConditionNode = useCallback(
        (updatedNode: EnhancedConditionNode) => {
            if (readonly) return

            // Find and update the corresponding condition node
            const updatedNodes = flowState.nodes.map((node) => {
                if (node.type === 'conditionNode' && node.id === updatedNode.id) {
                    return updatedNode
                }
                return node
            })

            const newFlowState: FlowState = {
                nodes: updatedNodes,
                edges: flowState.edges,
            }

            updateFlowState(newFlowState)
        },
        [readonly, flowState, updateFlowState]
    )

    return {
        onConnect,
        isValidConnection,
        addStep,
        updateStep,
        deleteStep,
        updateConditionNode,
    }
}
