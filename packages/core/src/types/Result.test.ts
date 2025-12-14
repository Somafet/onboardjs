import { describe, it, expect } from 'vitest'
import {
    ok,
    err,
    isOk,
    isErr,
    unwrap,
    unwrapOr,
    map,
    mapErr,
    andThen,
    safeSync,
    safeAsync,
    fromPromise,
    type Result,
} from './Result'

describe('Result Type', () => {
    describe('ok() and err()', () => {
        it('should create Ok result', () => {
            const result = ok(42)
            expect(result.ok).toBe(true)
            expect(result.value).toBe(42)
        })

        it('should create Err result', () => {
            const error = new Error('test error')
            const result = err(error)
            expect(result.ok).toBe(false)
            expect(result.error).toBe(error)
        })
    })

    describe('isOk() and isErr()', () => {
        it('should identify Ok result', () => {
            const result = ok('success')
            expect(isOk(result)).toBe(true)
            expect(isErr(result)).toBe(false)
        })

        it('should identify Err result', () => {
            const result = err(new Error('failure'))
            expect(isOk(result)).toBe(false)
            expect(isErr(result)).toBe(true)
        })
    })

    describe('unwrap()', () => {
        it('should return value for Ok result', () => {
            const result = ok('hello')
            expect(unwrap(result)).toBe('hello')
        })

        it('should throw for Err result', () => {
            const error = new Error('test error')
            const result = err(error)
            expect(() => unwrap(result)).toThrow(error)
        })
    })

    describe('unwrapOr()', () => {
        it('should return value for Ok result', () => {
            const result = ok(10)
            expect(unwrapOr(result, 0)).toBe(10)
        })

        it('should return default for Err result', () => {
            const result: Result<number, Error> = err(new Error('error'))
            expect(unwrapOr(result, 0)).toBe(0)
        })
    })

    describe('map()', () => {
        it('should transform Ok value', () => {
            const result: Result<number, Error> = ok(5)
            const mapped = map(result, (x) => x * 2)
            expect(isOk(mapped) && mapped.value).toBe(10)
        })

        it('should pass through Err', () => {
            const error = new Error('error')
            const result: Result<number, Error> = err(error)
            const mapped = map(result, (x: number) => x * 2)
            expect(isErr(mapped) && mapped.error).toBe(error)
        })
    })

    describe('mapErr()', () => {
        it('should pass through Ok', () => {
            const result = ok(42)
            const mapped = mapErr(result, () => new Error('different'))
            expect(isOk(mapped) && mapped.value).toBe(42)
        })

        it('should transform Err', () => {
            const result: Result<number, string> = err('original')
            const mapped = mapErr(result, (e) => `wrapped: ${e}`)
            expect(isErr(mapped) && mapped.error).toBe('wrapped: original')
        })
    })

    describe('andThen()', () => {
        it('should chain Ok results', () => {
            const result: Result<number, Error> = ok(5)
            const chained = andThen(result, (x) => ok(x * 2))
            expect(isOk(chained) && chained.value).toBe(10)
        })

        it('should short-circuit on Err', () => {
            const error = new Error('error')
            const result: Result<number, Error> = err(error)
            const chained = andThen(result, (x: number) => ok(x * 2))
            expect(isErr(chained) && chained.error).toBe(error)
        })

        it('should propagate Err from chain function', () => {
            const result = ok(5)
            const newError = new Error('chain error')
            const chained = andThen(result, () => err(newError))
            expect(isErr(chained) && chained.error).toBe(newError)
        })
    })

    describe('safeSync()', () => {
        it('should wrap successful sync function', () => {
            const result = safeSync(() => JSON.parse('{"a": 1}'))
            expect(isOk(result)).toBe(true)
            expect(isOk(result) && result.value).toEqual({ a: 1 })
        })

        it('should catch sync errors', () => {
            const result = safeSync(() => JSON.parse('invalid json'))
            expect(isErr(result)).toBe(true)
            expect(isErr(result) && result.error).toBeInstanceOf(Error)
        })

        it('should convert non-Error throws to Error', () => {
            const result = safeSync(() => {
                throw 'string error'
            })
            expect(isErr(result)).toBe(true)
            expect(isErr(result) && result.error.message).toBe('string error')
        })
    })

    describe('safeAsync()', () => {
        it('should wrap successful async function', async () => {
            const result = await safeAsync(async () => {
                return Promise.resolve(42)
            })
            expect(isOk(result)).toBe(true)
            expect(isOk(result) && result.value).toBe(42)
        })

        it('should catch async errors', async () => {
            const result = await safeAsync(async () => {
                throw new Error('async error')
            })
            expect(isErr(result)).toBe(true)
            expect(isErr(result) && result.error.message).toBe('async error')
        })

        it('should catch rejected promises', async () => {
            const result = await safeAsync(async () => {
                return Promise.reject(new Error('rejected'))
            })
            expect(isErr(result)).toBe(true)
            expect(isErr(result) && result.error.message).toBe('rejected')
        })
    })

    describe('fromPromise()', () => {
        it('should convert resolved promise to Ok', async () => {
            const promise = Promise.resolve('success')
            const result = await fromPromise(promise)
            expect(isOk(result)).toBe(true)
            expect(isOk(result) && result.value).toBe('success')
        })

        it('should convert rejected promise to Err', async () => {
            const promise = Promise.reject(new Error('failed'))
            const result = await fromPromise(promise)
            expect(isErr(result)).toBe(true)
            expect(isErr(result) && result.error.message).toBe('failed')
        })

        it('should convert non-Error rejections to Error', async () => {
            const promise = Promise.reject('string rejection')
            const result = await fromPromise(promise)
            expect(isErr(result)).toBe(true)
            expect(isErr(result) && result.error.message).toBe('string rejection')
        })
    })

    describe('Type Safety', () => {
        it('should narrow types correctly with isOk', () => {
            const result: Result<number, string> = ok(42)

            if (isOk(result)) {
                // TypeScript should know result.value is number
                const doubled: number = result.value * 2
                expect(doubled).toBe(84)
            }
        })

        it('should narrow types correctly with isErr', () => {
            const result: Result<number, string> = err('error message')

            if (isErr(result)) {
                // TypeScript should know result.error is string
                const upperError: string = result.error.toUpperCase()
                expect(upperError).toBe('ERROR MESSAGE')
            }
        })
    })
})
