// @onboardjs/react/src/components/OnboardingContainer.tsx
'use client'

import React, { Suspense, ReactNode } from 'react'
import { OnboardingContext as OnboardingContextType } from '@onboardjs/core'
import { OnboardingProvider, type OnboardingProviderProps } from '../context/OnboardingProvider'
import { OnboardingErrorBoundary, type OnboardingErrorBoundaryProps } from './OnboardingErrorBoundary'

/**
 * Loading fallback component shown during Suspense
 */
interface ContainerLoadingProps {
    message?: string
}

const DefaultLoadingFallback: React.FC<ContainerLoadingProps> = ({ message = 'Initializing...' }) => (
    <div
        style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '200px',
            fontSize: '14px',
            color: '#666',
        }}
    >
        {message}
    </div>
)

/**
 * Props for OnboardingContainer component
 *
 * @example With analytics before_send hook
 * ```tsx
 * import { AnalyticsBeforeSendHook } from '@onboardjs/core'
 *
 * const beforeSend: AnalyticsBeforeSendHook = (event) => {
 *   // Drop events with sensitive data
 *   if (event.properties.includes_password) {
 *     return null
 *   }
 *   return event
 * }
 *
 * <OnboardingContainer
 *   steps={steps}
 *   analytics={{ enabled: true, before_send: beforeSend }}
 * >
 *   <YourComponent />
 * </OnboardingContainer>
 * ```
 */
export interface OnboardingContainerProps<TContext extends OnboardingContextType> extends Omit<
    OnboardingProviderProps<TContext>,
    'children'
> {
    /**
     * Children to render inside the provider and error boundary
     */
    children: ReactNode

    /**
     * Enable Suspense support for async engine initialization
     * @default false
     */
    suspense?: boolean

    /**
     * Fallback UI shown while Suspense is pending
     */
    suspenseFallback?: ReactNode

    /**
     * Enable the error boundary wrapper
     * @default true
     */
    errorBoundary?: boolean

    /**
     * Props to pass to the error boundary (if enabled)
     */
    errorBoundaryProps?: Omit<OnboardingErrorBoundaryProps, 'children'>

    /**
     * Callback fired when error boundary catches an error
     */
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

/**
 * All-in-one container component that combines:
 * - OnboardingProvider (engine initialization)
 * - OnboardingErrorBoundary (error handling)
 * - Suspense boundary (async initialization)
 *
 * This is a convenient wrapper for users who want the full onboarding setup
 * without manually composing the components.
 *
 * @example
 * ```tsx
 * <OnboardingContainer
 *   steps={steps}
 *   initialStepId="step1"
 *   suspense={true}
 *   errorBoundary={true}
 * >
 *   <YourOnboardingUI />
 * </OnboardingContainer>
 * ```
 *
 * @example With custom error handling
 * ```tsx
 * <OnboardingContainer
 *   steps={steps}
 *   initialStepId="step1"
 *   errorBoundaryProps={{
 *     fallback: <CustomErrorUI />,
 *     onError: (error) => logToService(error)
 *   }}
 * >
 *   <YourOnboardingUI />
 * </OnboardingContainer>
 * ```
 */
export function OnboardingContainer<TContext extends OnboardingContextType = OnboardingContextType>({
    children,
    suspense = false,
    suspenseFallback = <DefaultLoadingFallback />,
    errorBoundary = true,
    errorBoundaryProps,
    onError,
    ...providerProps
}: OnboardingContainerProps<TContext>): React.ReactNode {
    // Build the provider content
    const providerContent = <OnboardingProvider<TContext> {...providerProps}>{children}</OnboardingProvider>

    // Wrap with error boundary if enabled
    const containerContent = errorBoundary ? (
        <OnboardingErrorBoundary
            {...errorBoundaryProps}
            onError={
                onError
                    ? (error) => {
                          // OnboardingError extends Error-like interface
                          const err = new Error(error.message)
                          onError(err, { componentStack: '' })
                      }
                    : undefined
            }
        >
            {providerContent}
        </OnboardingErrorBoundary>
    ) : (
        providerContent
    )

    // Wrap with Suspense if enabled
    if (suspense) {
        return <Suspense fallback={suspenseFallback}>{containerContent}</Suspense>
    }

    return containerContent
}
