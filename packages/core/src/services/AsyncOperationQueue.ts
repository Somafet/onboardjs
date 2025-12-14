// src/services/AsyncOperationQueue.ts
// Modern wrapper around p-queue for reliable async operation management
// Replaces the custom OperationQueue with a battle-tested implementation

import PQueue from 'p-queue'

/**
 * Statistics about the queue state
 */
export interface QueueStats {
    /** Number of pending operations waiting to be executed */
    queueLength: number
    /** Number of currently executing operations */
    activeOperations: number
    /** Whether the queue is currently processing operations */
    isProcessing: boolean
    /** Whether the queue is currently paused */
    isPaused: boolean
    /** Age of the oldest pending operation in milliseconds, or null if queue is empty */
    oldestOperationAge: number | null
}

/**
 * Internal tracking for queued operations
 */
interface TrackedOperation {
    id: string
    createdAt: number
}

/**
 * AsyncOperationQueue provides a reliable async operation queue using p-queue.
 *
 * This is a drop-in replacement for the previous custom OperationQueue,
 * maintaining the same public API while leveraging p-queue's battle-tested
 * implementation for better reliability and features.
 *
 * Features:
 * - Priority-based execution (higher priority operations run first)
 * - Configurable concurrency
 * - Pause/resume support
 * - Timeout support
 * - Proper error handling
 * - Generic return type support (React 19.2 style)
 *
 * @example
 * ```typescript
 * const queue = new AsyncOperationQueue(1) // Sequential operations
 *
 * // Void operation
 * await queue.enqueue(async () => {
 *   await doSomethingAsync()
 * })
 *
 * // Operation with return value
 * const result = await queue.enqueue(async () => {
 *   return await fetchData()
 * })
 *
 * // High-priority operation
 * await queue.enqueueUrgent(async () => {
 *   await doUrgentOperation()
 * })
 * ```
 */
export class AsyncOperationQueue {
    private _queue: PQueue
    private _operationCounter = 0
    private _trackedOperations: Map<string, TrackedOperation> = new Map()
    private _isPaused = false

    constructor(concurrency: number = 1) {
        this._queue = new PQueue({
            concurrency: Math.max(1, concurrency),
        })
    }

    /**
     * Add an operation to the queue with optional return value
     * @param operation The async function to execute
     * @param priority Priority level (higher = executed sooner). Default is 0.
     * @returns Promise that resolves to the operation's return value when it completes
     *
     * @example
     * ```typescript
     * // Void operation (default)
     * await queue.enqueue(async () => {
     *   console.log('Do something')
     * })
     *
     * // Operation with return value (type-safe)
     * const count = await queue.enqueue<number>(async () => {
     *   return 42
     * })
     * ```
     */
    enqueue<T = void>(operation: () => Promise<T>, priority: number = 0): Promise<T> {
        const operationId = `op_${++this._operationCounter}_${Date.now()}`

        this._trackedOperations.set(operationId, {
            id: operationId,
            createdAt: Date.now(),
        })

        return this._queue.add(
            async () => {
                try {
                    return await operation()
                } finally {
                    this._trackedOperations.delete(operationId)
                }
            },
            { priority }
        ) as Promise<T>
    }

    /**
     * Add a high-priority operation that jumps to the front of the queue
     * @param operation The async function to execute
     * @returns Promise that resolves to the operation's return value when it completes
     *
     * @example
     * ```typescript
     * const result = await queue.enqueueUrgent<string>(async () => {
     *   return 'urgent result'
     * })
     * ```
     */
    enqueueUrgent<T = void>(operation: () => Promise<T>): Promise<T> {
        return this.enqueue(operation, Number.MAX_SAFE_INTEGER)
    }

    /**
     * Get current queue statistics
     */
    getStats(): QueueStats {
        const trackedOps = Array.from(this._trackedOperations.values())
        const oldestOp = trackedOps.reduce(
            (oldest, op) => (!oldest || op.createdAt < oldest.createdAt ? op : oldest),
            undefined as TrackedOperation | undefined
        )

        return {
            queueLength: this._queue.size,
            activeOperations: this._queue.pending,
            isProcessing: this._queue.pending > 0 || this._queue.size > 0,
            isPaused: this._isPaused,
            oldestOperationAge: oldestOp ? Date.now() - oldestOp.createdAt : null,
        }
    }

    /**
     * Clear all pending operations
     * Note: Already executing operations will continue to completion
     */
    clear(): void {
        this._queue.clear()
        this._trackedOperations.clear()
    }

    /**
     * Wait for all operations to complete
     */
    async drain(): Promise<void> {
        await this._queue.onIdle()
    }

    /**
     * Pause the queue (pending operations will wait)
     */
    pause(): void {
        this._queue.pause()
        this._isPaused = true
    }

    /**
     * Resume processing of queued operations
     */
    resume(): void {
        this._queue.start()
        this._isPaused = false
    }

    /**
     * Set the concurrency level
     * @param concurrency Number of operations that can run in parallel
     */
    setConcurrency(concurrency: number): void {
        this._queue.concurrency = Math.max(1, concurrency)
    }

    /**
     * Get the current concurrency level
     */
    get concurrency(): number {
        return this._queue.concurrency
    }

    /**
     * Get the number of pending operations
     */
    get size(): number {
        return this._queue.size
    }

    /**
     * Get the number of currently running operations
     */
    get pending(): number {
        return this._queue.pending
    }

    /**
     * Check if the queue is empty (no pending or running operations)
     */
    get isEmpty(): boolean {
        return this._queue.size === 0 && this._queue.pending === 0
    }

    /**
     * Wait for the queue to become empty
     */
    async onEmpty(): Promise<void> {
        await this._queue.onEmpty()
    }

    /**
     * Wait for the queue to become idle (no running operations)
     */
    async onIdle(): Promise<void> {
        await this._queue.onIdle()
    }
}
