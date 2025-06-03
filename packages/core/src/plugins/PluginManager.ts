// @onboardjs/core/src/plugins/PluginManager.ts

import { OnboardingEngine } from "../engine/OnboardingEngine";
import { OnboardingContext } from "../types";
import { OnboardingPlugin, PluginManager, PluginCleanup } from "./types";

export class PluginManagerImpl<
  TContext extends OnboardingContext = OnboardingContext,
> implements PluginManager<TContext>
{
  private plugins = new Map<string, OnboardingPlugin<TContext>>();
  private cleanupFunctions = new Map<string, PluginCleanup>();
  private engine: OnboardingEngine<TContext>;

  constructor(engine: OnboardingEngine<TContext>) {
    this.engine = engine;
  }

  async install(plugin: OnboardingPlugin<TContext>): Promise<void> {
    // Check if plugin is already installed
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already installed`);
    }

    // Check dependencies
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this.plugins.has(dep)) {
          throw new Error(
            `Plugin "${plugin.name}" requires dependency "${dep}" which is not installed`,
          );
        }
      }
    }

    try {
      // Install the plugin
      const cleanup = await plugin.install(this.engine);

      // Store plugin and cleanup function
      this.plugins.set(plugin.name, plugin);
      this.cleanupFunctions.set(plugin.name, cleanup);

      console.debug(
        `[PluginManager] Installed plugin: ${plugin.name}@${plugin.version}`,
      );
    } catch (error) {
      console.error(
        `[PluginManager] Failed to install plugin "${plugin.name}":`,
        error,
      );
      throw error;
    }
  }

  async uninstall(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin "${pluginName}" is not installed`);
    }

    // Check if other plugins depend on this one
    const dependentPlugins = Array.from(this.plugins.values()).filter((p) =>
      p.dependencies?.includes(pluginName),
    );

    if (dependentPlugins.length > 0) {
      const dependentNames = dependentPlugins.map((p) => p.name).join(", ");
      throw new Error(
        `Cannot uninstall "${pluginName}" because it is required by: ${dependentNames}`,
      );
    }

    try {
      // Run cleanup
      const cleanup = this.cleanupFunctions.get(pluginName);
      if (cleanup) {
        await cleanup();
      }

      console.debug(`[PluginManager] Uninstalled plugin: ${pluginName}`);
    } catch (error) {
      console.error(
        `[PluginManager] Failed to uninstall plugin "${pluginName}":`,
        error,
      );
      throw error;
    } finally {
      // Ensure cleanup function is removed even if it fails
      this.cleanupFunctions.delete(pluginName);
      this.plugins.delete(pluginName);
    }
  }

  getPlugin(name: string): OnboardingPlugin<TContext> | undefined {
    return this.plugins.get(name);
  }

  getInstalledPlugins(): OnboardingPlugin<TContext>[] {
    return Array.from(this.plugins.values());
  }

  isInstalled(name: string): boolean {
    return this.plugins.has(name);
  }

  async cleanup(): Promise<void> {
    const cleanupPromises = Array.from(this.cleanupFunctions.values()).map(
      (cleanup) => cleanup(),
    );
    await Promise.all(cleanupPromises);

    this.plugins.clear();
    this.cleanupFunctions.clear();
  }
}
