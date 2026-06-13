// @onboardjs/react-native/src/components/PersistenceStatus.tsx
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { getStatusText, type PersistenceMode } from '@onboardjs/react-core'

export type { PersistenceMode }

export interface PersistenceStatusProps {
    mode: PersistenceMode
    hasError?: boolean
    children?: (props: { mode: PersistenceMode; hasError: boolean; statusText: string }) => React.ReactNode
    visible?: boolean
}

/**
 * Displays the current persistence status of the onboarding flow (React Native).
 */
export function PersistenceStatus({
    mode,
    hasError = false,
    children,
    visible = true,
}: PersistenceStatusProps): React.ReactElement | null {
    if (!visible) {
        return null
    }

    const statusText = getStatusText(mode, hasError)

    if (children) {
        return <>{children({ mode, hasError, statusText })}</>
    }

    const tone = hasError ? styles.error : mode === 'memory' ? styles.warn : styles.ok

    return (
        <View style={[styles.container, tone]}>
            <Text style={styles.text}>{statusText}</Text>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        alignSelf: 'flex-start',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
        borderWidth: 1,
    },
    text: {
        fontSize: 12,
        fontWeight: '500',
    },
    ok: {
        backgroundColor: '#F0FDF4',
        borderColor: '#86EFAC',
    },
    warn: {
        backgroundColor: '#FFFBEB',
        borderColor: '#FCD34D',
    },
    error: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FCA5A5',
    },
})
