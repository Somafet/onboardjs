export type ConditionRule = {
    id: string
    field: string
    operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than'
    value: string | number | boolean
    valueType: 'string' | 'number' | 'boolean'
}

export interface ConditionGroup {
    id: string
    logic: 'AND' | 'OR'
    rules: ConditionRule[]
}

export type ConditionToCodeOptions = {
    wrapInFunction?: boolean
}

export type ParseInput = string | ((context: any) => any) | number

export const FIELD_ACCESS_PREFIX = 'context.flowData?.'

export const LOGIC_OPERATOR_MAP = {
    AND: '&&',
    OR: '||',
} as const

export const JS_OP_TO_RULE_OP: Record<string, ConditionRule['operator']> = {
    '===': 'equals',
    '!==': 'not_equals',
    '==': 'equals',
    '!=': 'not_equals',
    '>': 'greater_than',
    '<': 'less_than',
    '>=': 'greater_than',
    '<=': 'less_than',
}

export const SAFE_MATH_OPERATORS = ['+', '-', '*', '/'] as const

export const CONDITION_TYPES = [
    'BinaryExpression',
    'LogicalExpression',
    'CallExpression',
    'UnaryExpression',
    'ConditionalExpression',
    'MemberExpression',
    'ChainExpression',
    'Identifier',
] as const

export const SPECIAL_IDENTIFIERS = ['true', 'false', 'null', 'undefined'] as const
