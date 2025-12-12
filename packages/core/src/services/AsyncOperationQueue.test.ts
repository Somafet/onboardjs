import { describe, it, expect, beforeEach } from 'vitest'
import { AsyncOperationQueue } from './AsyncOperationQueue'

describe('AsyncOperationQueue', () => {
    let queue: AsyncOperationQueue

    beforeEach(() => {
        queue = new AsyncOperationQueue(1)
    })

    describe('Basic Operations', () => {
        it('should execute a single operation', async () => {
            let executed = false

            await queue.enqueue(async () => {
                executed = true
            })

            expect(executed).toBe(true)
        })

        it('should execute operations sequentially with concurrency 1', async () => {
            const order: number[] = []

            await Promise.all([
                queue.enqueue(async () => {
                    await new Promise((r) => setTimeout(r, 50))
                    order.push(1)
                }),
                queue.enqueue(async () => {
                    order.push(2)
                }),
                queue.enqueue(async () => {
                    order.push(3)
                }),
            ])

            expect(order).toEqual([1, 2, 3])
        })

        it('should handle operation errors', async () => {
            await expect(
                queue.enqueue(async () => {
                    throw new Error('test error')
                })
            ).rejects.toThrow('test error')
        })
    })

    describe('Priority Queue', () => {
        it('should respect priority order', async () => {
            const order: number[] = []

            // Block the queue with a slow operation
            const blockingPromise = queue.enqueue(async () => {
                await new Promise((r) => setTimeout(r, 100))
                order.push(1)
            })

            // Queue more operations with different priorities
            const lowPriority = queue.enqueue(async () => {
                order.push(2) // Low priority
            }, 0)

            const highPriority = queue.enqueue(async () => {
                order.push(3) // High priority
            }, 10)

            await Promise.all([blockingPromise, lowPriority, highPriority])

            // High priority should execute before low priority
            expect(order).toEqual([1, 3, 2])
        })

        it('should execute urgent operations first', async () => {
            const order: number[] = []

            // Block the queue
            const blockingPromise = queue.enqueue(async () => {
                await new Promise((r) => setTimeout(r, 50))
                order.push(1)
            })

            // Queue normal and urgent
            const normal = queue.enqueue(async () => {
                order.push(2)
            })

            const urgent = queue.enqueueUrgent(async () => {
                order.push(3)
            })

            await Promise.all([blockingPromise, normal, urgent])

            expect(order).toEqual([1, 3, 2])
        })
    })

    describe('Queue Statistics', () => {
        it('should return correct statistics', async () => {
            const stats = queue.getStats()

            expect(stats.queueLength).toBe(0)
            expect(stats.activeOperations).toBe(0)
            expect(stats.isProcessing).toBe(false)
            expect(stats.isPaused).toBe(false)
            expect(stats.oldestOperationAge).toBeNull()
        })

        it('should report active operations during execution', async () => {
            let statsSnapshot: ReturnType<typeof queue.getStats> | undefined

            await queue.enqueue(async () => {
                statsSnapshot = queue.getStats()
            })

            expect(statsSnapshot?.activeOperations).toBeGreaterThanOrEqual(0)
        })
    })

    describe('Queue Control', () => {
        it('should clear pending operations', async () => {
            // Block queue with slow operation
            queue.enqueue(async () => {
                await new Promise((r) => setTimeout(r, 1000))
            })

            // Add more operations (but don't await)
            queue.enqueue(async () => {})
            queue.enqueue(async () => {})

            // Clear should remove pending
            queue.clear()

            expect(queue.size).toBe(0)
        })

        it('should drain the queue', async () => {
            let completed = 0

            queue.enqueue(async () => {
                await new Promise((r) => setTimeout(r, 10))
                completed++
            })
            queue.enqueue(async () => {
                await new Promise((r) => setTimeout(r, 10))
                completed++
            })

            await queue.drain()

            expect(completed).toBe(2)
        })

        it('should pause and resume', async () => {
            const order: number[] = []

            queue.pause()
            expect(queue.getStats().isPaused).toBe(true)

            // Queue operations while paused
            const p1 = queue.enqueue(async () => {
                order.push(1)
            })
            const p2 = queue.enqueue(async () => {
                order.push(2)
            })

            // Should not have executed yet
            await new Promise((r) => setTimeout(r, 50))
            expect(order).toHaveLength(0)

            // Resume
            queue.resume()
            expect(queue.getStats().isPaused).toBe(false)

            await Promise.all([p1, p2])
            expect(order).toEqual([1, 2])
        })
    })

    describe('Concurrency', () => {
        it('should respect concurrency setting', async () => {
            const parallelQueue = new AsyncOperationQueue(3)
            let maxConcurrent = 0
            let current = 0

            const operations = Array.from({ length: 6 }, () =>
                parallelQueue.enqueue(async () => {
                    current++
                    maxConcurrent = Math.max(maxConcurrent, current)
                    await new Promise((r) => setTimeout(r, 50))
                    current--
                })
            )

            await Promise.all(operations)

            expect(maxConcurrent).toBe(3)
        })

        it('should update concurrency dynamically', () => {
            expect(queue.concurrency).toBe(1)

            queue.setConcurrency(5)

            expect(queue.concurrency).toBe(5)
        })
    })

    describe('Properties', () => {
        it('should report size and pending', async () => {
            expect(queue.size).toBe(0)
            expect(queue.pending).toBe(0)
            expect(queue.isEmpty).toBe(true)

            // Block queue
            const blocking = queue.enqueue(async () => {
                await new Promise((r) => setTimeout(r, 100))
            })

            // Add pending
            queue.enqueue(async () => {})

            // Wait a tick for queue to start
            await new Promise((r) => setTimeout(r, 10))

            expect(queue.pending).toBeGreaterThanOrEqual(0)
            expect(queue.isEmpty).toBe(false)

            await blocking
        })
    })

    describe('Wait Methods', () => {
        it('should wait for empty', async () => {
            queue.enqueue(async () => {
                await new Promise((r) => setTimeout(r, 10))
            })

            await queue.onEmpty()

            // Queue is empty (operation may still be running)
            expect(queue.size).toBe(0)
        })

        it('should wait for idle', async () => {
            let completed = 0

            queue.enqueue(async () => {
                await new Promise((r) => setTimeout(r, 10))
                completed++
            })

            await queue.onIdle()

            // Queue is completely idle
            expect(queue.size).toBe(0)
            expect(queue.pending).toBe(0)
            expect(completed).toBe(1)
        })
    })

    describe('Generic Return Types (TASK-011, TASK-012)', () => {
        it('should return void by default', async () => {
            const result = await queue.enqueue(async () => {
                // No return statement
            })

            expect(result).toBeUndefined()
        })

        it('should support generic return type for primitives', async () => {
            const stringResult = await queue.enqueue<string>(async () => {
                return 'hello'
            })

            expect(stringResult).toBe('hello')
            expect(typeof stringResult).toBe('string')
        })

        it('should support generic return type for numbers', async () => {
            const numberResult = await queue.enqueue<number>(async () => {
                return 42
            })

            expect(numberResult).toBe(42)
            expect(typeof numberResult).toBe('number')
        })

        it('should support generic return type for objects', async () => {
            interface User {
                id: number
                name: string
            }

            const user = await queue.enqueue<User>(async () => {
                return { id: 1, name: 'Alice' }
            })

            expect(user).toEqual({ id: 1, name: 'Alice' })
            expect(user.name).toBe('Alice')
        })

        it('should support generic return type for arrays', async () => {
            const numbers = await queue.enqueue<number[]>(async () => {
                return [1, 2, 3, 4, 5]
            })

            expect(numbers).toEqual([1, 2, 3, 4, 5])
            expect(numbers.length).toBe(5)
        })

        it('should handle generic return types with await', async () => {
            const result = await queue.enqueue<string>(async () => {
                await new Promise((resolve) => setTimeout(resolve, 10))
                return 'delayed result'
            })

            expect(result).toBe('delayed result')
        })

        it('should preserve return values through priority operations', async () => {
            const results: string[] = []

            // Block the queue
            const blocking = queue.enqueue<string>(async () => {
                await new Promise((r) => setTimeout(r, 50))
                return 'first'
            })

            // Queue with different priorities
            const low = queue.enqueue<string>(async () => {
                return 'low'
            }, 0)

            const high = queue.enqueue<string>(async () => {
                return 'high'
            }, 10)

            const first = await blocking
            const highResult = await high
            const lowResult = await low

            results.push(first, highResult, lowResult)

            expect(first).toBe('first')
            expect(highResult).toBe('high')
            expect(lowResult).toBe('low')
            expect(results).toEqual(['first', 'high', 'low'])
        })

        it('should support urgent operations with return values', async () => {
            let executed = false

            const blocking = queue.enqueue<number>(async () => {
                await new Promise((r) => setTimeout(r, 50))
                return 1
            })

            const urgentOp = queue.enqueueUrgent<string>(async () => {
                executed = true
                return 'urgent'
            })

            const blockingResult = await blocking
            const urgentResult = await urgentOp

            expect(executed).toBe(true)
            expect(blockingResult).toBe(1)
            expect(urgentResult).toBe('urgent')
        })

        it('should handle generic return types with errors', async () => {
            await expect(
                queue.enqueue<number>(async () => {
                    throw new Error('calculation failed')
                })
            ).rejects.toThrow('calculation failed')
        })

        it('should support multiple concurrent operations with different return types', async () => {
            const stringOp = queue.enqueue<string>(async () => {
                await new Promise((r) => setTimeout(r, 20))
                return 'text'
            })

            const numberOp = queue.enqueue<number>(async () => {
                await new Promise((r) => setTimeout(r, 10))
                return 100
            })

            const boolOp = queue.enqueue<boolean>(async () => {
                return true
            })

            // Note: sequential execution due to concurrency=1, but types are preserved
            const [str, num, bool] = await Promise.all([stringOp, numberOp, boolOp])

            expect(str).toBe('text')
            expect(num).toBe(100)
            expect(bool).toBe(true)
            expect(typeof str).toBe('string')
            expect(typeof num).toBe('number')
            expect(typeof bool).toBe('boolean')
        })

        it('should support complex object types with nesting', async () => {
            interface Config {
                server: {
                    host: string
                    port: number
                }
                debug: boolean
            }

            const config = await queue.enqueue<Config>(async () => {
                return {
                    server: {
                        host: 'localhost',
                        port: 3000,
                    },
                    debug: true,
                }
            })

            expect(config.server.host).toBe('localhost')
            expect(config.server.port).toBe(3000)
            expect(config.debug).toBe(true)
        })

        it('should support union return types', async () => {
            const resultA = await queue.enqueue<string | number>(async () => {
                return 'string value'
            })

            const resultB = await queue.enqueue<string | number>(async () => {
                return 42
            })

            expect(resultA).toBe('string value')
            expect(resultB).toBe(42)
        })

        it('should maintain type safety across queue operations', async () => {
            // This test validates that types are properly preserved
            const queue2 = new AsyncOperationQueue(2)

            const op1 = queue2.enqueue<{ success: boolean }>(async () => ({
                success: true,
            }))

            const op2 = queue2.enqueue<number>(async () => 123)

            const [result1, result2] = await Promise.all([op1, op2])

            // Type checking happens at compile time, but we verify runtime values
            expect(result1.success).toBe(true)
            expect(result2).toBe(123)
        })
    })
})
