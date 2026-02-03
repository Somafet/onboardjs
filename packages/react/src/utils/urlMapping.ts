// @onboardjs/react/src/utils/urlMapping.ts
'use client'

import { OnboardingContext } from '@onboardjs/core'
import type { NavigatorConfig, UrlMappingFunction } from '../types/navigator'
import type { OnboardingStep } from '../types'

/**
 * Convert a step ID to a URL-friendly slug.
 *
 * Transformations:
 * - camelCase → kebab-case (userDetails → user-details)
 * - snake_case → kebab-case (user_details → user-details)
 * - Lowercase everything
 * - Numeric IDs are converted to strings
 *
 * @param stepId The step ID to convert
 * @returns A URL-friendly slug
 */
export function toUrlSlug(stepId: string | number): string {
    const str = String(stepId)

    // Handle camelCase: insert hyphen before uppercase letters
    // Handle snake_case: replace underscores with hyphens
    return str
        .replace(/([a-z])([A-Z])/g, '$1-$2') // camelCase to kebab
        .replace(/_/g, '-') // snake_case to kebab
        .toLowerCase()
}

export interface UrlMapper<TContext extends OnboardingContext = OnboardingContext> {
    /**
     * Convert a step ID to a full URL path.
     * @param stepId The step ID to convert
     * @param context The current onboarding context (for dynamic mappings)
     * @returns The full URL path (e.g., '/onboarding/user-details')
     */
    stepIdToUrl(stepId: string | number, context: TContext): string

    /**
     * Extract a step ID from a URL path.
     * @param path The URL path to parse
     * @returns The step ID if found, or null if the path doesn't match any step
     */
    urlToStepId(path: string): string | number | null

    /**
     * Check if a given path is an onboarding URL.
     * @param path The URL path to check
     * @returns True if the path starts with the basePath
     */
    isOnboardingUrl(path: string): boolean

    /**
     * Get the URL for the completed/finished state.
     * @returns The completion URL or null if not configured
     */
    getCompletionUrl(): string | null
}

/**
 * Create a URL mapper for step-to-URL and URL-to-step conversions.
 *
 * @param config The navigator configuration
 * @param steps The onboarding steps
 * @returns A UrlMapper instance
 */
export function createUrlMapper<TContext extends OnboardingContext = OnboardingContext>(
    config: NavigatorConfig<TContext>,
    steps: OnboardingStep<TContext>[]
): UrlMapper<TContext> {
    const { basePath, urlMapping = 'auto' } = config

    // Normalize basePath: ensure it starts with / and doesn't end with /
    // Using trim operations instead of regex to avoid polynomial complexity
    let normalizedBasePath = basePath
    // Remove leading slashes
    while (normalizedBasePath.startsWith('/')) {
        normalizedBasePath = normalizedBasePath.slice(1)
    }
    // Remove trailing slashes
    while (normalizedBasePath.endsWith('/')) {
        normalizedBasePath = normalizedBasePath.slice(0, -1)
    }
    // Ensure leading slash
    normalizedBasePath = '/' + normalizedBasePath

    // Build lookup tables for efficient bidirectional mapping
    // stepId -> slug
    const stepIdToSlugMap = new Map<string | number, string | UrlMappingFunction<TContext>>()
    // slug -> stepId (for reverse lookups with static mappings)
    const slugToStepIdMap = new Map<string, string | number>()

    // Process each step to build the mapping
    for (const step of steps) {
        const stepId = step.id
        let slug: string | UrlMappingFunction<TContext>

        if (urlMapping === 'auto') {
            // Auto-generate slug from step ID
            slug = toUrlSlug(stepId)
        } else if (urlMapping[stepId] !== undefined) {
            // Use custom mapping
            slug = urlMapping[stepId]
        } else {
            // Fallback to auto-generated slug
            slug = toUrlSlug(stepId)
        }

        stepIdToSlugMap.set(stepId, slug)

        // Build reverse lookup only for static string mappings
        if (typeof slug === 'string') {
            slugToStepIdMap.set(slug, stepId)
        }
    }

    // Also add auto-generated slugs to reverse lookup for fallback
    for (const step of steps) {
        const autoSlug = toUrlSlug(step.id)
        if (!slugToStepIdMap.has(autoSlug)) {
            slugToStepIdMap.set(autoSlug, step.id)
        }
    }

    return {
        stepIdToUrl(stepId: string | number, context: TContext): string {
            const mapping = stepIdToSlugMap.get(stepId)
            let slug: string

            if (mapping === undefined) {
                // Unknown step, generate slug on the fly
                slug = toUrlSlug(stepId)
            } else if (typeof mapping === 'function') {
                // Dynamic mapping function
                slug = mapping(context)
            } else {
                // Static string mapping
                slug = mapping
            }

            return `${normalizedBasePath}/${slug}`
        },

        urlToStepId(path: string): string | number | null {
            // Check if path starts with basePath
            if (!path.startsWith(normalizedBasePath)) {
                return null
            }

            // Extract the slug from the path
            const remainder = path.slice(normalizedBasePath.length)
            // Remove leading slash and any query string or hash
            const slug = remainder.replace(/^\//, '').split(/[?#]/)[0]

            if (!slug) {
                return null
            }

            // Try direct lookup
            const stepId = slugToStepIdMap.get(slug)
            if (stepId !== undefined) {
                return stepId
            }

            // No match found
            return null
        },

        isOnboardingUrl(path: string): boolean {
            return path.startsWith(normalizedBasePath)
        },

        getCompletionUrl(): string | null {
            // Could be extended to support a completion URL
            return null
        },
    }
}

/**
 * Check if a step can be accessed based on the current flow state.
 *
 * A step is accessible if:
 * 1. It is the current step
 * 2. It has been completed previously
 * 3. All prerequisite steps have been completed (for linear flows)
 *
 * @param stepId The step ID to check
 * @param currentStepId The currently active step ID
 * @param completedStepIds Set of completed step IDs
 * @param steps The onboarding steps (for determining order)
 * @returns True if the step can be accessed
 */
export function canAccessStep<TContext extends OnboardingContext = OnboardingContext>(
    stepId: string | number,
    currentStepId: string | number | null,
    completedStepIds: Set<string | number>,
    steps: OnboardingStep<TContext>[]
): boolean {
    // Current step is always accessible
    if (stepId === currentStepId) {
        return true
    }

    // Completed steps are accessible (allows going back)
    if (completedStepIds.has(stepId)) {
        return true
    }

    // For steps that haven't been reached yet, check if all prior steps are completed
    // This implements a linear access control model
    const stepIndex = steps.findIndex((s) => s.id === stepId)
    const currentIndex = steps.findIndex((s) => s.id === currentStepId)

    if (stepIndex === -1 || currentIndex === -1) {
        return false
    }

    // Can't skip ahead
    if (stepIndex > currentIndex) {
        return false
    }

    return true
}
