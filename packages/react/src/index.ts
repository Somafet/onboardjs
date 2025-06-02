// @onboardjs/react/src/index.ts
export { OnboardingProvider } from "./context/OnboardingProvider";
export { useOnboarding } from "./hooks/useOnboarding";
export { usePlugins } from "./hooks/usePlugins";

// Re-export plugin system from core for convenience
export {
  BasePlugin,
  PluginManagerImpl,
  type OnboardingPlugin,
  type PluginManager,
  type PluginHooks,
  type PluginConfig,
  type PluginCleanup,
} from "@onboardjs/core";

// Export React-specific plugin utilities
export { ReactPlugin } from "./plugins/ReactPlugin";
export type {
  ReactPluginConfig,
  ReactPluginHooks,
} from "./plugins/ReactPlugin";

// Export types
export type { StepComponentProps, StepComponentRegistry } from "./types";
export type {
  UseOnboardingOptions,
  UseOnboardingReturn,
} from "./hooks/useOnboarding.types";
export type {
  OnboardingContextValue,
  OnboardingActions,
  LocalStoragePersistenceOptions,
  OnboardingProviderProps,
} from "./context/OnboardingProvider";
