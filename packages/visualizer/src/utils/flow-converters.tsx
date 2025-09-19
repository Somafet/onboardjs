// components/FlowVisualizer/utils/flowConverters.ts
import { Node, Edge, Position } from '@xyflow/react'
import { OnboardingStep, OnboardingContext } from '@onboardjs/core'
import dagre from 'dagre'
import { StepNode } from '../nodes/step-node'
import { EndNode } from '../nodes/end-node'
import { ConditionNode } from '../nodes/condition-node'
import { ConditionalFlowEdge } from '../edges/conditional-edge'
import { getDefaultPayload, getStepDescription, getStepLabel } from './step.utils'

export interface FlowData {
    nodes: (StepNode | EndNode | ConditionNode)[]
    edges: ConditionalFlowEdge[]
}

type ConvertOptions = {
    existingNodes: (StepNode | EndNode | ConditionNode)[]
    autoConnectUndefined?: boolean
}

export function convertStepsToFlow<TContext extends OnboardingContext = OnboardingContext>(
    steps: OnboardingStep<TContext>[],
    options: ConvertOptions = { autoConnectUndefined: false, existingNodes: [] }
): FlowData {
    const nodes: (StepNode | EndNode | ConditionNode)[] = []
    const edges: ConditionalFlowEdge[] = []

    const { existingNodes, autoConnectUndefined } = options

    // Create step nodes (reuse positions from existing nodes when available)
    steps.forEach((step, index) => {
        const nodeData: StepNode['data'] = {
            stepId: step.id,
            stepType: step.type ?? 'INFORMATION',
            label: getStepLabel(step),
            description: getStepDescription(step),
            isSkippable: Boolean(step.isSkippable),
            hasCondition: typeof step.condition === 'function',
        }

        // Try to find an existing node with the same id to preserve position
        const existingNode = existingNodes.find((n) => n.id === String(step.id))

        const node: StepNode = {
            id: String(step.id),
            type: 'stepNode',
            data: nodeData,
            position: existingNode?.position ?? { x: 0, y: index * 150 },
        }

        nodes.push(node)
    })

    // Create end node and reuse existing end node position if present
    const existingEnd = existingNodes?.find((n) => n.id === 'null')
    const endNode: EndNode = {
        id: 'null',
        type: 'endNode',
        data: {
            label: 'End',
            description: 'Flow completed',
        },
        position: existingEnd?.position ?? { x: 0, y: steps.length * 150 },
    }

    nodes.push(endNode)

    // Process each step to create edges
    steps.forEach((step, index) => {
        const sourceId = String(step.id)

        // Handle skip edges first
        if (step.isSkippable) {
            const skipToStep = step.skipToStep

            if (skipToStep === null || skipToStep === 'null') {
                // Skip to end
                edges.push({
                    id: `${sourceId}-skip-null`,
                    source: sourceId,
                    target: 'null',
                    sourceHandle: 'skip',
                    type: 'conditional',
                    data: {
                        edgeType: 'skip',
                        label: 'Skip',
                    },
                })
            } else if (skipToStep && typeof skipToStep !== 'function') {
                // Skip to specific step
                edges.push({
                    id: `${sourceId}-skip-${skipToStep}`,
                    source: sourceId,
                    target: String(skipToStep),
                    sourceHandle: 'skip',
                    type: 'conditional',
                    data: {
                        edgeType: 'skip',
                        label: 'Skip',
                    },
                })
            }
        }

        // Handle nextStep navigation
        if (step.nextStep === null || step.nextStep === 'null') {
            // Explicit end - connect to end node
            edges.push({
                id: `${sourceId}-next-null`,
                source: sourceId,
                target: 'null',
                sourceHandle: 'next',
                type: 'conditional',
                data: {
                    edgeType: 'next',
                    label: 'Next',
                },
            })
        } else if (step.nextStep && typeof step.nextStep !== 'function') {
            // Explicit next step - this is always a sequential connection
            edges.push({
                id: `${sourceId}-next-${step.nextStep}`,
                source: sourceId,
                target: String(step.nextStep),
                sourceHandle: 'next',
                type: 'conditional',
                data: {
                    edgeType: 'next',
                    label: 'Next',
                },
            })
        } else if (step.nextStep === undefined) {
            // nextStep is undefined - determine behavior based on following steps
            const nextStepIndex = index + 1

            if (nextStepIndex < steps.length) {
                const nextStep = steps[nextStepIndex]

                // Check if there are conditional steps after current step
                const hasCondition = nextStep.condition !== undefined

                if (!hasCondition && autoConnectUndefined) {
                    edges.push({
                        id: `${sourceId}-next-${nextStep.id}`,
                        source: sourceId,
                        target: String(nextStep.id),
                        sourceHandle: 'next',
                    })
                }
            }
        }

        // Handle previous step edges
        const prevStep = typeof step.previousStep === 'function' ? '[Function]' : step.previousStep
        if (prevStep && prevStep !== '[Function]') {
            edges.push({
                id: `${sourceId}-prev-${prevStep}`,
                source: sourceId,
                target: String(prevStep),
                sourceHandle: 'previous',
                type: 'conditional',
                data: {
                    edgeType: 'previous',
                    label: 'Back',
                },
            })
        }
    })

    // Layout nodes
    // const layouted = layoutNodes(nodes, edges)

    return {
        nodes: nodes,
        edges: edges,
    }
}

