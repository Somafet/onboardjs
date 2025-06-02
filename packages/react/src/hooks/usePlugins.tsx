// @onboardjs/react/src/hooks/usePlugins.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { OnboardingPlugin } from "@onboardjs/core";
import { useOnboarding } from "./useOnboarding";

export interface UsePluginsOptions {
  /**
   * Callback executed when a plugin is successfully installed
   */
  onPluginInstalled?: (plugin: OnboardingPlugin) => void;
  /**
   * Callback executed when a plugin is successfully uninstalled
   */
  onPluginUninstalled?: (pluginName: string) => void;
  /**
   * Callback executed when plugin installation fails
   */
  onPluginInstallError?: (plugin: OnboardingPlugin, error: Error) => void;
  /**
   * Callback executed when plugin uninstallation fails
   */
  onPluginUninstallError?: (pluginName: string, error: Error) => void;
}

export const usePlugins = (options?: UsePluginsOptions) => {
  const {
    pluginManager,
    installPlugin: baseInstallPlugin,
    uninstallPlugin: baseUninstallPlugin,
    getInstalledPlugins,
    isPluginInstalled,
  } = useOnboarding();

  const [isInstalling, setIsInstalling] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [installedPlugins, setInstalledPlugins] = useState<OnboardingPlugin[]>(
    []
  );

  // Update installed plugins list when plugins change
  useEffect(() => {
    if (pluginManager) {
      setInstalledPlugins(getInstalledPlugins());
    }
  }, [pluginManager, getInstalledPlugins]);

  const installPlugin = useCallback(
    async (plugin: OnboardingPlugin) => {
      if (!pluginManager) {
        throw new Error("Plugin manager is not available");
      }

      setIsInstalling(true);
      try {
        await baseInstallPlugin(plugin);
        setInstalledPlugins(getInstalledPlugins());
        options?.onPluginInstalled?.(plugin);
      } catch (error) {
        options?.onPluginInstallError?.(plugin, error as Error);
        throw error;
      } finally {
        setIsInstalling(false);
      }
    },
    [pluginManager, baseInstallPlugin, getInstalledPlugins, options]
  );

  const uninstallPlugin = useCallback(
    async (pluginName: string) => {
      if (!pluginManager) {
        throw new Error("Plugin manager is not available");
      }

      setIsUninstalling(true);
      try {
        await baseUninstallPlugin(pluginName);
        setInstalledPlugins(getInstalledPlugins());
        options?.onPluginUninstalled?.(pluginName);
      } catch (error) {
        options?.onPluginUninstallError?.(pluginName, error as Error);
        throw error;
      } finally {
        setIsUninstalling(false);
      }
    },
    [pluginManager, baseUninstallPlugin, getInstalledPlugins, options]
  );

  const getPlugin = useCallback(
    (pluginName: string) => {
      return pluginManager?.getPlugin(pluginName);
    },
    [pluginManager]
  );

  return {
    pluginManager,
    installedPlugins,
    installPlugin,
    uninstallPlugin,
    getPlugin,
    isPluginInstalled,
    isInstalling,
    isUninstalling,
    isPluginManagerAvailable: !!pluginManager,
  };
};
