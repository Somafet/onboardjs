// src/utils/performanceMetrics.ts

import { PerformanceMetrics } from "../types";

// Helper to check if we are in a browser environment
const isBrowser =
  typeof window !== "undefined" && typeof performance !== "undefined";

export class PerformanceTracker {
  private renderStartTimes = new Map<string, number>();
  private persistenceStartTimes = new Map<string, number>();

  startRenderTimer(stepId: string): void {
    if (!isBrowser) return;
    this.renderStartTimes.set(stepId, performance.now());
  }

  endRenderTimer(stepId: string): number | undefined {
    if (!isBrowser) return undefined;
    const startTime = this.renderStartTimes.get(stepId);
    if (startTime) {
      const renderTime = performance.now() - startTime;
      this.renderStartTimes.delete(stepId);
      return renderTime;
    }
    return undefined;
  }

  startPersistenceTimer(operationId: string): void {
    if (!isBrowser) return;
    this.persistenceStartTimes.set(operationId, performance.now());
  }

  endPersistenceTimer(operationId: string): number | undefined {
    if (!isBrowser) return undefined;
    const startTime = this.persistenceStartTimes.get(operationId);
    if (startTime) {
      const persistenceTime = performance.now() - startTime;
      this.persistenceStartTimes.delete(operationId);
      return persistenceTime;
    }
    return undefined;
  }

  getMemoryUsage(): number | undefined {
    if (isBrowser && "memory" in performance) {
      // The 'memory' property is non-standard and only in Chromium-based browsers
      return (performance as any).memory.usedJSHeapSize;
    }
    return undefined;
  }

  getCurrentMetrics(): PerformanceMetrics {
    return {
      memoryUsage: this.getMemoryUsage(),
      navigationTime: this.getNavigationTime(),
    };
  }

  private getNavigationTime(): number | undefined {
    if (!isBrowser) return undefined;

    // Use modern Navigation Timing API Level 2 (the standard)
    if ("getEntriesByType" in performance) {
      const navigationEntries = performance.getEntriesByType("navigation");
      if (navigationEntries.length > 0) {
        // Cast to the correct type to access properties
        const entry = navigationEntries[0] as PerformanceNavigationTiming;
        // The value of loadEventEnd is the duration, as startTime is 0.
        return entry.loadEventEnd;
      }
    }

    // Fallback to the deprecated Performance Timing API for older browsers
    if ("timing" in performance && performance.timing) {
      const timing = performance.timing;
      // Check if the values are valid before calculating
      if (timing.loadEventEnd > 0 && timing.navigationStart > 0) {
        // CORRECT: This calculation is correct for the old API
        return timing.loadEventEnd - timing.navigationStart;
      }
    }

    return undefined;
  }

  cleanup(): void {
    this.renderStartTimes.clear();
    this.persistenceStartTimes.clear();
  }
}
