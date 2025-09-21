import type { Node, BlockStatement, ReturnStatement, IfStatement, Expression } from 'acorn'

export function isFunctionDeclaration(
    node: Node | undefined
): node is { type: 'FunctionDeclaration'; body: BlockStatement; start: number; end: number } {
    return node?.type === 'FunctionDeclaration'
}

export function isFunctionExpression(
    node: Node | undefined
): node is { type: 'FunctionExpression'; body: BlockStatement; start: number; end: number } {
    return node?.type === 'FunctionExpression'
}

export function isExpressionStatement(
    node: Node | undefined
): node is { type: 'ExpressionStatement'; expression: Expression; start: number; end: number } {
    return node?.type === 'ExpressionStatement'
}

export function isBlockStatement(node: Node | undefined): node is BlockStatement {
    return node?.type === 'BlockStatement'
}

export function isReturnStatement(node: Node | undefined): node is ReturnStatement {
    return node?.type === 'ReturnStatement'
}

export function isArrowFunctionExpression(
    node: Node | undefined
): node is { type: 'ArrowFunctionExpression'; body: any; start: number; end: number } {
    return node?.type === 'ArrowFunctionExpression'
}

export function isIfStatement(node: Node | undefined): node is IfStatement {
    return node?.type === 'IfStatement'
}
