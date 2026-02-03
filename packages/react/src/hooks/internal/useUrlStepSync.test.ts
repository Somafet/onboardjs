// @onboardjs/react/src/hooks/internal/useUrlStepSync.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useUrlStepSync } from './useUrlStepSync'
import type { OnboardingNavigator, NavigatorConfig } from '../../types/navigator'
import type { OnboardingStep } from '../../types'
import type { OnboardingContext, OnboardingEngine, EngineState } from '@onboardjs/core'

// Mock navigator
const createMockNavigator = (currentPath = '/onboarding/step1'): OnboardingNavigator => {
    let path = currentPath
    let routeChangeCallback: ((path: string) => void) | null = null

    return {
        navigate: vi.fn((newPath: string) => {
            path = newPath
        }),
        getCurrentPath: () => path,
        onRouteChange: vi.fn((callback) => {
            routeChangeCallback = callback
            return () => {
                routeChangeCallback = null
            }
        }),
        back: vi.fn(),
        // Expose for testing
        _simulateRouteChange: (newPath: string) => {
            path = newPath
            routeChangeCallback?.(newPath)
        },
    } as OnboardingNavigator & { _simulateRouteChange: (path: string) => void }
}

// Mock engine
const createMockEngine = (currentStepId = 'step1') => {
    const listeners: Map<string, Set<(event: unknown) => void>> = new Map()

    const mockEngine = {
        getState: vi.fn(
            () =>
                ({
                    currentStep: { id: currentStepId },
                    context: {
                        flowData: {
                            _internal: {
                                completedSteps: {},
                            },
                        },
                    },
                    isCompleted: false,
                    isHydrating: false,
                    isLoading: false,
                    error: null,
                }) as unknown as EngineState
        ),
        goToStep: vi.fn().mockResolvedValue(undefined),
        addEventListener: vi.fn((event: string, callback: (event: unknown) => void) => {
            if (!listeners.has(event)) {
                listeners.set(event, new Set())
            }
            listeners.get(event)!.add(callback)
            return () => {
                listeners.get(event)?.delete(callback)
            }
        }),
        // Helper to emit events in tests
        _emit: (event: string, data: unknown) => {
            listeners.get(event)?.forEach((cb) => cb(data))
        },
    }

    return mockEngine as unknown as OnboardingEngine & { _emit: (event: string, data: unknown) => void }
}

