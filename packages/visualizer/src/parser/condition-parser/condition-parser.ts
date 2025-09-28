import { ParseInput, ConditionGroup, ParseResult, ConditionToCodeOptions } from './types'
import { CompositeInputValidator } from './validation'
import { FunctionParseStrategy, StringParseStrategy } from './parsers'
import { CodeGenerator } from './generators'
import { parseCache } from './utils/cache'
import { FunctionExtractor } from './extractors/function-extractor'

export class ConditionParser {
    private _validator = new CompositeInputValidator()
    private _strategies = [new FunctionParseStrategy(), new StringParseStrategy()]
    private _codeGenerator = new CodeGenerator()
    private _extractor = new FunctionExtractor()

    parseConditions(input: ParseInput): ParseResult {
        // Sanitize string input
        if (typeof input === 'string') {
            input = this._validator.sanitize(input)
        }

        if (!this._validator.validate(input)) {
            console.warn('Invalid input')
            return { conditions: this._getEmptyResult() }
        }

        // Convert number to string if needed
        const processedInput = typeof input === 'number' ? String(input) : input

        try {
            const strategy = this._strategies.find((s) => s.canParse(processedInput))
            if (!strategy) {
                throw new Error('No suitable parser strategy found')
            }

            const conditions = strategy.parse(processedInput)

            // Attempt to extract then/else targets when input was a function
            let thenTarget: string | null | undefined = undefined
            let elseTarget: string | null | undefined = undefined

            if (typeof input === 'function') {
                try {
                    const expr = this._extractor.extract(input as Function)

                    const extractTargetValue = (node: any): string | null | undefined => {
                        if (!node) return undefined
                        if (node.type === 'Literal') return node.value === null ? 'null' : String(node.value)
                        if (node.type === 'Identifier') return node.name === 'null' ? 'null' : node.name
                        return undefined
                    }

                    if (expr) {
                        if (expr.type === 'ConditionalExpression') {
                            thenTarget = extractTargetValue(expr.consequent)
                            elseTarget = extractTargetValue(expr.alternate)
                        } else if (expr.type === 'Literal' || expr.type === 'Identifier') {
                            thenTarget = extractTargetValue(expr)
                        }
                    }

                    // If extractor failed to find then/else, try a string-based fallback
                    if ((thenTarget === undefined && elseTarget === undefined) || expr === null) {
                        try {
                            const fnStr = (input as Function).toString()

                            const parseRawTarget = (raw: string): string | null | undefined => {
                                if (!raw) return undefined
                                const trimmed = raw.trim()
                                if (trimmed === 'null') return 'null'
                                const quoted = trimmed.match(/^['"`](.+?)['"`]$/)
                                if (quoted) return quoted[1]
                                const idMatch = trimmed.match(/^([a-zA-Z0-9_$-]+)/)
                                if (idMatch) return idMatch[1]
                                return undefined
                            }

                            const ifMatch = fnStr.match(/if\s*\([^)]*\)\s*{[\s\S]*?return\s+([^;]+);?[\s\S]*?}/m)
                            if (ifMatch) {
                                const thenRaw = ifMatch[1]
                                const parsedThen = parseRawTarget(thenRaw)
                                if (parsedThen !== undefined) thenTarget = parsedThen

                                // Look for a return after the if block
                                const afterIfIndex = fnStr.indexOf(ifMatch[0]) + ifMatch[0].length
                                const afterStr = fnStr.slice(afterIfIndex)
                                const returnAfter = afterStr.match(/return\s+([^;]+);?/)
                                if (returnAfter) {
                                    const parsedElse = parseRawTarget(returnAfter[1])
                                    if (parsedElse !== undefined) elseTarget = parsedElse
                                }
                            }
                        } catch {
                            // ignore fallback failures
                        }
                    }
                } catch {
                    // ignore extraction failures
                }
            }

            return { conditions, thenTarget, elseTarget }
        } catch (error) {
            console.error('Error in parseConditions:', error)
            return { conditions: this._getEmptyResult() }
        }
    }

    generateCode(conditions: ConditionGroup[], options?: ConditionToCodeOptions): string {
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
