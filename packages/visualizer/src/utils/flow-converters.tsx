// components/FlowVisualizer/utils/flowConverters.ts
import { Node, Edge, Position } from '@xyflow/react'
import { OnboardingStep, OnboardingContext } from '@onboardjs/core'
import dagre from 'dagre'
import { StepNode } from '../nodes/step-node'
import { EndNode } from '../nodes/end-node'
import { ConditionalFlowEdge } from '../edges/conditional-edge'
import { getStepLabel } from './helpers'

export interface FlowData {
    nodes: (StepNode | EndNode)[]
    edges: ConditionalFlowEdge[]
}

export function convertStepsToFlow<TContext extends OnboardingContext = OnboardingContext>(
    steps: OnboardingStep<TContext>[]
): FlowData {
    const nodes: (StepNode | EndNode)[] = []
    const edges: ConditionalFlowEdge[] = []

    // Check if we need an end node
    const hasStepsEndingWithNull = steps.some((step) => step.nextStep === null || (step as any).skipToStep === null)

    // Create step nodes
    steps.forEach((step, index) => {
        const nodeData: StepNode['data'] = {
            stepId: step.id,
            stepType: step.type || 'INFORMATION',
            label: getStepLabel(step),
            description: getStepDescription(step),
            isSkippable: Boolean(step.isSkippable),
            hasCondition: typeof step.condition === 'function',
        }

        const node: StepNode = {
            id: String(step.id),
            type: 'stepNode',
            data: nodeData,
            position: { x: 0, y: index * 150 }, // Will be positioned properly by layout
            targetPosition: Position.Top,
            sourcePosition: Position.Bottom,
        }

        nodes.push(node)
    })

    // Add end node if needed
    if (hasStepsEndingWithNull) {
        const endNode: EndNode = {
            id: 'END',
            type: 'endNode',
            data: {
                label: 'End',
                description: 'Flow completed',
            },
            position: { x: 0, y: steps.length * 150 },
            targetPosition: Position.Top,
            sourcePosition: Position.Bottom,
        }
        nodes.push(endNode)
    }

    // Create a map for easier step lookup
    const stepMap = new Map(steps.map((step) => [step.id, step]))

    // Process each step to create edges
    steps.forEach((step, index) => {
        const sourceId = String(step.id)

        // Handle skip edges first
        if (step.isSkippable) {
            const skipToStep = step.skipToStep

            if (skipToStep === null) {
                // Skip to end
                edges.push({
                    id: `${sourceId}-skip-END`,
                    source: sourceId,
                    target: 'END',
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
        if (step.nextStep === null) {
            // Explicit end - connect to END node
            edges.push({
                id: `${sourceId}-next-END`,
                source: sourceId,
                target: 'END',
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

                if (!hasCondition) {
                    edges.push({
                        id: `${sourceId}-next-${nextStep.id}`,
                        source: sourceId,
                        target: String(nextStep.id),
                        sourceHandle: 'next',
                    })
                } else {
                    const conditionalStepsAfter = steps.slice(nextStepIndex)

                    if (conditionalStepsAfter.length > 0 && typeof step.condition !== 'function') {
                        // Current step is not conditional but there are conditional steps after
                        // Create conditional edges to all conditional steps that could follow
                        conditionalStepsAfter.forEach((condStep) => {
                            edges.push({
                                id: `${sourceId}-cond-${condStep.id}`,
                                source: sourceId,
                                target: String(condStep.id),
                                sourceHandle: 'next',
                                type: 'conditional',
                                data: {
                                    edgeType: 'conditional',
                                    label: 'Cond',
                                },
                            })
                        })
                    } else {
                        // Either no conditional steps after OR current step is conditional
                        // Create sequential edge to immediate next step
                        edges.push({
                            id: `${sourceId}-next-${nextStep.id}`,
                            source: sourceId,
                            target: String(nextStep.id),
                            sourceHandle: 'next',
                            type: 'conditional',
                            data: {
                                edgeType: 'next',
                                label: 'Next',
                            },
                        })
                    }
                }
            }
        }

        // Handle previous step edges
        const prevStepId = typeof step.previousStep === 'function' ? '[Function]' : step.previousStep
        if (prevStepId && prevStepId !== '[Function]') {
            edges.push({
                id: `${sourceId}-prev-${prevStepId}`,
                source: sourceId,
                target: String(prevStepId),
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
    const layouted = layoutNodes(nodes, edges)

    return {
        nodes: layouted.nodes,
        edges: layouted.edges,
    }
}

// This function correctly interprets the visual model created above.
export function convertFlowToSteps<TContext extends OnboardingContext = OnboardingContext>(
    nodes: (StepNode | EndNode)[],
    edges: ConditionalFlowEdge[],
    originalSteps?: OnboardingStep<TContext>[]
): OnboardingStep<TContext>[] {
    const steps: OnboardingStep<TContext>[] = []

    // Filter out the END node when converting back to steps
    const stepNodes = nodes.filter((node): node is StepNode => node.type === 'stepNode' && 'stepId' in node.data)

    stepNodes.forEach((node) => {
        const { stepId, stepType } = node.data
        const originalStep = originalSteps?.find((s) => s.id === stepId)
        const step: OnboardingStep<TContext> = originalStep
            ? { ...originalStep }
            : ({
                  id: stepId,
                  type: stepType,
                  payload: getDefaultPayload(stepType) as any,
              } as OnboardingStep<TContext>)

        // Find edges where THIS node is the SOURCE
        const nextEdges = edges.filter(
            (e) => e.source === node.id && (e.data?.edgeType === 'next' || e.data?.edgeType === 'conditional')
        )
        const skipEdges = edges.filter((e) => e.source === node.id && e.data?.edgeType === 'skip')
        const prevEdges = edges.filter((e) => e.source === node.id && e.data?.edgeType === 'previous')

        // Reset navigation properties
        step.nextStep = undefined
        step.previousStep = undefined
        step.isSkippable = skipEdges.length > 0
        ;(step as any).skipToStep = undefined

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
                if (targetId === 'END') {
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
                if (targetId === 'END') {
                    step.nextStep = null as any
                } else {
                    const targetNode = nodes.find((n) => n.id === targetId)
                    if (targetNode && targetNode.type === 'stepNode') {
                        step.nextStep = targetNode.data.stepId as any
                    }
                }
            }
        }

        if (skipEdges.length > 0) {
            const targetId = skipEdges[0].target
            step.isSkippable = true

            if (targetId === 'END') {
                ;(step as any).skipToStep = null
            } else {
                const targetNode = nodes.find((n) => n.id === targetId)
                if (targetNode && targetNode.type === 'stepNode') {
                    ;(step as any).skipToStep = targetNode.data.stepId
                } else {
                    ;(step as any).skipToStep = null
                }
            }
        }

        // If this node is the SOURCE of a "previous" edge, its previousStep is the TARGET.
        if (prevEdges.length > 0) {
            const targetNode = nodes.find((n) => n.id === prevEdges[0].target)
            if (targetNode && targetNode.type === 'stepNode') {
                step.previousStep = targetNode.data.stepId as any
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

function getStepDescription<TContext extends OnboardingContext>(step: OnboardingStep<TContext>): string | undefined {
    const payload = step.payload as any

    if (payload?.description) return payload.description
    if (payload?.subtitle) return payload.subtitle
    if (payload?.options && Array.isArray(payload.options)) {
        return `${payload.options.length} options`
    }
    if (payload?.items && Array.isArray(payload.items)) {
        return `${payload.items.length} items`
    }

    return undefined
}

function getDefaultPayload(stepType: string): Record<string, any> {
    switch (stepType) {
        case 'SINGLE_CHOICE':
        case 'MULTIPLE_CHOICE':
            return { options: [] }
        case 'CHECKLIST':
            return { dataKey: 'checklist_data', items: [] }
        case 'CUSTOM_COMPONENT':
            return { componentKey: 'DefaultComponent' }
        default:
            return {}
    }
}
