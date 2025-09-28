import { OnboardingStepType, OnboardingContext, OnboardingStep } from '@onboardjs/core'
import dagre from 'dagre'
import { EndNode, StepNode, ConditionNode } from '../types'
import { ConditionGroup } from '../parser/condition-parser/types'
import { getStepLabel, getStepDescription, getDefaultPayload, generateId } from './step.utils'
import { Edge, Node } from '@xyflow/react'
import { ConditionParser } from '../parser/condition-parser/condition-parser'
import { ConditionalFlowEdge } from '../edges/conditional-edge'

const conditionParser = new ConditionParser()

export interface FlowState {
    nodes: (EnhancedStepNode | EndNode | EnhancedConditionNode)[]
    edges: ConditionalFlowEdge[]
}

// Enhanced node data that stores all step information directly
export interface EnhancedStepNodeData extends Record<string, unknown> {
    stepId: string | number
    stepType: OnboardingStepType
    label: string
    description?: string
    isSkippable?: boolean
    hasCondition?: boolean
    isCompleted?: boolean
    errors?: string[]
    // Store all step properties directly on the node
    payload?: any
    condition?: Function | string // serialized function
    metadata?: Record<string, any>
    // Navigation properties (for visual display only)
    nextStep?: string | number | null | Function
    previousStep?: string | number | null | Function
    skipToStep?: string | number | null | Function
}

export interface EnhancedConditionNodeData extends Record<string, unknown> {
    conditionId: string | number
    expression?: string
    description?: string
    errors?: string[]
    // Store condition function or serialized condition
    condition?: ConditionGroup[]
    metadata?: Record<string, any>
}

export type EnhancedStepNode = Node<EnhancedStepNodeData, 'stepNode'>
export type EnhancedConditionNode = Node<EnhancedConditionNodeData, 'conditionNode'>

// Legacy interface for backwards compatibility
export interface FlowData {
    nodes: (StepNode | EndNode | ConditionNode)[]
    edges: ConditionalFlowEdge[]
}

// Utility function to convert legacy steps to enhanced flow state
export function stepsToFlowState<TContext extends OnboardingContext = OnboardingContext>(
    steps: OnboardingStep<TContext>[],
    conditionNodes: ConditionNode[] = []
): FlowState {
    const nodes: (EnhancedStepNode | EndNode | EnhancedConditionNode)[] = []
    const edges: ConditionalFlowEdge[] = []

    // Convert steps to enhanced step nodes
    steps.forEach((step, index) => {
        const enhancedNode: EnhancedStepNode = {
            id: String(step.id),
            type: 'stepNode',
            data: {
                stepId: step.id,
                stepType: step.type ?? 'INFORMATION',
                label: getStepLabel(step),
                description: getStepDescription(step),
                isSkippable: Boolean(step.isSkippable),
                hasCondition: typeof step.condition === 'function',
                payload: step.payload,
                condition: step.condition,
                metadata: (step as any).metadata || {},
                nextStep: step.nextStep,
                previousStep: step.previousStep,
                skipToStep: step.skipToStep,
            },
            position: { x: 0, y: index * 150 },
        }
        nodes.push(enhancedNode)
    })

    // Convert condition nodes to enhanced condition nodes
    conditionNodes.forEach((conditionNode) => {
        const enhancedNode: EnhancedConditionNode = {
            id: conditionNode.id,
            type: 'conditionNode',
            data: {
                conditionId: conditionNode.data.conditionId,
                description: conditionNode.data.description,
                errors: conditionNode.data.errors,
                condition: conditionNode.data.condition as any, // Handle ConditionGroup[] conversion
            },
            position: conditionNode.position,
        }
        nodes.push(enhancedNode)
    })

    // Add end node
    const endNode: EndNode = {
        id: 'null',
        type: 'endNode',
        data: {
            label: 'End',
            description: 'Flow completed',
        },
        position: { x: 0, y: steps.length * 150 },
    }
    nodes.push(endNode)

    // Generate edges based on step navigation properties and existing condition node connections
    steps.forEach((step) => {
        const sourceId = String(step.id)

        // Handle skip edges
        if (step.isSkippable && step.skipToStep !== undefined) {
            const targetId = step.skipToStep === null ? 'null' : String(step.skipToStep)
            edges.push({
                id: `${sourceId}-skip-${targetId}`,
                source: sourceId,
                target: targetId,
                sourceHandle: 'skip',
                type: 'conditional',
                data: {
                    edgeType: 'skip',
                    label: 'Skip',
                },
            })
        }

        // Handle next step edges
        if (step.nextStep !== undefined) {
            if (typeof step.nextStep === 'function') {
                try {
                    const condId = generateId('condition')
                    const conditionResult = conditionParser.parseConditions(step.nextStep as any)
                    const conditionGroups = conditionResult.conditions

                    const conditionNode: EnhancedConditionNode = {
                        id: condId,
                        type: 'conditionNode',
                        data: {
                            conditionId: condId,
                            description: 'Condition',
                            condition: conditionGroups,
                        },
                        position: { x: 0, y: 0 },
                    }

                    nodes.push(conditionNode)

                    edges.push({
                        id: `${sourceId}-next-${condId}`,
                        source: sourceId,
                        target: condId,
                        sourceHandle: 'next',
                        type: 'conditional',
                        data: {
                            edgeType: 'conditional',
                            label: 'Next',
                        },
                    })

                    const { thenTarget, elseTarget } = conditionResult

                    if (thenTarget !== undefined) {
                        const targetId = thenTarget === null ? 'null' : String(thenTarget)
                        edges.push({
                            id: `${condId}-then-${targetId}`,
                            source: condId,
                            target: targetId,
                            sourceHandle: 'then',
                            type: 'conditional',
                            data: {
                                edgeType: 'then',
                                label: 'Then',
                            },
                        })
                    }

                    if (elseTarget !== undefined) {
                        const targetId = elseTarget === null ? 'null' : String(elseTarget)
                        edges.push({
                            id: `${condId}-else-${targetId}`,
                            source: condId,
                            target: targetId,
                            sourceHandle: 'else',
                            type: 'conditional',
                            data: {
                                edgeType: 'else',
                                label: 'Else',
                            },
                        })
                    }
                } catch {
                    // fallback to null
                    edges.push({
                        id: `${sourceId}-next-null`,
                        source: sourceId,
                        target: 'null',
                        sourceHandle: 'next',
                        type: 'conditional',
                        data: { edgeType: 'next', label: 'Next' },
                    })
                }
            } else {
                const targetId = step.nextStep === null ? 'null' : String(step.nextStep)
                edges.push({
                    id: `${sourceId}-next-${targetId}`,
                    source: sourceId,
                    target: targetId,
                    sourceHandle: 'next',
                    type: 'conditional',
                    data: {
                        edgeType: 'next',
                        label: 'Next',
                    },
                })
            }
        }

        // Handle previous step edges
        if (step.previousStep !== undefined && typeof step.previousStep !== 'function') {
            edges.push({
                id: `${sourceId}-prev-${step.previousStep}`,
                source: sourceId,
                target: String(step.previousStep),
                sourceHandle: 'previous',
                type: 'conditional',
                data: {
                    edgeType: 'previous',
                    label: 'Back',
                },
            })
        }
    })

    return { nodes, edges }
}

