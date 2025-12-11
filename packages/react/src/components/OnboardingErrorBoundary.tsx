// @onboardjs/react/src/components/OnboardingErrorBoundary.tsx
'use client'

import { Component, ErrorInfo, ReactNode } from 'react'

/**
 * Classification of errors that can occur during onboarding.
 */
export type OnboardingErrorType =
    | 'INITIALIZATION_ERROR'
    | 'PERSISTENCE_ERROR'
    | 'ENGINE_ERROR'
    | 'COMPONENT_ERROR'
    | 'UNKNOWN'

/**
 * Extended error information for onboarding errors.
 */
export interface OnboardingError {
    type: OnboardingErrorType
    originalError: Error
    message: string
    recoverable: boolean
}

/**
 * Props for the Error Boundary component.
 */
export interface OnboardingErrorBoundaryProps {
    children: ReactNode

    /**
     * Custom fallback UI to render when an error occurs.
     * If not provided, a default error UI will be rendered.
     */
    fallback?: ReactNode | ((props: OnboardingErrorBoundaryFallbackProps) => ReactNode)

    /**
     * Callback fired when an error is caught.
     * Useful for error logging/reporting services.
     */
    onError?: (error: OnboardingError, errorInfo: ErrorInfo) => void

    /**
     * Callback fired when the user attempts to reset/retry.
     */
    onReset?: () => void

    /**
     * Callback fired when the user chooses to continue without persistence.
     */
    onContinueWithoutPersistence?: () => void
}

/**
 * Props passed to the fallback render function.
 */
export interface OnboardingErrorBoundaryFallbackProps {
    error: OnboardingError
    resetError: () => void
    continueWithoutPersistence?: () => void
}

interface OnboardingErrorBoundaryState {
    hasError: boolean
    error: OnboardingError | null
}

/**
 * Classifies an error into an OnboardingErrorType.
 */
function classifyError(error: Error): OnboardingErrorType {
    const message = error.message.toLowerCase()
    const name = error.name.toLowerCase()

    // Check for initialization errors
    if (
        message.includes('initialization') ||
        message.includes('invalid onboarding configuration') ||
        message.includes('engine creation')
    ) {
        return 'INITIALIZATION_ERROR'
    }

    // Check for persistence/localStorage errors
    if (
        name === 'quotaexceedederror' ||
        message.includes('localstorage') ||
        message.includes('quota') ||
        message.includes('persist') ||
        message.includes('storage')
    ) {
        return 'PERSISTENCE_ERROR'
    }

    // Check for engine errors
    if (message.includes('engine') || message.includes('step') || message.includes('navigation')) {
        return 'ENGINE_ERROR'
    }

    // Check for component rendering errors
    if (message.includes('render') || message.includes('component') || message.includes('react')) {
        return 'COMPONENT_ERROR'
    }

    return 'UNKNOWN'
}

/**
 * Determines if an error is recoverable.
 */
function isRecoverable(errorType: OnboardingErrorType): boolean {
    switch (errorType) {
        case 'PERSISTENCE_ERROR':
            // Can continue without persistence
            return true
        case 'COMPONENT_ERROR':
            // Can retry rendering
            return true
        case 'INITIALIZATION_ERROR':
            // May be recoverable with retry
            return true
        case 'ENGINE_ERROR':
            // Usually recoverable with reset
            return true
        case 'UNKNOWN':
        default:
            // Unknown errors are potentially recoverable
            return true
    }
}

/**
 * Creates an OnboardingError from a standard Error.
 */
function createOnboardingError(error: Error): OnboardingError {
    const type = classifyError(error)
    return {
        type,
        originalError: error,
        message: error.message,
        recoverable: isRecoverable(type),
    }
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
