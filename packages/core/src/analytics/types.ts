// src/engine/analytics/types.ts
export interface AnalyticsEvent {
  type: string;
  timestamp: number;
  properties: AnalyticsEventPayload;
  sessionId?: string;
  userId?: string;
  flowId?: string;
}

export interface AnalyticsEventPayload {
  [key: string]: unknown;
  pageUrl?: string;
  // Add these?
  // stepId?: string;
  // isResumed?: boolean;
  // flowData?: any;
  // duration?: number;
  // totalSteps?: number;
}

export interface AnalyticsProvider {
  name: string;
  trackEvent(event: AnalyticsEvent): void | Promise<void>;
  flush?(): void | Promise<void>;
}

export interface AnalyticsConfig {
  enabled?: boolean;
  providers?: AnalyticsProvider[];
  sessionId?: string;
  userId?: string;
  flowId?: string;
  samplingRate?: number;
  debug?: boolean;
  autoTrack?:
    | boolean
    | {
        steps?: boolean;
        flow?: boolean;
        navigation?: boolean;
        interactions?: boolean;
      };
}
