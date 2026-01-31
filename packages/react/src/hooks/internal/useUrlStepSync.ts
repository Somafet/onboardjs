// @onboardjs/react/src/hooks/internal/useUrlStepSync.ts
'use client'

import { useEffect, useRef, useCallback, useMemo } from 'react'
import { OnboardingEngine, OnboardingContext as OnboardingContextType } from '@onboardjs/core'
import type { NavigatorConfig } from '../../types/navigator'
import type { OnboardingStep } from '../../types'
import { createUrlMapper, canAccessStep, type UrlMapper } from '../../utils/urlMapping'

export interface UseUrlStepSyncConfig<TContext extends OnboardingContextType = OnboardingContextType> {
    /** Navigator configuration with router adapter and settings */
    navigatorConfig: NavigatorConfig<TContext> | undefined
    /** The onboarding engine instance */
    engine: OnboardingEngine<TContext> | null
    /** Whether the engine is ready */
    isEngineReady: boolean
    /** The onboarding steps */
    steps: OnboardingStep<TContext>[]
}

export interface UseUrlStepSyncResult {
    /**
     * Sync the URL to match the current step.
     * Call this after navigation actions (next, previous, goToStep).
     */
    syncUrlToStep: () => void

    /**
     * The URL mapper instance for converting between steps and URLs.
     */
    urlMapper: UrlMapper | null
}

/**
 * Hook for bidirectional synchronization between URL and onboarding steps.
 *
 * Responsibilities:
 * 1. On mount: Detect step from URL, validate access, sync engine if needed
 * 2. On step change: Update URL to match current step
 * 3. On URL change (browser back/forward): Sync engine to URL step
 *
 * @param config Configuration for URL-step synchronization
 * @returns Functions and state for URL synchronization
 */
export function useUrlStepSync<TContext extends OnboardingContextType = OnboardingContextType>(
    config: UseUrlStepSyncConfig<TContext>
): UseUrlStepSyncResult {
    const { navigatorConfig, engine, isEngineReady, steps } = config

    // Track whether we're currently syncing to prevent loops
    const isSyncingRef = useRef(false)
    // Track the last synced step to avoid redundant updates
    const lastSyncedStepRef = useRef<string | number | null>(null)
    // Track if initial URL sync has been performed
    const initialSyncDoneRef = useRef(false)

    // Create the URL mapper if navigator config is provided
    const urlMapper = useMemo(() => {
        if (!navigatorConfig) return null
        return createUrlMapper(navigatorConfig, steps)
    }, [navigatorConfig, steps])

    // Get the navigator instance
    const navigator = navigatorConfig?.navigator
    const syncUrl = navigatorConfig?.syncUrl !== false // Default to true

    /**
     * Sync the URL to match the current engine step.
     */
    const syncUrlToStep = useCallback(() => {
        if (!navigator || !engine || !urlMapper || !syncUrl || isSyncingRef.current) {
            return
        }

        const state = engine.getState()
        const currentStepId = state.currentStep?.id

        if (currentStepId === undefined || currentStepId === lastSyncedStepRef.current) {
            return
        }

        isSyncingRef.current = true
        try {
            const targetUrl = urlMapper.stepIdToUrl(currentStepId, state.context as TContext)
            const currentPath = navigator.getCurrentPath()

            if (currentPath !== targetUrl) {
                navigator.navigate(targetUrl, { replace: false })
            }

            lastSyncedStepRef.current = currentStepId
        } finally {
            isSyncingRef.current = false
        }
    }, [navigator, engine, urlMapper, syncUrl])

    /**
     * Sync the engine to match the current URL.
     */
    const syncStepToUrl = useCallback(
        async (path: string) => {
            if (!engine || !urlMapper || isSyncingRef.current) {
                return
            }

            const stepId = urlMapper.urlToStepId(path)
            if (stepId === null) {
                // Not an onboarding URL or unknown step
                return
            }

            const state = engine.getState()
            const currentStepId = state.currentStep?.id

            if (stepId === currentStepId) {
                // Already on this step
                return
            }

            // Check if user can access this step
            const completedSteps = new Set<string | number>(
                Object.keys(state.context.flowData?._internal?.completedSteps || {})
            )

            const canAccess = canAccessStep(stepId, currentStepId ?? null, completedSteps, steps)

            if (!canAccess) {
                // User can't access this step, redirect to current step
                if (currentStepId !== undefined && navigator) {
                    const correctUrl = urlMapper.stepIdToUrl(currentStepId, state.context as TContext)
                    navigator.navigate(correctUrl, { replace: true })
                }
                return
            }

            // Navigate engine to the requested step
            isSyncingRef.current = true
            try {
                await engine.goToStep(String(stepId))
                lastSyncedStepRef.current = stepId
            } finally {
                isSyncingRef.current = false
            }
        },
        [engine, urlMapper, steps, navigator]
    )

    // Initial URL sync: When engine becomes ready, check URL and sync
    useEffect(() => {
        if (!isEngineReady || !engine || !navigator || !urlMapper || initialSyncDoneRef.current) {
            return
        }

        initialSyncDoneRef.current = true
        const currentPath = navigator.getCurrentPath()

        // Check if we're on an onboarding URL
        if (urlMapper.isOnboardingUrl(currentPath)) {
            // Try to sync engine to URL step
            syncStepToUrl(currentPath)
        } else {
            // Not on an onboarding URL, sync URL to engine step if syncUrl is enabled
            if (syncUrl) {
                syncUrlToStep()
            }
        }
    }, [isEngineReady, engine, navigator, urlMapper, syncStepToUrl, syncUrlToStep, syncUrl])

    // Subscribe to engine state changes for URL updates
    useEffect(() => {
        if (!engine || !isEngineReady || !syncUrl) {
            return
        }

        const unsubscribe = engine.addEventListener('stateChange', (event) => {
            if (!isSyncingRef.current && event.state.currentStep?.id !== lastSyncedStepRef.current) {
                syncUrlToStep()
            }
        })

        return unsubscribe
    }, [engine, isEngineReady, syncUrl, syncUrlToStep])

    // Subscribe to browser navigation (back/forward)
    useEffect(() => {
        if (!navigator?.onRouteChange || !isEngineReady) {
            return
        }

        const unsubscribe = navigator.onRouteChange((path) => {
            syncStepToUrl(path)
        })

        return unsubscribe
    }, [navigator, isEngineReady, syncStepToUrl])

    // Reset initial sync flag when engine changes
    useEffect(() => {
        initialSyncDoneRef.current = false
        lastSyncedStepRef.current = null
    }, [engine])

    return {
        syncUrlToStep,
        urlMapper,
    }
}
