import { useCallback } from 'react'
import { Connection, MarkerType } from '@xyflow/react'
import { OnboardingStep, OnboardingContext } from '@onboardjs/core'
import { FlowState, EnhancedStepNode, EnhancedConditionNode } from '../types/flow-types'
import { generateId } from '../utils/step.utils'
import { getDefaultPayload, getStepLabel, getStepDescription } from '../utils/step.utils'
import { ConditionalFlowEdge } from '../edges/conditional-edge'

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

            // Allow drag preview even before a target is chosen
            if (!connection.target) {
                return true
            }

            // Allow connections from condition nodes (then/else handles) to any step node
            const sourceNode = flowState.nodes.find((n) => n.id === connection.source)
            const targetNode = flowState.nodes.find((n) => n.id === connection.target)

            if (!sourceNode || !targetNode) {
                return false
            }

            // Don't allow connections from end nodes
            if (sourceNode.type === 'endNode') {
                return false
            }

            // Condition nodes can connect to step nodes or end nodes
            if (
                sourceNode.type === 'conditionNode' &&
                (connection.sourceHandle === 'then' || connection.sourceHandle === 'else')
            ) {
                return targetNode.type === 'stepNode' || targetNode.type === 'endNode'
            }

            // Skip and previous handles can only connect to step nodes or end nodes
            if (connection.sourceHandle === 'skip' || connection.sourceHandle === 'previous') {
                return targetNode.type === 'stepNode' || targetNode.type === 'endNode'
            }

            // Next handles from step nodes can connect to step nodes, end nodes, or condition nodes
            return (
                targetNode.type === 'stepNode' || targetNode.type === 'endNode' || targetNode.type === 'conditionNode'
            )
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

    const updateNode = (updatedNode: EnhancedStepNode) => {
        // Find and update the corresponding step node
        const updatedNodes = flowState.nodes.map((node) => {
            if (node.type === 'stepNode' && node.id === updatedNode.id) {
                return updatedNode
            }
            return node
        })

        // Rebuild navigation edges originating from this node (next/skip/previous)
        // Remove any existing outgoing navigation edges from this source node
        const nonNavEdges = flowState.edges.filter((e) => {
            // Only treat edges as navigation edges when they have a string edgeType matching our list
            const isNav = typeof e.data?.edgeType === 'string' && ['next', 'skip', 'previous'].includes(e.data.edgeType)
            return !(e.source === updatedNode.id && isNav)
        })

        const newEdges: ConditionalFlowEdge[] = [...nonNavEdges]

        // Helper to add an edge for a navigation field when present
        const addNavEdge = (edgeType: 'next' | 'skip' | 'previous', targetId?: any) => {
            // Ignore undefined or function targets
            if (targetId === undefined) return
            if (typeof targetId === 'function') return
            // Only allow string/number targets to form edges
            if (!(typeof targetId === 'string' || typeof targetId === 'number' || targetId === null)) return

            const target = targetId === null ? 'null' : String(targetId)
            const id = `edge-${updatedNode.id}-${edgeType}-${target}`

            let markerEnd: { type: MarkerType } | undefined = { type: MarkerType.ArrowClosed }
            let markerStart: { type: MarkerType } | undefined = undefined

            if (edgeType === 'previous') {
                // previous edges show arrow at the start
                markerStart = { type: MarkerType.ArrowClosed }
                markerEnd = undefined
            }

            const edge: ConditionalFlowEdge = {
                id,
                source: String(updatedNode.id),
                target,
                sourceHandle: edgeType === 'skip' ? 'skip' : edgeType === 'previous' ? 'previous' : undefined,
                targetHandle: undefined,
                markerEnd,
                markerStart,
                type: 'conditional',
                data: {
                    edgeType,
                    label: edgeType === 'next' ? 'Next' : edgeType === 'skip' ? 'Skip' : 'Back',
                },
            }

            // Prevent duplicates: replace any existing edge with same id
            const existingIndex = newEdges.findIndex((e) => e.id === id)
            if (existingIndex !== -1) {
                newEdges[existingIndex] = edge
            } else {
                newEdges.push(edge)
            }
        }

        // Add edges based on updated node data
        addNavEdge('next', updatedNode.data.nextStep)
        addNavEdge('skip', updatedNode.data.skipToStep)
        addNavEdge('previous', updatedNode.data.previousStep)

        // Use updateStepsFromFlow so the rest of the system (steps list, serializers) stay in sync
        updateStepsFromFlow(updatedNodes, newEdges)
    }

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
        updateNode,
        deleteStep,
        updateConditionNode,
    }
}
