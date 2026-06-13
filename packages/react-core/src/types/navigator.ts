// @onboardjs/react/src/types/navigator.ts
import { OnboardingContext } from '@onboardjs/core'

/**
 * Options for navigation operations.
 */
export interface NavigatorOptions {
    /** Replace the current history entry instead of pushing a new one. */
    replace?: boolean
    /** Control scroll behavior after navigation. */
    scroll?: boolean
}

/**
 * Interface for router adapters that enable URL-based onboarding navigation.
 * Implement this interface to integrate with your routing library (Next.js, React Router, etc.).
 *
 * @example
 * ```typescript
 * // Custom navigator implementation
 * const myNavigator: OnboardingNavigator = {
 *   navigate: (path, options) => {
 *     if (options?.replace) {
 *       history.replaceState(null, '', path)
 *     } else {
 *       history.pushState(null, '', path)
 *     }
 *   },
 *   getCurrentPath: () => window.location.pathname,
 *   onRouteChange: (callback) => {
 *     const handler = () => callback(window.location.pathname)
 *     window.addEventListener('popstate', handler)
 *     return () => window.removeEventListener('popstate', handler)
 *   }
 * }
 * ```
 */
export interface OnboardingNavigator {
    /**
     * Navigate to a given path.
     * @param path The path to navigate to (e.g., '/onboarding/user-details')
     * @param options Navigation options like replace and scroll behavior
     */
    navigate(path: string, options?: NavigatorOptions): void | Promise<void>

    /**
     * Get the current URL path.
     * @returns The current pathname (e.g., '/onboarding/user-details')
     */
    getCurrentPath(): string

    /**
     * Subscribe to route changes (for browser back/forward navigation).
     * @param callback Function to call when the route changes
     * @returns Cleanup function to unsubscribe
     */
    onRouteChange?(callback: (path: string) => void): () => void

    /**
     * Navigate back in history.
     */
    back?(): void | Promise<void>

    /**
     * Prefetch a route for faster navigation.
     * @param path The path to prefetch
     */
    prefetch?(path: string): void | Promise<void>
}

/**
 * URL mapping function that generates a URL for a step based on the current context.
 */
export type UrlMappingFunction<TContext extends OnboardingContext = OnboardingContext> = (context: TContext) => string

/**
 * Configuration for URL-based navigation in onboarding flows.
 *
 * @example
 * ```tsx
 * // Basic configuration with auto-generated URLs
 * <OnboardingProvider
 *   steps={steps}
 *   navigator={{
 *     navigator: createNextNavigator(router, pathname),
 *     basePath: '/onboarding'
 *   }}
 * />
 *
 * // Custom URL mapping
 * <OnboardingProvider
 *   steps={steps}
 *   navigator={{
 *     navigator: createNextNavigator(router, pathname),
 *     basePath: '/onboarding',
 *     urlMapping: {
 *       'user-details': 'profile-setup',
 *       'plan-selection': (ctx) => ctx.isPremium ? 'premium-plan' : 'select-plan'
 *     }
 *   }}
 * />
 * ```
 */
export interface NavigatorConfig<TContext extends OnboardingContext = OnboardingContext> {
    /**
     * The navigator instance that handles actual routing.
     */
    navigator: OnboardingNavigator

    /**
     * Base path for all onboarding URLs (e.g., '/onboarding').
     * Step URLs will be constructed as `${basePath}/${stepSlug}`.
     */
    basePath: string

    /**
     * Custom URL mappings for steps.
     * - `'auto'` (default): Generate URLs from step IDs automatically
     * - `Record<string, string>`: Static mapping from stepId to URL slug
     * - `Record<string, (context) => string>`: Dynamic mapping based on context
     *
     * When set to 'auto', step IDs are converted to URL slugs:
     * - 'user_details' → 'user-details'
     * - 'selectPlan' → 'select-plan'
     */
    urlMapping?: Record<string | number, string | UrlMappingFunction<TContext>> | 'auto'

    /**
     * Whether to sync the URL with step changes.
     * @default true
     */
    syncUrl?: boolean
}
