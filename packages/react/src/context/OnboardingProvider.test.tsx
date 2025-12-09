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
