// @onboardjs/react/src/hooks/internal/usePersistence.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePersistence } from './usePersistence'
import type { OnboardingStorageAdapter } from '../../persistence/storageAdapter'
import type { OnboardingContext } from '@onboardjs/core'

type Ctx = OnboardingContext

function makeAdapter(initial: Record<string, string> = {}): OnboardingStorageAdapter & { store: Map<string, string> } {
    const store = new Map<string, string>(Object.entries(initial))
    return {
        store,
        load: vi.fn((key: string) => store.get(key) ?? null),
        save: vi.fn((key: string, value: string) => {
            store.set(key, value)
        }),
        remove: vi.fn((key: string) => {
            store.delete(key)
        }),
    }
}

const baseContext = { flowData: { _internal: {} } } as unknown as Ctx

describe('usePersistence storage adapter', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('prioritizes customOnDataLoad over the storage adapter', async () => {
        const adapter = makeAdapter({ k: JSON.stringify({ data: { fromAdapter: true } }) })
        const customOnDataLoad = vi.fn(async () => ({ flowData: { fromCustom: true } }) as never)

        const { result } = renderHook(() =>
            usePersistence<Ctx>({
                localStoragePersistence: { key: 'k' },
                storageAdapter: adapter,
                customOnDataLoad,
            })
        )

        const loaded = await result.current.onDataLoad()

        expect(customOnDataLoad).toHaveBeenCalledTimes(1)
        expect(adapter.load).not.toHaveBeenCalled()
        expect(loaded).toEqual({ flowData: { fromCustom: true } })
    })

    it('uses the storage adapter when no custom loader is provided', async () => {
        const adapter = makeAdapter({ k: JSON.stringify({ data: { flowData: { a: 1 } } }) })

        const { result } = renderHook(() =>
            usePersistence<Ctx>({
                localStoragePersistence: { key: 'k' },
                storageAdapter: adapter,
            })
        )

        const loaded = await result.current.onDataLoad()

        expect(adapter.load).toHaveBeenCalledWith('k')
        expect(loaded).toEqual({ flowData: { a: 1 } })
    })

    it('persists through the storage adapter', async () => {
        const adapter = makeAdapter()

        const { result } = renderHook(() =>
            usePersistence<Ctx>({
                localStoragePersistence: { key: 'k' },
                storageAdapter: adapter,
            })
        )

        await result.current.onDataPersist(baseContext, 'step1')

        expect(adapter.save).toHaveBeenCalledTimes(1)
        const [savedKey, savedValue] = (adapter.save as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(savedKey).toBe('k')
        const parsed = JSON.parse(savedValue)
        expect(parsed.data.currentStepId).toBe('step1')
    })

    it('is inert when localStoragePersistence is set but no adapter is provided', async () => {
        const { result } = renderHook(() =>
            usePersistence<Ctx>({
                localStoragePersistence: { key: 'k' },
            })
        )

        await expect(result.current.onDataLoad()).resolves.toBeNull()
        // persist should not throw
        await expect(result.current.onDataPersist(baseContext, 'step1')).resolves.toBeUndefined()
    })

    it('honors TTL expiry by removing the key and returning null', async () => {
        const expired = JSON.stringify({ timestamp: 1, data: { flowData: { a: 1 } } })
        const adapter = makeAdapter({ k: expired })

        const { result } = renderHook(() =>
            usePersistence<Ctx>({
                localStoragePersistence: { key: 'k', ttl: 1000 },
                storageAdapter: adapter,
            })
        )

        const loaded = await result.current.onDataLoad()

        expect(loaded).toBeNull()
        expect(adapter.remove).toHaveBeenCalledWith('k')
    })

    it('falls back to memory mode on QuotaExceededError', async () => {
        const adapter = makeAdapter()
        const quota = Object.assign(new Error('quota'), { name: 'QuotaExceededError' })
        ;(adapter.save as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
            throw quota
        })
        const onPersistenceError = vi.fn()

        const { result } = renderHook(() =>
            usePersistence<Ctx>({
                localStoragePersistence: { key: 'k' },
                storageAdapter: adapter,
                onPersistenceError,
            })
        )

        await result.current.onDataPersist(baseContext, 'step1')

        expect(onPersistenceError).toHaveBeenCalledWith(quota)
        // Subsequent loads should come from memory, not the adapter
        ;(adapter.load as ReturnType<typeof vi.fn>).mockClear()
        const loaded = await result.current.onDataLoad()
        expect(adapter.load).not.toHaveBeenCalled()
        expect(loaded).toMatchObject({ currentStepId: 'step1' })
    })

    it('supports async (promise-returning) adapters', async () => {
        const store = new Map<string, string>()
        const asyncAdapter: OnboardingStorageAdapter = {
            load: (key) => Promise.resolve(store.get(key) ?? null),
            save: (key, value) => Promise.resolve(void store.set(key, value)),
            remove: (key) => Promise.resolve(void store.delete(key)),
        }

        const { result } = renderHook(() =>
            usePersistence<Ctx>({
                localStoragePersistence: { key: 'k' },
                storageAdapter: asyncAdapter,
            })
        )

        await result.current.onDataPersist(baseContext, 'step9')
        const loaded = await result.current.onDataLoad()
        expect(loaded).toMatchObject({ currentStepId: 'step9' })
    })
})
