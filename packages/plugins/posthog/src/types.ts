import { PluginConfig } from "@onboardjs/core";
import { PostHog } from "posthog-js";

export interface PostHogPluginConfig extends PluginConfig {
  // PostHog instance configuration
  apiKey?: string;
  host?: string;
  posthogInstance?: PostHog;

  // Event naming and customization
  eventPrefix?: string;
  customEventNames?: Partial<EventNameMapping>;

  // Data inclusion options
  includeUserProperties?: boolean;
  includeFlowData?: boolean;
  includeStepMetadata?: boolean;
  includePerformanceMetrics?: boolean;
  includeSessionData?: boolean;

  // Event filtering
  excludeEvents?: (keyof EventNameMapping)[];
  includeOnlyEvents?: (keyof EventNameMapping)[];
  stepTypeFilters?: string[];

  // Privacy and compliance
  sanitizeData?: (data: Record<string, any>) => Record<string, any>;
  excludePersonalData?: boolean;
  excludeFlowDataKeys?: string[];

  // Churn detection
  enableChurnDetection?: boolean;
  churnTimeoutMs?: number;
  churnRiskThreshold?: number;

  // Progress tracking
  enableProgressMilestones?: boolean;
  milestonePercentages?: number[];

  // A/B testing
  enableExperimentTracking?: boolean;
  experimentFlags?: string[];

  // Performance monitoring
  enablePerformanceTracking?: boolean;
  performanceThresholds?: {
    slowStepMs?: number;
    slowRenderMs?: number;
  };

  // Custom properties and enrichment
  globalProperties?: Record<string, any>;
  stepPropertyEnrichers?: Record<string, StepPropertyEnricher>;
  userPropertyMapper?: (user: any) => Record<string, any>;

  // Debug and development
  debug?: boolean;
  enableConsoleLogging?: boolean;
}

export interface EventNameMapping {
  // Flow events
  flowStarted: string;
  flowCompleted: string;
  flowAbandoned: string;
  flowPaused: string;
  flowResumed: string;
  flowReset: string;

  // Step events
  stepActive: string;
  stepCompleted: string;
  stepSkipped: string;
  stepAbandoned: string;
  stepRetried: string;
  stepValidationFailed: string;
  stepHelpRequested: string;

  // Navigation events
  navigationBack: string;
  navigationForward: string;
  navigationJump: string;

  // Interaction events
  userIdle: string;
  userReturned: string;
  dataChanged: string;

  // Progress events
  progressMilestone: string;
  highChurnRisk: string;

  // Performance events
  stepRenderSlow: string;
  persistenceSuccess: string;
  persistenceFailure: string;

  // Checklist events
  checklistItemToggled: string;
  checklistProgress: string;

  // Experiment events
  experimentExposed: string;

  // Error events
  errorEncountered: string;
  pluginError: string;
}

export type StepPropertyEnricher = (
  step: any,
  context: any,
) => Record<string, any>;

export interface ChurnRiskFactors {
  timeOnStep: number;
  backNavigationCount: number;
  errorCount: number;
  idleTime: number;
  validationFailures: number;
}

export interface PerformanceMetrics {
  stepRenderTime?: number;
  persistenceTime?: number;
  memoryUsage?: number;
  navigationTime?: number;
}
