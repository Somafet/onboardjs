// src/engine/analytics/types.ts
export interface AnalyticsEvent {
  type: string;
  timestamp: number;
  properties: Record<string, any>;
  sessionId?: string;
  userId?: string;
  flowId?: string;
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