// Export-time conversion functions

/**
 * Convert FlowState to OnboardingStep[] for export
 * This is where we handle the complexity of translating visual flows to linear steps
 */
export function exportFlowAsSteps<TContext extends OnboardingContext = OnboardingContext>(
    flowState: FlowState
): OnboardingStep<TContext>[] {
    const steps: OnboardingStep<TContext>[] = []
    const { nodes, edges } = flowState

    // Filter out the END node and condition nodes when converting back to steps
    const stepNodes = nodes.filter((node): node is EnhancedStepNode => node.type === 'stepNode')

    stepNodes.forEach((node) => {
        const { data } = node

        const step: OnboardingStep<TContext> = {
            id: data.stepId,
            type: data.stepType,
            payload: data.payload || getDefaultPayload(data.stepType),
        } as OnboardingStep<TContext>

        // Add condition if present
        if (data.condition && typeof data.condition === 'function') {
            step.condition = data.condition as any
        }

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
            const conditionalEdges = nextEdges.filter((e) => e.data?.edgeType === 'conditional')
            const sequentialEdges = nextEdges.filter((e) => e.data?.edgeType === 'next')

            if (conditionalEdges.length > 1) {
                // Multiple conditional branches - keep nextStep undefined to allow conditional evaluation
                step.nextStep = undefined
            } else if (conditionalEdges.length === 1 && sequentialEdges.length === 0) {
                // Single conditional edge
                const targetId = conditionalEdges[0].target
                if (targetId === 'null') {
                    step.nextStep = null as any
                } else {
                    const targetNode = nodes.find((n) => n.id === targetId)
                    if (targetNode && targetNode.type === 'stepNode') {
                        step.nextStep = (targetNode as EnhancedStepNode).data.stepId as any
                    } else if (targetNode && targetNode.type === 'conditionNode') {
                        // Connect to condition node by using its ID
                        step.nextStep = targetId as any
                    }
                }
            } else {
                // Sequential edge or mixed - use the first edge found
                const targetId = nextEdges[0].target
                if (targetId === 'null') {
                    step.nextStep = null as any
                } else {
                    const targetNode = nodes.find((n) => n.id === targetId)
                    if (targetNode && targetNode.type === 'stepNode') {
                        step.nextStep = (targetNode as EnhancedStepNode).data.stepId as any
                    } else if (targetNode && targetNode.type === 'conditionNode') {
                        step.nextStep = targetId as any
                    }
                }
            }
        }

        // Set isSkippable from node data, not from edges
        if (data.isSkippable) {
            step.isSkippable = true
        }

        if (skipEdges.length > 0) {
            const targetId = skipEdges[0].target

            if (targetId === 'null') {
                step.skipToStep = null
            } else {
                const targetNode = nodes.find((n) => n.id === targetId)
                if (targetNode && targetNode.type === 'stepNode') {
                    step.skipToStep = (targetNode as EnhancedStepNode).data.stepId as any
                } else {
                    step.skipToStep = null
                }
            }
        }

        // Handle previous step edges
        if (prevEdges.length > 0) {
            const targetNode = nodes.find((n) => n.id === prevEdges[0].target)
            if (targetNode && targetNode.type === 'stepNode') {
                step.previousStep = (targetNode as EnhancedStepNode).data.stepId as any
            }
        }

        steps.push(step)
    })

    return steps
}

