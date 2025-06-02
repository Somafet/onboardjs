// @onboardjs/core/src/plugins/types.ts

import { OnboardingEngine } from "../engine/OnboardingEngine";
import { OnboardingContext, OnboardingStep } from "../types";

export interface OnboardingPlugin<
  TContext extends OnboardingContext = OnboardingContext,
> {
  /** Unique plugin identifier */
  name: string;
  /** Plugin version for compatibility checking */
  version: string;
  /** Plugin description */
  description?: string;
  /** Plugin dependencies */
  dependencies?: string[];
  /** Install function called when plugin is added to engine */
  install: (
    engine: OnboardingEngine<TContext>
  ) => PluginCleanup | Promise<PluginCleanup>;
}

export type PluginCleanup = () => void | Promise<void>;

export interface PluginManager<
  TContext extends OnboardingContext = OnboardingContext,
> {
  /** Install a plugin */
  install(plugin: OnboardingPlugin<TContext>): Promise<void>;
  /** Uninstall a plugin */
  uninstall(pluginName: string): Promise<void>;
  /** Get installed plugin */
  getPlugin(name: string): OnboardingPlugin<TContext> | undefined;
  /** Get all installed plugins */
  getInstalledPlugins(): OnboardingPlugin<TContext>[];
  /** Check if plugin is installed */
  isInstalled(name: string): boolean;
  /** Cleanup all plugins */
  cleanup(): Promise<void>;
}

export interface PluginHooks<
  TContext extends OnboardingContext = OnboardingContext,
> {
  /** Called before step change */
  beforeStepChange?: (
    currentStep: OnboardingStep<TContext> | null,
    nextStep: OnboardingStep<TContext>,
    context: TContext
  ) => void | Promise<void>;

  /** Called after step change */
  afterStepChange?: (
    previousStep: OnboardingStep<TContext> | null,
    currentStep: OnboardingStep<TContext> | null,
    context: TContext
  ) => void | Promise<void>;

  /** Called when step becomes active */
  onStepActive?: (
    step: OnboardingStep<TContext>,
    context: TContext
  ) => void | Promise<void>;

  /** Called when step is completed */
  onStepComplete?: (
    step: OnboardingStep<TContext>,
    stepData: any,
    context: TContext
  ) => void | Promise<void>;

  /** Called when flow is completed */
  onFlowComplete?: (context: TContext) => void | Promise<void>;

  /** Called when context is updated */
  onContextUpdate?: (
    oldContext: TContext,
    newContext: TContext
  ) => void | Promise<void>;

  /** Called on engine errors */
  onError?: (error: Error, context: TContext) => void | Promise<void>;
}

export interface PluginConfig {
  [key: string]: any;
}
