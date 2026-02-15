// @onboardjs/react/src/adapters/next.ts
'use client'

import type { OnboardingNavigator, NavigatorOptions } from '../types/navigator'

/**
 * Type for the Next.js App Router's useRouter hook result.
 * We use a minimal interface to avoid requiring next as a dependency.
 */
export interface NextAppRouter {
    push(href: string, options?: { scroll?: boolean }): void
    replace(href: string, options?: { scroll?: boolean }): void
    back(): void
    prefetch(href: string): void
}

/**
 * Create an OnboardingNavigator for Next.js App Router.
 *
 * @param router The router instance from useRouter()
 * @param pathname The current pathname from usePathname()
 * @returns An OnboardingNavigator instance
 *
 * @example
 * ```tsx
 * 'use client'
 * import { useRouter, usePathname } from 'next/navigation'
 * import { OnboardingProvider, createNextNavigator } from '@onboardjs/react'
 *
 * export default function OnboardingLayout({ children }) {
 *   const router = useRouter()
 *   const pathname = usePathname()
 *   const navigator = useMemo(
 *     () => createNextNavigator(router, pathname),
 *     [router, pathname]
 *   )
 *
 *   return (
 *     <OnboardingProvider
 *       steps={steps}
 *       navigator={{ navigator, basePath: '/onboarding' }}
 *     >
 *       {children}
 *     </OnboardingProvider>
 *   )
 * }
 * ```
 */
export function createNextNavigator(router: NextAppRouter, pathname: string): OnboardingNavigator {
    return {
        navigate(path: string, options?: NavigatorOptions): void {
            const scrollOption = options?.scroll !== false // Default to true for Next.js
            if (options?.replace) {
                router.replace(path, { scroll: scrollOption })
            } else {
                router.push(path, { scroll: scrollOption })
            }
        },

        getCurrentPath(): string {
            return pathname
        },

        // Note: onRouteChange is not directly available in Next.js App Router.
        // The pathname from usePathname() updates reactively, so the hook
        // will naturally re-run when the pathname changes.
        // If needed, you can use a custom implementation with window.addEventListener('popstate')
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
            router.back()
        },

        prefetch(path: string): void {
            router.prefetch(path)
        },
    }
}