/**
 * Generate TypeScript/JavaScript code from FlowState
 * This provides more flexibility than the step format
 */
export function exportFlowAsCode(
    flowState: FlowState,
    options: {
        format?: 'typescript' | 'javascript'
        includeTypes?: boolean
        includeComments?: boolean
        variableName?: string
    } = {}
): string {
    const { format = 'typescript', includeTypes = true, includeComments = true, variableName = 'flowSteps' } = options

    const steps = exportFlowAsSteps(flowState)
    const isTypeScript = format === 'typescript'

    let code = ''

    if (includeComments) {
        code += '// Generated onboarding flow\n'
        code += `// Generated on ${new Date().toISOString()}\n\n`
    }

    if (isTypeScript && includeTypes) {
        code += "import type { OnboardingStep } from '@onboardjs/core'\n\n"
    }

    const typeAnnotation = isTypeScript && includeTypes ? ': OnboardingStep[]' : ''
    code += `export const ${variableName}${typeAnnotation} = ${JSON.stringify(steps, null, 2)}\n`

    return code
}

// Legacy conversion functions for backwards compatibility
type ConvertOptions = {
    existingNodes: (StepNode | EndNode | ConditionNode)[]
    autoConnectUndefined?: boolean
}

/**
 * @deprecated Use stepsToFlowState for new implementations
 * Legacy function for converting steps to flow data
 */
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

    return {
        nodes: nodes,
        edges: edges,
    }
}

/**
 * @deprecated Use exportFlowAsSteps for new implementations
 * Legacy function for converting flow to steps
 */
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

// Helper function to convert FlowState to legacy format temporarily during transition
export function flowStateToLegacyFormat(flowState: FlowState): {
    stepNodes: StepNode[]
    conditionNodes: ConditionNode[]
    edges: ConditionalFlowEdge[]
} {
    const stepNodes: StepNode[] = []
    const conditionNodes: ConditionNode[] = []

    flowState.nodes.forEach((node) => {
        if (node.type === 'stepNode') {
            const enhancedNode = node as EnhancedStepNode
            const legacyNode: StepNode = {
                id: node.id,
                type: 'stepNode',
                data: {
                    stepId: enhancedNode.data.stepId,
                    stepType: enhancedNode.data.stepType,
                    label: enhancedNode.data.label,
                    description: enhancedNode.data.description,
                    isSkippable: enhancedNode.data.isSkippable,
                    hasCondition: enhancedNode.data.hasCondition,
                    isCompleted: enhancedNode.data.isCompleted,
                    errors: enhancedNode.data.errors,
                },
                position: node.position,
                measured: node.measured,
                width: node.width,
                height: node.height,
            }
            stepNodes.push(legacyNode)
        } else if (node.type === 'conditionNode') {
            const enhancedNode = node as EnhancedConditionNode
            const legacyNode: ConditionNode = {
                id: node.id,
                type: 'conditionNode',
                data: {
                    conditionId: enhancedNode.data.conditionId,
                    description: enhancedNode.data.description,
                    errors: enhancedNode.data.errors,
                    condition: enhancedNode.data.condition as any, // Handle conversion
                },
                position: node.position,
                measured: node.measured,
                width: node.width,
                height: node.height,
            }
            conditionNodes.push(legacyNode)
        }
    })

    return {
        stepNodes,
        conditionNodes,
        edges: flowState.edges,
    }
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
