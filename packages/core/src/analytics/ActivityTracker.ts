import { Logger } from '../services/Logger'

/**
 * ActivityTracker monitors idle detection and user activity state.
 */
export class ActivityTracker {
    private _isIdle: boolean = false
    private _lastActivityTime: number = Date.now()
    private _awayDuration: number = 0
    private _logger: Logger
    private _idleThresholdMs: number = 300000 // 5 minutes default

    constructor(logger?: Logger, idleThresholdMs?: number) {
        this._logger = logger || new Logger({ prefix: 'ActivityTracker' })
        if (idleThresholdMs) {
            this._idleThresholdMs = idleThresholdMs
        }
    }

    recordActivity(): void {
        const wasIdle = this._isIdle
        this._lastActivityTime = Date.now()
        this._isIdle = false

        if (wasIdle) {
            this._logger.debug('User returned from idle state')
        } else {
            this._logger.debug('User activity recorded')
        }
    }

    recordIdleStart(duration: number): void {
        this._isIdle = true
        this._awayDuration = duration
        this._logger.debug(`User idle for ${duration}ms`)
    }

    recordIdleEnd(awayDuration: number): void {
        this._isIdle = false
        this._awayDuration = awayDuration
        this._lastActivityTime = Date.now()
        this._logger.debug(`User returned after ${awayDuration}ms away`)
    }

    isIdle(): boolean {
        return this._isIdle
    }

    getLastActivityTime(): number {
        return this._lastActivityTime
    }

    getAwayDuration(): number {
        return this._awayDuration
    }

    getTimeSinceLastActivity(): number {
        return Date.now() - this._lastActivityTime
    }

    shouldBeIdle(): boolean {
        return this.getTimeSinceLastActivity() > this._idleThresholdMs
    }

    reset(): void {
        this._isIdle = false
        this._lastActivityTime = Date.now()
        this._awayDuration = 0
        this._logger.debug('Activity state reset')
    }
}
