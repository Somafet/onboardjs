import type { Node } from 'acorn'
import { BaseASTVisitor } from './ast-visitor'
import { ConditionRule, ConditionGroup } from '../types'
import { FieldExtractor, LiteralExtractor } from '../extractors'
import { BinaryExpressionParser } from '../parsers'
import { generateId } from '../../../utils'

export class ConditionVisitor extends BaseASTVisitor {
    private _fieldExtractor = new FieldExtractor()
    private _literalExtractor = new LiteralExtractor()
    private _binaryParser = new BinaryExpressionParser(this._fieldExtractor, this._literalExtractor)

    visit(node: Node): ConditionRule | ConditionGroup {
        if (!node) return this.getEmptyGroup()

        // Handle ChainExpression first
        if (node.type === 'ChainExpression') {
            node = (node as any).expression
        }

        switch (node.type) {
            case 'LogicalExpression':
                return this.visitLogicalExpression(node)
            case 'ConditionalExpression':
                return this.visitConditionalExpression(node)
            case 'IfStatement':
                return this.visitIfStatement(node)
            case 'BinaryExpression':
                return this.visitBinaryExpression(node)
            case 'MemberExpression':
                return this.visitMemberExpression(node)
            case 'Identifier':
                return this.visitIdentifier(node)
            case 'Literal':
                return this.visitLiteral(node)
            default:
                console.warn(`Unsupported node type: ${node.type}`)
                return this.getEmptyGroup()
        }
    }

    visitBinaryExpression(node: any): ConditionRule {
        return this._binaryParser.parse(node)
    }

    visitLogicalExpression(node: any): ConditionGroup {
        const left = this.visit(node.left)
        const right = this.visit(node.right)
        const logicType = node.operator === '&&' ? 'AND' : 'OR'

        return this._flattenLogicalTree(logicType, left, right)
    }

    visitMemberExpression(node: any): ConditionRule {
        const field = this._fieldExtractor.extract(node)
        return {
            id: this.generateId(),
            field,
            operator: 'exists',
        }
    }

    visitConditionalExpression(node: any): ConditionRule | ConditionGroup {
        return this.visit(node.test)
    }

    visitIfStatement(node: any): ConditionRule | ConditionGroup {
        return this.visit(node.test)
    }

    visitIdentifier(node: any): ConditionRule {
        if (['true', 'false'].includes(node.name.toLowerCase())) {
            return {
                id: this.generateId(),
                field: '',
                operator: node.name.toLowerCase() === 'true' ? 'equals' : 'not_equals',
                value: node.name.toLowerCase() === 'true',
                valueType: 'boolean',
            }
        }

        const fieldName = node.name.toLowerCase().includes('env') ? node.name : `flowData.${node.name}`

        return {
            id: this.generateId(),
            field: fieldName,
            operator: 'exists',
        }
    }

    visitLiteral(node: any): ConditionRule {
        return {
            id: this.generateId(),
            field: '',
            operator: 'equals',
            value: node.value,
            valueType: this._literalExtractor.getValueType(node.value),
        }
    }

    protected generateId(): string {
        return generateId('rule')
    }

    private _flattenLogicalTree(
        currentLogicType: 'AND' | 'OR',
        left: ConditionRule | ConditionGroup,
        right: ConditionRule | ConditionGroup
    ): ConditionGroup {
        const extractRules = (item: ConditionRule | ConditionGroup): ConditionRule[] => {
            if ('rules' in item && Array.isArray(item.rules)) {
                return item.rules.filter((r): r is ConditionRule => 'field' in r)
            }
            return 'field' in item ? [item as ConditionRule] : []
        }

        // If both sides are rules, create new group
        if ('field' in left && 'field' in right) {
            return {
                id: this.generateId(),
                logic: currentLogicType,
                rules: [left, right],
            }
        }

        // Handle group + rule combinations
        if ('rules' in left && 'field' in right && left.logic === currentLogicType) {
            return {
                ...left,
                rules: [...left.rules, right].filter((r): r is ConditionRule => 'field' in r),
            }
        }

        if ('rules' in right && 'field' in left && right.logic === currentLogicType) {
            return {
                ...right,
                rules: [left, ...right.rules].filter((r): r is ConditionRule => 'field' in r),
            }
        }

        // Handle group + group with same logic
        if (
            'rules' in left &&
            'rules' in right &&
            left.logic === currentLogicType &&
            right.logic === currentLogicType
        ) {
            const mergedRules = [...left.rules, ...right.rules].filter((r): r is ConditionRule => 'field' in r)
            return {
                id: this.generateId(),
                logic: currentLogicType,
                rules: mergedRules,
            }
        }

        // Mixed case: create new group with all rules
        const allRules = [...extractRules(left), ...extractRules(right)]
        return {
            id: this.generateId(),
            logic: currentLogicType,
            rules: allRules,
        }
    }
}
