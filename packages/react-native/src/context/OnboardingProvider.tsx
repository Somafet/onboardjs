// @onboardjs/react-native/src/context/OnboardingProvider.tsx
import React from 'react'
import { OnboardingProvider as CoreOnboardingProvider, type OnboardingProviderProps } from '@onboardjs/react-core'
import type { OnboardingContext as OnboardingContextType } from '@onboardjs/core'
import { asyncStorageAdapter } from '../persistence/asyncStorageAdapter'
import { StepNotFoundFallback } from '../components/StepNotFoundFallback'

export type { OnboardingProviderProps }

/**
 * React Native onboarding provider. Wraps the headless core provider, supplying
 * the React Native platform defaults (AsyncStorage persistence and a native
 * fallback for unresolved steps). Both are overridable via props.
 */
export function OnboardingProvider<TContext extends OnboardingContextType = OnboardingContextType>({
    storageAdapter = asyncStorageAdapter,
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
