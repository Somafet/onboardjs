// @onboardjs/react/src/utils/configHash.test.ts
import { describe, it, expect } from 'vitest'
import { createStepsHash, createConfigHash, areStepsEqual } from './configHash'
import { OnboardingStep } from '@onboardjs/core'

describe('configHash utilities', () => {
    describe('createStepsHash', () => {
        it('should return "empty" for empty steps array', () => {
            expect(createStepsHash([])).toBe('empty')
        })

        it('should return "empty" for undefined/null steps', () => {
            expect(createStepsHash(undefined as unknown as OnboardingStep[])).toBe('empty')
            expect(createStepsHash(null as unknown as OnboardingStep[])).toBe('empty')
        })

        it('should create consistent hash for same steps', () => {
            const steps: OnboardingStep[] = [
                { id: 'step1', type: 'INFORMATION', payload: { title: 'Welcome' } },
                {
                    id: 'step2',
                    type: 'SINGLE_CHOICE',
                    payload: { question: 'Pick one', dataKey: 'choice', options: [] },
                },
            ]

            const hash1 = createStepsHash(steps)
            const hash2 = createStepsHash(steps)

            expect(hash1).toBe(hash2)
        })

        it('should create different hash for different step IDs', () => {
            const steps1: OnboardingStep[] = [{ id: 'step1', type: 'INFORMATION' }]
            const steps2: OnboardingStep[] = [{ id: 'step2', type: 'INFORMATION' }]

            expect(createStepsHash(steps1)).not.toBe(createStepsHash(steps2))
        })

        it('should create different hash for different step types', () => {
            const steps1: OnboardingStep[] = [{ id: 'step1', type: 'INFORMATION' }]
            const steps2: OnboardingStep[] = [
                { id: 'step1', type: 'SINGLE_CHOICE', payload: { question: 'Q', dataKey: 'k', options: [] } },
            ]

            expect(createStepsHash(steps1)).not.toBe(createStepsHash(steps2))
        })

        it('should create different hash for different payloads', () => {
            const steps1: OnboardingStep[] = [{ id: 'step1', type: 'INFORMATION', payload: { title: 'A' } }]
            const steps2: OnboardingStep[] = [{ id: 'step1', type: 'INFORMATION', payload: { title: 'B' } }]

            expect(createStepsHash(steps1)).not.toBe(createStepsHash(steps2))
        })

        it('should create same hash when only callback references change', () => {
            const callback1 = () => {
                // callback 1
            }
            const callback2 = () => {
                // callback 2
            }

            const steps1: OnboardingStep[] = [
                {
                    id: 'step1',
                    type: 'INFORMATION',
                    onStepActive: callback1,
                    onStepComplete: callback1,
                },
            ]

            const steps2: OnboardingStep[] = [
                {
                    id: 'step1',
                    type: 'INFORMATION',
                    onStepActive: callback2,
                    onStepComplete: callback2,
                },
            ]

            // The hash should be the same because we only care that callbacks exist,
            // not their identity
            expect(createStepsHash(steps1)).toBe(createStepsHash(steps2))
        })

        it('should create different hash when callback presence changes', () => {
            const steps1: OnboardingStep[] = [
                {
                    id: 'step1',
                    type: 'INFORMATION',
                    onStepActive: () => {},
                },
            ]

            const steps2: OnboardingStep[] = [
                {
                    id: 'step1',
                    type: 'INFORMATION',
                    // no onStepActive
                },
            ]

            expect(createStepsHash(steps1)).not.toBe(createStepsHash(steps2))
        })
    })

    describe('createConfigHash', () => {
        it('should create consistent hash for same config', () => {
            const config = {
                steps: [{ id: 'step1', type: 'INFORMATION' as const }],
                initialStepId: 'step1',
                debug: true,
            }

            const hash1 = createConfigHash(config)
            const hash2 = createConfigHash(config)

            expect(hash1).toBe(hash2)
        })

        it('should create different hash for different initialStepId', () => {
            const config1 = {
                steps: [{ id: 'step1', type: 'INFORMATION' as const }],
                initialStepId: 'step1',
            }
            const config2 = {
                steps: [{ id: 'step1', type: 'INFORMATION' as const }],
                initialStepId: 'step2',
            }

            expect(createConfigHash(config1)).not.toBe(createConfigHash(config2))
        })

        it('should create different hash for different debug setting', () => {
            const config1 = {
                steps: [{ id: 'step1', type: 'INFORMATION' as const }],
                debug: true,
            }
            const config2 = {
                steps: [{ id: 'step1', type: 'INFORMATION' as const }],
                debug: false,
            }

            expect(createConfigHash(config1)).not.toBe(createConfigHash(config2))
        })

        it('should create different hash for different plugin count', () => {
            const config1 = {
                steps: [{ id: 'step1', type: 'INFORMATION' as const }],
                plugins: [{}, {}],
            }
            const config2 = {
                steps: [{ id: 'step1', type: 'INFORMATION' as const }],
                plugins: [{}],
            }

            expect(createConfigHash(config1)).not.toBe(createConfigHash(config2))
        })

        it('should create same hash when initialContext has same serialized value', () => {
            const config1 = {
                steps: [{ id: 'step1', type: 'INFORMATION' as const }],
                initialContext: { flowData: { key: 'value' } },
            }
            const config2 = {
                steps: [{ id: 'step1', type: 'INFORMATION' as const }],
                initialContext: { flowData: { key: 'value' } },
            }

            expect(createConfigHash(config1)).toBe(createConfigHash(config2))
        })
    })

    describe('areStepsEqual', () => {
        it('should return true for identical steps', () => {
            const steps: OnboardingStep[] = [
                { id: 'step1', type: 'INFORMATION' },
                { id: 'step2', type: 'SINGLE_CHOICE', payload: { question: 'Q', dataKey: 'k', options: [] } },
            ]

            expect(areStepsEqual(steps, steps)).toBe(true)
        })

        it('should return true for structurally equal steps', () => {
            const steps1: OnboardingStep[] = [{ id: 'step1', type: 'INFORMATION', payload: { title: 'Hello' } }]
            const steps2: OnboardingStep[] = [{ id: 'step1', type: 'INFORMATION', payload: { title: 'Hello' } }]

            expect(areStepsEqual(steps1, steps2)).toBe(true)
        })

        it('should return false for different length arrays', () => {
            const steps1: OnboardingStep[] = [{ id: 'step1', type: 'INFORMATION' }]
            const steps2: OnboardingStep[] = [
                { id: 'step1', type: 'INFORMATION' },
                { id: 'step2', type: 'INFORMATION' },
            ]

            expect(areStepsEqual(steps1, steps2)).toBe(false)
        })

        it('should return false for different step content', () => {
            const steps1: OnboardingStep[] = [{ id: 'step1', type: 'INFORMATION', payload: { title: 'A' } }]
            const steps2: OnboardingStep[] = [{ id: 'step1', type: 'INFORMATION', payload: { title: 'B' } }]

            expect(areStepsEqual(steps1, steps2)).toBe(false)
        })
    })
})
