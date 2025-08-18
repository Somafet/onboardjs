import { PluginConfig } from "@onboardjs/core";

// Flexible Mixpanel type to work with mixpanel-browser
type Mixpanel = any;

export interface MixpanelPluginConfig extends PluginConfig {
  // Mixpanel instance configuration
  token?: string;
  config?: Partial<MixpanelConfig>;
  mixpanelInstance?: Mixpanel;

  // Event naming and customization
  eventPrefix?: string;
  customEventNames?: Partial<EventNameMapping>;

  // Data inclusion options
  includeUserProperties?: boolean;
  includeFlowData?: boolean;
  includeFlowInfo?: boolean;
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

export interface MixpanelConfig {
  api_host?: string;
  cross_subdomain_cookie?: boolean;
  persistence?: string;
  persistence_name?: string;
  cookie_name?: string;
  loaded?: (mixpanel: Mixpanel) => void;
  store_google?: boolean;
  save_referrer?: boolean;
  test?: boolean;
  verbose?: boolean;
  img?: boolean;
  debug?: boolean;
  track_links_timeout?: number;
  cookie_expiration?: number;
  upgrade?: boolean;
  disable_persistence?: boolean;
  disable_cookie?: boolean;
  secure_cookie?: boolean;
  ip?: boolean;
  property_blacklist?: string[];
  xhr_headers?: Record<string, string>;
  ignore_dnt?: boolean;
  batch_requests?: boolean;
  batch_size?: number;
  batch_flush_interval_ms?: number;
  batch_request_timeout_ms?: number;
  hooks?: {
    before_send_events?: (data: any) => any;
  };
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
