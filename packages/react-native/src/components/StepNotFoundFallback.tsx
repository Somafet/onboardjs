// @onboardjs/react-native/src/components/StepNotFoundFallback.tsx
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import type { StepNotFoundInfo } from '@onboardjs/react-core'

export type { StepNotFoundInfo }

/**
 * React Native fallback shown when no component can be resolved for the active step.
 */
export function StepNotFoundFallback({ stepId, attemptedKeys }: StepNotFoundInfo): React.ReactElement {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Component Not Found for Step: &quot;{String(stepId)}&quot;</Text>
            <Text style={styles.body}>
                OnboardJS tried to resolve a component from the registry but none of the following keys matched:
            </Text>
            {attemptedKeys.map((key) => (
                <Text key={key} style={styles.key}>
                    • registry[&quot;{key}&quot;]
                </Text>
            ))}
            <Text style={styles.key}>• step.component property</Text>
            <Text style={styles.body}>
                Register the component in the componentRegistry prop or set it on the step&apos;s component property.
            </Text>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        backgroundColor: '#ffebee',
        borderRadius: 4,
    },
    title: {
        color: '#d32f2f',
        fontWeight: '700',
        marginBottom: 8,
    },
    body: {
        color: '#d32f2f',
        fontSize: 14,
        marginTop: 8,
    },
    key: {
        color: '#d32f2f',
        fontSize: 13,
        marginTop: 2,
    },
})
