import { parse } from 'acorn'
import { BaseParseStrategy } from './parser-strategy'
import { ParseInput, ConditionGroup } from '../types'
import { ConditionVisitor } from '../visitors'
import { isExpressionStatement } from '../utils/type-guards'
import { generateId } from '../../../utils'

export class StringParseStrategy extends BaseParseStrategy {
    private _conditionVisitor = new ConditionVisitor()

    canParse(input: ParseInput): boolean {
        return typeof input === 'string'
    }

    parse(input: ParseInput): ConditionGroup[] {
        if (!this.canParse(input)) {
            throw new Error('Input is not a string')
        }

        const code = String(input).trim()

        try {
            const ast = parse(code, {
                sourceType: 'script',
                ecmaVersion: 'latest',
                allowReturnOutsideFunction: true,
            })

            if (ast.body.length > 0) {
                const expressionNode = isExpressionStatement(ast.body[0]) ? ast.body[0].expression : null

                if (expressionNode) {
                    const result = this._conditionVisitor.visit(expressionNode)
                    return this._convertToGroups(result)
                }
            }
        } catch (error) {
            console.error('Failed to parse string input:', error)
        }

        return this.getEmptyResult()
    }

    protected generateId(): string {
        return generateId('rule')
    }

    private _convertToGroups(result: any): ConditionGroup[] {
        if ('rules' in result && Array.isArray(result.rules)) {
            return [result as ConditionGroup]
        } else if ('field' in result) {
            return [
                {
                    id: this.generateId(),
                    logic: 'AND',
                    rules: [result],
                },
            ]
        }
        return this.getEmptyResult()
    }
}
