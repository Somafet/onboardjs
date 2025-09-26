import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useNodesState, useEdgesState, useReactFlow } from '@xyflow/react'
import { OnboardingStep, OnboardingContext } from '@onboardjs/core'
import { FlowState, EnhancedStepNode, EndNode, EnhancedConditionNode } from '../types/flow-types'
import { stepsToFlowState } from '../converters/steps-to-flow'
import { layoutNodes } from '../utils/flow-converters'
import { exportFlowAsSteps } from '../converters/flow-to-steps'
import { ConditionalFlowEdge } from '../edges/conditional-edge'

export function useFlowState<TContext extends OnboardingContext = OnboardingContext>(
    initialSteps: OnboardingStep<TContext>[],
    onStepsChange?: (steps: OnboardingStep<TContext>[]) => void
) {
    // State - Use FlowState as single source of truth
    const [flowState, setFlowState] = useState<FlowState>(() => {
        const base = stepsToFlowState(initialSteps)
        try {
            const layouted = layoutNodes(base.nodes, base.edges, 'TB')
            return { nodes: layouted.nodes, edges: layouted.edges }
        } catch {
            return base
        }
    })

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
            const base = stepsToFlowState(initialSteps)
            try {
                const layouted = layoutNodes(base.nodes as any, base.edges as any, 'TB')
                updateFlowState({ nodes: layouted.nodes as any, edges: layouted.edges as any })
            } catch {
                updateFlowState(base)
            }

            lastInitialSteps.current = initialSteps
        }
    }, [initialSteps, updateFlowState])

    const updateStepsFromFlow = useCallback(
        (newNodes?: (EnhancedStepNode | EndNode | EnhancedConditionNode)[], newEdges?: ConditionalFlowEdge[]) => {
            const currentNodes = newNodes ?? flowState.nodes
            const currentEdges = newEdges ?? flowState.edges

            // Ensure node.data navigation fields (nextStep/previousStep/skipToStep/isSkippable)
            // are in sync with the provided edges. This keeps the UI (StepDetailsPanel)
            // consistent when edges are created via drag/connect.
            const syncedNodes = currentNodes.map((node) => {
                if (node.type !== 'stepNode') return node

                const stepNode = node as EnhancedStepNode

                // Outgoing edges from this node
                const outgoing = currentEdges.filter((e) => e.source === stepNode.id)

                const nextEdge = outgoing.find(
                    (e) =>
                        e.data?.edgeType === 'next' ||
                        e.data?.edgeType === 'conditional' ||
                        e.data?.edgeType === undefined
                )
                const skipEdge = outgoing.find((e) => e.data?.edgeType === 'skip')
                const prevEdge = outgoing.find((e) => e.data?.edgeType === 'previous')

                const updatedData = { ...stepNode.data }

                // Helper to resolve edge target to a stepId when target is a step node
                const resolveStepTarget = (targetId?: string | number | null) => {
                    if (!targetId) return undefined
                    const targetNode = currentNodes.find((n) => n.id === String(targetId))
                    if (!targetNode || targetNode.type !== 'stepNode') return undefined
                    return (targetNode as EnhancedStepNode).data.stepId
                }

                updatedData.nextStep = nextEdge ? resolveStepTarget(nextEdge.target) : undefined
                updatedData.skipToStep = skipEdge ? resolveStepTarget(skipEdge.target) : undefined
                updatedData.previousStep = prevEdge ? resolveStepTarget(prevEdge.target) : undefined
                updatedData.isSkippable = Boolean(skipEdge)

                return {
                    ...stepNode,
                    data: updatedData,
                } as EnhancedStepNode
            })

            const newFlowState: FlowState = {
                nodes: syncedNodes,
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

    const updateFlowFromSteps = useCallback(
        (newSteps: OnboardingStep<TContext>[]) => {
            const newFlowState = stepsToFlowState(newSteps)
            try {
                const layouted = layoutNodes(newFlowState.nodes, newFlowState.edges, 'TB')
                updateFlowState({ nodes: layouted.nodes, edges: layouted.edges })
            } catch {
                updateFlowState(newFlowState)
            }
        },
        [updateFlowState]
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
        updateFlowFromSteps,

        // React Flow state setters
        setNodes,
        setEdges,
    }
}
