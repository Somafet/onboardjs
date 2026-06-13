// @onboardjs/react/src/persistence/localStorageAdapter.ts
// Web storage adapter backed by window.localStorage.
// Guards SSR/non-DOM environments by no-opping when window is unavailable,
// preserving the original usePersistence behavior.

import type { OnboardingStorageAdapter } from './storageAdapter'

export const localStorageAdapter: OnboardingStorageAdapter = {
    load: (key) => (typeof window === 'undefined' ? null : window.localStorage.getItem(key)),
    save: (key, value) => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(key, value)
        }
    },
    remove: (key) => {
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem(key)
        }
    },
}
