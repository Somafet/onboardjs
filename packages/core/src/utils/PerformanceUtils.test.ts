// src/engine/utils/__tests__/PerformanceUtils.test.ts
import { describe, it, expect, vi, beforeEach, afterEach, MockInstance, Mock } from 'vitest'
import { OnboardingContext, OnboardingStep } from '../types'
import { PerformanceUtils } from './PerformanceUtils'

interface TestContext extends OnboardingContext {
    flowData: {
        keyA?: string
        keyB?: number
        [key: string]: unknown
    }
    user?: string
}

const mockSteps: OnboardingStep<TestContext>[] = [
    { id: 's1', type: 'INFORMATION', payload: { mainText: 'Step 1' } },
    { id: 's2', type: 'INFORMATION', payload: { mainText: 'Step 2' } },
    { id: 's3', type: 'INFORMATION', payload: { mainText: 'Step 3' } },
]

describe('PerformanceUtils', () => {
    let consoleWarnSpy: MockInstance
    let mockCurrentTime: number
    let currentTimeStub: number

    beforeEach(() => {
        PerformanceUtils.clearCaches()
        mockCurrentTime = 0
        currentTimeStub = 0
        // Default spy for tests not needing specific sequences for performance.now
        vi.spyOn(performance, 'now').mockImplementation(() => mockCurrentTime)
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.restoreAllMocks() // Restores all spies, including generalPerformanceNowSpy
        vi.useRealTimers()
    })

    const runMeasuredOp = (operationName: string, intendedDuration: number) => {
        const originalPerformanceNow = performance.now
        const mockPerfNow = vi.fn()
        performance.now = mockPerfNow

        const currentCallStartTime = currentTimeStub // Use currentTimeStub to calculate expected values
        currentTimeStub += intendedDuration
        const currentCallEndTime = currentTimeStub

        console.log(
            `TEST HELPER: op=${operationName}, i=${intendedDuration}, configuring perf.now to return ${currentCallStartTime} then ${currentCallEndTime}`
        )
        mockPerfNow.mockReturnValueOnce(currentCallStartTime).mockReturnValueOnce(currentCallEndTime)

        PerformanceUtils.measurePerformance(operationName, () => {})
        // The debug log inside PerformanceUtils.measurePerformance will show what it actually got

        performance.now = originalPerformanceNow // Restore immediately
    }

    const runAsyncMeasuredOp = async (operationName: string, intendedDuration: number) => {
        const originalPerformanceNow = performance.now
        const mockPerfNow = vi.fn()
        performance.now = mockPerfNow

        const currentCallStartTime = currentTimeStub
        currentTimeStub += intendedDuration
        const currentCallEndTime = currentTimeStub

        console.log(
            `TEST HELPER ASYNC: op=${operationName}, i=${intendedDuration}, configuring perf.now to return ${currentCallStartTime} then ${currentCallEndTime}`
        )
        mockPerfNow.mockReturnValueOnce(currentCallStartTime).mockReturnValueOnce(currentCallEndTime)

        await PerformanceUtils.measureAsyncPerformance(operationName, async () => {
            await vi.advanceTimersByTimeAsync(0) // For the internal setTimeout(0) in the test op
        })

        performance.now = originalPerformanceNow // Restore immediately
    }

    describe('findStepById (Caching)', () => {
        it('should return undefined if stepId is null or undefined', () => {
            expect(PerformanceUtils.findStepById(mockSteps, null)).toBeUndefined()
            expect(PerformanceUtils.findStepById(mockSteps, undefined)).toBeUndefined()
        })

        it('should find a step if it exists and cache it', () => {
            const step = PerformanceUtils.findStepById(mockSteps, 's1')
            expect(step).toEqual(mockSteps[0])
            const cachedStep = PerformanceUtils.findStepById(mockSteps, 's1')
            expect(cachedStep).toEqual(mockSteps[0])
        })

        it('should return undefined if step does not exist', () => {
            const step = PerformanceUtils.findStepById(mockSteps, 'nonExistent')
            expect(step).toBeUndefined()
        })

        it('should implement LRU eviction for stepCache', () => {
            const maxCacheSize = 1000 // Matching the class's private static
            const manySteps: OnboardingStep<TestContext>[] = []
            for (let i = 0; i < maxCacheSize + 5; i++) {
                manySteps.push({
                    id: `step${i}`,
                    type: 'INFORMATION',
                    payload: { mainText: 'Hello world!' },
                })
            }

            for (let i = 0; i < maxCacheSize; i++) {
                PerformanceUtils.findStepById(manySteps, `step${i}`)
            }
            expect((PerformanceUtils as any).stepCache.size).toBe(maxCacheSize)

            PerformanceUtils.findStepById(manySteps, `step0`) // Access to move to end of LRU
            PerformanceUtils.findStepById(manySteps, `step${maxCacheSize}`) // New item, evicts oldest unaccessed

            expect((PerformanceUtils as any).stepCache.size).toBe(maxCacheSize)
            expect((PerformanceUtils as any).stepCache.has(`${manySteps.length}-step0`)).toBe(true)
            expect((PerformanceUtils as any).stepCache.has(`${manySteps.length}-step1`)).toBe(false) // step1 should be evicted
        })

        it('cache key should depend on steps.length and stepId', () => {
            PerformanceUtils.findStepById(mockSteps, 's1')
            expect((PerformanceUtils as any).stepCache.has(`3-s1`)).toBe(true)
            const shorterSteps = [mockSteps[0]]
            PerformanceUtils.findStepById(shorterSteps, 's1')
            expect((PerformanceUtils as any).stepCache.has(`1-s1`)).toBe(true)
        })
    })

    describe('memoizeStepEvaluation (Caching)', () => {
        let mockEvaluator: Mock
        const mockContext1: TestContext = { flowData: { keyA: 'val1' } }
        const mockContext2: TestContext = { flowData: { keyA: 'val2' } }

        beforeEach(() => {
            mockEvaluator = vi.fn((id, ctx) => ({
                result: `evaluated ${id} with ${JSON.stringify(ctx.flowData)}`,
            }))
        })

        it('should call evaluator if stepId is null and not cache', () => {
            const result = PerformanceUtils.memoizeStepEvaluation(null, mockContext1, mockEvaluator)
            expect(mockEvaluator).toHaveBeenCalledWith(null, mockContext1)
            expect(result.result).toContain('evaluated null')
            expect((PerformanceUtils as any).evaluationCache.size).toBe(0)
        })

        it('should call evaluator for a new stepId/context combination and cache the result', () => {
            PerformanceUtils.memoizeStepEvaluation('eval1', mockContext1, mockEvaluator)
            expect(mockEvaluator).toHaveBeenCalledTimes(1)
            expect((PerformanceUtils as any).evaluationCache.size).toBe(1)
        })

        it('should return cached result if called again with the same stepId/context', () => {
            PerformanceUtils.memoizeStepEvaluation('eval1', mockContext1, mockEvaluator)
            const result = PerformanceUtils.memoizeStepEvaluation('eval1', mockContext1, mockEvaluator)
            expect(mockEvaluator).toHaveBeenCalledTimes(1)
            expect(result.result).toContain('evaluated eval1 with {"keyA":"val1"}')
        })

        it('should call evaluator again if context changes for the same stepId', () => {
            PerformanceUtils.memoizeStepEvaluation('eval1', mockContext1, mockEvaluator)
            PerformanceUtils.memoizeStepEvaluation('eval1', mockContext2, mockEvaluator)
            expect(mockEvaluator).toHaveBeenCalledTimes(2)
        })

        it('should implement LRU eviction for evaluationCache', () => {
            const maxCacheSize = 1000
            for (let i = 0; i < maxCacheSize + 5; i++) {
                PerformanceUtils.memoizeStepEvaluation(`eval${i}`, { flowData: { [`key${i}`]: i } }, mockEvaluator)
            }
            expect((PerformanceUtils as any).evaluationCache.size).toBe(maxCacheSize)
            const contextHash0 = (PerformanceUtils as any).hashContext({
                flowData: { key0: 0 },
            })
            expect((PerformanceUtils as any).evaluationCache.has(`eval0-${contextHash0}`)).toBe(false)
        })
    })

    describe('debounce', () => {
        it('should call the function only once after the wait time for multiple rapid calls', () => {
            const func = vi.fn()
            const debouncedFunc = PerformanceUtils.debounce(func, 100)
            debouncedFunc()
            debouncedFunc()
            debouncedFunc()
            vi.advanceTimersByTime(100)
            expect(func).toHaveBeenCalledTimes(1)
        })

        it('should call the function with the latest arguments', () => {
            const func = vi.fn()
            const debouncedFunc = PerformanceUtils.debounce(func, 100)
            debouncedFunc(1)
            debouncedFunc(2)
            debouncedFunc(3)
            vi.advanceTimersByTime(100)
            expect(func).toHaveBeenCalledWith(3)
        })
    })

    describe('throttle', () => {
        it('should call the function immediately on first call and ignore subsequent calls within limit', () => {
            const func = vi.fn()
            const throttledFunc = PerformanceUtils.throttle(func, 100)
            throttledFunc() // Called
            throttledFunc() // Ignored
            expect(func).toHaveBeenCalledTimes(1)
            vi.advanceTimersByTime(50)
            throttledFunc() // Still ignored
            expect(func).toHaveBeenCalledTimes(1)
        })

        it('should call the function again after the limit time has passed', () => {
            const func = vi.fn()
            const throttledFunc = PerformanceUtils.throttle(func, 100)
            throttledFunc() // Call 1
            vi.advanceTimersByTime(100)
            throttledFunc() // Call 2
            expect(func).toHaveBeenCalledTimes(2)
        })
    })

    describe('measurePerformance & measureAsyncPerformance', () => {
        it('measurePerformance should execute operation and record metrics', () => {
            const operation = vi.fn(() => 'result')
            // Use the generalPerformanceNowSpy which returns mockCurrentTime
            mockCurrentTime = 100
            const result = PerformanceUtils.measurePerformance('syncOp_basic', operation)
            // For a sync op, mockCurrentTime doesn't change between start and end calls
            // unless the operation itself somehow changes it (which it doesn't here).
            // So, duration will be 0.
            expect(result).toBe('result')
            expect(operation).toHaveBeenCalledTimes(1)
            const stats = PerformanceUtils.getPerformanceStats('syncOp_basic')
            expect(stats?.recent).toBe(0)
        })

        it('should log a warning for slow sync operations with controlled sequence', () => {
            const specificSyncSpy = vi.spyOn(performance, 'now') // Local spy for this test
            specificSyncSpy
                .mockReturnValueOnce(0) // startTime
                .mockReturnValueOnce(150) // endTime

            PerformanceUtils.measurePerformance('slowSync', () => {})

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('PerformanceUtils [WARN]'),
                expect.stringContaining('Slow operation detected: slowSync took 150.00ms')
            )
            expect(specificSyncSpy).toHaveBeenCalledTimes(2)
            specificSyncSpy.mockRestore() // Restore after this test
        })

        it('measureAsyncPerformance should execute async operation and record metrics', async () => {
            const operationWorkTime = 60
            const measurementOverhead = 10 // Conceptual overhead for measurement itself

            const asyncOperation = vi.fn(async () => {
                // This operation doesn't need to manipulate mockCurrentTime directly
                // if we control performance.now for start/end times.
                await vi.advanceTimersByTimeAsync(operationWorkTime) // Simulate async work using fake timers
                return 'asyncResult'
            })

            const specificAsyncSpy = vi.spyOn(performance, 'now')
            const startTime = 500
            const endTime = startTime + operationWorkTime + measurementOverhead // e.g., 500 + 60 + 10 = 570

            specificAsyncSpy
                .mockReturnValueOnce(startTime) // For startTime
                .mockReturnValueOnce(endTime) // For endTime

            const result = await PerformanceUtils.measureAsyncPerformance('asyncOp', asyncOperation)

            expect(result).toBe('asyncResult')
            const stats = PerformanceUtils.getPerformanceStats('asyncOp')
            expect(stats?.recent).toBe(operationWorkTime + measurementOverhead) // 570 - 500 = 70
            expect(specificAsyncSpy).toHaveBeenCalledTimes(2)
            specificAsyncSpy.mockRestore()
        })

        it('should log a warning for slow async operations with controlled sequence', async () => {
            const specificAsyncSlowSpy = vi.spyOn(performance, 'now')
            specificAsyncSlowSpy
                .mockReturnValueOnce(0) // startTime
                .mockReturnValueOnce(250) // endTime

            await PerformanceUtils.measureAsyncPerformance('slowAsync', async () => {
                await vi.advanceTimersByTimeAsync(0) // Ensure it's treated as async if op is empty
            })

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('PerformanceUtils [WARN]'),
                expect.stringContaining('Slow async operation detected: slowAsync took 250.00ms')
            )
            expect(specificAsyncSlowSpy).toHaveBeenCalledTimes(2)
            specificAsyncSlowSpy.mockRestore()
        })

        it('should limit performanceMetrics to last 100 measurements', () => {
            // Temporarily override performance.now for this test to ensure distinct durations
            const tempPerfSpy = vi.spyOn(performance, 'now')
            let time = 0
            tempPerfSpy.mockImplementation(() => {
                time += 10
                return time
            })

            for (let i = 0; i < 110; i++) {
                PerformanceUtils.measurePerformance('manyMetrics', () => {})
            }
            const metrics = (PerformanceUtils as any).performanceMetrics.get('manyMetrics')
            expect(metrics).toHaveLength(100)
            tempPerfSpy.mockRestore()
        })

        it('measurePerformance should keep only the last 100 measurements, shifting out oldest', () => {
            const operationName = 'syncLimitTest'
            const totalMeasurements = 105
            const limit = 100

            for (let i = 1; i <= totalMeasurements; i++) {
                console.log(`TEST LOOP: Iteration for intended duration ${i}`)
                runMeasuredOp(operationName, i) // Pass 'i' as the intended duration
                const metricsSoFar = (PerformanceUtils as any).performanceMetrics.get(operationName) as
                    | number[]
                    | undefined
                console.log(`TEST LOOP: Metrics after duration ${i}: ${JSON.stringify(metricsSoFar?.slice(-5))}`) // Log last 5
            }

            const metrics = (PerformanceUtils as any).performanceMetrics.get(operationName) as number[] | undefined
            expect(metrics).toBeDefined()
            expect(metrics).toHaveLength(limit)

            // The first measurement recorded was 1ms, second was 2ms, etc.
            // After 105 measurements, durations 1ms through 5ms should be shifted out.
            // The first element in the metrics array should now be the 6th measurement (duration 6ms).
            expect(metrics?.[0]).toBe(6) // Duration of the 6th operation (i=6)
            // The last element should be the duration of the 105th operation
            expect(metrics?.[limit - 1]).toBe(totalMeasurements) // Duration of the 105th operation
        })

        it('measureAsyncPerformance should keep only the last 100 measurements, shifting out oldest', async () => {
            const operationName = 'asyncLimitTest'
            const totalMeasurements = 103
            const limit = 100

            for (let i = 1; i <= totalMeasurements; i++) {
                await runAsyncMeasuredOp(operationName, i * 2) // e.g., 2ms, 4ms, ...
            }

            const metrics = (PerformanceUtils as any).performanceMetrics.get(operationName) as number[] | undefined
            expect(metrics).toBeDefined()
            expect(metrics).toHaveLength(limit)

            // Durations recorded: 2, 4, 6, 8, 10, 12...
            // After 103 measurements, durations 2ms, 4ms, 6ms should be shifted out.
            // The first element should be the 4th measurement (duration 4*2 = 8ms).
            expect(metrics?.[0]).toBe((totalMeasurements - limit + 1) * 2) // (103 - 100 + 1) * 2 = 4 * 2 = 8
            // The last element should be the duration of the 103rd operation
            expect(metrics?.[limit - 1]).toBe(totalMeasurements * 2)
        })
    })

    describe('getPerformanceStats', () => {
        it('should return null if no metrics for operationName', () => {
            expect(PerformanceUtils.getPerformanceStats('nonExistentOp')).toBeNull()
        })

        it('should calculate stats correctly', () => {
            ;(PerformanceUtils as any).performanceMetrics.set('testOp', [10, 20, 30, 20, 20])
            const stats = PerformanceUtils.getPerformanceStats('testOp')
            expect(stats?.count).toBe(5)
            expect(stats?.average).toBe(20)
            expect(stats?.min).toBe(10)
            expect(stats?.max).toBe(30)
            expect(stats?.recent).toBe(20)
        })
    })

    describe('clearCaches', () => {
        it('should clear all caches and performance metrics', () => {
            PerformanceUtils.findStepById(mockSteps, 's1')
            PerformanceUtils.memoizeStepEvaluation('eval1', { flowData: {} }, () => 'res')
            const tempPerfSpy = vi.spyOn(performance, 'now').mockReturnValue(0) // For measurePerformance
            PerformanceUtils.measurePerformance('op1', () => {})
            tempPerfSpy.mockRestore()

            PerformanceUtils.clearCaches()

            expect((PerformanceUtils as any).stepCache.size).toBe(0)
            expect((PerformanceUtils as any).evaluationCache.size).toBe(0)
            expect((PerformanceUtils as any).performanceMetrics.size).toBe(0)
        })
    })

    describe('getCacheStats', () => {
        it('should return correct cache sizes', () => {
            PerformanceUtils.findStepById(mockSteps, 's1')
            PerformanceUtils.memoizeStepEvaluation('eval1', { flowData: {} }, () => 'res')
            const tempPerfSpy = vi.spyOn(performance, 'now').mockReturnValue(0)
            PerformanceUtils.measurePerformance('op1', () => {})
            PerformanceUtils.measurePerformance('op2', () => {})
            tempPerfSpy.mockRestore()

            const stats = PerformanceUtils.getCacheStats()
            expect(stats.stepCacheSize).toBe(1)
            expect(stats.evaluationCacheSize).toBe(1)
            expect(stats.performanceMetricsCount).toBe(2)
        })
    })

    describe('hashContext (Indirect Testing)', () => {
        it('should produce different hashes for different flowData values', () => {
            const evaluator = vi.fn()
            PerformanceUtils.memoizeStepEvaluation('hashTest', { flowData: { keyA: 'value1' } }, evaluator)
            PerformanceUtils.memoizeStepEvaluation('hashTest', { flowData: { keyA: 'value2' } }, evaluator)
            expect(evaluator).toHaveBeenCalledTimes(2)
        })

        it('should produce different hashes for different flowData keys', () => {
            const evaluator = vi.fn()
            PerformanceUtils.memoizeStepEvaluation('hashTest2', { flowData: { keyA: 'value' } }, evaluator)
            PerformanceUtils.memoizeStepEvaluation('hashTest2', { flowData: { keyB: 'value' } }, evaluator)
            expect(evaluator).toHaveBeenCalledTimes(2)
        })

        it('hashContext should be INSENSITIVE to flowData key order due to key sorting', () => {
            const evaluator = vi.fn()
            const context1: TestContext = { flowData: { keyA: 'v1', keyB: 2 } }
            const context2: TestContext = { flowData: { keyB: 2, keyA: 'v1' } } // Same data, different key order in literal

            // Call with context1
            PerformanceUtils.memoizeStepEvaluation('hashTestOrderInsensitive', context1, evaluator)

            // Call with context2 - should be a cache hit because the sorted representation is the same
            PerformanceUtils.memoizeStepEvaluation('hashTestOrderInsensitive', context2, evaluator)

            // The evaluator should only be called ONCE because the generated hash is the same
            expect(evaluator).toHaveBeenCalledTimes(1)
        })
    })

    describe('batchOperations', () => {
        it('should execute all operations and return their results', () => {
            const operations = [vi.fn(() => 1), vi.fn(() => 2), vi.fn(() => 3)]
            const results = PerformanceUtils.batchOperations(operations, 2)
            expect(results).toEqual([1, 2, 3])
            operations.forEach((op) => expect(op).toHaveBeenCalledTimes(1))
        })
    })

    describe('getMemoryUsage', () => {
        it('should return estimated memory usage', () => {
            PerformanceUtils.findStepById(mockSteps, 's1')
            PerformanceUtils.memoizeStepEvaluation('eval1', { flowData: {} }, () => 'res')
            const tempPerfSpy = vi.spyOn(performance, 'now').mockReturnValue(0)
            PerformanceUtils.measurePerformance('op1', () => {})
            PerformanceUtils.measurePerformance('op1', () => {}) // 2 measurements for op1
            tempPerfSpy.mockRestore()

            const memoryUsage = PerformanceUtils.getMemoryUsage()
            expect(memoryUsage.cacheMemoryEstimate).toBe(1 * 1000 + 1 * 500)
            expect(memoryUsage.performanceMemoryEstimate).toBe(2 * 8)
        })
    })
})
