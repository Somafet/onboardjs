// @onboardjs/react/src/components/OnboardingErrorBoundary.tsx
'use client'

import { Component, ErrorInfo, ReactNode } from 'react'
import {
    createOnboardingError,
    type OnboardingError,
    type OnboardingErrorType,
    type OnboardingErrorBoundaryProps,
    type OnboardingErrorBoundaryFallbackProps,
} from '@onboardjs/react-core'

// Re-export the shared error model so existing '@onboardjs/react' imports keep working.
export type { OnboardingError, OnboardingErrorType, OnboardingErrorBoundaryProps, OnboardingErrorBoundaryFallbackProps }

interface OnboardingErrorBoundaryState {
    hasError: boolean
    error: OnboardingError | null
}

/**
 * Default fallback UI component.
 */
function DefaultFallback({ error, resetError, continueWithoutPersistence }: OnboardingErrorBoundaryFallbackProps) {
    const getErrorTitle = (): string => {
        switch (error.type) {
            case 'INITIALIZATION_ERROR':
                return 'Failed to Initialize Onboarding'
            case 'PERSISTENCE_ERROR':
                return 'Storage Error'
            case 'ENGINE_ERROR':
                return 'Onboarding Error'
            case 'COMPONENT_ERROR':
                return 'Display Error'
            case 'UNKNOWN':
            default:
                return 'Something Went Wrong'
        }
    }

    const getErrorDescription = (): string => {
        switch (error.type) {
            case 'INITIALIZATION_ERROR':
                return 'We encountered an issue starting the onboarding flow. Please try again.'
            case 'PERSISTENCE_ERROR':
                return 'Unable to save your progress. You can continue without saving or try again.'
            case 'ENGINE_ERROR':
                return 'An error occurred during navigation. Please try again.'
            case 'COMPONENT_ERROR':
                return 'There was a problem displaying this step. Please try again.'
            case 'UNKNOWN':
            default:
                return 'An unexpected error occurred. Please try again.'
        }
    }

    return (
        <div
            role="alert"
            style={{
                padding: '24px',
                borderRadius: '8px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FCA5A5',
                maxWidth: '400px',
                margin: '20px auto',
            }}
        >
            <h2
                style={{
                    margin: '0 0 8px',
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#991B1B',
                }}
            >
                {getErrorTitle()}
            </h2>
            <p
                style={{
                    margin: '0 0 16px',
                    fontSize: '14px',
                    color: '#7F1D1D',
                }}
            >
                {getErrorDescription()}
            </p>

            {process.env.NODE_ENV === 'development' && (
                <details
                    style={{
                        marginBottom: '16px',
                        fontSize: '12px',
                        color: '#7F1D1D',
                    }}
                >
                    <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>Error Details</summary>
                    <pre
                        style={{
                            margin: 0,
                            padding: '8px',
                            backgroundColor: '#FEE2E2',
                            borderRadius: '4px',
                            overflow: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                        }}
                    >
                        {error.originalError.stack || error.message}
                    </pre>
                </details>
            )}

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                    onClick={resetError}
                    style={{
                        padding: '8px 16px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: 'white',
                        backgroundColor: '#DC2626',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                    }}
                >
                    Try Again
                </button>

                {error.type === 'PERSISTENCE_ERROR' && continueWithoutPersistence && (
                    <button
                        onClick={continueWithoutPersistence}
                        style={{
                            padding: '8px 16px',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#7F1D1D',
                            backgroundColor: 'transparent',
                            border: '1px solid #FCA5A5',
                            borderRadius: '6px',
                            cursor: 'pointer',
                        }}
                    >
                        Continue Without Saving
                    </button>
                )}
            </div>
        </div>
    )
}

/**
 * Error Boundary component for catching and handling errors in the onboarding flow.
 *
 * @example
 * ```tsx
 * <OnboardingErrorBoundary
 *   onError={(error, errorInfo) => logError(error, errorInfo)}
 *   onReset={() => window.location.reload()}
 * >
 *   <OnboardingProvider steps={steps}>
 *     <YourOnboardingUI />
 *   </OnboardingProvider>
 * </OnboardingErrorBoundary>
 * ```
 */
export class OnboardingErrorBoundary extends Component<OnboardingErrorBoundaryProps, OnboardingErrorBoundaryState> {
    constructor(props: OnboardingErrorBoundaryProps) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): OnboardingErrorBoundaryState {
        const onboardingError = createOnboardingError(error)
        return { hasError: true, error: onboardingError }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        const onboardingError = createOnboardingError(error)
        console.error('[OnboardJS] Error caught by boundary:', error, errorInfo)

        // Call the onError callback if provided
        if (this.props.onError) {
            this.props.onError(onboardingError, errorInfo)
        }
    }

    resetError = (): void => {
        this.setState({ hasError: false, error: null })

        if (this.props.onReset) {
            this.props.onReset()
        }
    }

    continueWithoutPersistence = (): void => {
        this.setState({ hasError: false, error: null })

        if (this.props.onContinueWithoutPersistence) {
            this.props.onContinueWithoutPersistence()
        }
    }

    render(): ReactNode {
        if (this.state.hasError && this.state.error) {
            const { fallback } = this.props
            const fallbackProps: OnboardingErrorBoundaryFallbackProps = {
                error: this.state.error,
                resetError: this.resetError,
                continueWithoutPersistence:
                    this.state.error.type === 'PERSISTENCE_ERROR' ? this.continueWithoutPersistence : undefined,
            }

            // If fallback is a function, call it with props
            if (typeof fallback === 'function') {
                return fallback(fallbackProps)
            }

            // If fallback is a ReactNode, render it
            if (fallback) {
                return fallback
            }

            // Use default fallback
            return <DefaultFallback {...fallbackProps} />
        }

        return this.props.children
    }
}
