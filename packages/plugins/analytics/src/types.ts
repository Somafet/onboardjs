import type { EventListenerMap, OnboardingContext } from "@onboardjs/core";

/**
 * Configuration options for the AnalyticsPlugin.
 */
export interface AnalyticsPluginConfig {
  /**
   * The API endpoint URL where events will be sent.
   */
  endpoint: string;

  /**
   * Optional headers to include with the request, e.g., for authentication.
   * @example { 'Authorization': 'Bearer YOUR_API_KEY' }
   */
  headers?: Record<string, string>;

  /**
   * An array of engine event names to track. If not provided, a default
   * set of common events will be tracked.
   * @example ['stepChange', 'flowCompleted', 'stepSkipped']
   */
  eventsToTrack?: Array<keyof EventListenerMap>;

  /**
   * The number of events to batch together before sending.
   * @default 10
   */
  batchSize?: number;

  /**
   * The maximum time in milliseconds to wait before sending a batch,
   * even if the batchSize is not reached.
   * @default 5000 (5 seconds)
   */
  flushInterval?: number;

  /**
   * An optional function to transform the event payload before it's sent.
   * Useful for adding metadata or removing sensitive information.
   */
  payloadTransformer?: <TContext extends OnboardingContext = OnboardingContext>(
    event: AnalyticsEvent<TContext>,
  ) => Record<string, unknown> & AnalyticsEvent<TContext>;

  /**
   * Maximum number of retries for a failed batch.
   * @default 5
   */
  maxRetries?: number;
}

/**
 * The structure of an event that is queued for sending.
 */
export interface AnalyticsEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  /** A unique ID for this specific event instance. */
  id: string;
  type: keyof EventListenerMap<TContext>;
  timestamp: string;
  payload: unknown;
  contextSnapshot: {
    flowData: TContext["flowData"];
    currentUserId?: OnboardingContext['currentUser']['id'];
  };
}


/**
 * A wrapper for a batch of events being sent, including retry metadata.
 */
export interface QueuedBatch {
  events: AnalyticsEvent[];
  retryCount: number;
}
