// @onboardjs/react-native/src/components/OnboardingErrorBoundary.tsx
import React, { Component, ErrorInfo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import {
    createOnboardingError,
    type OnboardingError,
    type OnboardingErrorBoundaryProps,
    type OnboardingErrorBoundaryFallbackProps,
} from '@onboardjs/react-core'

export type { OnboardingError, OnboardingErrorBoundaryProps, OnboardingErrorBoundaryFallbackProps }

interface State {
    hasError: boolean
    error: OnboardingError | null
}

function titleFor(error: OnboardingError): string {
    switch (error.type) {
        case 'INITIALIZATION_ERROR':
            return 'Failed to Initialize Onboarding'
        case 'PERSISTENCE_ERROR':
            return 'Storage Error'
        case 'ENGINE_ERROR':
            return 'Onboarding Error'
        case 'COMPONENT_ERROR':
            return 'Display Error'
        default:
            return 'Something Went Wrong'
    }
}

function DefaultFallback({ error, resetError, continueWithoutPersistence }: OnboardingErrorBoundaryFallbackProps) {
    return (
        <View style={styles.container} accessibilityRole="alert">
            <Text style={styles.title}>{titleFor(error)}</Text>
            <Text style={styles.message}>{error.message}</Text>
            <View style={styles.actions}>
                <Pressable style={styles.primary} onPress={resetError}>
                    <Text style={styles.primaryText}>Try Again</Text>
                </Pressable>
                {error.type === 'PERSISTENCE_ERROR' && continueWithoutPersistence ? (
                    <Pressable style={styles.secondary} onPress={continueWithoutPersistence}>
                        <Text style={styles.secondaryText}>Continue Without Saving</Text>
                    </Pressable>
                ) : null}
            </View>
        </View>
    )
}

/**
 * React Native error boundary for the onboarding flow. Shares error
 * classification with the web boundary via @onboardjs/react-core.
 */
export class OnboardingErrorBoundary extends Component<OnboardingErrorBoundaryProps, State> {
    constructor(props: OnboardingErrorBoundaryProps) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error: createOnboardingError(error) }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        const onboardingError = createOnboardingError(error)
        console.error('[OnboardJS] Error caught by boundary:', error, errorInfo)
        this.props.onError?.(onboardingError, errorInfo)
    }

    resetError = (): void => {
        this.setState({ hasError: false, error: null })
        this.props.onReset?.()
    }

    continueWithoutPersistence = (): void => {
        this.setState({ hasError: false, error: null })
        this.props.onContinueWithoutPersistence?.()
    }

    render(): React.ReactNode {
        if (this.state.hasError && this.state.error) {
            const { fallback } = this.props
            const fallbackProps: OnboardingErrorBoundaryFallbackProps = {
                error: this.state.error,
                resetError: this.resetError,
                continueWithoutPersistence:
                    this.state.error.type === 'PERSISTENCE_ERROR' ? this.continueWithoutPersistence : undefined,
            }

            if (typeof fallback === 'function') {
                return fallback(fallbackProps)
            }
            if (fallback) {
                return fallback
            }
            return <DefaultFallback {...fallbackProps} />
        }

        return this.props.children
    }
}

const styles = StyleSheet.create({
    container: {
        padding: 24,
        borderRadius: 8,
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FCA5A5',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#991B1B',
        marginBottom: 8,
    },
    message: {
        fontSize: 14,
        color: '#7F1D1D',
        marginBottom: 16,
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
    },
    primary: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        backgroundColor: '#DC2626',
    },
    primaryText: {
        color: 'white',
        fontWeight: '500',
        fontSize: 14,
    },
    secondary: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#FCA5A5',
    },
    secondaryText: {
        color: '#7F1D1D',
        fontWeight: '500',
        fontSize: 14,
    },
})
