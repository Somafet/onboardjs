import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FlowUtils } from './flow-utils'
import { OnboardingEngine } from '../engine/OnboardingEngine'
import { OnboardingEngineRegistry } from '../engine/OnboardingEngineRegistry'
import type { OnboardingStep, OnboardingContext } from '../types'

describe('FlowUtils', () => {
    let registry: OnboardingEngineRegistry
    const mockSteps: OnboardingStep[] = [
        { id: 'step1', payload: { mainText: 'Step 1' } },
        { id: 'step2', payload: { mainText: 'Step 2' } },
        { id: 'step3', payload: { mainText: 'Step 3' } },
    ]

    beforeEach(() => {
        registry = new OnboardingEngineRegistry()
        // Setup localStorage mock for Node.js environment
        if (typeof localStorage === 'undefined') {
            const store: Record<string, string> = {}
            ;(global as any).localStorage = {
                getItem: (key: string) => store[key] || null,
                setItem: (key: string, value: string) => {
                    store[key] = value
                },
                removeItem: (key: string) => {
                    delete store[key]
                },
                clear: () => {
                    Object.keys(store).forEach((key) => delete store[key])
                },
                key: (index: number) => {
                    const keys = Object.keys(store)
                    return keys[index] || null
                },
                get length() {
                    return Object.keys(store).length
                },
            }
        } else {
            // Clear real localStorage before each test
            localStorage.clear()
        }
    })

    afterEach(() => {
        // Clean up after each test
        if (typeof localStorage !== 'undefined') {
            localStorage.clear()
        }
    })

    describe('generatePersistenceKey', () => {
        it('should generate a key with flowId', async () => {
            const engine = new OnboardingEngine({
                flowId: 'user-onboarding',
                steps: mockSteps,
                registry,
            })
            await engine.ready()

            const key = FlowUtils.generatePersistenceKey(engine)

            expect(key).toBe('onboarding_user-onboarding')
        })

        it('should generate a key with custom base', async () => {
            const engine = new OnboardingEngine({
                flowId: 'user-onboarding',
                steps: mockSteps,
                registry,
            })
            await engine.ready()

            const key = FlowUtils.generatePersistenceKey(engine, 'custom')

            expect(key).toBe('custom_user-onboarding')
        })

        it('should generate a key with flowId and version', async () => {
            const engine = new OnboardingEngine({
                flowId: 'user-onboarding',
                flowVersion: '1.0.0',
                steps: mockSteps,
                registry,
            })
            await engine.ready()

            const key = FlowUtils.generatePersistenceKey(engine)

            expect(key).toBe('onboarding_user-onboarding_v1.0.0')
        })

        it('should fallback to flowName when flowId is not set', async () => {
            const engine = new OnboardingEngine({
                flowName: 'User Onboarding',
                steps: mockSteps,
                registry,
            })
            await engine.ready()

            const key = FlowUtils.generatePersistenceKey(engine)

            expect(key).toBe('onboarding_user_onboarding')
        })

        it('should handle flowName with multiple spaces', async () => {
            const engine = new OnboardingEngine({
                flowName: 'User   Onboarding   Flow',
                steps: mockSteps,
                registry,
            })
            await engine.ready()

            const key = FlowUtils.generatePersistenceKey(engine)

            expect(key).toBe('onboarding_user_onboarding_flow')
        })

        it('should include version in key with flowName', async () => {
            const engine = new OnboardingEngine({
                flowName: 'User Onboarding',
                flowVersion: '2.1.0',
                steps: mockSteps,
                registry,
            })
            await engine.ready()

            const key = FlowUtils.generatePersistenceKey(engine)

            expect(key).toBe('onboarding_user_onboarding_v2.1.0')
        })

        it('should default to onboarding when no flowId or flowName', async () => {
            const engine = new OnboardingEngine({
                steps: mockSteps,
                registry,
            })
            await engine.ready()

            const key = FlowUtils.generatePersistenceKey(engine)

            expect(key).toBe('onboarding')
        })
    })

    describe('getEnginesByPattern', () => {
        it('should return engines matching flowId pattern', async () => {
            const engine1 = new OnboardingEngine({
                flowId: 'user-onboarding',
                steps: mockSteps,
                registry,
            })
            const engine2 = new OnboardingEngine({
                flowId: 'admin-onboarding',
                steps: mockSteps,
                registry,
            })
            const engine3 = new OnboardingEngine({
                flowId: 'user-onboarding-v2',
                steps: mockSteps,
                registry,
            })
            await Promise.all([engine1.ready(), engine2.ready(), engine3.ready()])

            const results = FlowUtils.getEnginesByPattern({ flowId: 'user-onboarding' }, registry)

            expect(results).toHaveLength(1)
            expect(results[0]).toBe(engine1)
        })

        it('should return engines matching flowName pattern', async () => {
            const engine1 = new OnboardingEngine({
                flowId: 'flow-name-test-1',
                flowName: 'User Onboarding',
                steps: mockSteps,
                registry: registry,
            })
            const engine2 = new OnboardingEngine({
                flowId: 'flow-name-test-2',
                flowName: 'Admin Onboarding',
                steps: mockSteps,
                registry,
            })
            await Promise.all([engine1.ready(), engine2.ready()])

            const results = FlowUtils.getEnginesByPattern({ flowName: 'User Onboarding' }, registry)

            expect(results).toHaveLength(1)
            expect(results[0]).toBe(engine1)
        })

        it('should return engines matching flowVersion pattern', async () => {
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

            const results = FlowUtils.getEnginesByPattern({ flowVersion: '1.0.0' }, registry)

            expect(results).toHaveLength(1)
            expect(results[0]).toBe(engine1)
        })

        it('should return engines matching combined patterns', async () => {
            const engine1 = new OnboardingEngine({
                flowId: 'user-onboarding',
                flowName: 'User Onboarding',
                flowVersion: '1.0.0',
                steps: mockSteps,
                registry,
            })
            const engine2 = new OnboardingEngine({
                flowId: 'user-onboarding-v2',
                flowName: 'User Onboarding',
                flowVersion: '2.0.0',
                steps: mockSteps,
                registry,
            })
            const engine3 = new OnboardingEngine({
                flowId: 'admin-onboarding',
                flowName: 'User Onboarding',
                flowVersion: '1.0.0',
                steps: mockSteps,
                registry,
            })
            await Promise.all([engine1.ready(), engine2.ready(), engine3.ready()])

            const results = FlowUtils.getEnginesByPattern({ flowId: 'user-onboarding', flowVersion: '1.0.0' }, registry)

            expect(results).toHaveLength(1)
            expect(results[0]).toBe(engine1)
        })

        it('should return empty array when no engines match', async () => {
            const engine = new OnboardingEngine({
                flowId: 'user-onboarding',
                steps: mockSteps,
                registry,
            })
            await engine.ready()

            const results = FlowUtils.getEnginesByPattern({ flowId: 'non-existent' }, registry)

            expect(results).toHaveLength(0)
        })

        it('should return all engines when pattern is empty', async () => {
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

            const results = FlowUtils.getEnginesByPattern({}, registry)

            expect(results).toHaveLength(2)
            expect(results).toContain(engine1)
            expect(results).toContain(engine2)
        })
    })

    describe('getLatestVersionByFlowName', () => {
        it('should return the latest version of a flow', async () => {
            const engine1 = new OnboardingEngine({
                flowId: 'flow-1',
                flowName: 'User Onboarding',
                flowVersion: '1.0.0',
                steps: mockSteps,
                registry,
            })
            const engine2 = new OnboardingEngine({
                flowId: 'flow-2',
                flowName: 'User Onboarding',
                flowVersion: '2.0.0',
                steps: mockSteps,
                registry,
            })
            const engine3 = new OnboardingEngine({
                flowId: 'flow-3',
                flowName: 'User Onboarding',
                flowVersion: '1.5.0',
                steps: mockSteps,
                registry,
            })
            await Promise.all([engine1.ready(), engine2.ready(), engine3.ready()])

            const latest = FlowUtils.getLatestVersionByFlowName('User Onboarding', registry)

            expect(latest).toBe(engine2)
            expect(latest?.getFlowVersion()).toBe('2.0.0')
        })

        it('should return null when no flow matches the name', () => {
            const latest = FlowUtils.getLatestVersionByFlowName('Non Existent Flow', registry)

            expect(latest).toBeNull()
        })

        it('should handle flows with no version', async () => {
            const engine1 = new OnboardingEngine({
                flowId: 'flow-1',
                flowName: 'User Onboarding',
                steps: mockSteps,
                registry,
            })
            const engine2 = new OnboardingEngine({
                flowId: 'flow-2',
                flowName: 'User Onboarding',
                flowVersion: '1.0.0',
                steps: mockSteps,
                registry,
            })
            await Promise.all([engine1.ready(), engine2.ready()])

            const latest = FlowUtils.getLatestVersionByFlowName('User Onboarding', registry)

            // Should prefer the one with a version
            expect(latest).toBe(engine2)
        })

        it('should handle complex version numbers correctly', async () => {
            const engine1 = new OnboardingEngine({
                flowId: 'flow-1',
                flowName: 'Complex Flow',
                flowVersion: '1.9.9',
                steps: mockSteps,
                registry,
            })
            const engine2 = new OnboardingEngine({
                flowId: 'flow-2',
                flowName: 'Complex Flow',
                flowVersion: '2.0.0',
                steps: mockSteps,
                registry,
            })
            const engine3 = new OnboardingEngine({
                flowId: 'flow-3',
                flowName: 'Complex Flow',
                flowVersion: '1.10.0',
                steps: mockSteps,
                registry,
            })
            await Promise.all([engine1.ready(), engine2.ready(), engine3.ready()])

            const latest = FlowUtils.getLatestVersionByFlowName('Complex Flow', registry)

            expect(latest).toBe(engine2)
        })

        it('should return first match when only one version exists', async () => {
            const engine = new OnboardingEngine({
                flowId: 'flow-1',
                flowName: 'Single Flow',
                flowVersion: '1.0.0',
                steps: mockSteps,
                registry,
            })
            await engine.ready()

            const latest = FlowUtils.getLatestVersionByFlowName('Single Flow', registry)

            expect(latest).toBe(engine)
        })
    })

    describe('areFlowsCompatible', () => {
        it('should return true for same flowId with same major version', async () => {
            const engine1 = new OnboardingEngine({
                flowId: 'user-onboarding',
                flowVersion: '1.0.0',
                steps: mockSteps,
                registry,
            })
            const engine2 = new OnboardingEngine({
                flowId: 'user-onboarding',
                flowVersion: '1.5.3',
                steps: mockSteps,
                registry,
            })
            await Promise.all([engine1.ready(), engine2.ready()])

            expect(FlowUtils.areFlowsCompatible(engine1, engine2)).toBe(true)
        })

        it('should return false for same flowId with different major version', async () => {
            const engine1 = new OnboardingEngine({
                flowId: 'user-onboarding',
                flowVersion: '1.0.0',
                steps: mockSteps,
                registry,
            })
            const engine2 = new OnboardingEngine({
                flowId: 'user-onboarding',
                flowVersion: '2.0.0',
                steps: mockSteps,
                registry,
            })
            await Promise.all([engine1.ready(), engine2.ready()])

            expect(FlowUtils.areFlowsCompatible(engine1, engine2)).toBe(false)
        })

        it('should return false for different flowIds', async () => {
            const engine1 = new OnboardingEngine({
                flowId: 'user-onboarding',
                flowVersion: '1.0.0',
                steps: mockSteps,
                registry,
            })
            const engine2 = new OnboardingEngine({
                flowId: 'admin-onboarding',
                flowVersion: '1.0.0',
                steps: mockSteps,
                registry,
            })
            await Promise.all([engine1.ready(), engine2.ready()])

            expect(FlowUtils.areFlowsCompatible(engine1, engine2)).toBe(false)
        })

        it('should return true for same flowName with same major version', async () => {
            const engine1 = new OnboardingEngine({
                flowName: 'User Onboarding',
                flowVersion: '1.0.0',
                steps: mockSteps,
                registry,
            })
            const engine2 = new OnboardingEngine({
                flowName: 'User Onboarding',
                flowVersion: '1.3.2',
                steps: mockSteps,
                registry,
            })
            await Promise.all([engine1.ready(), engine2.ready()])

            expect(FlowUtils.areFlowsCompatible(engine1, engine2)).toBe(true)
        })

        it('should return true when no versions are specified', async () => {
            const engine1 = new OnboardingEngine({
                flowId: 'user-onboarding',
                steps: mockSteps,
                registry,
            })
            const engine2 = new OnboardingEngine({
                flowId: 'user-onboarding',
                steps: mockSteps,
                registry,
            })
            await Promise.all([engine1.ready(), engine2.ready()])

            expect(FlowUtils.areFlowsCompatible(engine1, engine2)).toBe(true)
        })

        it('should return true when one version is missing', async () => {
            const engine1 = new OnboardingEngine({
                flowId: 'user-onboarding',
                flowVersion: '1.0.0',
                steps: mockSteps,
                registry,
            })
            const engine2 = new OnboardingEngine({
                flowId: 'user-onboarding',
                steps: mockSteps,
                registry,
            })
            await Promise.all([engine1.ready(), engine2.ready()])

            expect(FlowUtils.areFlowsCompatible(engine1, engine2)).toBe(true)
        })

        it('should handle flowName matching when flowId is not available', async () => {
            const engine1 = new OnboardingEngine({
                flowName: 'Admin Flow',
                flowVersion: '2.0.0',
                steps: mockSteps,
                registry,
            })
            const engine2 = new OnboardingEngine({
                flowName: 'Admin Flow',
                flowVersion: '2.1.0',
                steps: mockSteps,
                registry,
            })
            await Promise.all([engine1.ready(), engine2.ready()])

            expect(FlowUtils.areFlowsCompatible(engine1, engine2)).toBe(true)
        })

        it('should return false for different flowNames', async () => {
            const engine1 = new OnboardingEngine({
                flowName: 'User Onboarding',
                flowVersion: '1.0.0',
                steps: mockSteps,
                registry,
            })
            const engine2 = new OnboardingEngine({
                flowName: 'Admin Onboarding',
                flowVersion: '1.0.0',
                steps: mockSteps,
                registry,
            })
            await Promise.all([engine1.ready(), engine2.ready()])

            expect(FlowUtils.areFlowsCompatible(engine1, engine2)).toBe(false)
        })
    })

    describe('createFlowAwarePersistence', () => {
        it('should create persistence wrapper for an engine', async () => {
            const engine = new OnboardingEngine({
                flowId: 'user-onboarding',
                flowVersion: '1.0.0',
                steps: mockSteps,
                registry,
            })
            await engine.ready()

            const persistence = FlowUtils.createFlowAwarePersistence(engine)

            expect(persistence).toBeDefined()
            expect(persistence.load).toBeDefined()
            expect(persistence.save).toBeDefined()
            expect(persistence.clear).toBeDefined()
            expect(persistence.getKey).toBeDefined()
        })

        it('should generate correct persistence key', async () => {
            const engine = new OnboardingEngine({
                flowId: 'user-onboarding',
                flowVersion: '1.0.0',
                steps: mockSteps,
                registry,
            })
            await engine.ready()

            const persistence = FlowUtils.createFlowAwarePersistence(engine)
            const key = persistence.getKey()

            expect(key).toBe('onboarding_user-onboarding_v1.0.0')
        })

        it('should save and load data from localStorage', async () => {
            const engine = new OnboardingEngine({
                flowId: 'test-flow',
                steps: mockSteps,
                registry,
            })
            await engine.ready()

            const persistence = FlowUtils.createFlowAwarePersistence(engine)
            const testContext: Partial<OnboardingContext> = {
                flowData: { userName: 'Test User', email: 'test@example.com' },
            }

            await persistence.save(testContext as OnboardingContext, 'step2')

            const loaded = await persistence.load()

            expect(loaded).toBeDefined()
            expect(loaded?.flowData).toEqual({ userName: 'Test User', email: 'test@example.com' })
            expect(loaded?.currentStepId).toBe('step2')
        })

        it('should return null when no data exists', async () => {
            const engine = new OnboardingEngine({
                flowId: 'empty-flow',
                steps: mockSteps,
                registry,
            })
            await engine.ready()

            const persistence = FlowUtils.createFlowAwarePersistence(engine)
            const loaded = await persistence.load()

            expect(loaded).toBeNull()
        })

        it('should clear persisted data', async () => {
            const engine = new OnboardingEngine({
                flowId: 'clear-test-flow',
                steps: mockSteps,
                registry,
            })
            await engine.ready()

            const persistence = FlowUtils.createFlowAwarePersistence(engine)
            const testContext: Partial<OnboardingContext> = {
                flowData: { test: 'data' },
            }

            await persistence.save(testContext as OnboardingContext, 'step1')
            let loaded = await persistence.load()
            expect(loaded).toBeDefined()

            await persistence.clear()
            loaded = await persistence.load()

            expect(loaded).toBeNull()
        })

        it('should include flowInfo in saved data', async () => {
            const engine = new OnboardingEngine({
                flowId: 'flow-with-info',
                flowName: 'Test Flow',
                flowVersion: '1.0.0',
                steps: mockSteps,
                registry,
            })
            await engine.ready()

            const persistence = FlowUtils.createFlowAwarePersistence(engine)
            const testContext: Partial<OnboardingContext> = {
                flowData: { test: 'data' },
            }

            await persistence.save(testContext as OnboardingContext, 'step1')
            const loaded = await persistence.load()

            expect(loaded?.flowInfo).toBeDefined()
            expect(loaded?.flowInfo?.flowId).toBe('flow-with-info')
            expect(loaded?.flowInfo?.flowName).toBe('Test Flow')
            expect(loaded?.flowInfo?.flowVersion).toBe('1.0.0')
        })

        it('should include savedAt timestamp', async () => {
            const engine = new OnboardingEngine({
                flowId: 'timestamp-flow',
                steps: mockSteps,
                registry,
            })
            await engine.ready()

            const persistence = FlowUtils.createFlowAwarePersistence(engine)
            const testContext: Partial<OnboardingContext> = {
                flowData: { test: 'data' },
            }

            const beforeSave = Date.now()
            await persistence.save(testContext as OnboardingContext, 'step1')
            const afterSave = Date.now()

            const loaded = await persistence.load()

            expect(loaded?.savedAt).toBeDefined()
            expect(loaded?.savedAt).toBeGreaterThanOrEqual(beforeSave)
            expect(loaded?.savedAt).toBeLessThanOrEqual(afterSave)
        })

        it('should handle localStorage errors gracefully', async () => {
            const engine = new OnboardingEngine({
                flowId: 'error-test-flow',
                steps: mockSteps,
                registry,
            })
            await engine.ready()

            const persistence = FlowUtils.createFlowAwarePersistence(engine)

            // Mock localStorage.setItem to throw an error
            const originalSetItem = localStorage.setItem
            localStorage.setItem = vi.fn(() => {
                throw new Error('Storage quota exceeded')
            })

            const testContext: Partial<OnboardingContext> = {
                flowData: { test: 'data' },
            }

            // Should not throw, should handle error gracefully
            await expect(persistence.save(testContext as OnboardingContext, 'step1')).resolves.toBeUndefined()

            // Restore original setItem
            localStorage.setItem = originalSetItem
        })

        it('should handle invalid JSON gracefully', async () => {
            const engine = new OnboardingEngine({
                flowId: 'json-error-flow',
                steps: mockSteps,
                registry,
            })
            await engine.ready()

            const persistence = FlowUtils.createFlowAwarePersistence(engine)
            const key = persistence.getKey()

            // Store invalid JSON
            localStorage.setItem(key, 'invalid{json}data')

            // Should return null instead of throwing
            const loaded = await persistence.load()

            expect(loaded).toBeNull()
        })

        it('should persist currentStepId correctly', async () => {
            const engine = new OnboardingEngine({
                flowId: 'step-tracking-flow',
                steps: mockSteps,
                registry,
            })
            await engine.ready()

            const persistence = FlowUtils.createFlowAwarePersistence(engine)
            const testContext: Partial<OnboardingContext> = {
                flowData: { progress: 'in-progress' },
            }

            // Save at step 2
            await persistence.save(testContext as OnboardingContext, 'step2')
            let loaded = await persistence.load()
            expect(loaded?.currentStepId).toBe('step2')

            // Save at step 3
            await persistence.save(testContext as OnboardingContext, 'step3')
            loaded = await persistence.load()
            expect(loaded?.currentStepId).toBe('step3')
        })

        it('should handle null currentStepId (flow completed)', async () => {
            const engine = new OnboardingEngine({
                flowId: 'completed-flow',
                steps: mockSteps,
                registry,
            })
            await engine.ready()

            const persistence = FlowUtils.createFlowAwarePersistence(engine)
            const testContext: Partial<OnboardingContext> = {
                flowData: { completed: true },
            }

            await persistence.save(testContext as OnboardingContext, null)
            const loaded = await persistence.load()

            expect(loaded?.currentStepId).toBeNull()
            expect(loaded?.flowData?.completed).toBe(true)
        })
    })
})
