import { describe, it, expect } from 'vitest'
import { ConditionParser } from '../condition-parser'

const parser = new ConditionParser()

describe('ConditionParser parseTargets', () => {
    it('extracts then/else from ternary function', () => {
        const fn = (context: any) => (context.flowData?.wantsNewsletter ? 'step-3' : null)
        const result = parser.parseConditions(fn as any)
        expect(result.thenTarget).toBe('step-3')
        expect(result.elseTarget).toBe('null')
    })

    it('extracts then/else from if-return function', () => {
        const fn = (context: any) => {
            const age = context.flowData?.age
            if (age >= 18 || age <= 65) {
                return 'step-2'
            }

            return null
        }

        const result = parser.parseConditions(fn as any)
        expect(result.thenTarget).toBe('step-2')
        expect(result.elseTarget).toBe('null')
    })
})
