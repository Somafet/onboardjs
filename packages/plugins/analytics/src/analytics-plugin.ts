import {
  BasePlugin,
  EventListenerMap,
  OnboardingContext,
  PluginHooks,
} from "@onboardjs/core";
import { AnalyticsPluginConfig, AnalyticsEvent, QueuedBatch } from "./types";
import { AnalyticsDBManager } from "./analytics-db-manager";

const DEFAULT_EVENTS_TO_TRACK: Array<keyof EventListenerMap> = [
  "flowStarted",
  "stepChange",
  "stepCompleted",
  "stepSkipped",
  "flowCompleted",
  "flowAbandoned",
];

export class AnalyticsPlugin<
  TContext extends OnboardingContext = OnboardingContext,
> extends BasePlugin<TContext, AnalyticsPluginConfig> {
  readonly name = "AnalyticsPlugin";
  readonly version = "1.0.0";
  readonly description =
    "Sends onboarding events to an API with offline support and retries.";

  private dbManager: AnalyticsDBManager;
  private inMemoryQueue: AnalyticsEvent<TContext>[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;

  constructor(config: AnalyticsPluginConfig) {
    // Provide default values for batching and events
    super({
      batchSize: 10,
      flushInterval: 5000,
      maxRetries: 5,
      eventsToTrack: DEFAULT_EVENTS_TO_TRACK,
      ...config,
    });
    this.dbManager = new AnalyticsDBManager();
  }

  /**
   * Called when the plugin is installed. Sets up the batching timer.
   */
  protected async onInstall(): Promise<void> {
    await this.dbManager.init();

    // Listen to online/offline events to trigger flushes
    if (window !== undefined) {
      window.addEventListener("online", this.flushQueue);
    }
    this.flushTimer = setInterval(
      () => this.persistAndFlush(),
      this.config.flushInterval,
    );

    // Attempt to flush any events left from a previous session
    this.flushQueue();
  }

  /**
   * Called when the plugin is uninstalled. Clears the timer and sends
   * any remaining events.
   */
  protected async onUninstall(): Promise<void> {
    if (window !== undefined) {
      window.removeEventListener("online", this.flushQueue);
    }
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.persistAndFlush(); // Final flush
  }

  /**
   * Dynamically generates the hooks object based on the `eventsToTrack`
   * configuration. This is the core of the event listening mechanism.
   */
  protected getHooks(): PluginHooks<TContext> {
    const hooks: PluginHooks<TContext> = {};
    const events = this.config.eventsToTrack || [];

    for (const eventType of events) {
      // Map the event name (e.g., 'onStepChange') to a handler.
      // The hook name is camelCase with 'on' prefix, e.g., onFlowStarted.
      const hookName =
        `on${eventType.charAt(0).toUpperCase()}${eventType.slice(1)}` as keyof PluginHooks<TContext>;

      // @ts-ignore - We are dynamically building the hooks object
      hooks[hookName] = (payload: any) => {
        this.handleEvent(eventType, payload);
      };
    }
    return hooks;
  }

  /**
   * Handles an incoming event from the engine, adds it to the queue,
   * and triggers a flush if the batch size is reached.
   */
  private handleEvent(type: keyof EventListenerMap<TContext>, payload: any) {
    if (!this.engine) {
      console.error("[AnalyticsPlugin] Engine not available in handleEvent");
      return;
    }

    const context = this.engine.getContext();
    if (!context) {
      console.error("[AnalyticsPlugin] Context not available from engine");
      return;
    }

    const event: AnalyticsEvent<TContext> = {
      id: crypto.randomUUID(), // Generate unique ID for DB
      type,
      timestamp: new Date().toISOString(),
      payload,
      contextSnapshot: {
        flowData: context.flowData,
        currentUserId: context.currentUser?.id,
      },
    };

    this.inMemoryQueue.push(event);

    if (this.inMemoryQueue.length >= (this.config.batchSize ?? 10)) {
      this.persistAndFlush();
    }
  }

  /**
   * Persists the in-memory queue to IndexedDB and then triggers a flush.
   */
  private async persistAndFlush(): Promise<void> {
    if (this.inMemoryQueue.length === 0) {
      return;
    }
    const eventsToPersist = [...this.inMemoryQueue];
    this.inMemoryQueue = [];
    await this.dbManager.addEvents(eventsToPersist);
    this.flushQueue();
  }

  /**
   * The main flushing logic that reads from DB and initiates sending.
   */
  private flushQueue = async (): Promise<void> => {
    if (this.isFlushing || !navigator.onLine) {
      return;
    }

    this.isFlushing = true;

    try {
      const events = await this.dbManager.getEvents(
        this.config.batchSize ?? 10,
      );
      if (events.length > 0) {
        const batch: QueuedBatch = { events, retryCount: 0 };
        await this.sendBatch(batch);
      }
    } catch (error) {
      console.error(`[${this.name}] Error during flush:`, error);
    } finally {
      this.isFlushing = false;
    }
  };

  /**
   * Sends a specific batch and handles the success or retry logic.
   */
  private async sendBatch(batch: QueuedBatch): Promise<void> {
    let transformedPayload = batch.events;
    if (this.config.payloadTransformer) {
      transformedPayload = batch.events.map(this.config.payloadTransformer);
    }

    try {
      const response = await fetch(this.config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.config.headers,
        },
        body: JSON.stringify(transformedPayload),
      });

      if (response.ok) {
        // SUCCESS: Delete from DB and try to flush the next batch
        await this.dbManager.deleteEvents(batch.events.map((e) => e.id));
        console.debug(
          `[${this.name}] Successfully sent ${batch.events.length} events.`,
        );
        // Immediately try to flush more, but don't await it
        this.flushQueue();
      } else {
        throw new Error(`API returned status ${response.status}`);
      }
    } catch (error) {
      // FAILURE: Handle retry
      console.warn(
        `[${this.name}] Failed to send batch. Error:`,
        error,
        `Retry attempt ${batch.retryCount + 1}.`,
      );
      this.handleRetry(batch);
    }
  }

  /**
   * Calculates backoff delay and schedules a retry.
   */
  private handleRetry(batch: QueuedBatch): void {
    batch.retryCount++;
    if (batch.retryCount > (this.config.maxRetries ?? 5)) {
      console.error(
        `[${this.name}] Batch failed after max retries. Discarding ${batch.events.length} events.`,
      );
      // To prevent losing data, you could move these to a "dead-letter" store
      // For now, we just delete them to prevent an infinite loop.
      this.dbManager.deleteEvents(batch.events.map((e) => e.id));
      // Report the error to the engine
      this.engine.reportError(
        new Error(
          `Analytics batch failed after ${this.config.maxRetries} retries`,
        ),
        "analytics-max-retries-exceeded",
      );
      return;
    }

    // Exponential backoff with jitter: (2^retryCount * 1s) + random_ms
    const jitter = Math.random() * 1000;
    const delay = Math.pow(2, batch.retryCount) * 1000 + jitter;

    setTimeout(() => this.sendBatch(batch), delay);
  }
}
