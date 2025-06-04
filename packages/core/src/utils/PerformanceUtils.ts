// src/engine/utils/PerformanceUtils.ts

import { OnboardingStep, OnboardingContext } from "../types";

export class PerformanceUtils {
  // Memoization cache
  private static stepCache = new Map<string, OnboardingStep<any>>();
  private static evaluationCache = new Map<string, any>();
  private static maxCacheSize = 1000;

  // Performance monitoring
  private static performanceMetrics = new Map<string, number[]>();

  /**
   * Cached step lookup with LRU eviction
   */
  static findStepById<T extends OnboardingContext>(
    steps: OnboardingStep<T>[],
    stepId: string | number | null | undefined,
  ): OnboardingStep<T> | undefined {
    if (!stepId) return undefined;

    const cacheKey = `${steps.length}-${stepId}`;

    if (this.stepCache.has(cacheKey)) {
      const cached = this.stepCache.get(cacheKey);
      // Move to end (LRU)
      this.stepCache.delete(cacheKey);
      this.stepCache.set(cacheKey, cached!);
      return cached;
    }

    const step = steps.find((s) => s.id === stepId);

    if (step) {
      // Apply LRU eviction when cache is full
      if (this.stepCache.size >= this.maxCacheSize) {
        const firstKey = this.stepCache.keys().next().value;
        if (firstKey) {
          this.stepCache.delete(firstKey);
        }
      }
      this.stepCache.set(cacheKey, step);
    }

    return step;
  }

  /**
   * Memoized step evaluation
   */
  static memoizeStepEvaluation<T extends OnboardingContext>(
    stepId: string | number | null | undefined,
    context: T,
    evaluator: (id: string | number | null | undefined, ctx: T) => unknown,
  ) {
    if (!stepId) return evaluator(stepId, context);

    // Create cache key from stepId and relevant context parts
    const contextHash = this.hashContext(context);
    const cacheKey = `${stepId}-${contextHash}`;

    if (this.evaluationCache.has(cacheKey)) {
      return this.evaluationCache.get(cacheKey);
    }

    const result = evaluator(stepId, context);

    // Apply cache size limit
    if (this.evaluationCache.size >= this.maxCacheSize) {
      const firstKey = this.evaluationCache.keys().next().value;
      if (firstKey) {
        // Remove the oldest entry
        this.evaluationCache.delete(firstKey);
      }
    }

    this.evaluationCache.set(cacheKey, result);
    return result;
  }

  /**
   * Debounce function for frequent operations
   */
  static debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number,
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  /**
   * Throttle function for rate limiting
   */
  static throttle<T extends (...args: unknown[]) => unknown>(
    func: T,
    limit: number,
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  /**
   * Performance measurement wrapper
   */
  static measurePerformance<T>(operationName: string, operation: () => T): T {
    const startTime = performance.now();
    const result = operation();
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Store performance metrics
    if (!this.performanceMetrics.has(operationName)) {
      this.performanceMetrics.set(operationName, []);
    }

    const metrics = this.performanceMetrics.get(operationName)!;
    metrics.push(duration);

    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }

    // Log slow operations
    if (duration > 100) {
      console.warn(
        `[PerformanceUtils] Slow operation detected: ${operationName} took ${duration.toFixed(2)}ms`,
      );
    }

    return result;
  }

  /**
   * Async performance measurement wrapper
   */
  static async measureAsyncPerformance<T>(
    operationName: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const startTime = performance.now();
    const result = await operation();
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Store performance metrics
    if (!this.performanceMetrics.has(operationName)) {
      this.performanceMetrics.set(operationName, []);
    }

    const metrics = this.performanceMetrics.get(operationName)!;
    metrics.push(duration);

    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }

    // Log slow operations
    if (duration > 200) {
      console.warn(
        `[PerformanceUtils] Slow async operation detected: ${operationName} took ${duration.toFixed(2)}ms`,
      );
    }

    return result;
  }

  /**
   * Get performance statistics for an operation
   */
  static getPerformanceStats(operationName: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    recent: number;
  } | null {
    const metrics = this.performanceMetrics.get(operationName);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const count = metrics.length;
    const sum = metrics.reduce((a, b) => a + b, 0);
    const average = sum / count;
    const min = Math.min(...metrics);
    const max = Math.max(...metrics);
    const recent = metrics[metrics.length - 1];

    return { count, average, min, max, recent };
  }

  /**
   * Clear all caches
   */
  static clearCaches(): void {
    this.stepCache.clear();
    this.evaluationCache.clear();
    this.performanceMetrics.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): {
    stepCacheSize: number;
    evaluationCacheSize: number;
    performanceMetricsCount: number;
  } {
    return {
      stepCacheSize: this.stepCache.size,
      evaluationCacheSize: this.evaluationCache.size,
      performanceMetricsCount: this.performanceMetrics.size,
    };
  }

  /**
   * Simple context hashing for cache keys
   */
  private static hashContext<T extends OnboardingContext>(context: T): string {
    const flowData = context.flowData || {};
    // Create a stable representation of flowData by sorting keys
    const sortedFlowDataKeys = Object.keys(flowData).sort();
    const stableFlowDataRepresentation: Record<string, unknown> = {};
    for (const key of sortedFlowDataKeys) {
      stableFlowDataRepresentation[key] = flowData[key];
    }
  
    // Define what parts of the context are relevant for the hash.
    // If other top-level context properties (besides flowData) can affect
    // the outcome of an evaluation that you're memoizing, include them here.
    const dataToHash = {
      // Example: if context.user?.id affects evaluation, include it:
      // userId: context.user?.id, 
      flowData: stableFlowDataRepresentation,
    };
  
    // JSON.stringify the stable representation as the hash
    const hash = JSON.stringify(dataToHash);
    return hash;
  }

  /**
   * Batch operations for better performance
   */
  static batchOperations<T>(
    operations: Array<() => T>,
    batchSize: number = 10,
  ): T[] {
    const results: T[] = [];

    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchResults = batch.map((op) => op());
      results.push(...batchResults);

      // Allow other tasks to run between batches
      if (i + batchSize < operations.length) {
        // In a real implementation, you might use setTimeout or requestIdleCallback
        // For this implementation, we continue synchronously
      }
    }

    return results;
  }

  /**
   * Memory usage monitoring
   */
  static getMemoryUsage(): {
    cacheMemoryEstimate: number;
    performanceMemoryEstimate: number;
  } {
    // Rough estimates of memory usage
    const stepCacheMemory = this.stepCache.size * 1000; // ~1KB per cached step
    const evaluationCacheMemory = this.evaluationCache.size * 500; // ~500B per evaluation
    const performanceMemory =
      Array.from(this.performanceMetrics.values()).reduce(
        (sum, metrics) => sum + metrics.length,
        0,
      ) * 8; // 8 bytes per number

    return {
      cacheMemoryEstimate: stepCacheMemory + evaluationCacheMemory,
      performanceMemoryEstimate: performanceMemory,
    };
  }
}
