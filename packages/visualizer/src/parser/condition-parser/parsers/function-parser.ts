import { BaseParseStrategy } from './parser-strategy'
import { ParseInput, ConditionGroup, ConditionRule } from '../types'
import { FunctionExtractor } from '../extractors'
import { ConditionVisitor } from '../visitors'
import { generateId } from '../../../utils'

export class FunctionParseStrategy extends BaseParseStrategy {
    private _functionExtractor = new FunctionExtractor()
    private _conditionVisitor = new ConditionVisitor()

    canParse(input: ParseInput): boolean {
        return typeof input === 'function'
    }

    parse(input: ParseInput): ConditionGroup[] {
        if (!this.canParse(input)) {
            throw new Error('Input is not a function')
        }

        const fn = input as Function
        const expressionNode = this._functionExtractor.extract(fn)

        if (!expressionNode) {
            throw new Error('Could not extract expression from function')
        }

        const result = this._conditionVisitor.visit(expressionNode)
        return this._convertToGroups(result)
    }

    protected generateId(): string {
        return generateId('condition')
    }

    private _convertToGroups(result: ConditionRule | ConditionGroup): ConditionGroup[] {
        if ('rules' in result && Array.isArray(result.rules)) {
            const group = result as ConditionGroup
            group.rules = group.rules.filter(
                (r): r is ConditionRule => 'field' in r && !!r.field && typeof r.field === 'string'
            )
            return [group]
        } else if ('field' in result) {
            return [
                {
                    id: this.generateId(),
                    logic: 'AND',
                    rules: [result as ConditionRule],
                },
            ]
        }

        return this.getEmptyResult()
    }
}
