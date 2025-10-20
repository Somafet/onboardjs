// src/analytics/aha-tracker/deduplication.ts
import { AhaTrackerConfig } from './types'

/**
 * Handles deduplication logic for aha events
 */
export class DeduplicationManager {
    private _config: Required<AhaTrackerConfig>
    private _userAhaCount: Map<string, number>
    private _lastAhaTime: Map<string, number>

    constructor(config: Required<AhaTrackerConfig>) {
        this._config = config
        this._userAhaCount = new Map()
        this._lastAhaTime = new Map()
    }

    /**
     * Check if an aha event should be tracked for a user
     */
    shouldTrack(userId: string): boolean {
        // Check max events per user
        const currentCount = this._userAhaCount.get(userId) || 0
        if (currentCount >= this._config.max_events_per_user) {
            return false
        }

        // Check cooldown
        if (this._config.cooldown_seconds > 0) {
            const lastAha = this._lastAhaTime.get(userId)
            if (lastAha && Date.now() - lastAha < this._config.cooldown_seconds * 1000) {
                return false
            }
        }

        return true
    }

    /**
     * Update user state after tracking an aha event
     */
    updateUserState(userId: string): void {
        this._userAhaCount.set(userId, (this._userAhaCount.get(userId) || 0) + 1)
        this._lastAhaTime.set(userId, Date.now())
    }

    /**
     * Get user aha count
     */
    getUserCount(userId: string): number {
        return this._userAhaCount.get(userId) || 0
    }

    /**
     * Get last aha time for user
     */
    getLastAhaTime(userId: string): number | null {
        return this._lastAhaTime.get(userId) || null
    }

    /**
     * Clear user data
     */
    clearUserData(userId: string): void {
        this._userAhaCount.delete(userId)
        this._lastAhaTime.delete(userId)
    }

    /**
     * Get internal maps for event builder access
     */
    getUserAhaCountMap(): Map<string, number> {
        return this._userAhaCount
    }
}
