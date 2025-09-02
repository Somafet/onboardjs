import { evaluateStepId } from './step-utils'
import type { OnboardingContext } from '../types'
import { describe, expect, it } from 'vitest'
import { findStepById } from './step-utils'
import type { OnboardingStep } from '../types'

describe('evaluateStepId', () => {
    const mockContext: OnboardingContext = {} as OnboardingContext

    it('returns the string stepId when given a string', () => {
        expect(evaluateStepId('step-1', mockContext)).toBe('step-1')
    })

    it('returns the result of the function when given a function', () => {
        const fn = (ctx: OnboardingContext) => 'dynamic-step'
        expect(evaluateStepId(fn, mockContext)).toBe('dynamic-step')
    })

    it('returns null when given null', () => {
        expect(evaluateStepId(null, mockContext)).toBeNull()
    })

    it('returns undefined when given undefined', () => {
        expect(evaluateStepId(undefined, mockContext)).toBeUndefined()
    })

    it('returns null if the function returns null', () => {
        const fn = (ctx: OnboardingContext) => null
        expect(evaluateStepId(fn, mockContext)).toBeNull()
    })

    it('returns undefined if the function returns undefined', () => {
        const fn = (ctx: OnboardingContext) => undefined
        expect(evaluateStepId(fn, mockContext)).toBeUndefined()
    })
})

describe('findStepById', () => {
    const steps: OnboardingStep[] = [
        { id: 'step-1' } as OnboardingStep,
        { id: 'step-2' } as OnboardingStep,
        { id: 'step-3' } as OnboardingStep,
    ]

    it('returns the correct step when stepId exists', () => {
        expect(findStepById(steps, 'step-2')).toBe(steps[1])
    })

    it('returns the correct step when stepId is a number', () => {
        const stepsWithNumberId: OnboardingStep[] = [
            { id: 1 } as OnboardingStep,
            { id: 2 } as OnboardingStep,
            { id: 3 } as OnboardingStep,
        ]
        expect(findStepById(stepsWithNumberId, 2)).toBe(stepsWithNumberId[1])
    })

    it('returns undefined when stepId does not exist', () => {
        expect(findStepById(steps, 'step-999')).toBeUndefined()
    })

    it('returns undefined when stepId is null', () => {
        expect(findStepById(steps, null)).toBeUndefined()
    })

    it('returns undefined when stepId is undefined', () => {
        expect(findStepById(steps, undefined)).toBeUndefined()
    })

    it('returns undefined when steps array is empty', () => {
        expect(findStepById([], 'step-1')).toBeUndefined()
    })

    it('returns the first matching step if there are duplicates', () => {
        const dupSteps: OnboardingStep[] = [{ id: 'dup' } as OnboardingStep, { id: 'dup' } as OnboardingStep]
        expect(findStepById(dupSteps, 'dup')).toBe(dupSteps[0])
    })
})
