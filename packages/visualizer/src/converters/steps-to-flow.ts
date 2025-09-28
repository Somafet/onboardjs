import { OnboardingStep, OnboardingContext } from '@onboardjs/core'
import { FlowState, EnhancedStepNode, EnhancedConditionNode, EndNode, ConditionNode } from '../types/flow-types'
import { getStepLabel, getStepDescription, generateId } from '../utils/step.utils'
import { ConditionalFlowEdge } from '../edges/conditional-edge'
import { ConditionParser } from '../parser/condition-parser/condition-parser'

const conditionParser = new ConditionParser()

/**
 * Helper function to handle conditional step navigation logic
 */
function handleConditionalNavigation(
    stepProperty: OnboardingStep<any>['nextStep'],
    sourceId: string,
    handleType: 'next' | 'previous' | 'skip',
    nodes: (EnhancedStepNode | EndNode | EnhancedConditionNode)[],
    edges: ConditionalFlowEdge[]
): void {
    if (stepProperty === undefined) return

    if (typeof stepProperty === 'function') {
        try {
            const condId = generateId('condition')

            // Parse condition groups and destination targets from the function
            const conditionResult = conditionParser.parseConditions(stepProperty)
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

            // Connect step -> condition node
            edges.push({
                id: `${sourceId}-${handleType}-${condId}`,
                source: sourceId,
                target: condId,
                sourceHandle: handleType,
                type: 'conditional',
                data: {
                    edgeType: handleType === 'previous' ? 'conditional' : handleType,
                    label: handleType.charAt(0).toUpperCase() + handleType.slice(1),
                },
            })

            // Add then/else targets if the parser extracted them
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
            // If anything fails, fall back to default behavior
            const targetId = 'null'
            edges.push({
                id: `${sourceId}-${handleType}-${targetId}`,
                source: sourceId,
                target: targetId,
                sourceHandle: handleType,
                type: 'conditional',
                data: {
                    edgeType: handleType,
                    label: handleType.charAt(0).toUpperCase() + handleType.slice(1),
                },
            })
        }
    } else {
        const targetId = stepProperty === null ? 'null' : String(stepProperty)
        edges.push({
            id: `${sourceId}-${handleType}-${targetId}`,
            source: sourceId,
            target: targetId,
            sourceHandle: handleType,
            type: 'conditional',
            data: {
                edgeType: handleType,
                label: handleType.charAt(0).toUpperCase() + handleType.slice(1),
            },
        })
    }
}

/**
 * Convert legacy steps to enhanced flow state
 * This is the preferred method for new implementations
 */
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
                metadata: step.meta || {},
                nextStep: step.nextStep,
                previousStep: step.previousStep,
                skipToStep: step.skipToStep,
            },
            position: { x: 0, y: index * 150 },
        }
        nodes.push(enhancedNode)
    })

    nodes.push(...conditionNodes)

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

        // Handle skip edges with conditional logic support
        if (step.isSkippable) {
            handleConditionalNavigation(step.skipToStep, sourceId, 'skip', nodes, edges)
        }

        // Handle next step edges with conditional logic
        handleConditionalNavigation(step.nextStep, sourceId, 'next', nodes, edges)

        // Handle previous step edges with conditional logic
        handleConditionalNavigation(step.previousStep, sourceId, 'previous', nodes, edges)
    })

    return { nodes, edges }
}
