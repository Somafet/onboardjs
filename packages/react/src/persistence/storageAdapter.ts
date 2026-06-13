// @onboardjs/react/src/persistence/storageAdapter.ts
// Platform-agnostic storage contract. Web injects a localStorage-backed adapter,
// React Native injects an AsyncStorage-backed adapter. Methods may be sync or async;
// the persistence hook awaits them either way.

export interface OnboardingStorageAdapter {
    /**
     * Read a raw string value for a key. Return null if absent.
     */
    load(key: string): string | null | Promise<string | null>

    /**
     * Write a raw string value for a key.
     * May throw (e.g. a web QuotaExceededError) — the persistence hook handles it.
     */
    save(key: string, value: string): void | Promise<void>

    /**
     * Remove a key.
     */
    remove(key: string): void | Promise<void>
}
