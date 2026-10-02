import { describe, it, expect } from 'vitest'
import { findIfReturn } from '../condition-parser'
import { FunctionExtractor } from '../extractors/function-extractor'

describe('findIfReturn', () => {
    it('extracts the returned value and the end of the if block', () => {
        const src = `(ctx) => { if (ctx.a) { return 'step-a'; } return 'step-b'; }`
        const match = findIfReturn(src)

        expect(match?.thenRaw).toBe(`'step-a'`)
        expect(src.slice(match!.end).trim()).toBe(`return 'step-b'; }`)
    })

    it('handles a return without a semicolon', () => {
        expect(findIfReturn(`if (x) { return next }`)?.thenRaw.trim()).toBe('next')
    })

    it('skips an if without a block and uses the next one', () => {
        expect(findIfReturn(`if (a) doIt(); if (b) { return 'b'; }`)?.thenRaw).toBe(`'b'`)
    })

    it('returns null when there is no if block', () => {
        expect(findIfReturn(`() => 'a'`)).toBeNull()
        expect(findIfReturn(`if (a`)).toBeNull()
    })

    it('stays fast on input that made the old regex backtrack', () => {
        const start = performance.now()
        for (const unit of ['if(', 'if(){{', 'if(){{return :']) {
            expect(findIfReturn(unit.repeat(50_000))).toBeNull()
        }
        expect(performance.now() - start).toBeLessThan(1000)
    })
})

describe('FunctionExtractor string fallback', () => {
    const fallback = (src: string) => (new FunctionExtractor() as any)._stringFallback(src)

    it('parses the first if condition', () => {
        expect(fallback(`if ( ctx.a === 1 ) { return 'x' }`)?.type).toBe('BinaryExpression')
    })

    it('stays fast on input that made the old regex backtrack', () => {
        const start = performance.now()
        expect(fallback('if(' + ' '.repeat(200_000))).toBeNull()
        expect(fallback('if('.repeat(100_000))).toBeNull()
        expect(performance.now() - start).toBeLessThan(1000)
    })
})
