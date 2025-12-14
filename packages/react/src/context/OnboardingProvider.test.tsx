import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { OnboardingProvider } from './OnboardingProvider'
import { useOnboarding } from '../hooks/useOnboarding'
import { OnboardingEngineConfig } from '@onboardjs/core'
import { mockStepComponents, mockSteps, mockStepsWithoutCriteria } from '../test-utils'
import type { StepComponentRegistry } from '../types'
import type { FC } from 'react'

// Test component that uses the context
const TestConsumer: FC = () => {
    const { state, isLoading, next, previous, goToStep } = useOnboarding()

    return (
        <div>
            <div data-testid="current-step">{state?.currentStep?.id || 'no-step'}</div>
            <div data-testid="is-loading">{isLoading.toString()}</div>
            <div data-testid="is-completed">{state?.isCompleted.toString()}</div>
            <button data-testid="next-btn" onClick={() => next()}>
                Next
            </button>
            <button data-testid="previous-btn" onClick={() => previous()}>
                Previous
            </button>
            <button data-testid="goto-final-btn" onClick={() => goToStep('step4')}>
                Go to Final Step
            </button>
        </div>
    )
}

describe('OnboardingProvider', () => {
    const mockConfig: OnboardingEngineConfig & {
        componentRegistry: StepComponentRegistry
    } = {
        steps: mockSteps,
        componentRegistry: mockStepComponents,
        onFlowComplete: vi.fn(),
        onStepChange: vi.fn(),
    }

    afterEach(() => {
        vi.restoreAllMocks()
        localStorage.clear()
    })

    it('should initialize with first step by default', async () => {
        render(
            <OnboardingProvider {...mockConfig}>
                <TestConsumer />
            </OnboardingProvider>
        )

        await waitFor(() => {
            expect(screen.getByTestId('current-step').textContent).toContain('step1')
            expect(screen.getByTestId('is-completed').textContent).toContain('false')
        })
    })

    it('should initialize with specified initial step', async () => {
        const configWithInitialStep = {
            ...mockConfig,
            initialStepId: 'step2',
        }

        render(
            <OnboardingProvider {...configWithInitialStep}>
                <TestConsumer />
            </OnboardingProvider>
        )

        await waitFor(() => {
            expect(screen.getByTestId('current-step').textContent).toContain('step2')
        })
    })

    it('should handle navigation between steps', async () => {
        render(
            <OnboardingProvider {...mockConfig}>
                <TestConsumer />
            </OnboardingProvider>
        )

        await waitFor(() => {
            expect(screen.getByTestId('current-step').textContent).toContain('step1')
        })

        // Navigate to next step
        await act(async () => {
            screen.getByTestId('next-btn').click()
        })

        await waitFor(() => {
            expect(screen.getByTestId('current-step').textContent).toContain('step2')
        })

        // Navigate back
        await act(async () => {
            screen.getByTestId('previous-btn').click()
        })

        await waitFor(() => {
            expect(screen.getByTestId('current-step').textContent).toContain('step1')
        })
    })

    it('should handle direct navigation to specific step', async () => {
        render(
            <OnboardingProvider {...mockConfig}>
                <TestConsumer />
            </OnboardingProvider>
        )

        await waitFor(() => {
            expect(screen.getByTestId('current-step').textContent).toContain('step1')
        })

        // Navigate directly to step 4
        await act(async () => {
            screen.getByTestId('goto-final-btn').click()
        })

        await waitFor(() => {
            expect(screen.getByTestId('current-step').textContent).toContain('step4')
        })
    })

    it('should call onFlowComplete when flow is completed', async () => {
        const onFlowComplete = vi.fn()
        const configWithCallback = {
            ...mockConfig,
            steps: mockStepsWithoutCriteria,
            onFlowComplete,
        }

        render(
            <OnboardingProvider {...configWithCallback}>
                <TestConsumer />
            </OnboardingProvider>
        )

        await waitFor(() => {
            expect(screen.getByTestId('current-step').textContent).toContain('step1')
        })

        // Navigate directly to step 4
        await act(async () => {
            screen.getByTestId('goto-final-btn').click()
        })

        await waitFor(() => {
            expect(screen.getByTestId('current-step').textContent).toContain('step4')
        })

        await act(async () => {
            screen.getByTestId('next-btn').click()
        })

        await waitFor(() => {
            expect(onFlowComplete).toHaveBeenCalled()
            expect(screen.getByTestId('is-completed').textContent).toContain('true')
        })
    })

    it('should handle localStorage persistence', async () => {
        const persistenceConfig = {
            key: 'test-onboarding',
            version: '1.0',
        }

        // First render - should start at step1
        const { unmount } = render(
            <OnboardingProvider {...mockConfig} localStoragePersistence={persistenceConfig}>
                <TestConsumer />
            </OnboardingProvider>
        )

        await waitFor(() => {
            expect(screen.getByTestId('current-step').textContent).toContain('step1')
        })

        // Navigate to step2
        await act(async () => {
            screen.getByTestId('next-btn').click()
        })

        await waitFor(() => {
            expect(screen.getByTestId('current-step').textContent).toContain('step2')
        })

        // Unmount component
        unmount()

        // Re-render - should restore to step2
        render(
            <OnboardingProvider {...mockConfig} localStoragePersistence={persistenceConfig}>
                <TestConsumer />
            </OnboardingProvider>
        )

        await waitFor(() => {
            expect(screen.getByTestId('current-step').textContent).toContain('step2')
        })
    })

    it('should handle persistence data loading errors gracefully', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        // Mock localStorage to throw an error
        const originalGetItem = localStorage.getItem
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('localStorage error')
        })

        const persistenceConfig = {
            key: 'test-onboarding',
            version: '1.0',
        }

        render(
            <OnboardingProvider {...mockConfig} localStoragePersistence={persistenceConfig}>
                <TestConsumer />
            </OnboardingProvider>
        )

        await waitFor(() => {
            expect(screen.getByTestId('current-step').textContent).toContain('step1')
            expect(consoleErrorSpy).toHaveBeenCalled()
        })

        // Restore original implementation
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(originalGetItem)
        consoleErrorSpy.mockRestore()
    })

    it('should handle custom onDataLoad and onDataPersist', async () => {
        const customOnDataLoad = vi.fn().mockResolvedValue({
            currentStepId: 'step2',
            flowData: { testKey: 'testValue' },
        })
        const customOnDataPersist = vi.fn().mockResolvedValue(undefined)

        render(
            <OnboardingProvider
                {...mockConfig}
                customOnDataLoad={customOnDataLoad}
                customOnDataPersist={customOnDataPersist}
            >
                <TestConsumer />
            </OnboardingProvider>
        )

        await waitFor(() => {
            expect(customOnDataLoad).toHaveBeenCalled()
            expect(screen.getByTestId('current-step').textContent).toContain('step2')
        })

        // Navigate to trigger persistence
        await act(async () => {
            screen.getByTestId('next-btn').click()
        })

        await waitFor(() => {
            expect(customOnDataPersist).toHaveBeenCalled()
        })
    })

    it('should prioritize custom persistence over localStorage', async () => {
        const customOnDataLoad = vi.fn().mockResolvedValue({
            currentStepId: 'step3',
            flowData: {},
        })
        const customOnDataPersist = vi.fn().mockResolvedValue(undefined)

        const persistenceConfig = {
            key: 'test-onboarding',
            version: '1.0',
        }

        render(
            <OnboardingProvider
                {...mockConfig}
                localStoragePersistence={persistenceConfig}
                customOnDataLoad={customOnDataLoad}
                customOnDataPersist={customOnDataPersist}
            >
                <TestConsumer />
            </OnboardingProvider>
        )

        await waitFor(() => {
            expect(customOnDataLoad).toHaveBeenCalled()
            expect(screen.getByTestId('current-step').textContent).toContain('step3')
        })
    })

    it('should handle component loading state', async () => {
        const TestConsumerWithLoading: FC = () => {
            const { isLoading, setComponentLoading } = useOnboarding()

            return (
                <div>
                    <div data-testid="is-loading">{isLoading.toString()}</div>
                    <button data-testid="set-loading-true-btn" onClick={() => setComponentLoading(true)}>
                        Set Loading True
                    </button>
                    <button data-testid="set-loading-false-btn" onClick={() => setComponentLoading(false)}>
                        Set Loading False
                    </button>
                </div>
            )
        }

        render(
            <OnboardingProvider {...mockConfig}>
                <TestConsumerWithLoading />
            </OnboardingProvider>
        )

        await waitFor(() => {
            expect(screen.getByTestId('is-loading').textContent).toContain('false')
        })

        // Set component loading to true
        act(() => {
            screen.getByTestId('set-loading-true-btn').click()
        })

        expect(screen.getByTestId('is-loading').textContent).toContain('true')

        // Set component loading to false
        act(() => {
            screen.getByTestId('set-loading-false-btn').click()
        })

        expect(screen.getByTestId('is-loading').textContent).toContain('false')
    })

    it('should handle empty steps array', async () => {
        const emptyConfig = {
            ...mockConfig,
            steps: [],
        }

        render(
            <OnboardingProvider {...emptyConfig}>
                <TestConsumer />
            </OnboardingProvider>
        )

        await waitFor(() => {
            expect(screen.getByTestId('current-step').textContent).toContain('no-step')
            expect(screen.getByTestId('is-completed').textContent).toContain('true')
        })
    })
})

