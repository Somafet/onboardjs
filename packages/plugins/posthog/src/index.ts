import { OnboardingContext } from "@onboardjs/core";
import { PostHogPlugin } from "./PostHogPlugin";
import { PostHogPluginConfig } from "./types";

export { PostHogPlugin } from "./PostHogPlugin";
export type {
  PostHogPluginConfig,
  EventNameMapping,
  StepPropertyEnricher,
  ChurnRiskFactors,
  PerformanceMetrics,
} from "./types";

// Re-export utilities for advanced users
export { EventDataBuilder } from "./utils/eventBuilder";
export { ChurnDetectionManager } from "./utils/churnDetection";
export { PerformanceTracker } from "./utils/performanceMetrics";

// Default configuration presets
export const defaultPostHogConfig: Partial<PostHogPluginConfig> = {
  eventPrefix: "onboarding_",
  includeUserProperties: true,
  includeFlowData: true,
  includeStepMetadata: true,
  includeFlowInfo: true,
  enableChurnDetection: true,
  churnTimeoutMs: 300000, // 5 minutes
  enableProgressMilestones: true,
  milestonePercentages: [25, 50, 75, 100],
  enablePerformanceTracking: true,
  debug: false,
  // These events are excluded by default as they are not relevant for tracking
  excludeEvents: ["persistenceSuccess", "dataChanged"],
};

// Configuration presets for different use cases
export const saasConfig: Partial<PostHogPluginConfig> = {
  ...defaultPostHogConfig,
  churnTimeoutMs: 180000, // 3 minutes for SaaS
  excludePersonalData: true,
  enableExperimentTracking: true,
};

export const ecommerceConfig: Partial<PostHogPluginConfig> = {
  ...defaultPostHogConfig,
  eventPrefix: "checkout_onboarding_",
  churnTimeoutMs: 600000, // 10 minutes for e-commerce
  milestonePercentages: [20, 40, 60, 80, 100],
};

export function createPostHogPlugin<
  TContext extends OnboardingContext = OnboardingContext,
>(config: Partial<PostHogPluginConfig> = {}): PostHogPlugin<TContext> {
  return new PostHogPlugin({
    ...defaultPostHogConfig,
    ...config,
  });
}
