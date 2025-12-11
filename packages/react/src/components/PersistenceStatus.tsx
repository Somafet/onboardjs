// @onboardjs/react/src/components/PersistenceStatus.tsx
'use client'

import React, { ReactNode, CSSProperties } from 'react'

/**
 * The current persistence mode of the onboarding flow.
 */
export type PersistenceMode = 'localStorage' | 'memory' | 'custom' | 'none'

/**
 * Props for the PersistenceStatus component.
 */
export interface PersistenceStatusProps {
    /**
     * The current persistence mode.
     */
    mode: PersistenceMode

    /**
     * Whether there was an error with persistence.
     */
    hasError?: boolean

    /**
     * Custom render function for the status indicator.
     */
    children?: (props: { mode: PersistenceMode; hasError: boolean; statusText: string }) => ReactNode

    /**
     * Whether to show the status indicator.
     * @default true
     */
    visible?: boolean

    /**
     * Custom class name for styling.
     */
    className?: string
}

/**
 * Gets a human-readable status text for the persistence mode.
 */
function getStatusText(mode: PersistenceMode, hasError: boolean): string {
    if (hasError) {
        return 'Progress not saved'
    }

    switch (mode) {
        case 'localStorage':
            return 'Progress saved locally'
        case 'memory':
            return 'Progress saved in memory'
        case 'custom':
            return 'Progress saved'
        case 'none':
            return 'Progress not being saved'
    }
}

/**
 * Gets the default styles for the status indicator.
 */
function getDefaultStyles(mode: PersistenceMode, hasError: boolean): CSSProperties {
    const baseStyles: CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: '500',
    }

    if (hasError) {
        return {
            ...baseStyles,
            backgroundColor: '#FEF2F2',
            color: '#991B1B',
            border: '1px solid #FCA5A5',
        }
    }

    switch (mode) {
        case 'localStorage':
        case 'custom':
            return {
                ...baseStyles,
                backgroundColor: '#F0FDF4',
                color: '#166534',
                border: '1px solid #86EFAC',
            }
        case 'memory':
            return {
                ...baseStyles,
                backgroundColor: '#FFFBEB',
                color: '#92400E',
                border: '1px solid #FCD34D',
            }
        case 'none':
            return {
                ...baseStyles,
                backgroundColor: '#F3F4F6',
                color: '#6B7280',
                border: '1px solid #D1D5DB',
            }
    }
}

/**
 * Gets the status icon character.
 */
function getStatusIcon(mode: PersistenceMode, hasError: boolean): string {
    if (hasError) {
        return '⚠️'
    }

    switch (mode) {
        case 'localStorage':
        case 'custom':
            return '✓'
        case 'memory':
            return '○'
        case 'none':
            return '○'
    }
}

/**
 * A component that displays the current persistence status of the onboarding flow.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <PersistenceStatus mode="localStorage" />
 *
 * // With error state
 * <PersistenceStatus mode="localStorage" hasError />
 *
 * // Custom render
 * <PersistenceStatus mode="localStorage">
 *   {({ mode, statusText }) => (
 *     <span className="custom-status">{statusText}</span>
 *   )}
 * </PersistenceStatus>
 * ```
 */
export function PersistenceStatus({
    mode,
    hasError = false,
    children,
    visible = true,
    className,
}: PersistenceStatusProps): ReactNode {
    if (!visible) {
        return null
    }

    const statusText = getStatusText(mode, hasError)

    // Custom render function
    if (children) {
        return children({ mode, hasError, statusText })
    }

    // Default render
    const styles = getDefaultStyles(mode, hasError)
    const icon = getStatusIcon(mode, hasError)

    return (
        <div className={className} style={styles} role="status" aria-live="polite">
            <span aria-hidden="true">{icon}</span>
            <span>{statusText}</span>
        </div>
    )
}
