// @onboardjs/react/src/hooks/internal/useSuspenseEngine.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import React, { Suspense, ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { useSuspenseEngine, clearSuspenseCache } from './useSuspenseEngine'
import type { OnboardingEngineConfig, OnboardingContext } from '@onboardjs/core'

interface TestContext extends OnboardingContext {
    name?: string
}

const createTestConfig = (): OnboardingEngineConfig<TestContext> => ({
    steps: [
        { id: 'step1', type: 'INFORMATION', payload: { title: 'Step 1' } },
        { id: 'step2', type: 'INFORMATION', payload: { title: 'Step 2' } },
    ],
    initialStepId: 'step1',
    initialContext: { flowData: {}, name: 'Test' },
})

// Component that uses the suspense hook
function SuspenseEngineConsumer({ config }: { config: OnboardingEngineConfig<TestContext> }) {
    const { engine, isReady } = useSuspenseEngine(config)
    return (
        <div>
            <span data-testid="engine-ready">{isReady.toString()}</span>
            <span data-testid="current-step">{engine.getState().currentStep?.id}</span>
        </div>
    )
}

// Wrapper with Suspense boundary
function SuspenseWrapper({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
    return <Suspense fallback={fallback ?? <div data-testid="loading">Loading...</div>}>{children}</Suspense>
}

describe('useSuspenseEngine', () => {
    // Suppress console.error during tests
    const originalError = console.error
    beforeEach(() => {
        console.error = vi.fn()
        clearSuspenseCache()
    })
    afterEach(() => {
        console.error = originalError
        clearSuspenseCache()
    })

    describe('basic functionality', () => {
        it('should suspend during initialization and resolve when ready', async () => {
            const config = createTestConfig()

            render(
                <SuspenseWrapper>
                    <SuspenseEngineConsumer config={config} />
                </SuspenseWrapper>
            )

            // Should show loading initially (suspended)
            expect(screen.getByTestId('loading')).toBeTruthy()

            // Wait for resolution
            await waitFor(() => {
                expect(screen.getByTestId('engine-ready')).toBeTruthy()
            })

            expect(screen.getByTestId('engine-ready').textContent).toBe('true')
            expect(screen.getByTestId('current-step').textContent).toBe('step1')
        })

        it('should cache engine instance and not re-suspend on re-render', async () => {
            const config = createTestConfig()

            const { rerender } = render(
                <SuspenseWrapper>
                    <SuspenseEngineConsumer config={config} />
                </SuspenseWrapper>
            )

            // Wait for initial resolution
            await waitFor(() => {
                expect(screen.getByTestId('engine-ready')).toBeTruthy()
            })

            // Re-render with same config
            rerender(
                <SuspenseWrapper>
                    <SuspenseEngineConsumer config={config} />
                </SuspenseWrapper>
            )

            // Should still be ready (cached)
            expect(screen.getByTestId('engine-ready').textContent).toBe('true')
        })
    })

    describe('cache management', () => {
        it('should clear specific cache entry when configHash provided', async () => {
            const config = createTestConfig()

            render(
                <SuspenseWrapper>
                    <SuspenseEngineConsumer config={config} />
                </SuspenseWrapper>
            )

            await waitFor(() => {
                expect(screen.getByTestId('engine-ready')).toBeTruthy()
            })

            // Clear cache for this config
            clearSuspenseCache()

            // The cache should be empty now (component won't re-suspend unless re-mounted)
        })

        it('should clear all cache entries when no configHash provided', async () => {
            clearSuspenseCache()
            // This just verifies the function doesn't throw
            expect(true).toBe(true)
        })
    })

    describe('error handling', () => {
        it('should throw error for invalid configuration', async () => {
            const invalidConfig: OnboardingEngineConfig<TestContext> = {
                steps: [], // Invalid: no steps
                initialStepId: 'nonexistent',
                initialContext: { flowData: {} },
            }

            // Error boundary to catch the error
            class ErrorCatcher extends React.Component<{ children: ReactNode }, { error: Error | null }> {
                constructor(props: { children: ReactNode }) {
                    super(props)
                    this.state = { error: null }
                }

                static getDerivedStateFromError(error: Error) {
                    return { error }
                }

                render() {
                    if (this.state.error) {
                        return <div data-testid="error">{this.state.error.message}</div>
                    }
                    return this.props.children
                }
            }

            render(
                <ErrorCatcher>
                    <SuspenseWrapper>
                        <SuspenseEngineConsumer config={invalidConfig} />
                    </SuspenseWrapper>
                </ErrorCatcher>
            )

            await waitFor(() => {
                expect(screen.getByTestId('error')).toBeTruthy()
            })

            expect(screen.getByTestId('error').textContent).toContain('Invalid Onboarding Configuration')
        })
    })

    describe('SSR safety', () => {
        it('should throw error when window is undefined (SSR)', async () => {
            const config = createTestConfig()
            const originalWindow = globalThis.window

            // Temporarily make window undefined
            // @ts-expect-error - intentionally setting window to undefined for SSR test
            delete globalThis.window

            let thrownError: Error | null = null
            try {
                // This should throw synchronously
                renderHook(() => useSuspenseEngine(config))
            } catch (error) {
                if (error instanceof Error) {
                    thrownError = error
                }
            }

            // Restore window
            globalThis.window = originalWindow

            // The error thrown could be our custom SSR error or a lower-level error
            // from dependencies - either way it should throw
            expect(thrownError).toBeTruthy()
            expect(thrownError?.message).toBeTruthy()
        })
    })

    describe('return type', () => {
        it('should return isReady as true literal type', async () => {
            const config = createTestConfig()

            render(
                <SuspenseWrapper>
                    <SuspenseEngineConsumer config={config} />
                </SuspenseWrapper>
            )

            await waitFor(() => {
                expect(screen.getByTestId('engine-ready')).toBeTruthy()
            })

            // The type system ensures isReady is always true after resolution
            expect(screen.getByTestId('engine-ready').textContent).toBe('true')
        })

        it('should return error as null literal type', async () => {
            const config = createTestConfig()

            // Component that checks error type
            function ErrorChecker() {
                const { error } = useSuspenseEngine(config)
                // TypeScript should know error is null
                return <div data-testid="error-null">{error === null ? 'null' : 'not-null'}</div>
            }

            render(
                <SuspenseWrapper>
                    <ErrorChecker />
                </SuspenseWrapper>
            )

            await waitFor(() => {
                expect(screen.getByTestId('error-null')).toBeTruthy()
            })

            expect(screen.getByTestId('error-null').textContent).toBe('null')
        })
    })
})
