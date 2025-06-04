// src/engine/services/OperationQueue.ts
export interface QueuedOperation {
  id: string;
  operation: () => Promise<void>;
  priority: number;
  createdAt: number;
  resolve: () => void;
  reject: (error: unknown) => void;
}

export class OperationQueue {
  private queue: QueuedOperation[] = [];
  private isProcessing = false;
  private concurrency = 1;
  private activeOperations = 0;
  private operationCounter = 0;

  constructor(concurrency: number = 1) {
    this.concurrency = Math.max(1, concurrency);
  }

  async enqueue(
    operation: () => Promise<void>,
    priority: number = 0,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const queuedOperation: QueuedOperation = {
        id: `op_${++this.operationCounter}_${Date.now()}`,
        operation,
        priority,
        createdAt: Date.now(),
        resolve,
        reject,
      };

      // Insert based on priority (higher priority first)
      const insertIndex = this.queue.findIndex(
        (item) => item.priority < priority,
      );

      if (insertIndex === -1) {
        this.queue.push(queuedOperation);
      } else {
        this.queue.splice(insertIndex, 0, queuedOperation);
      }

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.activeOperations >= this.concurrency) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0 && this.activeOperations < this.concurrency) {
      const queuedOperation = this.queue.shift()!;
      this.executeOperation(queuedOperation);
    }

    this.isProcessing = false;
  }

  private async executeOperation(
    queuedOperation: QueuedOperation,
  ): Promise<void> {
    this.activeOperations++;

    try {
      await queuedOperation.operation();
      queuedOperation.resolve();
    } catch (error) {
      queuedOperation.reject(error);
    } finally {
      this.activeOperations--;
      // Continue processing if there are more operations
      if (this.queue.length > 0) {
        this.processQueue();
      }
    }
  }

  // High-priority operation that jumps to the front
  async enqueueUrgent(operation: () => Promise<void>): Promise<void> {
    return this.enqueue(operation, Number.MAX_SAFE_INTEGER);
  }

  // Get queue statistics
  getStats(): {
    queueLength: number;
    activeOperations: number;
    isProcessing: boolean;
    oldestOperationAge: number | null;
  } {
    const oldestOperation = this.queue[this.queue.length - 1];
    const oldestOperationAge = oldestOperation
      ? Date.now() - oldestOperation.createdAt
      : null;

    return {
      queueLength: this.queue.length,
      activeOperations: this.activeOperations,
      isProcessing: this.isProcessing,
      oldestOperationAge,
    };
  }

  // Clear all pending operations
  clear(): void {
    const pendingOperations = [...this.queue];
    this.queue = [];

    // Reject all pending operations
    pendingOperations.forEach((op) => {
      op.reject(new Error("Operation queue cleared"));
    });
  }

  // Wait for all operations to complete
  async drain(): Promise<void> {
    while (this.queue.length > 0 || this.activeOperations > 0) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  // Set concurrency level
  setConcurrency(concurrency: number): void {
    this.concurrency = Math.max(1, concurrency);
    if (this.concurrency > this.activeOperations) {
      this.processQueue();
    }
  }

  // Remove operations by ID or filter
  removeOperations(filter: (op: QueuedOperation) => boolean): number {
    const initialLength = this.queue.length;
    const removedOperations: QueuedOperation[] = [];

    this.queue = this.queue.filter((op) => {
      if (filter(op)) {
        removedOperations.push(op);
        return false;
      }
      return true;
    });

    // Reject removed operations
    removedOperations.forEach((op) => {
      op.reject(new Error("Operation removed from queue"));
    });

    return initialLength - this.queue.length;
  }

  // Get operations by priority
  getOperationsByPriority(priority: number): QueuedOperation[] {
    return this.queue.filter((op) => op.priority === priority);
  }

  // Pause queue processing
  pause(): void {
    this.isProcessing = true; // This prevents new operations from starting
  }

  // Resume queue processing
  resume(): void {
    this.isProcessing = false;
    this.processQueue();
  }
}
