import { OnboardingStep, OnboardingContext } from '@onboardjs/core'
import { FlowState, EnhancedStepNode, EnhancedConditionNode, EndNode, ConditionNode } from '../types/flow-types'
import { getStepLabel, getStepDescription, getDefaultPayload } from '../utils/step.utils'

/**
 * Convert legacy steps to enhanced flow state
 * This is the preferred method for new implementations
 */
export function stepsToFlowState<TContext extends OnboardingContext = OnboardingContext>(
    steps: OnboardingStep<TContext>[],
    conditionNodes: ConditionNode[] = []
): FlowState {
    const nodes: (EnhancedStepNode | EndNode | EnhancedConditionNode)[] = []
    const edges: any[] = [] // ConditionalFlowEdge[] - imported later to avoid circular deps

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

        // Handle previous step edges
        if (step.previousStep !== undefined && typeof step.previousStep !== 'function') {
            const targetId = String(step.previousStep)
            edges.push({
                id: `${sourceId}-previous-${targetId}`,
                source: sourceId,
                target: targetId,
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