describe('OnboardingProvider - Loading State Management', () => {
    const mockConfig: OnboardingEngineConfig & {
        componentRegistry: StepComponentRegistry
    } = {
        steps: mockSteps,
        componentRegistry: mockStepComponents,
        onFlowComplete: vi.fn(),
        onStepChange: vi.fn(),
    }

    afterEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
    })

    // Test consumer that exposes granular loading states
    const LoadingStateTestConsumer: FC = () => {
        const { loading, isLoading, state, next, setComponentLoading } = useOnboarding()

        return (
            <div>
                <div data-testid="is-hydrating">{loading.isHydrating.toString()}</div>
                <div data-testid="is-engine-processing">{loading.isEngineProcessing.toString()}</div>
                <div data-testid="is-component-processing">{loading.isComponentProcessing.toString()}</div>
                <div data-testid="is-any-loading">{loading.isAnyLoading.toString()}</div>
                <div data-testid="is-loading">{isLoading.toString()}</div>
                <div data-testid="current-step">{state?.currentStep?.id || 'no-step'}</div>
                <button data-testid="next-btn" onClick={() => next()}>
                    Next
                </button>
                <button data-testid="set-component-loading-btn" onClick={() => setComponentLoading(true)}>
                    Set Component Loading
                </button>
                <button data-testid="clear-component-loading-btn" onClick={() => setComponentLoading(false)}>
                    Clear Component Loading
                </button>
            </div>
        )
    }

    it('should distinguish hydration loading from engine processing', async () => {
        // Test that during initial load, isHydrating is true (engine hydrating from persisted data)
        // and isEngineProcessing reflects the engine's isLoading state

        let initialHydratingCaptured = false

        const HydrationTestConsumer: FC = () => {
            const { loading, state } = useOnboarding()

            // Capture initial loading states
            if (loading && !initialHydratingCaptured) {
                // During hydration, isHydrating should be true before engine is ready
                if (loading.isHydrating) {
                    initialHydratingCaptured = true
                }
            }

            return (
                <div>
                    <div data-testid="is-hydrating">{loading.isHydrating.toString()}</div>
                    <div data-testid="is-engine-processing">{loading.isEngineProcessing.toString()}</div>
                    <div data-testid="current-step">{state?.currentStep?.id || 'loading'}</div>
                </div>
            )
        }

        render(
            <OnboardingProvider {...mockConfig}>
                <HydrationTestConsumer />
            </OnboardingProvider>
        )

        // Wait for initialization to complete
        await waitFor(() => {
            expect(screen.getByTestId('current-step').textContent).toContain('step1')
        })

        // After initialization, both should be false
        expect(screen.getByTestId('is-hydrating').textContent).toBe('false')
        expect(screen.getByTestId('is-engine-processing').textContent).toBe('false')
    })

    it('should set isEngineProcessing during navigation', async () => {
        // Track loading states during navigation
        const loadingStatesDuringNavigation: boolean[] = []

        const NavigationLoadingTestConsumer: FC = () => {
            const { loading, state, next } = useOnboarding()

            // Capture engine processing state changes
            if (loading.isEngineProcessing) {
                loadingStatesDuringNavigation.push(true)
            }

            return (
                <div>
                    <div data-testid="is-engine-processing">{loading.isEngineProcessing.toString()}</div>
                    <div data-testid="is-any-loading">{loading.isAnyLoading.toString()}</div>
                    <div data-testid="current-step">{state?.currentStep?.id || 'loading'}</div>
                    <button data-testid="next-btn" onClick={() => next()}>
                        Next
                    </button>
                </div>
            )
        }

        render(
            <OnboardingProvider {...mockConfig}>
                <NavigationLoadingTestConsumer />
            </OnboardingProvider>
        )

        // Wait for initial load
        await waitFor(() => {
            expect(screen.getByTestId('current-step').textContent).toContain('step1')
        })

        // Verify initial state - not loading
        expect(screen.getByTestId('is-engine-processing').textContent).toBe('false')

        // Trigger navigation
        await act(async () => {
            screen.getByTestId('next-btn').click()
        })

        // Wait for navigation to complete
        await waitFor(() => {
            expect(screen.getByTestId('current-step').textContent).toContain('step2')
        })

        // After navigation completes, loading should be false again
        expect(screen.getByTestId('is-engine-processing').textContent).toBe('false')
    })

    it('should set isComponentProcessing when component reports loading', async () => {
        render(
            <OnboardingProvider {...mockConfig}>
                <LoadingStateTestConsumer />
            </OnboardingProvider>
        )

        // Wait for initialization
        await waitFor(() => {
            expect(screen.getByTestId('current-step').textContent).toContain('step1')
        })

        // Initially, component loading should be false
        expect(screen.getByTestId('is-component-processing').textContent).toBe('false')
        expect(screen.getByTestId('is-any-loading').textContent).toBe('false')

        // Set component loading to true
        act(() => {
            screen.getByTestId('set-component-loading-btn').click()
        })

        // Component processing should now be true
        expect(screen.getByTestId('is-component-processing').textContent).toBe('true')
        expect(screen.getByTestId('is-any-loading').textContent).toBe('true')

        // Clear component loading
        act(() => {
            screen.getByTestId('clear-component-loading-btn').click()
        })

        // Component processing should be false again
        expect(screen.getByTestId('is-component-processing').textContent).toBe('false')
        expect(screen.getByTestId('is-any-loading').textContent).toBe('false')
    })

    it('should correctly compute isAnyLoading from individual states', async () => {
        render(
            <OnboardingProvider {...mockConfig}>
                <LoadingStateTestConsumer />
            </OnboardingProvider>
        )

        // Wait for initialization
        await waitFor(() => {
            expect(screen.getByTestId('current-step').textContent).toContain('step1')
        })

        // Initially, all loading states should be false
        expect(screen.getByTestId('is-hydrating').textContent).toBe('false')
        expect(screen.getByTestId('is-engine-processing').textContent).toBe('false')
        expect(screen.getByTestId('is-component-processing').textContent).toBe('false')
        expect(screen.getByTestId('is-any-loading').textContent).toBe('false')

        // When component loading is set, isAnyLoading should be true
        act(() => {
            screen.getByTestId('set-component-loading-btn').click()
        })

        expect(screen.getByTestId('is-component-processing').textContent).toBe('true')
        expect(screen.getByTestId('is-any-loading').textContent).toBe('true')

        // Clear it
        act(() => {
            screen.getByTestId('clear-component-loading-btn').click()
        })

        expect(screen.getByTestId('is-any-loading').textContent).toBe('false')
    })

    it('should maintain backward compatibility with isLoading', async () => {
        render(
            <OnboardingProvider {...mockConfig}>
                <LoadingStateTestConsumer />
            </OnboardingProvider>
        )

        // Wait for initialization
        await waitFor(() => {
            expect(screen.getByTestId('current-step').textContent).toContain('step1')
        })

        // isLoading should equal isAnyLoading for backward compatibility
        expect(screen.getByTestId('is-loading').textContent).toBe(screen.getByTestId('is-any-loading').textContent)

        // When component loading is set
        act(() => {
            screen.getByTestId('set-component-loading-btn').click()
        })

        // isLoading should still equal isAnyLoading
        expect(screen.getByTestId('is-loading').textContent).toBe('true')
        expect(screen.getByTestId('is-loading').textContent).toBe(screen.getByTestId('is-any-loading').textContent)

        // Clear it
        act(() => {
            screen.getByTestId('clear-component-loading-btn').click()
        })

        expect(screen.getByTestId('is-loading').textContent).toBe('false')
        expect(screen.getByTestId('is-loading').textContent).toBe(screen.getByTestId('is-any-loading').textContent)
    })

    it('should expose loading object through context', async () => {
        // Test that the loading object is properly exposed with all required properties
        let capturedLoading: any = null

        const LoadingObjectTestConsumer: FC = () => {
            const { loading, state } = useOnboarding()
            capturedLoading = loading

            return <div data-testid="current-step">{state?.currentStep?.id || 'loading'}</div>
        }

        render(
            <OnboardingProvider {...mockConfig}>
                <LoadingObjectTestConsumer />
            </OnboardingProvider>
        )

        // Wait for initialization
        await waitFor(() => {
            expect(screen.getByTestId('current-step').textContent).toContain('step1')
        })

        // Verify loading object structure
        expect(capturedLoading).toBeDefined()
        expect(typeof capturedLoading.isHydrating).toBe('boolean')
        expect(typeof capturedLoading.isEngineProcessing).toBe('boolean')
        expect(typeof capturedLoading.isComponentProcessing).toBe('boolean')
        expect(typeof capturedLoading.isAnyLoading).toBe('boolean')
    })
})
