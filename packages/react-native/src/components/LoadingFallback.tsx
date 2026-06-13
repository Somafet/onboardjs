// @onboardjs/react-native/src/components/LoadingFallback.tsx
import React from 'react'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'

export interface LoadingFallbackProps {
    message?: string
}

/**
 * Default loading indicator for React Native onboarding flows.
 */
export function LoadingFallback({ message = 'Initializing...' }: LoadingFallbackProps): React.ReactElement {
    return (
        <View style={styles.container}>
            <ActivityIndicator />
            <Text style={styles.text}>{message}</Text>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
        gap: 8,
    },
    text: {
        fontSize: 14,
        color: '#666',
    },
})