describe('useUrlStepSync', () => {
    const steps: OnboardingStep[] = [{ id: 'step1' }, { id: 'step2' }, { id: 'step3' }]

    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('without navigator config', () => {
        it('should return null urlMapper when no navigator is configured', () => {
            const engine = createMockEngine()

            const { result } = renderHook(() =>
                useUrlStepSync({
                    navigatorConfig: undefined,
                    engine,
                    isEngineReady: true,
                    steps,
                })
            )

            expect(result.current.urlMapper).toBe(null)
        })

        it('should not throw when syncUrlToStep is called without navigator', () => {
            const engine = createMockEngine()

            const { result } = renderHook(() =>
                useUrlStepSync({
                    navigatorConfig: undefined,
                    engine,
                    isEngineReady: true,
                    steps,
                })
            )

            expect(() => result.current.syncUrlToStep()).not.toThrow()
        })
    })

    describe('with navigator config', () => {
        it('should create a urlMapper', () => {
            const navigator = createMockNavigator()
            const engine = createMockEngine()
            const config: NavigatorConfig = {
                navigator,
                basePath: '/onboarding',
            }

            const { result } = renderHook(() =>
                useUrlStepSync({
                    navigatorConfig: config,
                    engine,
                    isEngineReady: true,
                    steps,
                })
            )

            expect(result.current.urlMapper).not.toBe(null)
            expect(result.current.urlMapper?.stepIdToUrl('step1', { flowData: {} })).toBe('/onboarding/step1')
        })

        it('should sync URL when engine state changes', async () => {
            const navigator = createMockNavigator('/onboarding/step1')
            const engine = createMockEngine('step1')
            const config: NavigatorConfig = {
                navigator,
                basePath: '/onboarding',
            }

            renderHook(() =>
                useUrlStepSync({
                    navigatorConfig: config,
                    engine,
                    isEngineReady: true,
                    steps,
                })
            )

            // Simulate step change
            ;(engine.getState as ReturnType<typeof vi.fn>).mockReturnValue({
                currentStep: { id: 'step2' },
                context: {
                    flowData: {
                        _internal: { completedSteps: { step1: Date.now() } },
                    },
                },
            })

            await act(async () => {
                engine._emit('stateChange', {
                    state: {
                        currentStep: { id: 'step2' },
                        context: { flowData: { _internal: { completedSteps: { step1: Date.now() } } } },
                    },
                })
            })

            await waitFor(() => {
                expect(navigator.navigate).toHaveBeenCalledWith('/onboarding/step2', { replace: false })
            })
        })

        it('should not sync URL when syncUrl is false', async () => {
            const navigator = createMockNavigator('/onboarding/step1')
            const engine = createMockEngine('step1')
            const config: NavigatorConfig = {
                navigator,
                basePath: '/onboarding',
                syncUrl: false,
            }

            renderHook(() =>
                useUrlStepSync({
                    navigatorConfig: config,
                    engine,
                    isEngineReady: true,
                    steps,
                })
            )

            // Simulate step change
            await act(async () => {
                engine._emit('stateChange', {
                    state: {
                        currentStep: { id: 'step2' },
                        context: { flowData: {} },
                    },
                })
            })

            // Should not navigate
            expect(navigator.navigate).not.toHaveBeenCalled()
        })

        it('should not sync URL when engine is not ready', () => {
            const navigator = createMockNavigator('/onboarding/step1')
            const engine = createMockEngine('step1')
            const config: NavigatorConfig = {
                navigator,
                basePath: '/onboarding',
            }

            const { result } = renderHook(() =>
                useUrlStepSync({
                    navigatorConfig: config,
                    engine,
                    isEngineReady: false, // Not ready
                    steps,
                })
            )

            result.current.syncUrlToStep()

            expect(navigator.navigate).not.toHaveBeenCalled()
        })
    })

    describe('syncUrlToStep', () => {
        it('should update URL to match current step', async () => {
            const navigator = createMockNavigator('/onboarding/step1')
            const engine = createMockEngine('step1')
            const config: NavigatorConfig = {
                navigator,
                basePath: '/onboarding',
            }

            const { result } = renderHook(() =>
                useUrlStepSync({
                    navigatorConfig: config,
                    engine,
                    isEngineReady: true,
                    steps,
                })
            )

            // Simulate step change to step2
            ;(engine.getState as ReturnType<typeof vi.fn>).mockReturnValue({
                currentStep: { id: 'step2' },
                context: {
                    flowData: {
                        _internal: { completedSteps: { step1: Date.now() } },
                    },
                },
            })

            // Trigger sync
            await act(async () => {
                result.current.syncUrlToStep()
            })

            expect(navigator.navigate).toHaveBeenCalledWith('/onboarding/step2', { replace: false })
        })

        it('should not navigate when URL already matches step', () => {
            const navigator = createMockNavigator('/onboarding/step1')
            const engine = createMockEngine('step1')
            const config: NavigatorConfig = {
                navigator,
                basePath: '/onboarding',
            }

            const { result } = renderHook(() =>
                useUrlStepSync({
                    navigatorConfig: config,
                    engine,
                    isEngineReady: true,
                    steps,
                })
            )

            act(() => {
                result.current.syncUrlToStep()
            })

            expect(navigator.navigate).not.toHaveBeenCalled()
        })
    })

    describe('URL mapper functionality', () => {
        it('should convert step IDs to URLs', () => {
            const navigator = createMockNavigator()
            const engine = createMockEngine()
            const config: NavigatorConfig = {
                navigator,
                basePath: '/onboarding',
            }

            const { result } = renderHook(() =>
                useUrlStepSync({
                    navigatorConfig: config,
                    engine,
                    isEngineReady: true,
                    steps,
                })
            )

            const context: OnboardingContext = { flowData: {} }
            expect(result.current.urlMapper?.stepIdToUrl('step1', context)).toBe('/onboarding/step1')
            expect(result.current.urlMapper?.stepIdToUrl('step2', context)).toBe('/onboarding/step2')
        })

        it('should convert URLs to step IDs', () => {
            const navigator = createMockNavigator()
            const engine = createMockEngine()
            const config: NavigatorConfig = {
                navigator,
                basePath: '/onboarding',
            }

            const { result } = renderHook(() =>
                useUrlStepSync({
                    navigatorConfig: config,
                    engine,
                    isEngineReady: true,
                    steps,
                })
            )

            expect(result.current.urlMapper?.urlToStepId('/onboarding/step1')).toBe('step1')
            expect(result.current.urlMapper?.urlToStepId('/onboarding/step2')).toBe('step2')
        })

        it('should check if URL is an onboarding URL', () => {
            const navigator = createMockNavigator()
            const engine = createMockEngine()
            const config: NavigatorConfig = {
                navigator,
                basePath: '/onboarding',
            }

            const { result } = renderHook(() =>
                useUrlStepSync({
                    navigatorConfig: config,
                    engine,
                    isEngineReady: true,
                    steps,
                })
            )

            expect(result.current.urlMapper?.isOnboardingUrl('/onboarding/step1')).toBe(true)
            expect(result.current.urlMapper?.isOnboardingUrl('/dashboard')).toBe(false)
        })
    })
})
