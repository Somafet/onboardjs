import { ConditionRule, JS_OP_TO_RULE_OP } from '../types'
import { FieldExtractor, LiteralExtractor } from '../extractors'
import { generateId } from '../../../utils'

export class BinaryExpressionParser {
    constructor(
        private _fieldExtractor: FieldExtractor,
        private _literalExtractor: LiteralExtractor
    ) {}

    parse(node: any): ConditionRule {
        let fieldNode = node.left
        let valueNode = node.right
        let operator = node.operator

        // Handle reversed patterns like "value" === field
        if (this._isReversedPattern(node)) {
            fieldNode = node.right
            valueNode = node.left
            operator = this._reverseOperator(operator)
        }

        const field = this._fieldExtractor.extract(fieldNode)
        if (!field) {
            throw new Error(`Could not extract field from: ${fieldNode?.type || 'unknown'}`)
        }

        const value = this._literalExtractor.extract(valueNode)
        if (value === undefined && valueNode?.type !== 'Identifier') {
            throw new Error(`Could not extract value from: ${valueNode?.type || 'unknown'}`)
        }

        const valueType = this._literalExtractor.getValueType(value)
        const ruleOperator = JS_OP_TO_RULE_OP[operator]

        if (!ruleOperator || ruleOperator === 'exists' || ruleOperator === 'not_exists') {
            throw new Error('Unsupported binary operator: ' + operator)
        }

        return {
            id: generateId('rule'),
            field,
            operator: ruleOperator,
            value,
            valueType,
        }
    }

    private _isReversedPattern(node: any): boolean {
        return (
            (node.right.type === 'MemberExpression' || node.right.type === 'ChainExpression') &&
            (node.left.type === 'Literal' || node.left.type === 'Identifier')
        )
    }

    private _reverseOperator(operator: string): string {
        const reverseMap: Record<string, string> = {
            '>': '<',
            '<': '>',
            '>=': '<=',
            '<=': '>=',
            '===': '===',
            '!==': '!==',
            '==': '==',
            '!=': '!=',
        }
        return reverseMap[operator] || operator
    }
}