// This function correctly interprets the visual model created above.
export function convertFlowToSteps<TContext extends OnboardingContext = OnboardingContext>(
    nodes: (StepNode | EndNode | ConditionNode)[],
    edges: ConditionalFlowEdge[]
): OnboardingStep<TContext>[] {
    const steps: OnboardingStep<TContext>[] = []

    // Filter out the END node and condition nodes when converting back to steps
    const stepNodes = nodes.filter((node): node is StepNode => node.type === 'stepNode')

    stepNodes.forEach((node) => {
        const { id, data } = node

        const { stepType } = data
        const step = {
            id: id,
            type: stepType,
            payload: getDefaultPayload(stepType),
        } as OnboardingStep<TContext>

        // Find edges where THIS node is the SOURCE
        const nextEdges = edges.filter(
            (e) => e.source === node.id && (e.data?.edgeType === 'next' || e.data?.edgeType === 'conditional')
        )
        const skipEdges = edges.filter((e) => e.source === node.id && e.data?.edgeType === 'skip')
        const prevEdges = edges.filter((e) => e.source === node.id && e.data?.edgeType === 'previous')

        // Reset navigation properties
        step.nextStep = undefined
        step.previousStep = undefined
        step.skipToStep = undefined

        // Set navigation properties based on outgoing edges
        if (nextEdges.length > 0) {
            // Check if there are multiple conditional edges (conditional branching)
            const conditionalEdges = nextEdges.filter((e) => e.data?.edgeType === 'conditional')
            const sequentialEdges = nextEdges.filter((e) => e.data?.edgeType === 'next')

            if (conditionalEdges.length > 1) {
                // Multiple conditional branches - keep nextStep undefined to allow conditional evaluation
                step.nextStep = undefined
            } else if (conditionalEdges.length === 1 && sequentialEdges.length === 0) {
                // Single conditional edge - this means the step has an explicit nextStep with a condition
                const targetId = conditionalEdges[0].target
                if (targetId === 'null') {
                    step.nextStep = null as any
                } else {
                    const targetNode = nodes.find((n) => n.id === targetId)
                    if (targetNode && targetNode.type === 'stepNode') {
                        step.nextStep = targetNode.data.stepId as any
                    }
                }
            } else {
                // Sequential edge or mixed - use the first edge found
                const targetId = nextEdges[0].target
                step.nextStep = targetId
            }
        }

        if (skipEdges.length > 0) {
            const targetId = skipEdges[0].target
            step.isSkippable = true

            if (targetId === 'null') {
                step.skipToStep = null
            } else {
                const targetNode = nodes.find((n) => n.id === targetId)
                if (targetNode && targetNode.type === 'stepNode') {
                    step.skipToStep = targetNode.data.stepId
                } else {
                    step.skipToStep = null
                }
            }
        }

        // If this node is the SOURCE of a "previous" edge, its previousStep is the TARGET.
        if (prevEdges.length > 0) {
            const targetNode = nodes.find((n) => n.id === prevEdges[0].target)
            if (targetNode && targetNode.type === 'stepNode') {
                step.previousStep = targetNode.id
            }
        }

        steps.push(step)
    })

    return steps
}

// Layout nodes using dagre
export function layoutNodes<TNode extends Node, TEdge extends Edge>(
    nodes: TNode[],
    edges: TEdge[],
    direction: 'TB' | 'LR' = 'TB'
): { nodes: TNode[]; edges: TEdge[] } {
    const dagreGraph = new dagre.graphlib.Graph()
    dagreGraph.setDefaultEdgeLabel(() => ({}))
    dagreGraph.setGraph({ rankdir: direction })

    // Add nodes to dagre graph
    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: 250, height: 120 })
    })

    // Add edges to dagre graph
    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target)
    })

    dagre.layout(dagreGraph)

    // Apply dagre layout to nodes
    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id)
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - 125, // Adjust for node width
                y: nodeWithPosition.y - 60, // Adjust for node height
            },
        }
    })

    return {
        nodes: layoutedNodes,
        edges,
    }
}
