// @onboardjs/react/src/adapters/react-router.ts
'use client'

import type { OnboardingNavigator, NavigatorOptions } from '../types/navigator'

/**
 * Type for React Router's navigate function from useNavigate().
 * We use a minimal interface to avoid requiring react-router-dom as a dependency.
 */
export interface ReactRouterNavigateFunction {
    (to: string | number, options?: { replace?: boolean; state?: unknown }): void
}

/**
 * Type for React Router's location object from useLocation().
 */
export interface ReactRouterLocation {
    pathname: string
    search: string
    hash: string
    state: unknown
    key: string
}

/**
 * Create an OnboardingNavigator for React Router v6+.
 *
 * @param navigate The navigate function from useNavigate()
 * @param location The location object from useLocation()
 * @returns An OnboardingNavigator instance
 *
 * @example
 * ```tsx
 * import { useNavigate, useLocation, Outlet } from 'react-router-dom'
 * import { OnboardingProvider, createReactRouterNavigator } from '@onboardjs/react'
 *
 * export function OnboardingLayout() {
 *   const navigate = useNavigate()
 *   const location = useLocation()
 *   const navigator = useMemo(
 *     () => createReactRouterNavigator(navigate, location),
 *     [navigate, location]
 *   )
 *
 *   return (
 *     <OnboardingProvider
 *       steps={steps}
 *       navigator={{ navigator, basePath: '/onboarding' }}
 *     >
 *       <Outlet />
 *     </OnboardingProvider>
 *   )
 * }
 * ```
 */
export function createReactRouterNavigator(
    navigate: ReactRouterNavigateFunction,
    location: ReactRouterLocation
): OnboardingNavigator {
    return {
        navigate(path: string, options?: NavigatorOptions): void {
            navigate(path, { replace: options?.replace })
        },

        getCurrentPath(): string {
            return location.pathname
        },

        onRouteChange(callback: (path: string) => void): () => void {
            // For browser back/forward, we can listen to popstate
            const handlePopState = () => {
                callback(window.location.pathname)
            }

            window.addEventListener('popstate', handlePopState)
            return () => {
                window.removeEventListener('popstate', handlePopState)
            }
        },

        back(): void {
            navigate(-1)
        },

        // React Router doesn't have built-in prefetch
        // This could be implemented with route loaders if needed
    }
}
