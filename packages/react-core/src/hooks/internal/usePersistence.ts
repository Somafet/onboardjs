// @onboardjs/react/src/hooks/internal/usePersistence.ts
'use client'

import { useCallback, useState, useRef } from 'react'
import { DataLoadFn, DataPersistFn, LoadedData, OnboardingContext as OnboardingContextType } from '@onboardjs/core'
import { PersistenceMode } from '../../persistence/persistenceMode'
import type { OnboardingStorageAdapter } from '../../persistence/storageAdapter'

export interface LocalStoragePersistenceOptions {
    key: string
    ttl?: number // Time to live in milliseconds
}

export interface UsePersistenceConfig<TContext extends OnboardingContextType> {
    localStoragePersistence?: LocalStoragePersistenceOptions
    /**
     * Platform storage adapter used together with `localStoragePersistence`.
     * Web supplies a localStorage-backed adapter; React Native an AsyncStorage one.
     * When absent, the `localStoragePersistence` key path is inert (loads null, persist no-ops).
     */
    storageAdapter?: OnboardingStorageAdapter
    customOnDataLoad?: DataLoadFn<TContext>
    customOnDataPersist?: DataPersistFn<TContext>
    customOnClearPersistedData?: () => Promise<unknown> | unknown
    /**
     * Callback fired when a persistence error occurs.
     * Useful for showing user notifications or logging.
     */
    onPersistenceError?: (error: Error) => void
}

export interface UsePersistenceResult<TContext extends OnboardingContextType> {
    onDataLoad: DataLoadFn<TContext>
    onDataPersist: DataPersistFn<TContext>
    onClearPersistedData: () => Promise<void>
    /**
     * The current persistence mode.
     */
    persistenceMode: PersistenceMode
    /**
     * Whether there's been a persistence error.
     */
    persistenceError: Error | null
    /**
     * Switch to memory-only mode (fallback when storage fails).
     */
    switchToMemoryMode: () => void
}

// In-memory storage fallback
const memoryStorage = new Map<string, string>()

/**
 * Handles persistence operations through a platform storage adapter with proper
 * error recovery. Provides fallback mechanisms for quota and privacy errors.
 *
 * Resolution priority (unchanged across platforms):
 * 1. customOnDataLoad / customOnDataPersist (user-provided)
 * 2. storageAdapter + localStoragePersistence
 * 3. in-memory fallback
 */
