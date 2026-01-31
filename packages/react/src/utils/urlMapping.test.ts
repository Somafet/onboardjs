// @onboardjs/react/src/utils/urlMapping.test.ts
import { describe, it, expect } from 'vitest'
import { toUrlSlug, fromUrlSlug, createUrlMapper, canAccessStep } from './urlMapping'
import type { OnboardingStep } from '../types'
import type { NavigatorConfig } from '../types/navigator'
import type { OnboardingContext } from '@onboardjs/core'

describe('urlMapping utilities', () => {
    describe('toUrlSlug', () => {
        it('should convert camelCase to kebab-case', () => {
            expect(toUrlSlug('userDetails')).toBe('user-details')
            expect(toUrlSlug('selectPlan')).toBe('select-plan')
            expect(toUrlSlug('myLongStepName')).toBe('my-long-step-name')
        })

        it('should convert snake_case to kebab-case', () => {
            expect(toUrlSlug('user_details')).toBe('user-details')
            expect(toUrlSlug('select_plan')).toBe('select-plan')
            expect(toUrlSlug('my_long_step_name')).toBe('my-long-step-name')
        })

        it('should lowercase everything', () => {
            expect(toUrlSlug('UserDetails')).toBe('user-details')
            expect(toUrlSlug('SELECT_PLAN')).toBe('select-plan')
        })

        it('should convert numeric IDs to strings', () => {
            expect(toUrlSlug(1)).toBe('1')
            expect(toUrlSlug(123)).toBe('123')
        })

        it('should handle already kebab-case strings', () => {
            expect(toUrlSlug('user-details')).toBe('user-details')
            expect(toUrlSlug('select-plan')).toBe('select-plan')
        })

        it('should handle simple strings', () => {
            expect(toUrlSlug('welcome')).toBe('welcome')
            expect(toUrlSlug('intro')).toBe('intro')
        })
    })

    describe('fromUrlSlug', () => {
        it('should return the slug as-is', () => {
            expect(fromUrlSlug('user-details')).toBe('user-details')
            expect(fromUrlSlug('select-plan')).toBe('select-plan')
        })
    })

    describe('createUrlMapper', () => {
        const createTestSteps = (): OnboardingStep[] => [
            { id: 'welcome' },
            { id: 'user_details' },
            { id: 'selectPlan' },
            { id: 'confirmation' },
        ]

        const createTestContext = (): OnboardingContext => ({
            flowData: {},
        })

        describe('with auto URL mapping', () => {
            it('should generate URLs from step IDs', () => {
                const steps = createTestSteps()
                const config: NavigatorConfig = {
                    navigator: { navigate: () => {}, getCurrentPath: () => '/onboarding' },
                    basePath: '/onboarding',
                    urlMapping: 'auto',
                }
                const mapper = createUrlMapper(config, steps)
                const context = createTestContext()

                expect(mapper.stepIdToUrl('welcome', context)).toBe('/onboarding/welcome')
                expect(mapper.stepIdToUrl('user_details', context)).toBe('/onboarding/user-details')
                expect(mapper.stepIdToUrl('selectPlan', context)).toBe('/onboarding/select-plan')
            })

            it('should reverse lookup step IDs from URLs', () => {
                const steps = createTestSteps()
                const config: NavigatorConfig = {
                    navigator: { navigate: () => {}, getCurrentPath: () => '/onboarding' },
                    basePath: '/onboarding',
                    urlMapping: 'auto',
                }
                const mapper = createUrlMapper(config, steps)

                expect(mapper.urlToStepId('/onboarding/welcome')).toBe('welcome')
                expect(mapper.urlToStepId('/onboarding/user-details')).toBe('user_details')
                expect(mapper.urlToStepId('/onboarding/select-plan')).toBe('selectPlan')
            })
        })

        describe('with custom URL mapping', () => {
            it('should use custom static mappings', () => {
                const steps = createTestSteps()
                const config: NavigatorConfig = {
                    navigator: { navigate: () => {}, getCurrentPath: () => '/onboarding' },
                    basePath: '/onboarding',
                    urlMapping: {
                        user_details: 'profile-setup',
                        selectPlan: 'choose-plan',
                    },
                }
                const mapper = createUrlMapper(config, steps)
                const context = createTestContext()

                expect(mapper.stepIdToUrl('user_details', context)).toBe('/onboarding/profile-setup')
                expect(mapper.stepIdToUrl('selectPlan', context)).toBe('/onboarding/choose-plan')
                // Fallback to auto for unmapped steps
                expect(mapper.stepIdToUrl('welcome', context)).toBe('/onboarding/welcome')
            })

            it('should use custom dynamic mappings', () => {
                interface TestContext extends OnboardingContext {
                    isPremium?: boolean
                }
                const steps: OnboardingStep<TestContext>[] = createTestSteps()
                const config: NavigatorConfig<TestContext> = {
                    navigator: { navigate: () => {}, getCurrentPath: () => '/onboarding' },
                    basePath: '/onboarding',
                    urlMapping: {
                        selectPlan: (ctx) => (ctx.isPremium ? 'premium-plan' : 'standard-plan'),
                    },
                }
                const mapper = createUrlMapper(config, steps)

                expect(mapper.stepIdToUrl('selectPlan', { flowData: {}, isPremium: true })).toBe(
                    '/onboarding/premium-plan'
                )
                expect(mapper.stepIdToUrl('selectPlan', { flowData: {}, isPremium: false })).toBe(
                    '/onboarding/standard-plan'
                )
            })

            it('should reverse lookup custom static mappings', () => {
                const steps = createTestSteps()
                const config: NavigatorConfig = {
                    navigator: { navigate: () => {}, getCurrentPath: () => '/onboarding' },
                    basePath: '/onboarding',
                    urlMapping: {
                        user_details: 'profile-setup',
                    },
                }
                const mapper = createUrlMapper(config, steps)

                expect(mapper.urlToStepId('/onboarding/profile-setup')).toBe('user_details')
            })
        })

        describe('basePath normalization', () => {
            it('should normalize basePath with leading slash', () => {
                const steps = createTestSteps()
                const config: NavigatorConfig = {
                    navigator: { navigate: () => {}, getCurrentPath: () => '/setup' },
                    basePath: 'setup', // No leading slash
                }
                const mapper = createUrlMapper(config, steps)
                const context = createTestContext()

                expect(mapper.stepIdToUrl('welcome', context)).toBe('/setup/welcome')
            })

            it('should normalize basePath with trailing slash', () => {
                const steps = createTestSteps()
                const config: NavigatorConfig = {
                    navigator: { navigate: () => {}, getCurrentPath: () => '/setup/' },
                    basePath: '/setup/', // Trailing slash
                }
                const mapper = createUrlMapper(config, steps)
                const context = createTestContext()

                expect(mapper.stepIdToUrl('welcome', context)).toBe('/setup/welcome')
            })
        })

        describe('isOnboardingUrl', () => {
            it('should return true for URLs starting with basePath', () => {
                const steps = createTestSteps()
                const config: NavigatorConfig = {
                    navigator: { navigate: () => {}, getCurrentPath: () => '/onboarding' },
                    basePath: '/onboarding',
                }
                const mapper = createUrlMapper(config, steps)

                expect(mapper.isOnboardingUrl('/onboarding/welcome')).toBe(true)
                expect(mapper.isOnboardingUrl('/onboarding/unknown-step')).toBe(true)
                expect(mapper.isOnboardingUrl('/other/path')).toBe(false)
                expect(mapper.isOnboardingUrl('/dashboard')).toBe(false)
            })
        })

        describe('urlToStepId edge cases', () => {
            it('should return null for non-onboarding URLs', () => {
                const steps = createTestSteps()
                const config: NavigatorConfig = {
                    navigator: { navigate: () => {}, getCurrentPath: () => '/onboarding' },
                    basePath: '/onboarding',
                }
                const mapper = createUrlMapper(config, steps)

                expect(mapper.urlToStepId('/other/path')).toBe(null)
            })

            it('should return null for unknown step slugs', () => {
                const steps = createTestSteps()
                const config: NavigatorConfig = {
                    navigator: { navigate: () => {}, getCurrentPath: () => '/onboarding' },
                    basePath: '/onboarding',
                }
                const mapper = createUrlMapper(config, steps)

                expect(mapper.urlToStepId('/onboarding/nonexistent-step')).toBe(null)
            })

            it('should return null for empty path after basePath', () => {
                const steps = createTestSteps()
                const config: NavigatorConfig = {
                    navigator: { navigate: () => {}, getCurrentPath: () => '/onboarding' },
                    basePath: '/onboarding',
                }
                const mapper = createUrlMapper(config, steps)

                expect(mapper.urlToStepId('/onboarding')).toBe(null)
                expect(mapper.urlToStepId('/onboarding/')).toBe(null)
            })

            it('should strip query strings and hashes from URLs', () => {
                const steps = createTestSteps()
                const config: NavigatorConfig = {
                    navigator: { navigate: () => {}, getCurrentPath: () => '/onboarding' },
                    basePath: '/onboarding',
                }
                const mapper = createUrlMapper(config, steps)

                expect(mapper.urlToStepId('/onboarding/welcome?foo=bar')).toBe('welcome')
                expect(mapper.urlToStepId('/onboarding/welcome#section')).toBe('welcome')
            })
        })
    })

    describe('canAccessStep', () => {
        const createTestSteps = (): OnboardingStep[] => [
            { id: 'step1' },
            { id: 'step2' },
            { id: 'step3' },
            { id: 'step4' },
        ]

        it('should allow access to the current step', () => {
            const steps = createTestSteps()
            const completedSteps = new Set<string | number>()

            expect(canAccessStep('step2', 'step2', completedSteps, steps)).toBe(true)
        })

        it('should allow access to completed steps', () => {
            const steps = createTestSteps()
            const completedSteps = new Set<string | number>(['step1', 'step2'])

            expect(canAccessStep('step1', 'step3', completedSteps, steps)).toBe(true)
            expect(canAccessStep('step2', 'step3', completedSteps, steps)).toBe(true)
        })

        it('should deny access to future steps', () => {
            const steps = createTestSteps()
            const completedSteps = new Set<string | number>(['step1'])

            expect(canAccessStep('step3', 'step2', completedSteps, steps)).toBe(false)
            expect(canAccessStep('step4', 'step2', completedSteps, steps)).toBe(false)
        })

        it('should deny access to unknown steps', () => {
            const steps = createTestSteps()
            const completedSteps = new Set<string | number>()

            expect(canAccessStep('unknown', 'step1', completedSteps, steps)).toBe(false)
        })

        it('should handle null current step', () => {
            const steps = createTestSteps()
            const completedSteps = new Set<string | number>()

            expect(canAccessStep('step1', null, completedSteps, steps)).toBe(false)
        })
    })
})
