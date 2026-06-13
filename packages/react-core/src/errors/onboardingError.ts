// @onboardjs/react-core/src/errors/onboardingError.ts
// Platform-agnostic error model for onboarding error boundaries.
// Each platform package supplies its own boundary component + default UI,
// but the classification and props contract are shared here.

import type { ErrorInfo, ReactNode } from 'react'

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
 * Props passed to the fallback render function.
 */
export interface OnboardingErrorBoundaryFallbackProps {
    error: OnboardingError
    resetError: () => void
    continueWithoutPersistence?: () => void
}

/**
 * Props for an onboarding error boundary component.
 */
export interface OnboardingErrorBoundaryProps {
    children: ReactNode

    /**
     * Custom fallback UI to render when an error occurs.
     * If not provided, the platform package's default error UI is rendered.
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
 * Classifies an error into an OnboardingErrorType.
 */
export function classifyError(error: Error): OnboardingErrorType {
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

    // Check for persistence/storage errors
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
export function isRecoverable(errorType: OnboardingErrorType): boolean {
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
export function createOnboardingError(error: Error): OnboardingError {
    const type = classifyError(error)
    return {
        type,
        originalError: error,
        message: error.message,
        recoverable: isRecoverable(type),
    }
}
