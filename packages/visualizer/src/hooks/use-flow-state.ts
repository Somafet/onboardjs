import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useNodesState, useEdgesState, useReactFlow } from '@xyflow/react'
import { OnboardingStep, OnboardingContext } from '@onboardjs/core'
import { FlowState, EnhancedStepNode, EndNode, EnhancedConditionNode, ConditionalFlowEdge } from '../types/flow-types'
import { stepsToFlowState } from '../converters/steps-to-flow'
import { exportFlowAsSteps } from '../converters/flow-to-steps'

export function useFlowState<TContext extends OnboardingContext = OnboardingContext>(
    initialSteps: OnboardingStep<TContext>[],
    onStepsChange?: (steps: OnboardingStep<TContext>[]) => void
) {
    // State - Use FlowState as single source of truth
    const [flowState, setFlowState] = useState<FlowState>(() => stepsToFlowState(initialSteps))

    // Derive steps from flow state for backwards compatibility
    const steps = useMemo(() => exportFlowAsSteps<TContext>(flowState), [flowState])

    const stepsById = useMemo(() => {
        return new Map(steps.map((step) => [step.id, step]))
    }, [steps])

    const isInitialMount = useRef(true)
    const lastInitialSteps = useRef(initialSteps)

    // Use flow state directly for nodes and edges
    const { nodes: flowNodes, edges: flowEdges } = flowState

    // React Flow state - primary source of truth for UI
    const [nodes, setNodes, onNodesChangeBase] = useNodesState(flowNodes)
    const [edges, setEdges, onEdgesChangeBase] = useEdgesState(flowEdges)

    const { getNodes, getEdges } = useReactFlow<
        EnhancedStepNode | EndNode | EnhancedConditionNode,
        ConditionalFlowEdge
    >()

    // Enhanced change handlers that sync back to flowState without causing resets
    const onNodesChange = useCallback(
        (changes: any[]) => {
            onNodesChangeBase(changes)

            // Sync back to flowState after React Flow processes the changes
            setTimeout(() => {
                const currentNodes = getNodes()
                const currentEdges = getEdges()
                setFlowState({ nodes: currentNodes, edges: currentEdges })
            }, 0)
        },
        [onNodesChangeBase, getNodes, getEdges]
    )

    const onEdgesChange = useCallback(
        (changes: any[]) => {
            onEdgesChangeBase(changes)

            // Sync back to flowState after React Flow processes the changes
            setTimeout(() => {
                const currentNodes = getNodes()
                const currentEdges = getEdges()
                setFlowState({ nodes: currentNodes, edges: currentEdges })
            }, 0)
        },
        [onEdgesChangeBase, getNodes, getEdges]
    )

    // Notify parent when steps change
    useEffect(() => {
        onStepsChange?.(steps)
    }, [steps, onStepsChange])

    const updateFlowState = useCallback(
        (newFlowState: FlowState) => {
            // Update React Flow state directly (primary source)
            setNodes(newFlowState.nodes)
            setEdges(newFlowState.edges)

            // Update our internal state for exports
            setFlowState(newFlowState)
        },
        [setNodes, setEdges]
    )

    // Update flow state when initialSteps change externally (not during hot-reload)
    useEffect(() => {
        // Skip on initial mount - flowState is already initialized
        if (isInitialMount.current) {
            isInitialMount.current = false
            lastInitialSteps.current = initialSteps
            return
        }

        // Deep comparison of initialSteps to detect real changes
        const hasRealChange =
            initialSteps.length !== lastInitialSteps.current.length ||
            initialSteps.some((step, index) => {
                const lastStep = lastInitialSteps.current[index]
                return !lastStep || JSON.stringify(step) !== JSON.stringify(lastStep)
            })

        if (hasRealChange) {
            const newFlowState = stepsToFlowState(initialSteps)
            updateFlowState(newFlowState)
            lastInitialSteps.current = initialSteps
        }
    }, [initialSteps, updateFlowState])

    const updateStepsFromFlow = useCallback(
        (newNodes?: (EnhancedStepNode | EndNode | EnhancedConditionNode)[], newEdges?: ConditionalFlowEdge[]) => {
            const currentNodes = newNodes ?? flowState.nodes
            const currentEdges = newEdges ?? flowState.edges

            const newFlowState: FlowState = {
                nodes: currentNodes,
                edges: currentEdges,
            }

            updateFlowState(newFlowState)

            return {
                updatedSteps: exportFlowAsSteps<TContext>(newFlowState),
                updatedNodes: currentNodes,
                updatedEdges: currentEdges,
            }
        },
        [flowState, updateFlowState]
    )

    return {
        // State
        flowState,
        steps,
        stepsById,
        nodes,
        edges,

        // Handlers
        onNodesChange,
        onEdgesChange,
        updateFlowState,
        updateStepsFromFlow,

        // React Flow state setters
        setNodes,
        setEdges,
    }
}
