import { OnboardingContext } from "@onboardjs/core";
import { AnalyticsPlugin } from "./analytics-plugin";
import { AnalyticsPluginConfig } from "./types";

export * from "./analytics-plugin";
export * from "./types";

/**
 * A helper function to create an instance of the AnalyticsPlugin.
 * This is the recommended way to instantiate the plugin.
 *
 * @param config The configuration options for the plugin.
 * @returns An instance of AnalyticsPlugin.
 */
export function createAnalyticsPlugin<
  TContext extends OnboardingContext = OnboardingContext,
>(config: AnalyticsPluginConfig): AnalyticsPlugin<TContext> {
  return new AnalyticsPlugin<TContext>(config);
}
