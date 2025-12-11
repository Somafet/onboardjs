// @onboardjs/react/src/components/OnboardingErrorBoundary.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React, { ReactNode } from 'react'
import { OnboardingErrorBoundary, OnboardingError, OnboardingErrorType } from './OnboardingErrorBoundary'

// Component that throws an error - returns never to satisfy React
function ThrowError({ error }: { error: Error }): ReactNode {
    throw error
}

// Component that renders normally
function NormalComponent() {
    return <div data-testid="normal-content">Normal content</div>
}

describe('OnboardingErrorBoundary', () => {
    // Suppress console.error during tests
    const originalError = console.error
    beforeEach(() => {
        console.error = vi.fn()
    })
    afterEach(() => {
        console.error = originalError
    })

    describe('error classification', () => {
        it('should classify initialization errors', () => {
            const onError = vi.fn()
            const error = new Error('Invalid Onboarding Configuration: missing steps')

            render(
                <OnboardingErrorBoundary onError={onError}>
                    <ThrowError error={error} />
                </OnboardingErrorBoundary>
            )

            expect(onError).toHaveBeenCalled()
            const [onboardingError] = onError.mock.calls[0] as [OnboardingError, unknown]
            expect(onboardingError.type).toBe('INITIALIZATION_ERROR')
        })

        it('should classify persistence errors', () => {
            const onError = vi.fn()
            const error = new Error('QuotaExceededError')
            error.name = 'QuotaExceededError'

            render(
                <OnboardingErrorBoundary onError={onError}>
                    <ThrowError error={error} />
                </OnboardingErrorBoundary>
            )

            expect(onError).toHaveBeenCalled()
            const [onboardingError] = onError.mock.calls[0] as [OnboardingError, unknown]
            expect(onboardingError.type).toBe('PERSISTENCE_ERROR')
        })

        it('should classify localStorage errors as persistence errors', () => {
            const onError = vi.fn()
            const error = new Error('localStorage is not available')

            render(
                <OnboardingErrorBoundary onError={onError}>
                    <ThrowError error={error} />
                </OnboardingErrorBoundary>
            )

            expect(onError).toHaveBeenCalled()
            const [onboardingError] = onError.mock.calls[0] as [OnboardingError, unknown]
            expect(onboardingError.type).toBe('PERSISTENCE_ERROR')
        })

        it('should classify engine errors', () => {
            const onError = vi.fn()
            const error = new Error('Engine navigation failed')

            render(
                <OnboardingErrorBoundary onError={onError}>
                    <ThrowError error={error} />
                </OnboardingErrorBoundary>
            )

            expect(onError).toHaveBeenCalled()
            const [onboardingError] = onError.mock.calls[0] as [OnboardingError, unknown]
            expect(onboardingError.type).toBe('ENGINE_ERROR')
        })

        it('should classify component errors', () => {
            const onError = vi.fn()
            const error = new Error('Cannot render component')

            render(
                <OnboardingErrorBoundary onError={onError}>
                    <ThrowError error={error} />
                </OnboardingErrorBoundary>
            )

            expect(onError).toHaveBeenCalled()
            const [onboardingError] = onError.mock.calls[0] as [OnboardingError, unknown]
            expect(onboardingError.type).toBe('COMPONENT_ERROR')
        })

        it('should classify unknown errors', () => {
            const onError = vi.fn()
            const error = new Error('Something unexpected happened')

            render(
                <OnboardingErrorBoundary onError={onError}>
                    <ThrowError error={error} />
                </OnboardingErrorBoundary>
            )

            expect(onError).toHaveBeenCalled()
            const [onboardingError] = onError.mock.calls[0] as [OnboardingError, unknown]
            expect(onboardingError.type).toBe('UNKNOWN')
        })
    })

    describe('default fallback UI', () => {
        it('should render default fallback when error occurs', () => {
            const error = new Error('Test error')

            render(
                <OnboardingErrorBoundary>
                    <ThrowError error={error} />
                </OnboardingErrorBoundary>
            )

            expect(screen.getByRole('alert')).toBeTruthy()
            expect(screen.getByText('Something Went Wrong')).toBeTruthy()
            expect(screen.getByText('Try Again')).toBeTruthy()
        })

        it('should show "Continue Without Saving" button for persistence errors', () => {
            const error = new Error('localStorage quota exceeded')
            error.name = 'QuotaExceededError'

            render(
                <OnboardingErrorBoundary onContinueWithoutPersistence={vi.fn()}>
                    <ThrowError error={error} />
                </OnboardingErrorBoundary>
            )

            expect(screen.getByText('Continue Without Saving')).toBeTruthy()
        })

        it('should not show "Continue Without Saving" for non-persistence errors', () => {
            const error = new Error('Test error')

            render(
                <OnboardingErrorBoundary onContinueWithoutPersistence={vi.fn()}>
                    <ThrowError error={error} />
                </OnboardingErrorBoundary>
            )

            expect(screen.queryByText('Continue Without Saving')).toBeNull()
        })
    })

    describe('recovery actions', () => {
        it('should call onReset when "Try Again" is clicked', () => {
            const onReset = vi.fn()
            const error = new Error('Test error')

            render(
                <OnboardingErrorBoundary onReset={onReset}>
                    <ThrowError error={error} />
                </OnboardingErrorBoundary>
            )

            fireEvent.click(screen.getByText('Try Again'))
            expect(onReset).toHaveBeenCalled()
        })

        it('should call onContinueWithoutPersistence when clicked', () => {
            const onContinueWithoutPersistence = vi.fn()
            const error = new Error('localStorage quota')
            error.name = 'QuotaExceededError'

            render(
                <OnboardingErrorBoundary onContinueWithoutPersistence={onContinueWithoutPersistence}>
                    <ThrowError error={error} />
                </OnboardingErrorBoundary>
            )

            fireEvent.click(screen.getByText('Continue Without Saving'))
            expect(onContinueWithoutPersistence).toHaveBeenCalled()
        })

        it('should reset error state when "Try Again" is clicked', () => {
            const error = new Error('Test error')
            let shouldThrow = true

            const MaybeThrow = () => {
                if (shouldThrow) throw error
                return <div data-testid="recovered">Recovered</div>
            }

            const { rerender } = render(
                <OnboardingErrorBoundary>
                    <MaybeThrow />
                </OnboardingErrorBoundary>
            )

            expect(screen.getByRole('alert')).toBeTruthy()

            // Stop throwing and click retry
            shouldThrow = false
            fireEvent.click(screen.getByText('Try Again'))

            rerender(
                <OnboardingErrorBoundary>
                    <MaybeThrow />
                </OnboardingErrorBoundary>
            )

            expect(screen.getByTestId('recovered')).toBeTruthy()
        })
    })

    describe('custom fallback', () => {
        it('should render custom fallback ReactNode', () => {
            const error = new Error('Test error')

            render(
                <OnboardingErrorBoundary fallback={<div data-testid="custom-fallback">Custom Error UI</div>}>
                    <ThrowError error={error} />
                </OnboardingErrorBoundary>
            )

            expect(screen.getByTestId('custom-fallback')).toBeTruthy()
            expect(screen.getByText('Custom Error UI')).toBeTruthy()
        })

        it('should render custom fallback function with error props', () => {
            const error = new Error('Test error message')
            const fallbackFn = vi.fn(({ error: onboardingError, resetError }) => (
                <div data-testid="custom-fallback">
                    <span data-testid="error-type">{onboardingError.type}</span>
                    <button onClick={resetError}>Custom Reset</button>
                </div>
            ))

            render(
                <OnboardingErrorBoundary fallback={fallbackFn}>
                    <ThrowError error={error} />
                </OnboardingErrorBoundary>
            )

            expect(fallbackFn).toHaveBeenCalled()
            expect(screen.getByTestId('custom-fallback')).toBeTruthy()
            expect(screen.getByText('Custom Reset')).toBeTruthy()
        })
    })

    describe('normal operation', () => {
        it('should render children when no error occurs', () => {
            render(
                <OnboardingErrorBoundary>
                    <NormalComponent />
                </OnboardingErrorBoundary>
            )

            expect(screen.getByTestId('normal-content')).toBeTruthy()
        })

        it('should call onError callback with error details', () => {
            const onError = vi.fn()
            const error = new Error('Test error')

            render(
                <OnboardingErrorBoundary onError={onError}>
                    <ThrowError error={error} />
                </OnboardingErrorBoundary>
            )

            expect(onError).toHaveBeenCalledWith(
                expect.objectContaining({
                    originalError: error,
                    message: 'Test error',
                    recoverable: true,
                }),
                expect.objectContaining({
                    componentStack: expect.any(String),
                })
            )
        })
    })

    describe('error recoverability', () => {
        const testCases: [OnboardingErrorType, boolean][] = [
            ['INITIALIZATION_ERROR', true],
            ['PERSISTENCE_ERROR', true],
            ['ENGINE_ERROR', true],
            ['COMPONENT_ERROR', true],
            ['UNKNOWN', true],
        ]

        testCases.forEach(([errorType, expectedRecoverable]) => {
            it(`should mark ${errorType} as ${expectedRecoverable ? 'recoverable' : 'not recoverable'}`, () => {
                const onError = vi.fn()
                const errorMessages: Record<OnboardingErrorType, string> = {
                    INITIALIZATION_ERROR: 'Invalid Onboarding Configuration',
                    PERSISTENCE_ERROR: 'localStorage error',
                    ENGINE_ERROR: 'Engine navigation failed',
                    COMPONENT_ERROR: 'Cannot render component',
                    UNKNOWN: 'Unknown error occurred',
                }
                const error = new Error(errorMessages[errorType])

                render(
                    <OnboardingErrorBoundary onError={onError}>
                        <ThrowError error={error} />
                    </OnboardingErrorBoundary>
                )

                expect(onError).toHaveBeenCalled()
                const [onboardingError] = onError.mock.calls[0] as [OnboardingError, unknown]
                expect(onboardingError.recoverable).toBe(expectedRecoverable)
            })
        })
    })
})
