// src/types/Result.ts
// Result type for explicit error handling without throwing in hot paths
// Follows the Result pattern for type-safe error handling

/**
 * Represents a successful result containing a value
 */
export interface Ok<T> {
    readonly ok: true
    readonly value: T
}

/**
 * Represents a failure result containing an error
 */
export interface Err<E> {
    readonly ok: false
    readonly error: E
}

/**
 * A Result type that can be either Ok (success) or Err (failure)
 * Use this instead of throwing exceptions in hot paths
 */
export type Result<T, E = Error> = Ok<T> | Err<E>

/**
 * Creates a successful Result
 */
export function ok<T>(value: T): Ok<T> {
    return { ok: true, value }
}

/**
 * Creates a failure Result
 */
export function err<E>(error: E): Err<E> {
    return { ok: false, error }
}

/**
 * Type guard to check if a Result is Ok
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
    return result.ok === true
}

/**
 * Type guard to check if a Result is Err
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
    return result.ok === false
}

/**
 * Unwraps a Result, throwing if it's an error
 * Use sparingly - prefer pattern matching with isOk/isErr
 */
export function unwrap<T, E>(result: Result<T, E>): T {
    if (isOk(result)) {
        return result.value
    }
    throw result.error
}

/**
 * Unwraps a Result with a default value if it's an error
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
    return isOk(result) ? result.value : defaultValue
}

/**
 * Maps a Result's success value to a new value
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
    return isOk(result) ? ok(fn(result.value)) : result
}

/**
 * Maps a Result's error to a new error
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
    return isErr(result) ? err(fn(result.error)) : result
}

/**
 * Chains Result operations (flatMap)
 */
export function andThen<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
    return isOk(result) ? fn(result.value) : result
}

/**
 * Wraps a synchronous function that might throw into a Result
 * Preserves stack traces unlike try-catch-rethrow
 */
export function safeSync<T>(fn: () => T): Result<T, Error> {
    try {
        return ok(fn())
    } catch (error) {
        return err(error instanceof Error ? error : new Error(String(error)))
    }
}

/**
 * Wraps an async function that might throw into a Result
 * Preserves stack traces unlike try-catch-rethrow
 */
export async function safeAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
    try {
        return ok(await fn())
    } catch (error) {
        return err(error instanceof Error ? error : new Error(String(error)))
    }
}

/**
 * Converts a Promise that might reject to a Promise<Result>
 */
export async function fromPromise<T>(promise: Promise<T>): Promise<Result<T, Error>> {
    try {
        return ok(await promise)
    } catch (error) {
        return err(error instanceof Error ? error : new Error(String(error)))
    }
}
