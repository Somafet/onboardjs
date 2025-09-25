import { OnboardingStep, OnboardingContext } from '@onboardjs/core'
import { FlowState, EnhancedStepNode, EnhancedConditionNode, EndNode, ConditionNode } from '../types/flow-types'
import { getStepLabel, getStepDescription, generateId } from '../utils/step.utils'
import { ConditionalFlowEdge } from '../edges/conditional-edge'
import { ConditionParser } from '../parser/condition-parser/condition-parser'

const conditionParser = new ConditionParser()

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
            // If nextStep is a function, create a condition node and connect it
            if (typeof step.nextStep === 'function') {
                try {
                    const condId = generateId('condition')

                    // Parse condition groups and destination targets from the function
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

                    // Connect step -> condition node (as conditional)
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
