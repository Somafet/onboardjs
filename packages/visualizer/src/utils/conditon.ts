export interface ConditionRule {
    id: string
    field: string
    operator:
        | 'equals'
        | 'not_equals'
        | 'contains'
        | 'not_contains'
        | 'greater_than'
        | 'less_than'
        | 'exists'
        | 'not_exists'
    value: string
    valueType: 'string' | 'number' | 'boolean'
}

export interface ConditionGroup {
    id: string
    logic: 'AND' | 'OR'
    rules: ConditionRule[]
}

const logicOperatorMap = {
    AND: '&&',
    OR: '||',
}

export type ConditionToCodeOptions = {
    wrapInFunction?: boolean
}

export const conditionToCode = (
    condition: ConditionGroup[],
    options: ConditionToCodeOptions = { wrapInFunction: true }
): string => {
    if (condition.length === 0 || condition.every((group) => group.rules.length === 0)) {
        return '() => true'
    }

    const groupConditions = condition.map((group) => {
        if (group.rules.length === 0) return 'true'

        const ruleConditions = group.rules.map((rule) => {
            const fieldAccess = `context.flowData?.${rule.field}`
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
        })

        return `(${ruleConditions.join(` ${logicOperatorMap[group.logic]} `)})`
    })

    const conditionCode = groupConditions.join(' && ')
    const functionCode = `(context) => ${conditionCode}`

    return options.wrapInFunction ? functionCode : conditionCode
}
