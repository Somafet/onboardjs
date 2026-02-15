/* eslint-disable no-console */
'use client'

import { createClient } from '@/lib/supabase'
import { createNextNavigator, OnboardingProvider } from '@onboardjs/react'
import { createSupabasePlugin } from '@onboardjs/supabase-plugin'
import { createPostHogPlugin, saasConfig } from '@onboardjs/posthog-plugin'
import { AppOnboardingContext, commonFlowSteps, commonRegistry } from './common-flow-config'
import { type User } from '@supabase/auth-js'
import posthog from 'posthog-js'
import { ReactNode, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export default function OnboardingProviderWrapper({
    user,
    children,
}: Readonly<{
    user: User | null
    children: ReactNode
}>) {
    const router = useRouter()
    const pathname = usePathname()
    const client = createClient()

    const supabasePlugin = createSupabasePlugin<AppOnboardingContext>({
        client,
        tableName: 'onboarding_progress',
        contextKeyForId: 'currentUser.id',
        onError(error, operation) {
            console.error(`[SupabasePlugin] Error during ${operation}:`, error.message)
        },
        stateDataColumn: 'flow_data',
        userIdColumn: 'user_id',
    })

    const basicPostHogPlugin = createPostHogPlugin<AppOnboardingContext>({
        ...saasConfig,
        apiKey: process.env.NEXT_PUBLIC_POSTHOG_KEY!,
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
        posthogInstance: posthog,
        // We can enable debug logging during development
        debug: process.env.NODE_ENV === 'development',
        enableConsoleLogging: process.env.NODE_ENV === 'development',
    })

    const isNavigatorRoute = pathname.startsWith('/onboarding')
    const navigator = useMemo(
        () => (isNavigatorRoute ? createNextNavigator(router, pathname) : undefined),
        [router, pathname, isNavigatorRoute]
    )

    console.log('[OnboardingProviderWrapper] Initializing OnboardingProvider with user:', user)

    return (
        <OnboardingProvider<AppOnboardingContext>
            initialContext={{
                flowData: {
                    selectedOption: 'simple-flow', // Default to simple flow for demo
                },
                currentUser: user ?? undefined, // Pass the user object from props
            }}
            steps={commonFlowSteps}
            plugins={[supabasePlugin, basicPostHogPlugin]}
            componentRegistry={commonRegistry}
            {...(navigator ? { navigator: { navigator, basePath: '/onboarding' } } : {})}
        >
            {children}
        </OnboardingProvider>
    )
}
