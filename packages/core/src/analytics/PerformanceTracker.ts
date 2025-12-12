import { Logger } from '../services/Logger'
import { AnalyticsConfig } from './types'

/**
 * PerformanceTracker tracks render times, navigation times, and slowness detection.
 * Enforces memory limits with LRU eviction to prevent unbounded map growth.
 */
export class PerformanceTracker {
    private static readonly _MAX_ENTRIES = 500 // Limit to prevent memory leaks

    private _stepRenderTimes: Map<string | number, number>
    private _navigationTimes: Map<string, number>
    private _renderTimeEntryOrder: (string | number)[] = []
    private _navigationEntryOrder: string[] = []
    private _config: AnalyticsConfig
    private _logger: Logger
    private _thresholds: {
        slowStepMs: number
        slowRenderMs: number
    }

    constructor(config: AnalyticsConfig = {}, logger?: Logger) {
        this._config = config
        this._logger = logger || new Logger({ debugMode: config.debug, prefix: 'PerformanceTracker' })
        this._stepRenderTimes = new Map()
        this._navigationTimes = new Map()
        this._thresholds = {
            slowStepMs: config.performanceThresholds?.slowStepMs || 3000,
            slowRenderMs: config.performanceThresholds?.slowRenderMs || 2000,
        }
    }

    recordStepRenderTime(stepId: string | number, renderTime: number): void {
        this._stepRenderTimes.set(stepId, renderTime)
        this._renderTimeEntryOrder.push(stepId)

        // Enforce LRU eviction
        if (this._stepRenderTimes.size > PerformanceTracker._MAX_ENTRIES) {
            const oldestId = this._renderTimeEntryOrder.shift()
            if (oldestId !== undefined) {
                this._stepRenderTimes.delete(oldestId)
            }
        }

        this._logger.debug(`Recorded step render time: ${stepId} = ${renderTime}ms`)
    }

    recordNavigationTime(direction: string, duration: number): void {
        this._navigationTimes.set(`nav_${direction}_${Date.now()}`, duration)
        this._navigationEntryOrder.push(`nav_${direction}_${Date.now()}`)

        // Enforce LRU eviction
        if (this._navigationTimes.size > PerformanceTracker._MAX_ENTRIES) {
            const oldestKey = this._navigationEntryOrder.shift()
            if (oldestKey) {
                this._navigationTimes.delete(oldestKey)
            }
        }

        this._logger.debug(`Recorded navigation time: ${direction} = ${duration}ms`)
    }

    getStepRenderTime(stepId: string | number): number | undefined {
        return this._stepRenderTimes.get(stepId)
    }

    getNavigationTimes(): ReadonlyMap<string, number> {
        return new Map(this._navigationTimes)
    }

    getRenderTimeHistory(): number[] {
        return Array.from(this._stepRenderTimes.values())
    }

    isSlowRender(renderTime: number): boolean {
        return renderTime > this._thresholds.slowRenderMs
    }

    isSlowStep(duration: number): boolean {
        return duration > this._thresholds.slowStepMs
    }

    clear(): void {
        this._stepRenderTimes.clear()
        this._navigationTimes.clear()
        this._renderTimeEntryOrder = []
        this._navigationEntryOrder = []
        this._logger.debug('Performance metrics cleared')
    }

    getMemoryUsage(): number | undefined {
        if (typeof performance !== 'undefined' && (performance as any).memory) {
            return (performance as any).memory.usedJSHeapSize
        }
        return undefined
    }

    getConnectionType(): string | undefined {
        if (typeof navigator !== 'undefined' && 'connection' in navigator) {
            const connection = (navigator as any).connection
            return connection?.effectiveType || connection?.type
        }
        return undefined
    }
}
