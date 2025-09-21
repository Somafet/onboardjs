import { Node } from '@xyflow/react'
import { OnboardingStepType } from '@onboardjs/core'

// Import the existing edge type first
import type { ConditionalFlowEdge } from '../edges/conditional-edge'
// Import the existing condition types
import type { ConditionGroup } from '../utils/conditon'

// Re-export for convenience
export type { ConditionalFlowEdge, ConditionGroup }

// New flow-first data interfaces
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

// Legacy node types (for backwards compatibility)
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

export interface ConditionNodeData extends Record<string, unknown> {
    conditionId: string | number
    expression?: string
    description?: string
    errors?: string[]
    condition?: ConditionGroup[]
    metadata?: Record<string, any>
}

export interface EndNodeData extends Record<string, unknown> {
    label: string
    description?: string
}

export type StepNode = Node<StepNodeData, 'stepNode'>
export type ConditionNode = Node<ConditionNodeData, 'conditionNode'>
export type EndNode = Node<EndNodeData, 'endNode'>

// Export options
export interface ExportOptions {
    format: 'typescript' | 'javascript'
    includeTypes: boolean
    includeComments: boolean
    variableName: string
}

// Parser options
export interface StepJSONParserOptions {
    prettyPrint?: boolean
    functionHandling?: 'serialize' | 'omit' | 'error'
    includeMeta?: boolean
    validateSteps?: boolean
}

export interface TypeScriptExportOptions {
    includeImports?: boolean
    includeTypes?: boolean
    useConstAssertion?: boolean
    variableName?: string
    includeComments?: boolean
    inlineFunctions?: boolean
    indentation?: 'spaces' | 'tabs'
    spacesCount?: number
    includeValidation?: boolean
}

// Conversion options
export type ConvertOptions = {
    existingNodes: (StepNode | EndNode | ConditionNode)[]
    autoConnectUndefined?: boolean
}

// Export formats
export type ExportFormat = 'json' | 'typescript' | 'javascript'

// Edge visibility settings
export interface EdgeVisibility {
    next: boolean
    conditional: boolean
    skip: boolean
    previous: boolean
    then: boolean
    else: boolean
}
