import { ParseInput, ConditionGroup } from './types'
import { CompositeInputValidator } from './validation'
import { FunctionParseStrategy, StringParseStrategy } from './parsers'
import { CodeGenerator } from './generators'
import { parseCache } from './utils/cache'

export class ConditionParser {
    private _validator = new CompositeInputValidator()
    private _strategies = [new FunctionParseStrategy(), new StringParseStrategy()]
    private _codeGenerator = new CodeGenerator()

    parseConditions(input: ParseInput): ConditionGroup[] {
        // Sanitize string input
        if (typeof input === 'string') {
            input = this._validator.sanitize(input)
        }

        if (!this._validator.validate(input)) {
            console.warn('Invalid input')
            return this._getEmptyResult()
        }

        // Convert number to string if needed
        const processedInput = typeof input === 'number' ? String(input) : input

        try {
            const strategy = this._strategies.find((s) => s.canParse(processedInput))
            if (!strategy) {
                throw new Error('No suitable parser strategy found')
            }

            return strategy.parse(processedInput)
        } catch (error) {
            console.error('Error in parseConditions:', error)
            return this._getEmptyResult()
        }
    }

    generateCode(conditions: ConditionGroup[], options?: any): string {
        return this._codeGenerator.generate(conditions, options)
    }

    clearCache(): void {
        parseCache.clear()
    }

    private _getEmptyResult(): ConditionGroup[] {
        return [
            {
                id: 'empty-condition',
                logic: 'AND',
                rules: [],
            },
        ]
    }
}
