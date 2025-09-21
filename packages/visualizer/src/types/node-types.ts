import { Node } from '@xyflow/react'
import { OnboardingStepType } from '@onboardjs/core'
import { ConditionGroup } from './flow-types'

// Step Node Type Definition
export interface StepNodeData extends Record<string, unknown> {
    stepId: string | number
    stepType: OnboardingStepType
    label: string
    description?: string
    isSkippable?: boolean
    hasCondition?: boolean
    isCompleted?: boolean
    errors?: string[]
}

export type StepNodeType = Node<StepNodeData, 'stepNode'>

export interface EndNodeData extends Record<string, unknown> {
    label: string
    description?: string
}

export type EndNodeType = Node<EndNodeData, 'endNode'>

export interface ConditionNodeData extends Record<string, unknown> {
    conditionId: string | number
    condition?: ConditionGroup[]
    description?: string
    errors?: string[]
}

export type ConditionNodeType = Node<ConditionNodeData, 'conditionNode'>

// Step Icon Mapping
export const STEP_TYPE_ICONS = {
    INFORMATION: 'InfoIcon',
    SINGLE_CHOICE: 'CheckCircleIcon',
    MULTIPLE_CHOICE: 'ListChecksIcon',
    CHECKLIST: 'ListIcon',
    CONFIRMATION: 'HandIcon',
    CUSTOM_COMPONENT: 'PuzzleIcon',
} as const

// Step Type Color Mapping
export const STEP_TYPE_COLORS = {
    INFORMATION: 'vis:border-blue-500 vis:bg-blue-50',
    SINGLE_CHOICE: 'vis:border-green-500 vis:bg-green-50',
    MULTIPLE_CHOICE: 'vis:border-purple-500 vis:bg-purple-50',
    CHECKLIST: 'vis:border-amber-500 vis:bg-amber-50',
    CONFIRMATION: 'vis:border-orange-500 vis:bg-orange-50',
    CUSTOM_COMPONENT: 'vis:border-gray-500 vis:bg-gray-50',
} as const

// Utility functions for step nodes
export function getStepTypeColor(type: OnboardingStepType): string {
    return STEP_TYPE_COLORS[type] || STEP_TYPE_COLORS.INFORMATION
}
