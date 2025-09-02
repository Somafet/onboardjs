// @onboardjs/core/src/plugins/PluginManager.ts

import { EventManager } from '../engine/EventManager'
import { OnboardingEngine } from '../engine/OnboardingEngine'
import { OnboardingContext } from '../types'
import { Logger } from '../services/Logger'
import { OnboardingPlugin, PluginManager, PluginCleanup } from './types'

export class PluginManagerImpl<TContext extends OnboardingContext = OnboardingContext>
    implements PluginManager<TContext>
{
    private plugins = new Map<string, OnboardingPlugin<TContext>>()
    private cleanupFunctions = new Map<string, PluginCleanup>()
    private engine: OnboardingEngine<TContext>
    private logger: Logger

    constructor(
        engine: OnboardingEngine<TContext>,
        private eventManager?: EventManager<TContext>,
        debugMode?: boolean
    ) {
        this.engine = engine
        this.eventManager = eventManager
        this.logger = new Logger({
            debugMode: debugMode ?? false,
            prefix: 'PluginManager',
        })
    }

    async install(plugin: OnboardingPlugin<TContext>): Promise<void> {
        // Check if plugin is already installed
        if (this.plugins.has(plugin.name)) {
            throw new Error(`Plugin "${plugin.name}" is already installed`)
        }

        // Check dependencies
        if (plugin.dependencies) {
            for (const dep of plugin.dependencies) {
                if (!this.plugins.has(dep)) {
                    throw new Error(`Plugin "${plugin.name}" requires dependency "${dep}" which is not installed`)
                }
            }
        }

        try {
            // Install the plugin
            const cleanup = await plugin.install(this.engine)

            // Store plugin and cleanup function
            this.plugins.set(plugin.name, plugin)
            this.cleanupFunctions.set(plugin.name, cleanup)

            // Notify listeners about the installation
            this.eventManager?.notifyListeners('pluginInstalled', {
                pluginName: plugin.name,
                pluginVersion: plugin.version,
            })

            this.logger.debug(`Installed plugin: ${plugin.name}@${plugin.version}`)
        } catch (error) {
            // Handle installation errors
            this.eventManager?.notifyListeners('pluginError', {
                pluginName: plugin.name,
                error: error as Error,
                context: this.engine.getContext(),
            })

            this.logger.error(`Failed to install plugin "${plugin.name}":`, error)
            throw error
        }
    }

    async uninstall(pluginName: string): Promise<void> {
        const plugin = this.plugins.get(pluginName)
        if (!plugin) {
            throw new Error(`Plugin "${pluginName}" is not installed`)
        }

        // Check if other plugins depend on this one
        const dependentPlugins = Array.from(this.plugins.values()).filter((p) => p.dependencies?.includes(pluginName))

        if (dependentPlugins.length > 0) {
            const dependentNames = dependentPlugins.map((p) => p.name).join(', ')
            throw new Error(`Cannot uninstall "${pluginName}" because it is required by: ${dependentNames}`)
        }

        try {
            // Run cleanup
            const cleanup = this.cleanupFunctions.get(pluginName)
            if (cleanup) {
                await cleanup()
            }

            this.logger.debug(`Uninstalled plugin: ${pluginName}`)
        } catch (error) {
            this.logger.error(`Failed to uninstall plugin "${pluginName}":`, error)
            throw error
        } finally {
            // Ensure cleanup function is removed even if it fails
            this.cleanupFunctions.delete(pluginName)
            this.plugins.delete(pluginName)
        }
    }

    getPlugin(name: string): OnboardingPlugin<TContext> | undefined {
        return this.plugins.get(name)
    }

    getInstalledPlugins(): OnboardingPlugin<TContext>[] {
        return Array.from(this.plugins.values())
    }

    isInstalled(name: string): boolean {
        return this.plugins.has(name)
    }

    async cleanup(): Promise<void> {
        const cleanupPromises = Array.from(this.cleanupFunctions.values()).map((cleanup) => cleanup())
        await Promise.all(cleanupPromises)

        this.plugins.clear()
        this.cleanupFunctions.clear()
    }
}
