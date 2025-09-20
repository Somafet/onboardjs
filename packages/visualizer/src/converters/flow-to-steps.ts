import { OnboardingStep, OnboardingContext } from '@onboardjs/core'
import { FlowState, EnhancedStepNode, ConditionalFlowEdge } from '../types/flow-types'
import { getDefaultPayload } from '../utils/step.utils'

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
        const { id, data } = node

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
            const nextEdge = nextEdges[0]
            if (nextEdge.target === 'null') {
                step.nextStep = null
            } else {
                const targetNode = nodes.find((n) => n.id === nextEdge.target)
                if (targetNode?.type === 'stepNode') {
                    step.nextStep = targetNode.data.stepId
                } else if (targetNode?.type === 'conditionNode') {
                    // For condition nodes, we might need special handling
                    step.nextStep = nextEdge.target as any
                }
            }
        }

        // Set isSkippable from node data, not from edges
        if (data.isSkippable) {
            step.isSkippable = true
        }

        if (skipEdges.length > 0) {
            const skipEdge = skipEdges[0]
            if (skipEdge.target === 'null') {
                step.skipToStep = null
            } else {
                const targetNode = nodes.find((n) => n.id === skipEdge.target)
                if (targetNode?.type === 'stepNode') {
                    step.skipToStep = targetNode.data.stepId
                }
            }
        }

        // Handle previous step edges
        if (prevEdges.length > 0) {
            const prevEdge = prevEdges[0]
            const targetNode = nodes.find((n) => n.id === prevEdge.target)
            if (targetNode?.type === 'stepNode') {
                step.previousStep = targetNode.data.stepId
            }
        }

        steps.push(step)
    })

    return steps
}
