import { OnboardingStep, OnboardingContext } from '@onboardjs/core'
import { FlowState, EnhancedStepNode, EnhancedConditionNode } from '../types/flow-types'
import { getDefaultPayload } from '../utils/step.utils'
import { ConditionParser } from '../parser/condition-parser/condition-parser'

const conditionParser = new ConditionParser()

/**
 * Helper: build a conditional function string
 */
function buildConditionalFunction(
    conditionNode: EnhancedConditionNode,
    thenTarget: string | null,
    elseTarget: string | null
): string {
    const conditionCode = conditionNode.data.condition
        ? conditionParser.generateCode(conditionNode.data.condition)
        : '() => true'

    return `(context) => {
        const condition = ${conditionCode}
        return condition(context) ? ${JSON.stringify(thenTarget)} : ${JSON.stringify(elseTarget)}
    }`
}

/**
 * Helper: resolve a target (direct or conditional) into a step pointer or function
 */
function resolveTarget(
    targetId: string,
    nodes: FlowState['nodes'],
    edges: FlowState['edges']
): string | ((ctx: any) => string | null) | null {
    if (targetId === 'null') return null

    const targetNode = nodes.find((n) => n.id === targetId)
    if (!targetNode) return null

    if (targetNode.type === 'stepNode') {
        return String(targetNode.data.stepId)
    }

    if (targetNode.type === 'conditionNode') {
        const conditionalNode = targetNode as EnhancedConditionNode

        // find then/else edges
        const thenEdge = edges.find((e) => e.source === conditionalNode.id && e.data?.edgeType === 'then')
        const elseEdge = edges.find((e) => e.source === conditionalNode.id && e.data?.edgeType === 'else')

        const thenTarget = thenEdge?.target ?? null
        const elseTarget = elseEdge?.target ?? null

        return buildConditionalFunction(conditionalNode, thenTarget, elseTarget) as any
    }

    return null
}

/**
 * Convert FlowState to OnboardingStep[] for export
 */
export function exportFlowAsSteps<TContext extends OnboardingContext = OnboardingContext>(
    flowState: FlowState
): OnboardingStep<TContext>[] {
    const { nodes, edges } = flowState
    const steps: OnboardingStep<TContext>[] = []

    // Filter for stepNodes only
    const stepNodes = nodes.filter((node): node is EnhancedStepNode => node.type === 'stepNode')

    for (const node of stepNodes) {
        const { data, id } = node

        const step: OnboardingStep<TContext> = {
            id: data.stepId,
            type: data.stepType,
            payload: data.payload || getDefaultPayload(data.stepType),
        } as OnboardingStep<TContext>

        if (typeof data.condition === 'function') {
            step.condition = data.condition as any
        }

        // outgoing edges grouped by type
        const outgoing = edges.filter((e) => e.source === id)
        const nextEdge = outgoing.find((e) => e.data?.edgeType === 'next' || e.data?.edgeType === 'conditional')
        const skipEdge = outgoing.find((e) => e.data?.edgeType === 'skip')
        const prevEdge = outgoing.find((e) => e.data?.edgeType === 'previous')

        step.nextStep = nextEdge ? resolveTarget(nextEdge.target, nodes, edges) : undefined

        step.skipToStep = skipEdge ? resolveTarget(skipEdge.target, nodes, edges) : undefined

        step.previousStep = prevEdge ? resolveTarget(prevEdge.target, nodes, edges) : undefined

        if (data.isSkippable) step.isSkippable = true

        steps.push(step)
    }

    return steps
}
