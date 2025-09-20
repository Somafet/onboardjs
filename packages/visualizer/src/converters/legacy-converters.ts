import { OnboardingStep, OnboardingContext } from '@onboardjs/core'
import {
    FlowData,
    StepNode,
    EndNode,
    ConditionNode,
    ConditionalFlowEdge,
    FlowState,
    ConvertOptions,
} from '../types/flow-types'
import { getStepLabel, getStepDescription, getDefaultPayload } from '../utils/step.utils'

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
            let skipTargetId: string

            if (step.skipToStep === null || step.skipToStep === 'null') {
                skipTargetId = 'null'
            } else if (step.skipToStep && typeof step.skipToStep !== 'function') {
                skipTargetId = String(step.skipToStep)
            } else if (autoConnectUndefined && index < steps.length - 1) {
                // Auto-connect to next step if skipToStep is undefined
                skipTargetId = String(steps[index + 1].id)
            } else {
                skipTargetId = 'null'
            }

            edges.push({
                id: `${sourceId}-skip-${skipTargetId}`,
                source: sourceId,
                target: skipTargetId,
                sourceHandle: 'skip',
                type: 'conditional',
                data: {
                    edgeType: 'skip',
                    label: 'Skip',
                },
            })
        }

        // Handle nextStep navigation
        if (step.nextStep === null || step.nextStep === 'null') {
            edges.push({
                id: `${sourceId}-next-null`,
                source: sourceId,
                target: 'null',
                sourceHandle: 'next',
                type: 'conditional',
                data: {
                    edgeType: 'next',
                    label: 'Complete',
                },
            })
        } else if (step.nextStep && typeof step.nextStep !== 'function') {
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
            if (autoConnectUndefined && index < steps.length - 1) {
                const nextStepId = String(steps[index + 1].id)
                edges.push({
                    id: `${sourceId}-next-${nextStepId}`,
                    source: sourceId,
                    target: nextStepId,
                    sourceHandle: 'next',
                    type: 'conditional',
                    data: {
                        edgeType: 'next',
                        label: 'Next',
                    },
                })
            } else {
                edges.push({
                    id: `${sourceId}-next-null`,
                    source: sourceId,
                    target: 'null',
                    sourceHandle: 'next',
                    type: 'conditional',
                    data: {
                        edgeType: 'next',
                        label: 'Complete',
                    },
                })
            }
        }

        // Handle previous step edges
        const prevStep = typeof step.previousStep === 'function' ? '[Function]' : step.previousStep
        if (prevStep && prevStep !== '[Function]') {
            edges.push({
                id: `${sourceId}-previous-${prevStep}`,
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
            const nextEdge = nextEdges[0]
            if (nextEdge.target === 'null') {
                step.nextStep = null
            } else {
                const targetNode = nodes.find((n) => n.id === nextEdge.target)
                if (targetNode && targetNode.type === 'stepNode') {
                    step.nextStep = targetNode.data.stepId
                }
            }
        }

        if (skipEdges.length > 0) {
            const skipEdge = skipEdges[0]
            if (skipEdge.target === 'null') {
                step.skipToStep = null
            } else {
                const targetNode = nodes.find((n) => n.id === skipEdge.target)
                if (targetNode && targetNode.type === 'stepNode') {
                    step.skipToStep = targetNode.data.stepId
                }
            }
        }

        // If this node is the SOURCE of a "previous" edge, its previousStep is the TARGET.
        if (prevEdges.length > 0) {
            const prevEdge = prevEdges[0]
            const targetNode = nodes.find((n) => n.id === prevEdge.target)
            if (targetNode && targetNode.type === 'stepNode') {
                step.previousStep = targetNode.data.stepId
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
            // Convert EnhancedStepNode to StepNode
            const legacyNode: StepNode = {
                id: node.id,
                type: 'stepNode',
                data: {
                    stepId: node.data.stepId,
                    stepType: node.data.stepType,
                    label: node.data.label,
                    description: node.data.description,
                    isSkippable: node.data.isSkippable,
                    hasCondition: node.data.hasCondition,
                    isCompleted: node.data.isCompleted,
                    errors: node.data.errors,
                },
                position: node.position,
            }
            stepNodes.push(legacyNode)
        } else if (node.type === 'conditionNode') {
            // Convert EnhancedConditionNode to ConditionNode
            const legacyNode: ConditionNode = {
                id: node.id,
                type: 'conditionNode',
                data: {
                    conditionId: node.data.conditionId,
                    expression: node.data.expression,
                    description: node.data.description,
                    errors: node.data.errors,
                    condition: node.data.condition,
                    metadata: node.data.metadata,
                },
                position: node.position,
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
