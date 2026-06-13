// @onboardjs/react-native/src/persistence/asyncStorageAdapter.ts
// React Native storage adapter backed by @react-native-async-storage/async-storage.

import AsyncStorage from '@react-native-async-storage/async-storage'
import type { OnboardingStorageAdapter } from '@onboardjs/react-core'

export const asyncStorageAdapter: OnboardingStorageAdapter = {
    load: (key) => AsyncStorage.getItem(key),
    save: (key, value) => AsyncStorage.setItem(key, value),
    remove: (key) => AsyncStorage.removeItem(key),
}
