import { describe, it, expect, beforeEach } from 'vitest'
import { OnboardingEngineRegistry, createRegistry } from './OnboardingEngineRegistry'
import { OnboardingEngine } from './OnboardingEngine'
import type { OnboardingStep } from '../types'

describe('OnboardingEngineRegistry', () => {
    let registry: OnboardingEngineRegistry
    const mockSteps: OnboardingStep[] = [
        { id: 'step1', payload: { mainText: 'Step 1' } },
        { id: 'step2', payload: { mainText: 'Step 2' } },
    ]

    beforeEach(() => {
        registry = new OnboardingEngineRegistry()
        // Each test gets a clean registry instance
    })

    describe('Basic Operations', () => {
        it('should register an engine with a flowId', async () => {
            const engine = new OnboardingEngine({
                flowId: 'test-flow',
                steps: mockSteps,
                registry,
            })
            await engine.ready()

            expect(registry.has('test-flow')).toBe(true)
            expect(registry.get('test-flow')).toBe(engine)
        })

        it('should unregister an engine', async () => {
            const engine = new OnboardingEngine({
                flowId: 'test-flow',
                steps: mockSteps,
                registry,
            })
            await engine.ready()

            expect(registry.has('test-flow')).toBe(true)

            const result = registry.unregister('test-flow')

            expect(result).toBe(true)
            expect(registry.has('test-flow')).toBe(false)
        })

        it('should return false when unregistering non-existent flowId', () => {
            const result = registry.unregister('non-existent')
            expect(result).toBe(false)
        })

        it('should return undefined for non-existent flowId', () => {
            expect(registry.get('non-existent')).toBeUndefined()
        })
    })

    describe('Multiple Engines', () => {
        it('should register multiple engines', async () => {
            const engine1 = new OnboardingEngine({
                flowId: 'flow-1',
                steps: mockSteps,
                registry,
            })
            const engine2 = new OnboardingEngine({
                flowId: 'flow-2',
                steps: mockSteps,
                registry,
            })
            await Promise.all([engine1.ready(), engine2.ready()])

            expect(registry.size).toBe(2)
            expect(registry.getFlowIds()).toContain('flow-1')
            expect(registry.getFlowIds()).toContain('flow-2')
        })

        it('should get all engines', async () => {
            const engine1 = new OnboardingEngine({
                flowId: 'flow-1',
                steps: mockSteps,
                registry,
            })
            const engine2 = new OnboardingEngine({
                flowId: 'flow-2',
                steps: mockSteps,
                registry,
            })
            await Promise.all([engine1.ready(), engine2.ready()])

            const allEngines = registry.getAll()

            expect(allEngines).toHaveLength(2)
            expect(allEngines).toContain(engine1)
            expect(allEngines).toContain(engine2)
        })
    })

    describe('Version Queries', () => {
        it('should query engines by version', async () => {
            const engine1 = new OnboardingEngine({
                flowId: 'flow-1',
                flowVersion: '1.0.0',
                steps: mockSteps,
                registry,
            })
            const engine2 = new OnboardingEngine({
                flowId: 'flow-2',
                flowVersion: '2.0.0',
                steps: mockSteps,
                registry,
            })
            await Promise.all([engine1.ready(), engine2.ready()])

            const v1Engines = registry.getByVersion('1.0.0')
            const v2Engines = registry.getByVersion('2.0.0')

            expect(v1Engines).toHaveLength(1)
            expect(v1Engines[0]).toBe(engine1)
            expect(v2Engines).toHaveLength(1)
            expect(v2Engines[0]).toBe(engine2)
        })
    })

    describe('Statistics', () => {
        it('should return correct statistics', async () => {
            const engine1 = new OnboardingEngine({
                flowId: 'flow-1',
                flowName: 'Onboarding A',
                flowVersion: '1.0.0',
                steps: mockSteps,
                registry,
            })
            const engine2 = new OnboardingEngine({
                flowId: 'flow-2',
                flowName: 'Onboarding B',
                flowVersion: '2.0.0',
                steps: mockSteps,
                registry,
            })
            await Promise.all([engine1.ready(), engine2.ready()])

            const stats = registry.getStats()

            expect(stats.totalEngines).toBe(2)
            expect(stats.enginesByFlow['Onboarding A']).toBe(1)
            expect(stats.enginesByFlow['Onboarding B']).toBe(1)
            expect(stats.enginesByVersion['1.0.0']).toBe(1)
            expect(stats.enginesByVersion['2.0.0']).toBe(1)
        })
    })

    describe('Isolation', () => {
        it('should maintain isolation between registries', async () => {
            const registry1 = createRegistry()
            const registry2 = createRegistry()

            const engine1 = new OnboardingEngine({
                flowId: 'shared-id',
                steps: mockSteps,
                registry: registry1,
            })
            const engine2 = new OnboardingEngine({
                flowId: 'shared-id',
                steps: mockSteps,
                registry: registry2,
            })
            await Promise.all([engine1.ready(), engine2.ready()])

            expect(registry1.get('shared-id')).toBe(engine1)
            expect(registry2.get('shared-id')).toBe(engine2)
            expect(registry1.get('shared-id')).not.toBe(registry2.get('shared-id'))
        })

        it('should maintain isolation when no registry is provided', async () => {
            const customRegistry = createRegistry()

            const engineWithRegistry = new OnboardingEngine({
                flowId: 'custom-flow',
                steps: mockSteps,
                registry: customRegistry,
            })
            await engineWithRegistry.ready()

            expect(customRegistry.has('custom-flow')).toBe(true)

            // Engine without registry should not be in the custom registry
            const engineWithoutRegistry = new OnboardingEngine({
                flowId: 'other-flow',
                steps: mockSteps,
            })
            await engineWithoutRegistry.ready()

            expect(customRegistry.has('other-flow')).toBe(false)
        })
    })

    describe('Query Options', () => {
        it('should query engines by flow name', async () => {
            const engine1 = new OnboardingEngine({
                flowId: 'flow-1',
                flowName: 'User Onboarding',
                steps: mockSteps,
                registry,
            })
            const engine2 = new OnboardingEngine({
                flowId: 'flow-2',
                flowName: 'Feature Tour',
                steps: mockSteps,
                registry,
            })
            await Promise.all([engine1.ready(), engine2.ready()])

            const userOnboarding = registry.query({ flowName: 'User Onboarding' })

            expect(userOnboarding).toHaveLength(1)
            expect(userOnboarding[0]).toBe(engine1)
        })
    })

    describe('forEach', () => {
        it('should iterate over all engines', async () => {
            const engine1 = new OnboardingEngine({
                flowId: 'flow-1',
                steps: mockSteps,
                registry,
            })
            const engine2 = new OnboardingEngine({
                flowId: 'flow-2',
                steps: mockSteps,
                registry,
            })
            await Promise.all([engine1.ready(), engine2.ready()])

            const visited: string[] = []
            registry.forEach((engine, flowId) => {
                visited.push(flowId)
            })

            expect(visited).toContain('flow-1')
            expect(visited).toContain('flow-2')
        })
    })

    describe('createRegistry factory', () => {
        it('should create isolated registry instances', () => {
            const r1 = createRegistry()
            const r2 = createRegistry()

            expect(r1).not.toBe(r2)
            expect(r1).toBeInstanceOf(OnboardingEngineRegistry)
            expect(r2).toBeInstanceOf(OnboardingEngineRegistry)
        })
    })
})
