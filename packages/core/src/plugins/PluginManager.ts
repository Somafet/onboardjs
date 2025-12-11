// @onboardjs/core/src/plugins/PluginManager.ts

import { EventManager } from '../engine/EventManager'
import { OnboardingEngine } from '../engine/OnboardingEngine'
import { OnboardingContext } from '../types'
import { Logger } from '../services/Logger'
import { OnboardingPlugin, PluginManager, PluginCleanup } from './types'

export class PluginManagerImpl<
    TContext extends OnboardingContext = OnboardingContext,
> implements PluginManager<TContext> {
    private _plugins = new Map<string, OnboardingPlugin<TContext>>()
    private _cleanupFunctions = new Map<string, PluginCleanup>()
    private _engine: OnboardingEngine<TContext>
    private _logger: Logger

    constructor(
        engine: OnboardingEngine<TContext>,
        private _eventManager?: EventManager<TContext>,
        debugMode?: boolean
    ) {
        this._engine = engine
        this._eventManager = _eventManager
        this._logger = new Logger({
            debugMode: debugMode ?? false,
            prefix: 'PluginManager',
        })
    }

    async install(plugin: OnboardingPlugin<TContext>): Promise<void> {
        // Check if plugin is already installed
        if (this._plugins.has(plugin.name)) {
            throw new Error(`Plugin "${plugin.name}" is already installed`)
        }

        // Check dependencies
        if (plugin.dependencies) {
            for (const dep of plugin.dependencies) {
                if (!this._plugins.has(dep)) {
                    throw new Error(`Plugin "${plugin.name}" requires dependency "${dep}" which is not installed`)
                }
            }
        }

        try {
            // Install the plugin
            const cleanup = await plugin.install(this._engine)

            // Store plugin and cleanup function
            this._plugins.set(plugin.name, plugin)
            this._cleanupFunctions.set(plugin.name, cleanup)

            // Notify listeners about the installation
            this._eventManager?.notifyListeners('pluginInstalled', {
                pluginName: plugin.name,
                pluginVersion: plugin.version,
            })

            this._logger.debug(`Installed plugin: ${plugin.name}@${plugin.version}`)
        } catch (error) {
            // Handle installation errors
            this._eventManager?.notifyListeners('pluginError', {
                pluginName: plugin.name,
                error: error as Error,
                context: this._engine.getContext(),
            })

            this._logger.error(`Failed to install plugin "${plugin.name}":`, error)
            throw error
        }
    }

    async uninstall(pluginName: string): Promise<void> {
        const plugin = this._plugins.get(pluginName)
        if (!plugin) {
            throw new Error(`Plugin "${pluginName}" is not installed`)
        }

        // Check if other plugins depend on this one
        const dependentPlugins = Array.from(this._plugins.values()).filter((p) => p.dependencies?.includes(pluginName))

        if (dependentPlugins.length > 0) {
            const dependentNames = dependentPlugins.map((p) => p.name).join(', ')
            throw new Error(`Cannot uninstall "${pluginName}" because it is required by: ${dependentNames}`)
        }

        try {
            // Run cleanup
            const cleanup = this._cleanupFunctions.get(pluginName)
            if (cleanup) {
                await cleanup()
            }

            this._logger.debug(`Uninstalled plugin: ${pluginName}`)
        } catch (error) {
            this._logger.error(`Failed to uninstall plugin "${pluginName}":`, error)
            throw error
        } finally {
            // Ensure cleanup function is removed even if it fails
            this._cleanupFunctions.delete(pluginName)
            this._plugins.delete(pluginName)
        }
    }

    getPlugin(name: string): OnboardingPlugin<TContext> | undefined {
        return this._plugins.get(name)
    }

    getInstalledPlugins(): OnboardingPlugin<TContext>[] {
        return Array.from(this._plugins.values())
    }

    isInstalled(name: string): boolean {
        return this._plugins.has(name)
    }

    async cleanup(): Promise<void> {
        const cleanupPromises = Array.from(this._cleanupFunctions.values()).map((cleanup) => cleanup())
        await Promise.all(cleanupPromises)

        this._plugins.clear()
        this._cleanupFunctions.clear()
    }
}
