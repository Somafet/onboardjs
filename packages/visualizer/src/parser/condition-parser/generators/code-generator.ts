import { ConditionGroup, ConditionToCodeOptions, FIELD_ACCESS_PREFIX, LOGIC_OPERATOR_MAP } from '../types'

export class CodeGenerator {
    generate(conditions: ConditionGroup[], options: ConditionToCodeOptions = { wrapInFunction: true }): string {
        if (conditions.length === 0 || conditions.every((group) => group.rules.length === 0)) {
            return '() => true'
        }

        const groupConditions = conditions.map((group) => this._generateGroupCode(group))
        const conditionCode = groupConditions.join(' && ')

        return options.wrapInFunction ? `(context) => ${conditionCode}` : conditionCode
    }

    private _generateGroupCode(group: ConditionGroup): string {
        if (group.rules.length === 0) return 'true'

        const ruleConditions = group.rules.map((rule) => this._generateRuleCode(rule))
        return `(${ruleConditions.join(` ${LOGIC_OPERATOR_MAP[group.logic]} `)})`
    }

    private _generateRuleCode(rule: any): string {
        const fieldAccess = `${FIELD_ACCESS_PREFIX}${rule.field}`
        const value = rule.valueType === 'string' ? `'${rule.value}'` : rule.value

        switch (rule.operator) {
            case 'equals':
                return `${fieldAccess} === ${value}`
            case 'not_equals':
                return `${fieldAccess} !== ${value}`
            case 'contains':
                return `${fieldAccess}?.includes(${value})`
            case 'not_contains':
                return `!${fieldAccess}?.includes(${value})`
            case 'greater_than':
                return `${fieldAccess} > ${value}`
            case 'less_than':
                return `${fieldAccess} < ${value}`
            case 'exists':
                return `${fieldAccess} !== undefined && ${fieldAccess} !== null`
            case 'not_exists':
                return `${fieldAccess} === undefined || ${fieldAccess} === null`
            default:
                return 'true'
        }
    }
}
