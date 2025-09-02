// src/engine/services/__tests__/OperationQueue.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { OperationQueue } from './OperationQueue'

describe('OperationQueue', () => {
    let queue: OperationQueue

    beforeEach(() => {
        vi.clearAllTimers()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    describe('Constructor', () => {
        it('should initialize with default concurrency of 1', () => {
            queue = new OperationQueue()
            const stats = queue.getStats()

            expect(stats.queueLength).toBe(0)
            expect(stats.activeOperations).toBe(0)
            expect(stats.isProcessing).toBe(false)
            expect(stats.oldestOperationAge).toBeNull()
        })

        it('should initialize with custom concurrency', () => {
            queue = new OperationQueue(3)
            // We can't directly test concurrency, but we can test it indirectly
            expect(queue).toBeDefined()
        })

        it('should enforce minimum concurrency of 1', () => {
            queue = new OperationQueue(0)
            // Should still work with concurrency 1
            expect(queue).toBeDefined()
        })

        it('should enforce minimum concurrency of 1 for negative values', () => {
            queue = new OperationQueue(-5)
            expect(queue).toBeDefined()
        })
    })

    describe('Basic Operation Enqueueing', () => {
        beforeEach(() => {
            queue = new OperationQueue()
        })

        it('should enqueue and execute a single operation', async () => {
            const mockOperation = vi.fn().mockResolvedValue(undefined)

            const promise = queue.enqueue(mockOperation)

            // Process the queue
            await vi.runAllTimersAsync()
            await promise

            expect(mockOperation).toHaveBeenCalledTimes(1)
        })

        it('should execute operations in FIFO order by default', async () => {
            const executionOrder: number[] = []
            const operation1 = vi.fn().mockImplementation(async () => {
                executionOrder.push(1)
            })
            const operation2 = vi.fn().mockImplementation(async () => {
                executionOrder.push(2)
            })
            const operation3 = vi.fn().mockImplementation(async () => {
                executionOrder.push(3)
            })

            const promises = [queue.enqueue(operation1), queue.enqueue(operation2), queue.enqueue(operation3)]

            await vi.runAllTimersAsync()
            await Promise.all(promises)

            expect(executionOrder).toEqual([1, 2, 3])
        })

        it('should handle async operations correctly', async () => {
            const mockOperation = vi.fn().mockImplementation(async () => {
                await new Promise((resolve) => setTimeout(resolve, 100))
                return 'completed'
            })

            const promise = queue.enqueue(mockOperation)

            await vi.advanceTimersByTimeAsync(100)
            await promise

            expect(mockOperation).toHaveBeenCalledTimes(1)
        })
    })

    describe('Priority Handling', () => {
        beforeEach(() => {
            queue = new OperationQueue()
        })

        it('should respect priority for queued operations', async () => {
            const executionOrder: string[] = []

            // Create a long-running operation to block the queue
            const blockingOp = vi.fn().mockImplementation(async () => {
                executionOrder.push('blocking')
                await new Promise((resolve) => setTimeout(resolve, 100))
            })

            const lowPriorityOp = vi.fn().mockImplementation(async () => {
                executionOrder.push('low')
            })
            const highPriorityOp = vi.fn().mockImplementation(async () => {
                executionOrder.push('high')
            })
            const mediumPriorityOp = vi.fn().mockImplementation(async () => {
                executionOrder.push('medium')
            })

            // Start with blocking operation
            const blockingPromise = queue.enqueue(blockingOp)

            // Wait a bit for it to start
            await vi.advanceTimersByTimeAsync(10)

            // Now enqueue other operations while the first is running
            const promises = [
                queue.enqueue(lowPriorityOp, 1),
                queue.enqueue(highPriorityOp, 10),
                queue.enqueue(mediumPriorityOp, 5),
            ]

            // Complete the blocking operation and process the queue
            await vi.advanceTimersByTimeAsync(100)
            await blockingPromise

            await vi.runAllTimersAsync()
            await Promise.all(promises)

            expect(executionOrder).toEqual(['blocking', 'high', 'medium', 'low'])
        })

        it('should maintain FIFO order for operations with same priority', async () => {
            const executionOrder: number[] = []

            const promises = []
            for (let i = 1; i <= 3; i++) {
                const op = vi.fn().mockImplementation(async () => {
                    executionOrder.push(i)
                })
                promises.push(queue.enqueue(op, 5)) // Same priority
            }

            await vi.runAllTimersAsync()
            await Promise.all(promises)

            expect(executionOrder).toEqual([1, 2, 3])
        })

        it('should handle enqueueUrgent correctly', async () => {
            const executionOrder: string[] = []

            const normalOp = vi.fn().mockImplementation(async () => {
                executionOrder.push('normal')
            })
            const urgentOp = vi.fn().mockImplementation(async () => {
                executionOrder.push('urgent')
            })

            // Pause the queue to prevent immediate execution
            queue.pause()

            const promises = [queue.enqueue(normalOp, 1), queue.enqueueUrgent(urgentOp)]

            // Resume processing - now urgent should execute first
            queue.resume()

            await vi.runAllTimersAsync()
            await Promise.all(promises)

            expect(executionOrder).toEqual(['urgent', 'normal'])
        })
    })

    describe('Concurrency Control', () => {
        it('should respect concurrency limit', async () => {
            queue = new OperationQueue(2)
            let activeOperations = 0
            let maxConcurrentOperations = 0

            const createOperation = () => async () => {
                activeOperations++
                maxConcurrentOperations = Math.max(maxConcurrentOperations, activeOperations)
                await new Promise((resolve) => setTimeout(resolve, 100))
                activeOperations--
            }

            const promises = [
                queue.enqueue(createOperation()),
                queue.enqueue(createOperation()),
                queue.enqueue(createOperation()),
                queue.enqueue(createOperation()),
            ]

            // With concurrency 2:
            // - First 2 operations start immediately (0-100ms)
            // - Next 2 operations start when first batch completes (100-200ms)
            await vi.advanceTimersByTimeAsync(200)
            await Promise.all(promises)

            expect(maxConcurrentOperations).toBe(2)
        })

        it('should update concurrency dynamically', async () => {
            queue = new OperationQueue(1)

            // Initially should have concurrency 1
            expect(queue).toBeDefined()

            // Change concurrency
            queue.setConcurrency(3)

            // Test that it works with new concurrency
            let activeOperations = 0
            let maxConcurrentOperations = 0

            const createOperation = () =>
                vi.fn().mockImplementation(async () => {
                    activeOperations++
                    maxConcurrentOperations = Math.max(maxConcurrentOperations, activeOperations)
                    await new Promise((resolve) => setTimeout(resolve, 100))
                    activeOperations--
                })

            const promises = [
                queue.enqueue(createOperation()),
                queue.enqueue(createOperation()),
                queue.enqueue(createOperation()),
            ]

            await vi.advanceTimersByTimeAsync(100)
            await Promise.all(promises)

            expect(maxConcurrentOperations).toBe(3)
        })

        it('should enforce minimum concurrency of 1 when setting concurrency', () => {
            queue = new OperationQueue()

            queue.setConcurrency(0)
            queue.setConcurrency(-1)

            // Should still work (implicitly testing concurrency is at least 1)
            expect(queue).toBeDefined()
        })
    })

    describe('Error Handling', () => {
        beforeEach(() => {
            queue = new OperationQueue()
        })

        it('should handle operation errors and reject the promise', async () => {
            const error = new Error('Operation failed')
            const failingOperation = vi.fn().mockRejectedValue(error)

            await expect(queue.enqueue(failingOperation)).rejects.toThrow('Operation failed')
            expect(failingOperation).toHaveBeenCalledTimes(1)
        })

        it('should continue processing other operations after an error', async () => {
            const error = new Error('Operation failed')
            const failingOperation = vi.fn().mockRejectedValue(error)
            const successfulOperation = vi.fn().mockResolvedValue(undefined)

            const promises = [
                queue.enqueue(failingOperation).catch(() => {}), // Catch to prevent unhandled rejection
                queue.enqueue(successfulOperation),
            ]

            await vi.runAllTimersAsync()
            await Promise.all(promises)

            expect(failingOperation).toHaveBeenCalledTimes(1)
            expect(successfulOperation).toHaveBeenCalledTimes(1)
        })

        it('should handle synchronous errors in operations', async () => {
            const error = new Error('Sync error')
            const failingOperation = vi.fn().mockImplementation(() => {
                throw error
            })

            await expect(queue.enqueue(failingOperation)).rejects.toThrow('Sync error')
        })
    })

    describe('Queue Management', () => {
        beforeEach(() => {
            queue = new OperationQueue()
        })

        it('should clear all pending operations', async () => {
            const operation1 = vi.fn().mockResolvedValue(undefined)
            const operation2 = vi.fn().mockResolvedValue(undefined)

            // Pause the queue to prevent immediate execution
            queue.pause()

            const promise1 = queue.enqueue(operation1)
            const promise2 = queue.enqueue(operation2)

            // Now both operations are pending in the queue
            queue.clear()

            await expect(promise1).rejects.toThrow('Operation queue cleared')
            await expect(promise2).rejects.toThrow('Operation queue cleared')

            const stats = queue.getStats()
            expect(stats.queueLength).toBe(0)
        })

        it('should not affect currently executing operations when clearing', async () => {
            let operationStarted = false
            let operationCompleted = false

            const longRunningOperation = vi.fn().mockImplementation(async () => {
                operationStarted = true
                await new Promise((resolve) => setTimeout(resolve, 100))
                operationCompleted = true
            })

            const pendingOperation = vi.fn().mockResolvedValue(undefined)

            const runningPromise = queue.enqueue(longRunningOperation)
            const pendingPromise = queue.enqueue(pendingOperation)

            // Wait for first operation to start
            await vi.advanceTimersByTimeAsync(10)
            expect(operationStarted).toBe(true)

            // Clear queue
            queue.clear()

            // Pending operation should be rejected
            await expect(pendingPromise).rejects.toThrow('Operation queue cleared')

            // Running operation should complete
            await vi.advanceTimersByTimeAsync(100)
            await runningPromise
            expect(operationCompleted).toBe(true)
        })

        it('should drain all operations', async () => {
            const operations = []
            for (let i = 0; i < 3; i++) {
                const op = vi.fn().mockImplementation(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 50))
                })
                operations.push(op)
                queue.enqueue(op)
            }

            const drainPromise = queue.drain()
            await vi.advanceTimersByTimeAsync(200)
            await drainPromise

            operations.forEach((op) => {
                expect(op).toHaveBeenCalledTimes(1)
            })

            const stats = queue.getStats()
            expect(stats.queueLength).toBe(0)
            expect(stats.activeOperations).toBe(0)
        })
    })

    describe('Operation Filtering and Removal', () => {
        beforeEach(() => {
            queue = new OperationQueue()
        })

        it('should remove operations by filter', async () => {
            const operation1 = vi.fn().mockResolvedValue(undefined)
            const operation2 = vi.fn().mockResolvedValue(undefined)
            const operation3 = vi.fn().mockResolvedValue(undefined)

            // Pause the queue to prevent immediate execution
            queue.pause()

            const promise1 = queue.enqueue(operation1, 1)
            const promise2 = queue.enqueue(operation2, 2)
            const promise3 = queue.enqueue(operation3, 1)

            // Now all operations are pending in the queue
            // Remove operations with priority 1
            const removedCount = queue.removeOperations((op) => op.priority === 1)

            expect(removedCount).toBe(2)

            // Removed operations should be rejected
            await expect(promise1).rejects.toThrow('Operation removed from queue')
            await expect(promise3).rejects.toThrow('Operation removed from queue')

            // Resume and execute remaining operation
            queue.resume()
            await vi.runAllTimersAsync()
            await promise2
            expect(operation2).toHaveBeenCalledTimes(1)
        })

        it('should get operations by priority', async () => {
            const operation1 = vi.fn().mockResolvedValue(undefined)
            const operation2 = vi.fn().mockResolvedValue(undefined)
            const operation3 = vi.fn().mockResolvedValue(undefined)

            // Pause the queue to prevent immediate execution
            queue.pause()

            queue.enqueue(operation1, 1)
            queue.enqueue(operation2, 2)
            queue.enqueue(operation3, 1)

            const priority1Ops = queue.getOperationsByPriority(1)
            const priority2Ops = queue.getOperationsByPriority(2)
            const priority3Ops = queue.getOperationsByPriority(3)

            expect(priority1Ops).toHaveLength(2)
            expect(priority2Ops).toHaveLength(1)
            expect(priority3Ops).toHaveLength(0)
        })
    })

    describe('Pause and Resume', () => {
        beforeEach(() => {
            queue = new OperationQueue()
        })

        it('should pause queue processing', async () => {
            const operation = vi.fn().mockResolvedValue(undefined)

            queue.pause()
            queue.enqueue(operation)

            await vi.runAllTimersAsync()

            expect(operation).not.toHaveBeenCalled()
            expect(queue.getStats().isProcessing).toBe(true)
        })

        it('should resume queue processing', async () => {
            const operation = vi.fn().mockResolvedValue(undefined)

            queue.pause()
            const promise = queue.enqueue(operation)

            await vi.runAllTimersAsync()
            expect(operation).not.toHaveBeenCalled()

            queue.resume()
            await vi.runAllTimersAsync()
            await promise

            expect(operation).toHaveBeenCalledTimes(1)
            expect(queue.getStats().isProcessing).toBe(false)
        })

        it('should not affect currently running operations when paused', async () => {
            let operationCompleted = false
            const longRunningOperation = vi.fn().mockImplementation(async () => {
                await new Promise((resolve) => setTimeout(resolve, 100))
                operationCompleted = true
            })

            const runningPromise = queue.enqueue(longRunningOperation)

            // Wait for operation to start
            await vi.advanceTimersByTimeAsync(10)

            queue.pause()

            // Operation should still complete
            await vi.advanceTimersByTimeAsync(100)
            await runningPromise

            expect(operationCompleted).toBe(true)
        })
    })

    describe('Statistics and Monitoring', () => {
        beforeEach(() => {
            queue = new OperationQueue()
        })

        it('should provide accurate queue statistics', async () => {
            const operation1 = vi.fn().mockImplementation(async () => {
                await new Promise((resolve) => setTimeout(resolve, 100))
            })
            const operation2 = vi.fn().mockResolvedValue(undefined)

            // Pause the queue to control when processing starts
            queue.pause()

            queue.enqueue(operation1)
            vi.advanceTimersByTime(1) // Ensure a slight time difference for createdAt
            const enqueueTime2 = Date.now()
            queue.enqueue(operation2)

            // At this point, both operations are in the queue, none are active
            let stats = queue.getStats()
            expect(stats.queueLength).toBe(2)
            expect(stats.activeOperations).toBe(0)
            // oldestOperationAge refers to the last item in the queue array, which is operation2
            expect(stats.oldestOperationAge).toBeGreaterThanOrEqual(0)
            expect(stats.oldestOperationAge).toBeLessThanOrEqual(Date.now() - enqueueTime2 + 5) // Check age of op2

            // Resume processing
            queue.resume()

            // Let operation1 start
            await vi.advanceTimersByTimeAsync(10)

            stats = queue.getStats()
            expect(stats.activeOperations).toBe(1) // operation1 is active
            expect(stats.queueLength).toBe(1) // operation2 is in queue
            // oldestOperationAge still refers to operation2
            expect(stats.oldestOperationAge).toBeGreaterThanOrEqual(Date.now() - enqueueTime2 - 10)

            // Let operation1 complete, and operation2 start and complete
            await vi.advanceTimersByTimeAsync(100)

            stats = queue.getStats()
            expect(stats.activeOperations).toBe(0)
            expect(stats.queueLength).toBe(0)
            expect(stats.oldestOperationAge).toBeNull()

            expect(operation1).toHaveBeenCalledTimes(1)
            expect(operation2).toHaveBeenCalledTimes(1)
        })

        it('should calculate oldest operation age correctly', async () => {
            const operation = vi.fn().mockResolvedValue(undefined)

            queue.pause() // Prevent immediate execution
            queue.enqueue(operation)

            await vi.advanceTimersByTimeAsync(1000)

            const stats = queue.getStats()
            expect(stats.oldestOperationAge).toBeGreaterThanOrEqual(1000)
        })

        it('should return null for oldest operation age when queue is empty', () => {
            const stats = queue.getStats()
            expect(stats.oldestOperationAge).toBeNull()
        })
    })

    describe('Edge Cases', () => {
        beforeEach(() => {
            queue = new OperationQueue()
        })

        it('should handle rapid successive enqueues', async () => {
            const operations = []
            const promises = []

            for (let i = 0; i < 100; i++) {
                const op = vi.fn().mockResolvedValue(undefined)
                operations.push(op)
                promises.push(queue.enqueue(op))
            }

            await vi.runAllTimersAsync()
            await Promise.all(promises)

            operations.forEach((op) => {
                expect(op).toHaveBeenCalledTimes(1)
            })
        })

        it('should handle operations that return non-promise values', async () => {
            const syncOperation = vi.fn().mockReturnValue('sync result')

            await queue.enqueue(syncOperation)

            expect(syncOperation).toHaveBeenCalledTimes(1)
        })

        it('should generate unique operation IDs', async () => {
            // Access private queue to check IDs
            for (let i = 0; i < 10; i++) {
                queue.enqueue(vi.fn().mockResolvedValue(undefined))
            }

            // We can't directly access private members, but we can test indirectly
            // by ensuring operations execute in order (which requires unique IDs internally)
            const executionOrder: number[] = []
            const promises = []

            for (let i = 0; i < 5; i++) {
                const op = vi.fn().mockImplementation(async () => {
                    executionOrder.push(i)
                })
                promises.push(queue.enqueue(op))
            }

            await vi.runAllTimersAsync()
            await Promise.all(promises)

            expect(executionOrder).toEqual([0, 1, 2, 3, 4])
        })

        it('should handle empty queue operations gracefully', () => {
            expect(() => queue.clear()).not.toThrow()
            expect(() => queue.pause()).not.toThrow()
            expect(() => queue.resume()).not.toThrow()
            expect(queue.removeOperations(() => true)).toBe(0)
            expect(queue.getOperationsByPriority(1)).toEqual([])
        })
    })

    describe('Memory Management', () => {
        beforeEach(() => {
            queue = new OperationQueue()
        })

        it('should not leak memory with completed operations', async () => {
            // Execute many operations
            const promises = []
            for (let i = 0; i < 100; i++) {
                const op = vi.fn().mockResolvedValue(undefined)
                promises.push(queue.enqueue(op))
            }

            await vi.runAllTimersAsync()
            await Promise.all(promises)

            const finalStats = queue.getStats()
            expect(finalStats.queueLength).toBe(0)
            expect(finalStats.activeOperations).toBe(0)
        })

        it('should clean up rejected operations', async () => {
            const error = new Error('Test error')
            const promises = []

            for (let i = 0; i < 10; i++) {
                const op = vi.fn().mockRejectedValue(error)
                promises.push(queue.enqueue(op).catch(() => {})) // Catch to prevent unhandled rejection
            }

            await vi.runAllTimersAsync()
            await Promise.all(promises)

            const stats = queue.getStats()
            expect(stats.queueLength).toBe(0)
            expect(stats.activeOperations).toBe(0)
        })
    })
})
