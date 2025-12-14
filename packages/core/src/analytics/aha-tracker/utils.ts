// src/analytics/aha-tracker/utils.ts

import { generateSecureId } from '../../utils/id-utils'

/**
 * Utility functions for aha tracking
 */

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
    return generateSecureId()
}

/**
 * Get the current timezone
 */
export function getTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
        return 'UTC'
    }
}

/**
 * Detect device type based on viewport width
 */
export function detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    if (typeof window === 'undefined') return 'desktop'

    const width = window.innerWidth
    if (width < 768) return 'mobile'
    if (width < 1024) return 'tablet'
    return 'desktop'
}

/**
 * Detect browser from user agent
 */
export function detectBrowser(): string | undefined {
    if (typeof navigator === 'undefined') return undefined

    const userAgent = navigator.userAgent
    if (userAgent.includes('Chrome')) return 'Chrome'
    if (userAgent.includes('Firefox')) return 'Firefox'
    if (userAgent.includes('Safari')) return 'Safari'
    if (userAgent.includes('Edge')) return 'Edge'
    return 'Unknown'
}

/**
 * Detect operating system from platform
 */
export function detectOS(): string | undefined {
    if (typeof navigator === 'undefined') return undefined

    const platform = navigator.platform
    if (platform.includes('Win')) return 'Windows'
    if (platform.includes('Mac')) return 'macOS'
    if (platform.includes('Linux')) return 'Linux'
    if (platform.includes('iPhone') || platform.includes('iPad')) return 'iOS'
    if (platform.includes('Android')) return 'Android'
    return 'Unknown'
}
