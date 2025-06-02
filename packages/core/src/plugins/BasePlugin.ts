// @onboardjs/core/src/plugins/BasePlugin.ts

import { OnboardingEngine } from "../engine/OnboardingEngine";
import { OnboardingContext } from "../types";
import {
  OnboardingPlugin,
  PluginHooks,
  PluginConfig,
  PluginCleanup,
} from "./types";

export abstract class BasePlugin<
  TContext extends OnboardingContext = OnboardingContext,
  TConfig extends PluginConfig = PluginConfig,
> implements OnboardingPlugin<TContext>
{
  abstract readonly name: string;
  abstract readonly version: string;
  readonly description?: string;
  readonly dependencies?: string[];

  protected config: TConfig;
  protected engine!: OnboardingEngine<TContext>;
  private unsubscribeFunctions: (() => void)[] = [];

  constructor(config: TConfig) {
    this.config = config;
  }

  async install(engine: OnboardingEngine<TContext>): Promise<PluginCleanup> {
    this.engine = engine;

    // Setup hooks
    this.setupHooks();

    // Call plugin-specific initialization
    await this.onInstall();

    // Return cleanup function
    return async () => {
      await this.onUninstall();
      this.cleanup();
    };
  }

  protected setupHooks(): void {
    const hooks = this.getHooks();

    if (hooks.beforeStepChange) {
      const unsubscribe = this.engine.addBeforeStepChangeListener(
        hooks.beforeStepChange
      );
      this.unsubscribeFunctions.push(unsubscribe);
    }

    if (hooks.afterStepChange) {
      const unsubscribe = this.engine.addAfterStepChangeListener(
        hooks.afterStepChange
      );
      this.unsubscribeFunctions.push(unsubscribe);
    }

    if (hooks.onStepActive) {
      const unsubscribe = this.engine.addStepActiveListener(hooks.onStepActive);
      this.unsubscribeFunctions.push(unsubscribe);
    }

    if (hooks.onStepComplete) {
      const unsubscribe = this.engine.addStepCompleteListener(
        hooks.onStepComplete
      );
      this.unsubscribeFunctions.push(unsubscribe);
    }

    if (hooks.onFlowComplete) {
      const unsubscribe = this.engine.addFlowCompleteListener(
        hooks.onFlowComplete
      );
      this.unsubscribeFunctions.push(unsubscribe);
    }

    if (hooks.onContextUpdate) {
      const unsubscribe = this.engine.addContextUpdateListener(
        hooks.onContextUpdate
      );
      this.unsubscribeFunctions.push(unsubscribe);
    }

    if (hooks.onError) {
      const unsubscribe = this.engine.addErrorListener(hooks.onError);
      this.unsubscribeFunctions.push(unsubscribe);
    }
  }

  private cleanup(): void {
    this.unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
    this.unsubscribeFunctions = [];
  }

  /** Override to provide plugin hooks */
  protected getHooks(): PluginHooks<TContext> {
    return {};
  }

  /** Override to handle plugin installation */
  protected async onInstall(): Promise<void> {
    // Default implementation does nothing
  }

  /** Override to handle plugin uninstallation */
  protected async onUninstall(): Promise<void> {
    // Default implementation does nothing
  }

  /** Get plugin configuration */
  protected getConfig(): TConfig {
    return this.config;
  }

  /** Update plugin configuration */
  protected updateConfig(newConfig: Partial<TConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
