// src/services/PersistenceService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PersistenceService } from './PersistenceService'
import { ErrorHandler } from '../engine/ErrorHandler'
import { EventManager } from '../engine/EventManager'
import { StateManager } from '../engine/StateManager'
import { OnboardingContext } from '../types'
import { FlowContext, LoadedData } from '../engine/types'

const createFlowContext = (): FlowContext => ({
    flowId: 'test-flow',
    flowName: 'Test Flow',
    flowVersion: '1.0.0',
    flowMetadata: null,
    instanceId: 1,
    createdAt: Date.now(),
})

const createTestContext = (): OnboardingContext => ({
    flowData: {
        testValue: 'hello',
    },
})

describe('PersistenceService', () => {
    let eventManager: EventManager<OnboardingContext>
    let stateManager: StateManager<OnboardingContext>
    let errorHandler: ErrorHandler<OnboardingContext>

    beforeEach(() => {
        eventManager = new EventManager<OnboardingContext>()
        stateManager = new StateManager(eventManager, [], null, createFlowContext())
        errorHandler = new ErrorHandler(eventManager, stateManager)
    })

    describe('loadPersistedData', () => {
        it('should return null if no load handler configured', async () => {
            const service = new PersistenceService()

            const result = await service.loadPersistedData()

            expect(result.data).toBeNull()
            expect(result.error).toBeNull()
        })

        it('should load data when handler is configured', async () => {
            const loadedData: LoadedData<OnboardingContext> = {
                flowData: { savedValue: 'test' },
                currentStepId: 'step-2',
            }
            const loadHandler = vi.fn().mockResolvedValue(loadedData)

            const service = new PersistenceService(loadHandler)
            const result = await service.loadPersistedData()

            expect(loadHandler).toHaveBeenCalled()
            expect(result.data).toEqual(loadedData)
            expect(result.error).toBeNull()
        })

        it('should handle load errors gracefully', async () => {
            const loadHandler = vi.fn().mockRejectedValue(new Error('Load failed'))

            const service = new PersistenceService(loadHandler)
            const result = await service.loadPersistedData()

            expect(result.data).toBeNull()
            expect(result.error).toBeDefined()
            expect(result.error?.message).toContain('Load failed')
        })

        it('should handle null return from load handler', async () => {
            const loadHandler = vi.fn().mockResolvedValue(null)

            const service = new PersistenceService(loadHandler)
            const result = await service.loadPersistedData()

            expect(result.data).toBeNull()
            expect(result.error).toBeNull()
        })
    })

    describe('persistDataIfNeeded', () => {
        it('should not persist if no persist handler configured', async () => {
            const service = new PersistenceService()
            const context = createTestContext()

            // Should not throw
            await expect(service.persistDataIfNeeded(context, 'step-1', false)).resolves.toBeUndefined()
        })

        it('should not persist during hydration', async () => {
            const persistHandler = vi.fn()

            const service = new PersistenceService(undefined, persistHandler)
            await service.persistDataIfNeeded(createTestContext(), 'step-1', true)

            expect(persistHandler).not.toHaveBeenCalled()
        })

        it('should persist when handler is configured and not hydrating', async () => {
            const persistHandler = vi.fn().mockResolvedValue(undefined)

            const service = new PersistenceService(undefined, persistHandler)
            const context = createTestContext()
            await service.persistDataIfNeeded(context, 'step-1', false)

            expect(persistHandler).toHaveBeenCalledWith(context, 'step-1')
        })

        it('should emit persistenceSuccess event on success', async () => {
            const persistHandler = vi.fn().mockResolvedValue(undefined)
            const service = new PersistenceService(undefined, persistHandler, undefined, undefined, eventManager)

            const listener = vi.fn()
            eventManager.addEventListener('persistenceSuccess', listener)

            await service.persistDataIfNeeded(createTestContext(), 'step-1', false)

            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    context: expect.any(Object),
                    persistenceTime: expect.any(Number),
                })
            )
        })

        it('should emit persistenceFailure event on error', async () => {
            const persistHandler = vi.fn().mockRejectedValue(new Error('Persist failed'))
            const service = new PersistenceService(undefined, persistHandler, undefined, errorHandler, eventManager)

            const listener = vi.fn()
            eventManager.addEventListener('persistenceFailure', listener)

            await service.persistDataIfNeeded(createTestContext(), 'step-1', false)

            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    context: expect.any(Object),
                    error: expect.any(Error),
                })
            )
        })

        it('should not throw on persistence error', async () => {
            const persistHandler = vi.fn().mockRejectedValue(new Error('Persist failed'))
            const service = new PersistenceService(undefined, persistHandler, undefined, errorHandler, eventManager)

            // Should not throw
            await expect(service.persistDataIfNeeded(createTestContext(), 'step-1', false)).resolves.toBeUndefined()
        })
    })

    describe('clearData', () => {
        it('should do nothing if no clear handler configured', async () => {
            const service = new PersistenceService()

            // Should not throw
            await expect(service.clearData()).resolves.toBeUndefined()
        })

        it('should call clear handler when configured', async () => {
            const clearHandler = vi.fn().mockResolvedValue(undefined)

            const service = new PersistenceService(undefined, undefined, clearHandler)
            await service.clearData()

            expect(clearHandler).toHaveBeenCalled()
        })

        it('should propagate errors from clear handler', async () => {
            const clearHandler = vi.fn().mockRejectedValue(new Error('Clear failed'))

            const service = new PersistenceService(undefined, undefined, clearHandler)

            await expect(service.clearData()).rejects.toThrow('Clear failed')
        })
    })

    describe('handler management', () => {
        it('should allow setting load handler', async () => {
            const service = new PersistenceService()
            const loadHandler = vi.fn().mockResolvedValue({ flowData: {} })

            service.setDataLoadHandler(loadHandler)
            await service.loadPersistedData()

            expect(loadHandler).toHaveBeenCalled()
        })

        it('should allow setting persist handler', async () => {
            const service = new PersistenceService()
            const persistHandler = vi.fn().mockResolvedValue(undefined)

            service.setDataPersistHandler(persistHandler)
            await service.persistDataIfNeeded(createTestContext(), 'step-1', false)

            expect(persistHandler).toHaveBeenCalled()
        })

        it('should allow setting clear handler', async () => {
            const service = new PersistenceService()
            const clearHandler = vi.fn().mockResolvedValue(undefined)

            service.setClearPersistedDataHandler(clearHandler)
            await service.clearData()

            expect(clearHandler).toHaveBeenCalled()
        })

        it('should return current load handler', () => {
            const loadHandler = vi.fn()
            const service = new PersistenceService(loadHandler)

            expect(service.getDataLoadHandler()).toBe(loadHandler)
        })

        it('should return current persist handler', () => {
            const persistHandler = vi.fn()
            const service = new PersistenceService(undefined, persistHandler)

            expect(service.getDataPersistHandler()).toBe(persistHandler)
        })

        it('should return current clear handler', () => {
            const clearHandler = vi.fn()
            const service = new PersistenceService(undefined, undefined, clearHandler)

            expect(service.getClearPersistedDataHandler()).toBe(clearHandler)
        })

        it('should return undefined for unset handlers', () => {
            const service = new PersistenceService()

            expect(service.getDataLoadHandler()).toBeUndefined()
            expect(service.getDataPersistHandler()).toBeUndefined()
            expect(service.getClearPersistedDataHandler()).toBeUndefined()
        })
    })
})
