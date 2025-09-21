import { parse } from 'acorn'
import type { Expression, BlockStatement, Node } from 'acorn'
import {
    isExpressionStatement,
    isBlockStatement,
    isArrowFunctionExpression,
    isFunctionDeclaration,
    isFunctionExpression,
    isIfStatement,
    isReturnStatement,
} from '../utils/type-guards'

export class FunctionExtractor {
    extract(fn: Function): Expression | null {
        try {
            const fnStr = fn.toString()
            const ast = this._parseFunction(fnStr)

            if (ast.body.length === 0) return null

            const body = ast.body[0]
            return this._extractFromTopLevel(body)
        } catch (error) {
            console.error('AST extraction failed:', error)
            return this._stringFallback(fn.toString())
        }
    }

    private _parseFunction(fnStr: string) {
        return parse(fnStr, {
            ecmaVersion: 'latest',
            sourceType: 'script',
            allowReturnOutsideFunction: true,
            locations: true,
        }) as { body: Node[] }
    }

    private _extractFromTopLevel(body: Node): Expression | null {
        // Handle ArrowFunctionExpression wrapped in ExpressionStatement
        if (isExpressionStatement(body) && body.expression.type === 'ArrowFunctionExpression') {
            return this._extractFromArrowFunction(body.expression)
        }

        // Handle direct top-level ArrowFunctionExpression
        if (isArrowFunctionExpression(body)) {
            return this._extractFromArrowFunction(body)
        }

        // Handle FunctionDeclaration or FunctionExpression
        if (isFunctionDeclaration(body) || (isExpressionStatement(body) && isFunctionExpression(body.expression))) {
            const fnNode = isFunctionDeclaration(body) ? body : body.expression
            if ('body' in fnNode && isBlockStatement(fnNode.body)) {
                return this._extractFromBlock(fnNode.body)
            }
        }

        if (isExpressionStatement(body) && body.expression) {
            return body.expression as Expression
        }

        return null
    }

    private _extractFromArrowFunction(arrowFn: any): Expression | null {
        if (isBlockStatement(arrowFn.body)) {
            return this._extractFromBlock(arrowFn.body)
        } else if (this._isConditionExpression(arrowFn.body)) {
            return arrowFn.body
        }
        return null
    }

    private _extractFromBlock(block: BlockStatement): Expression | null {
        const allIfStatements = block.body.filter(isIfStatement)
        const allReturns = block.body.filter(isReturnStatement)

        // Strategy 1: Analyze if statements for routing patterns
        const routingConditions = this._extractRoutingConditions(allIfStatements)
        if (routingConditions.length > 1) {
            return this._combineConditionsWithOr(routingConditions)
        }
        if (routingConditions.length === 1) {
            return routingConditions[0]
        }

        // Strategy 2: Look for direct return with condition
        for (const ret of allReturns) {
            if (ret.argument && this._isComplexCondition(ret.argument)) {
                return ret.argument as Expression
            }
        }

        // Fallback strategies
        return this._fallbackExtraction(allIfStatements, allReturns)
    }

    private _extractRoutingConditions(ifStatements: any[]): Expression[] {
        const routingConditions: Expression[] = []

        for (const ifStmt of ifStatements) {
            const hasReturnInConsequent = this._hasReturnInBlock(ifStmt.consequent)
            const hasReturnInAlternate = this._hasReturnInAlternate(ifStmt.alternate)

            if (hasReturnInConsequent || hasReturnInAlternate) {
                routingConditions.push(ifStmt.test)
            }
        }

        return routingConditions
    }

    private _hasReturnInBlock(consequent: any): boolean {
        if (!consequent) return false
        if (consequent.type === 'ReturnStatement') return true
        if (consequent.type === 'BlockStatement') {
            return consequent.body.some((stmt: Node) => stmt.type === 'ReturnStatement')
        }
        return false
    }

    private _hasReturnInAlternate(alternate: any): boolean {
        if (!alternate) return false
        if (alternate.type === 'ReturnStatement') return true
        if (alternate.type === 'IfStatement') {
            return this._hasReturnInBlock(alternate.consequent)
        }
        if (alternate.type === 'BlockStatement') {
            return this._hasReturnInBlock(alternate)
        }
        return false
    }

    private _combineConditionsWithOr(conditions: Expression[]): Expression {
        let combined = conditions[0]
        for (let i = 1; i < conditions.length; i++) {
            combined = {
                type: 'LogicalExpression' as const,
                operator: '||',
                left: combined,
                right: conditions[i],
                start: Math.min(combined.start || 0, conditions[i].start || 0),
                end: Math.max(combined.end || 0, conditions[i].end || 0),
                loc: {
                    start: { line: 0, column: 0 },
                    end: { line: 0, column: 0 },
                },
            }
        }
        return combined
    }

    private _fallbackExtraction(ifStatements: any[], returns: any[]): Expression | null {
        // Try if statements first
        for (const ifStmt of ifStatements) {
            if (this._isComplexCondition(ifStmt.test) || ifStmt.test.type === 'Identifier') {
                return ifStmt.test as Expression
            }
        }

        if (ifStatements.length > 0) {
            return ifStatements[0].test as Expression
        }

        if (returns.length > 0 && returns[0].argument) {
            return returns[0].argument as Expression
        }

        return null
    }

    private _isConditionExpression(node: any): boolean {
        return this._isComplexCondition(node)
    }

    private _isComplexCondition(node: any): boolean {
        if (!node) return false

        const complexTypes = [
            'BinaryExpression',
            'LogicalExpression',
            'CallExpression',
            'UnaryExpression',
            'ConditionalExpression',
            'MemberExpression',
            'ChainExpression',
        ]

        return complexTypes.includes(node.type)
    }

    private _stringFallback(fnStr: string): Expression | null {
        // Simple regex fallback for basic patterns
        const firstIfPattern = /if\s*\(\s*([^)]+)\s*\)/
        const match = fnStr.match(firstIfPattern)

        if (match) {
            try {
                const ast = parse(`(${match[1].trim()})`, {
                    sourceType: 'script',
                    ecmaVersion: 'latest',
                })
                if (ast.body.length > 0) {
                    return isExpressionStatement(ast.body[0]) ? ast.body[0].expression : null
                }
            } catch {
                // Ignore parsing errors in fallback
            }
        }

        return null
    }
}
