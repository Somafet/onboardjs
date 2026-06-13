// @onboardjs/react/src/persistence/persistenceMode.ts
// Platform-agnostic persistence-mode model. The rendered indicator lives in each
// platform package; this module holds the type and human-readable text only.

/**
 * The current persistence mode of the onboarding flow.
 */
export type PersistenceMode = 'localStorage' | 'memory' | 'custom' | 'none'

/**
 * Gets a human-readable status text for the persistence mode.
 */
export function getStatusText(mode: PersistenceMode, hasError: boolean): string {
    if (hasError) {
        return 'Progress not saved'
    }

    switch (mode) {
        case 'localStorage':
            return 'Progress saved locally'
        case 'memory':
            return 'Progress saved in memory'
        case 'custom':
            return 'Progress saved'
        case 'none':
            return 'Progress not being saved'
    }
}
