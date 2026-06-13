// @onboardjs/react/src/context/OnboardingProvider.tsx
'use client'

import React from 'react'
import { OnboardingProvider as CoreOnboardingProvider, type OnboardingProviderProps } from '@onboardjs/react-core'
import type { OnboardingContext as OnboardingContextType } from '@onboardjs/core'
import { localStorageAdapter } from '../persistence/localStorageAdapter'
import { StepNotFoundFallback } from '../components/StepNotFoundFallback'

export type { OnboardingProviderProps }

/**
 * Web onboarding provider. Wraps the headless core provider, supplying the
 * web platform defaults (window.localStorage persistence and a DOM fallback for
 * unresolved steps). Both are overridable via props.
 */
export function OnboardingProvider<TContext extends OnboardingContextType = OnboardingContextType>({
    storageAdapter = localStorageAdapter,
    renderStepNotFound = StepNotFoundFallback,
    ...props
}: OnboardingProviderProps<TContext>): React.ReactNode {
    return (
        <CoreOnboardingProvider<TContext>
            storageAdapter={storageAdapter}
            renderStepNotFound={renderStepNotFound}
            {...props}
        />
    )
}
