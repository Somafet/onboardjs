// @onboardjs/core/src/plugins/types.ts

import { OnboardingEngine } from "../engine/OnboardingEngine";
import {
  BeforeStepChangeEvent,
  ContextUpdateEvent,
  ErrorEvent,
  FlowCompletedEvent,
  StepActiveEvent,
  StepChangeEvent,
  StepCompletedEvent,
} from "../engine/types";
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
    engine: OnboardingEngine<TContext>,
  ) => PluginCleanup | Promise<PluginCleanup>;
}

export type PluginCleanup = () => any | Promise<any>;

export interface PluginManager<
  TContext extends OnboardingContext = OnboardingContext,
> {
  /** Install a plugin */
  install(plugin: OnboardingPlugin<TContext>): Promise<any>;
  /** Uninstall a plugin */
  uninstall(pluginName: string): Promise<any>;
  /** Get installed plugin */
  getPlugin(name: string): OnboardingPlugin<TContext> | undefined;
  /** Get all installed plugins */
  getInstalledPlugins(): OnboardingPlugin<TContext>[];
  /** Check if plugin is installed */
  isInstalled(name: string): boolean;
  /** Cleanup all plugins */
  cleanup(): Promise<any>;
}

export interface PluginHooks<TContext extends OnboardingContext = OnboardingContext> {
  /** Called before step change */
  beforeStepChange?: (
    event: BeforeStepChangeEvent<TContext>,
  ) => void | Promise<void>;

  /** Called after step change */
  afterStepChange?: (event: StepChangeEvent<TContext>) => void | Promise<void>;

  /** Called when step becomes active */
  onStepActive?: (event: StepActiveEvent<TContext>) => void | Promise<void>;

  /** Called when step is completed */
  onStepCompleted?: (
    event: StepCompletedEvent<TContext>,
  ) => void | Promise<void>;

  /** Called when flow is completed */
  onFlowCompleted?: (
    event: FlowCompletedEvent<TContext>,
  ) => void | Promise<void>;

  /** Called when context is updated */
  onContextUpdate?: (
    event: ContextUpdateEvent<TContext>,
  ) => void | Promise<void>;

  /** Called on engine errors */
  onError?: (event: ErrorEvent<TContext>) => void | Promise<void>;
}

export interface PluginConfig {
  [key: string]: any;
}
