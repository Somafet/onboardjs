import { ParseInput, ConditionGroup } from '../types'

export interface ParseStrategy {
    canParse(input: ParseInput): boolean
    parse(input: ParseInput): ConditionGroup[]
}

export abstract class BaseParseStrategy implements ParseStrategy {
    abstract canParse(input: ParseInput): boolean
    abstract parse(input: ParseInput): ConditionGroup[]

    protected getEmptyResult(): ConditionGroup[] {
        return [
            {
                id: this.generateId(),
                logic: 'AND',
                rules: [],
            },
        ]
    }

    protected abstract generateId(): string
}
