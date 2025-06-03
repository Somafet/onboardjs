// @onboardjs/react/src/hooks/useOnboarding.types.ts
import {
  OnboardingEngine,
  EngineState,
  OnboardingContext,
  DataLoadFn,
  DataPersistFn,
  BeforeStepChangeListener,
  FlowCompleteListener,
  OnboardingPlugin,
  PluginManager,
} from "@onboardjs/core";
import { OnboardingActions } from "../context/OnboardingProvider";

export interface UseOnboardingOptions {
  /**
   * Callback executed when the entire onboarding flow is completed.
   * This callback is specific to this instance of the `useOnboarding` hook.
   */
  onFlowComplete?: FlowCompleteListener;

  /**
   * Callback executed when the current step changes.
   * Specific to this instance of the `useOnboarding` hook.
   */
  onStepChange?: (
    newStep: ReturnType<OnboardingEngine["getState"]>["currentStep"],
    oldStep: ReturnType<OnboardingEngine["getState"]>["currentStep"],
    context: OnboardingContext
  ) => void;

  /**
   * Callback executed before the current step changes.
   * This allows you to perform checks or actions before the step transition.
   */
  onBeforeStepChange?: BeforeStepChangeListener;

  /**
   * Callback executed when data is loaded for the current step.
   * This can be used to trigger UI updates or other actions based on loaded data.
   */
  loadData?: DataLoadFn;

  /**
   * Callback executed when data is persisted for the current step.
   * Useful for triggering actions after data is saved.
   */
  persistData?: DataPersistFn;
}

export interface UseOnboardingReturn extends OnboardingActions {
  engine: OnboardingEngine | null;
  state: EngineState | null;
  isLoading: boolean;
  isCompleted: boolean;
  currentStep: EngineState["currentStep"];
  // Plugin management
  pluginManager: PluginManager | null;
  installPlugin: (plugin: OnboardingPlugin) => Promise<void>;
  uninstallPlugin: (pluginName: string) => Promise<void>;
  getInstalledPlugins: () => OnboardingPlugin[];
  isPluginInstalled: (pluginName: string) => boolean;
}
