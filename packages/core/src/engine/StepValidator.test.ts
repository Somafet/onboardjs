// src/engine/StepValidator.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { StepValidator } from './StepValidator'
import { OnboardingStep, OnboardingContext } from '../types'

describe('StepValidator', () => {
    let validator: StepValidator<OnboardingContext>

    beforeEach(() => {
        validator = new StepValidator<OnboardingContext>(100, false)
    })

    describe('ID Uniqueness Validation', () => {
        it('should pass validation for unique step IDs', () => {
            const steps: OnboardingStep[] = [
                { id: 'step1', type: 'INFORMATION', payload: {} },
                { id: 'step2', type: 'INFORMATION', payload: {} },
                { id: 'step3', type: 'INFORMATION', payload: {} },
            ]

            const result = validator.validateSteps(steps)

            expect(result.isValid).toBe(true)
            expect(result.errors).toHaveLength(0)
        })

        it('should detect duplicate step IDs', () => {
            const steps: OnboardingStep[] = [
                { id: 'step1', type: 'INFORMATION', payload: {} },
                { id: 'step2', type: 'INFORMATION', payload: {} },
                { id: 'step1', type: 'INFORMATION', payload: {} }, // Duplicate
            ]

            const result = validator.validateSteps(steps)

            expect(result.isValid).toBe(false)
            expect(result.errors).toHaveLength(1)
            expect(result.errors[0].errorType).toBe('DUPLICATE_ID')
            expect(result.errors[0].stepId).toBe('step1')
            expect(result.errors[0].message).toContain('Duplicate step ID')
        })

        it('should detect missing step IDs', () => {
            const steps: OnboardingStep[] = [
                { id: 'step1', type: 'INFORMATION', payload: {} },
                { id: '', type: 'INFORMATION', payload: {} } as any, // Missing ID
            ]

            const result = validator.validateSteps(steps)

            expect(result.isValid).toBe(false)
            expect(result.errors.length).toBeGreaterThan(0)
            const missingIdError = result.errors.find((e) => e.errorType === 'MISSING_ID')
            expect(missingIdError).toBeDefined()
        })

        it('should detect multiple duplicate IDs', () => {
            const steps: OnboardingStep[] = [
                { id: 'step1', type: 'INFORMATION', payload: {} },
                { id: 'step1', type: 'INFORMATION', payload: {} }, // Duplicate 1
                { id: 'step2', type: 'INFORMATION', payload: {} },
                { id: 'step2', type: 'INFORMATION', payload: {} }, // Duplicate 2
            ]

            const result = validator.validateSteps(steps)

            expect(result.isValid).toBe(false)
            expect(result.errors).toHaveLength(2)
            expect(result.errors.every((e) => e.errorType === 'DUPLICATE_ID')).toBe(true)
        })
    })

    describe('Circular Navigation Detection', () => {
        it('should detect simple circular navigation', () => {
            const steps: OnboardingStep[] = [
                { id: 'step1', type: 'INFORMATION', payload: {}, nextStep: 'step2' },
                { id: 'step2', type: 'INFORMATION', payload: {}, nextStep: 'step1' }, // Circular
            ]

            const result = validator.validateSteps(steps)

            expect(result.isValid).toBe(false)
            const circularError = result.errors.find((e) => e.errorType === 'CIRCULAR_NAVIGATION')
            expect(circularError).toBeDefined()
            expect(circularError?.message).toContain('Circular navigation detected')
        })

        it('should detect complex circular navigation', () => {
            const steps: OnboardingStep[] = [
                { id: 'step1', type: 'INFORMATION', payload: {}, nextStep: 'step2' },
                { id: 'step2', type: 'INFORMATION', payload: {}, nextStep: 'step3' },
                { id: 'step3', type: 'INFORMATION', payload: {}, nextStep: 'step1' }, // Circular back to step1
            ]

            const result = validator.validateSteps(steps)

            expect(result.isValid).toBe(false)
            const circularError = result.errors.find((e) => e.errorType === 'CIRCULAR_NAVIGATION')
            expect(circularError).toBeDefined()
            expect(circularError?.details?.cycle).toContain('step1')
            expect(circularError?.details?.cycle).toContain('step2')
            expect(circularError?.details?.cycle).toContain('step3')
        })

        it('should not flag linear navigation as circular', () => {
            const steps: OnboardingStep[] = [
                { id: 'step1', type: 'INFORMATION', payload: {}, nextStep: 'step2' },
                { id: 'step2', type: 'INFORMATION', payload: {}, nextStep: 'step3' },
                { id: 'step3', type: 'INFORMATION', payload: {}, nextStep: null },
            ]

            const result = validator.validateSteps(steps)

            expect(result.isValid).toBe(true)
            const circularError = result.errors.find((e) => e.errorType === 'CIRCULAR_NAVIGATION')
            expect(circularError).toBeUndefined()
        })

        it('should detect circular navigation in skip paths', () => {
            const steps: OnboardingStep[] = [
                { id: 'step1', type: 'INFORMATION', payload: {}, isSkippable: true, skipToStep: 'step2' },
                { id: 'step2', type: 'INFORMATION', payload: {}, isSkippable: true, skipToStep: 'step1' }, // Circular skip
            ]

            const result = validator.validateSteps(steps)

            expect(result.isValid).toBe(false)
            const circularError = result.errors.find((e) => e.errorType === 'CIRCULAR_NAVIGATION')
            expect(circularError).toBeDefined()
        })

        it('should handle self-referencing step', () => {
            const steps: OnboardingStep[] = [
                { id: 'step1', type: 'INFORMATION', payload: {}, nextStep: 'step1' }, // Self-reference
            ]

            const result = validator.validateSteps(steps)

            expect(result.isValid).toBe(false)
            const circularError = result.errors.find((e) => e.errorType === 'CIRCULAR_NAVIGATION')
            expect(circularError).toBeDefined()
            expect(circularError?.details?.cycle).toEqual(['step1', 'step1'])
        })

        it('should detect depth limit exceeded', () => {
            const smallDepthValidator = new StepValidator<OnboardingContext>(5, false)

            const steps: OnboardingStep[] = [
                { id: 'step1', type: 'INFORMATION', payload: {}, nextStep: 'step2' },
                { id: 'step2', type: 'INFORMATION', payload: {}, nextStep: 'step3' },
                { id: 'step3', type: 'INFORMATION', payload: {}, nextStep: 'step4' },
                { id: 'step4', type: 'INFORMATION', payload: {}, nextStep: 'step5' },
                { id: 'step5', type: 'INFORMATION', payload: {}, nextStep: 'step6' },
                { id: 'step6', type: 'INFORMATION', payload: {}, nextStep: 'step7' },
            ]

            const result = smallDepthValidator.validateSteps(steps)

            expect(result.isValid).toBe(false)
            const depthError = result.errors.find(
                (e) => e.errorType === 'CIRCULAR_NAVIGATION' && e.message.includes('depth exceeds')
            )
            expect(depthError).toBeDefined()
        })

        it('should not check previousStep for cycles (backward navigation is expected)', () => {
            const steps: OnboardingStep[] = [
                { id: 'step1', type: 'INFORMATION', payload: {}, nextStep: 'step2', previousStep: 'step2' },
                { id: 'step2', type: 'INFORMATION', payload: {}, nextStep: null, previousStep: 'step1' },
            ]

            const result = validator.validateSteps(steps)

            // Should be valid - previousStep cycles are normal for back navigation
            expect(result.isValid).toBe(true)
        })
    })

    describe('Step Structure Validation', () => {
        // Note: 'type' property is optional and defaults to 'INFORMATION', so no test for missing type

        it('should validate CUSTOM_COMPONENT requires componentKey', () => {
            const steps: OnboardingStep[] = [
                { id: 'step1', type: 'CUSTOM_COMPONENT', payload: {} }, // Missing componentKey
            ]

            const result = validator.validateSteps(steps)

            expect(result.isValid).toBe(false)
            const payloadError = result.errors.find((e) => e.errorType === 'INVALID_PAYLOAD')
            expect(payloadError).toBeDefined()
            expect(payloadError?.message).toContain('componentKey')
        })

        it('should validate SINGLE_CHOICE requires options array', () => {
            const steps: OnboardingStep[] = [
                { id: 'step1', type: 'SINGLE_CHOICE', payload: {} } as any, // Missing options
            ]

            const result = validator.validateSteps(steps)

            expect(result.isValid).toBe(false)
            const payloadError = result.errors.find((e) => e.errorType === 'INVALID_PAYLOAD')
            expect(payloadError).toBeDefined()
            expect(payloadError?.message).toContain('options')
        })

        it('should validate MULTIPLE_CHOICE requires options array', () => {
            const steps: OnboardingStep[] = [
                { id: 'step1', type: 'MULTIPLE_CHOICE', payload: { options: [] } }, // Empty options
            ]

            const result = validator.validateSteps(steps)

            expect(result.isValid).toBe(false)
            const payloadError = result.errors.find((e) => e.errorType === 'INVALID_PAYLOAD')
            expect(payloadError).toBeDefined()
        })

        it('should validate CHECKLIST requires dataKey and items', () => {
            const steps: OnboardingStep[] = [
                { id: 'step1', type: 'CHECKLIST', payload: {} } as any, // Missing dataKey and items
            ]

            const result = validator.validateSteps(steps)

            expect(result.isValid).toBe(false)
            expect(result.errors.filter((e) => e.errorType === 'INVALID_PAYLOAD')).toHaveLength(2)
        })

        it('should pass valid step structures', () => {
            const steps: OnboardingStep[] = [
                {
                    id: 'step1',
                    type: 'CUSTOM_COMPONENT',
                    payload: { componentKey: 'MyComponent' },
                },
                {
                    id: 'step2',
                    type: 'SINGLE_CHOICE',
                    payload: {
                        options: [{ id: 'opt1', label: 'Option 1', value: '1' }],
                    },
                },
                {
                    id: 'step3',
                    type: 'CHECKLIST',
                    payload: {
                        dataKey: 'checklist',
                        items: [{ id: 'item1', label: 'Item 1' }],
                    },
                },
            ]

            const result = validator.validateSteps(steps)

            expect(result.isValid).toBe(true)
            expect(result.errors).toHaveLength(0)
        })
    })

    describe('Static Reference Validation', () => {
        it('should warn about broken nextStep references', () => {
            const steps: OnboardingStep[] = [{ id: 'step1', type: 'INFORMATION', payload: {}, nextStep: 'nonexistent' }]

            const result = validator.validateSteps(steps)

            expect(result.warnings.find((w) => w.warningType === 'BROKEN_LINK')).toBeDefined()
        })

        it('should warn about broken previousStep references', () => {
            const steps: OnboardingStep[] = [
                { id: 'step1', type: 'INFORMATION', payload: {}, previousStep: 'nonexistent' },
            ]

            const result = validator.validateSteps(steps)

            expect(result.warnings.find((w) => w.warningType === 'BROKEN_LINK')).toBeDefined()
        })

        it('should warn about broken skipToStep references', () => {
            const steps: OnboardingStep[] = [
                {
                    id: 'step1',
                    type: 'INFORMATION',
                    payload: {},
                    isSkippable: true,
                    skipToStep: 'nonexistent',
                },
            ]

            const result = validator.validateSteps(steps)

            expect(result.warnings.find((w) => w.warningType === 'BROKEN_LINK')).toBeDefined()
        })

        it('should not warn about null navigation references', () => {
            const steps: OnboardingStep[] = [{ id: 'step1', type: 'INFORMATION', payload: {}, nextStep: null }]

            const result = validator.validateSteps(steps)

            expect(result.warnings.filter((w) => w.warningType === 'BROKEN_LINK')).toHaveLength(0)
        })

        it('should not check function-based navigation references', () => {
            const steps: OnboardingStep[] = [
                {
                    id: 'step1',
                    type: 'INFORMATION',
                    payload: {},
                    nextStep: () => 'step2', // Function - not validated
                },
            ]

            const result = validator.validateSteps(steps)

            expect(result.warnings.filter((w) => w.warningType === 'BROKEN_LINK')).toHaveLength(0)
        })
    })

    describe('Unreachable Step Detection', () => {
        it('should detect unreachable steps with static navigation', () => {
            const steps: OnboardingStep[] = [
                { id: 'step1', type: 'INFORMATION', payload: {}, nextStep: 'step2' },
                { id: 'step2', type: 'INFORMATION', payload: {}, nextStep: null },
                { id: 'step3', type: 'INFORMATION', payload: {}, nextStep: null }, // Unreachable
            ]

            const result = validator.validateSteps(steps)

            const unreachableWarning = result.warnings.find(
                (w) => w.warningType === 'UNREACHABLE_STEP' && w.stepId === 'step3'
            )
            expect(unreachableWarning).toBeDefined()
        })

        it('should not warn about unreachable steps with dynamic navigation', () => {
            const steps: OnboardingStep[] = [
                {
                    id: 'step1',
                    type: 'INFORMATION',
                    payload: {},
                    nextStep: (ctx) => (ctx.flowData.skipToEnd ? 'step3' : 'step2'),
                },
                { id: 'step2', type: 'INFORMATION', payload: {}, nextStep: null },
                { id: 'step3', type: 'INFORMATION', payload: {}, nextStep: null }, // May be reachable via function
            ]

            const result = validator.validateSteps(steps)

            const unreachableWarning = result.warnings.find(
                (w) => w.warningType === 'UNREACHABLE_STEP' && w.stepId === 'step3'
            )
            expect(unreachableWarning).toBeUndefined()
        })

        it('should not warn about steps with conditions', () => {
            const steps: OnboardingStep[] = [
                { id: 'step1', type: 'INFORMATION', payload: {}, nextStep: 'step2' },
                { id: 'step2', type: 'INFORMATION', payload: {}, nextStep: null },
                {
                    id: 'step3',
                    type: 'INFORMATION',
                    payload: {},
                    condition: (ctx) => ctx.flowData.showStep3, // Conditional - may be shown
                },
            ]

            const result = validator.validateSteps(steps)

            const unreachableWarning = result.warnings.find(
                (w) => w.warningType === 'UNREACHABLE_STEP' && w.stepId === 'step3'
            )
            expect(unreachableWarning).toBeUndefined()
        })

        it('should detect step reachable via skip path', () => {
            const steps: OnboardingStep[] = [
                {
                    id: 'step1',
                    type: 'INFORMATION',
                    payload: {},
                    nextStep: 'step2',
                    isSkippable: true,
                    skipToStep: 'step3',
                },
                { id: 'step2', type: 'INFORMATION', payload: {}, nextStep: null },
                { id: 'step3', type: 'INFORMATION', payload: {}, nextStep: null }, // Reachable via skip
            ]

            const result = validator.validateSteps(steps)

            const unreachableWarning = result.warnings.find(
                (w) => w.warningType === 'UNREACHABLE_STEP' && w.stepId === 'step3'
            )
            expect(unreachableWarning).toBeUndefined()
        })
    })

    describe('Empty Steps Handling', () => {
        it('should handle empty steps array gracefully', () => {
            const steps: OnboardingStep[] = []

            const result = validator.validateSteps(steps)

            expect(result.isValid).toBe(true)
            expect(result.warnings).toHaveLength(1)
            expect(result.warnings[0].message).toContain('No steps defined')
        })

        it('should handle null steps array', () => {
            const result = validator.validateSteps(null as any)

            expect(result.isValid).toBe(true)
            expect(result.warnings.length).toBeGreaterThan(0)
        })
    })

    describe('Utility Methods', () => {
        it('isValid() should return true for valid steps', () => {
            const steps: OnboardingStep[] = [{ id: 'step1', type: 'INFORMATION', payload: {} }]

            expect(validator.isValid(steps)).toBe(true)
        })

        it('isValid() should return false for invalid steps', () => {
            const steps: OnboardingStep[] = [
                { id: 'step1', type: 'INFORMATION', payload: {} },
                { id: 'step1', type: 'INFORMATION', payload: {} }, // Duplicate
            ]

            expect(validator.isValid(steps)).toBe(false)
        })

        it('getErrors() should return only errors', () => {
            const steps: OnboardingStep[] = [
                { id: 'step1', type: 'INFORMATION', payload: {}, nextStep: 'nonexistent' },
                { id: 'step1', type: 'INFORMATION', payload: {} }, // Duplicate - error
            ]

            const errors = validator.getErrors(steps)

            expect(errors.length).toBeGreaterThan(0)
            expect(errors.every((e) => e.errorType)).toBe(true)
        })

        it('getWarnings() should return only warnings', () => {
            const steps: OnboardingStep[] = [
                { id: 'step1', type: 'INFORMATION', payload: {}, nextStep: 'nonexistent' }, // Warning
            ]

            const warnings = validator.getWarnings(steps)

            expect(warnings.length).toBeGreaterThan(0)
            expect(warnings.every((w) => w.warningType)).toBe(true)
        })
    })

    describe('Complex Flow Validation', () => {
        it('should validate a complex real-world flow', () => {
            const steps: OnboardingStep[] = [
                {
                    id: 'welcome',
                    type: 'INFORMATION',
                    payload: { title: 'Welcome' },
                    nextStep: 'user-type',
                },
                {
                    id: 'user-type',
                    type: 'SINGLE_CHOICE',
                    payload: {
                        options: [
                            { id: 'admin', label: 'Admin', value: 'admin' },
                            { id: 'user', label: 'User', value: 'user' },
                        ],
                    },
                    nextStep: (ctx) => (ctx.flowData.userType === 'admin' ? 'admin-setup' : 'user-setup'),
                },
                {
                    id: 'admin-setup',
                    type: 'CUSTOM_COMPONENT',
                    payload: { componentKey: 'AdminSetup' },
                    nextStep: 'completion',
                },
                {
                    id: 'user-setup',
                    type: 'CUSTOM_COMPONENT',
                    payload: { componentKey: 'UserSetup' },
                    nextStep: 'completion',
                },
                {
                    id: 'completion',
                    type: 'INFORMATION',
                    payload: { title: 'Complete' },
                    nextStep: null,
                },
            ]

            const result = validator.validateSteps(steps)

            expect(result.isValid).toBe(true)
            expect(result.errors).toHaveLength(0)
        })
    })
})