export function usePersistence<TContext extends OnboardingContextType>(
    config: UsePersistenceConfig<TContext>
): UsePersistenceResult<TContext> {
    const {
        localStoragePersistence,
        storageAdapter,
        customOnDataLoad,
        customOnDataPersist,
        customOnClearPersistedData,
        onPersistenceError,
    } = config

    // Track persistence mode and errors
    const [persistenceMode, setPersistenceMode] = useState<PersistenceMode>(() => {
        if (customOnDataLoad || customOnDataPersist) return 'custom'
        if (localStoragePersistence) return 'localStorage'
        return 'none'
    })
    const [persistenceError, setPersistenceError] = useState<Error | null>(null)

    // Use ref for memory mode to avoid re-creating callbacks
    const useMemoryModeRef = useRef(false)

    const switchToMemoryMode = useCallback(() => {
        useMemoryModeRef.current = true
        setPersistenceMode('memory')
        console.warn('[OnboardJS] Switched to memory-only persistence mode')
    }, [])

    const handlePersistenceError = useCallback(
        (error: Error) => {
            setPersistenceError(error)
            if (onPersistenceError) {
                onPersistenceError(error)
            }
        },
        [onPersistenceError]
    )

    const onDataLoad = useCallback(async (): Promise<LoadedData<TContext> | null | undefined> => {
        // Use custom loader if provided
        if (customOnDataLoad) {
            try {
                return await customOnDataLoad()
            } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error))
                console.error('[OnboardJS] Custom data load failed:', err)
                handlePersistenceError(err)
                throw err
            }
        }

        // Check if we're in memory mode
        if (useMemoryModeRef.current && localStoragePersistence) {
            const { key } = localStoragePersistence
            const savedStateRaw = memoryStorage.get(key)
            if (!savedStateRaw) return null

            try {
                const savedState = JSON.parse(savedStateRaw) as {
                    timestamp?: number
                    data: LoadedData<TContext>
                }
                return savedState.data
            } catch {
                return null
            }
        }

        // Fallback to the storage adapter
        if (!localStoragePersistence || !storageAdapter) {
            return null
        }

        const { key, ttl } = localStoragePersistence

        try {
            const savedStateRaw = await storageAdapter.load(key)
            if (!savedStateRaw) {
                return null
            }

            const savedState = JSON.parse(savedStateRaw) as {
                timestamp?: number
                data: LoadedData<TContext>
            }

            // Check TTL expiration
            if (ttl && savedState.timestamp && Date.now() - savedState.timestamp > ttl) {
                await storageAdapter.remove(key)
                return null
            }

            return savedState.data
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error))
            console.error(`[OnboardJS] Error loading from storage (key: "${key}"):`, err)
            handlePersistenceError(err)

            // Clear corrupted data
            try {
                await storageAdapter.remove(key)
            } catch {
                // Ignore cleanup errors
            }
            return null
        }
    }, [localStoragePersistence, storageAdapter, customOnDataLoad, handlePersistenceError])

    const onDataPersist = useCallback(
        async (context: TContext, currentStepId: string | number | null): Promise<void> => {
            // Use custom persister if provided
            if (customOnDataPersist) {
                try {
                    await customOnDataPersist(context, currentStepId)
                } catch (error) {
                    const err = error instanceof Error ? error : new Error(String(error))
                    console.error('[OnboardJS] Custom data persist failed:', err)
                    handlePersistenceError(err)
                    throw err
                }
                return
            }

            // Fallback to the storage adapter or memory
            if (!localStoragePersistence || !storageAdapter) {
                return
            }

            const { key } = localStoragePersistence

            const dataToSave: LoadedData = {
                flowData: context.flowData,
                currentStepId: currentStepId,
                // Persist other context properties (excluding non-serializable values)
                ...Object.fromEntries(Object.entries(context).filter(([k]) => k !== 'flowData')),
            }

            const stateToStore = {
                timestamp: Date.now(),
                data: dataToSave,
            }

            const serialized = JSON.stringify(stateToStore)

            // Check if we're in memory mode
            if (useMemoryModeRef.current) {
                memoryStorage.set(key, serialized)
                return
            }

            try {
                await storageAdapter.save(key, serialized)
            } catch (error) {
                // Handle QuotaExceededError gracefully - switch to memory mode
                if (error instanceof Error && error.name === 'QuotaExceededError') {
                    console.warn('[OnboardJS] storage quota exceeded. Switching to memory-only persistence.')
                    handlePersistenceError(error)
                    switchToMemoryMode()
                    // Save to memory instead
                    memoryStorage.set(key, serialized)
                } else {
                    const err = error instanceof Error ? error : new Error(String(error))
                    console.error(`[OnboardJS] Error persisting to storage (key: "${key}"):`, err)
                    handlePersistenceError(err)
                }
                // Don't throw - allow flow to continue
            }
        },
        [localStoragePersistence, storageAdapter, customOnDataPersist, handlePersistenceError, switchToMemoryMode]
    )

    const onClearPersistedData = useCallback(async (): Promise<void> => {
        // Use custom clearer if provided
        if (customOnClearPersistedData) {
            try {
                await customOnClearPersistedData()
            } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error))
                console.error('[OnboardJS] Custom clear persisted data failed:', err)
                handlePersistenceError(err)
            }
            return
        }

        // Fallback to the storage adapter or memory
        if (!localStoragePersistence || !storageAdapter) {
            return
        }

        const { key } = localStoragePersistence

        // Clear from memory storage
        memoryStorage.delete(key)

        // Clear from the storage adapter if not in memory-only mode
        if (!useMemoryModeRef.current) {
            try {
                await storageAdapter.remove(key)
            } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error))
                console.error(`[OnboardJS] Error clearing storage (key: "${key}"):`, err)
                handlePersistenceError(err)
            }
        }
    }, [localStoragePersistence, storageAdapter, customOnClearPersistedData, handlePersistenceError])

    return {
        onDataLoad,
        onDataPersist,
        onClearPersistedData,
        persistenceMode,
        persistenceError,
        switchToMemoryMode,
    }
}
