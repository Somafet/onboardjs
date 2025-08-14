// src/engine/analytics/AnalyticsManager.ts
import { Logger } from "../services/Logger";
import { OnboardingContext, OnboardingStep } from "../types";
import {
  AnalyticsEvent,
  AnalyticsProvider,
  AnalyticsConfig,
  AnalyticsEventPayload,
} from "./types";

export class AnalyticsManager<TContext extends OnboardingContext = OnboardingContext> {
  private providers: AnalyticsProvider[] = [];
  private config: AnalyticsConfig;
  private sessionId: string;
  private logger: Logger;
  private flowInfo: {
    flowId?: string;
    flowName?: string;
    flowVersion?: string;
    flowMetadata?: Record<string, unknown>;
    instanceId?: number;
  } = {};

  constructor(config: AnalyticsConfig = {}, logger?: Logger) {
    this.config = {
      enabled: true,
      samplingRate: 1.0,
      autoTrack: true,
      ...config,
    };

    this.sessionId =
      config.sessionId || `session_${Math.random().toString(36).slice(2)}`;
    this.logger =
      logger ||
      new Logger({ debugMode: config.debug, prefix: "AnalyticsManager" });

    if (config.providers) {
      this.providers.push(...config.providers);
    }
  }

  registerProvider(provider: AnalyticsProvider): void {
    this.providers.push(provider);
    this.logger.debug(`Registered analytics provider: ${provider.name}`);
  }

  get providerCount(): number {
    return this.providers.length;
  }

  trackEvent(eventType: string, properties: Record<string, any> = {}): void {
    // Create a mutable copy of the properties object to add new data
    const augmentedProperties: AnalyticsEventPayload = {
      ...properties,
      // Add flow identification to all events
      ...this.flowInfo,
    };

    // Capture the URL if in a browser environment (client-side)
    // and add it to the event's properties.
    if (
      typeof window !== "undefined" &&
      window.location &&
      window.location.href
    ) {
      augmentedProperties.pageUrl = window.location.href;
    }

    // 1. Construct the full event object
    const event: AnalyticsEvent = {
      type: eventType,
      timestamp: Date.now(),
      properties: augmentedProperties,
      sessionId: this.sessionId,
      userId: this.config.userId, // Use userId from config
      flowId: this.config.flowId || this.flowInfo.flowId, // Use flowId from config or flowInfo
      flowName: this.flowInfo.flowName,
      flowVersion: this.flowInfo.flowVersion,
      instanceId: this.flowInfo.instanceId,
    };

    // 2. Log the event if debug mode is enabled
    this.logger.debug(`[AnalyticsManager] Event: "${eventType}"`, event);

    // 3. Check if analytics is enabled and if there are any providers to send to
    if (!this.config.enabled || this.providers.length === 0) {
      return; // If not enabled or no providers, stop here
    }

    // 4. Apply sampling *before* dispatching to providers
    if (
      this.config.samplingRate !== undefined &&
      this.config.samplingRate < 1.0 &&
      Math.random() > this.config.samplingRate
    ) {
      this.logger.debug(
        `[AnalyticsManager] Event "${eventType}" skipped due to sampling.`,
      );
      return;
    }

    // 5. Dispatch to all registered providers
    for (const provider of this.providers) {
      try {
        provider.trackEvent(event);
      } catch (error) {
        this.logger.error(
          `[AnalyticsManager] Error in analytics provider "${provider.name}":`,
          error,
        );
      }
    }
  }

  trackStepViewed(step: OnboardingStep<TContext>, context: TContext): void {
    this.trackEvent("step_viewed", {
      stepId: step.id,
    });
  }

  trackStepCompleted(
    step: OnboardingStep<TContext>,
    context: TContext,
    duration: number,
  ): void {
    this.trackEvent("step_completed", {
      stepId: step.id,
      duration,
    });
  }

  trackFlowStarted(context: TContext, isResumed: boolean): void {
    this.trackEvent("flow_started", {
      isResumed,
      flowData: this.sanitizeContext(context),
    });
  }

  trackFlowCompleted(context: TContext): void {
    const duration = this.getFlowCompletionTime(context);

    this.trackEvent("flow_completed", {
      duration,
      totalSteps: context.flowData?._internal?.completedSteps
        ? Object.keys(context.flowData._internal.completedSteps).length
        : 0,
      flowData: this.sanitizeContext(context),
    });
  }

  async flush(): Promise<void> {
    for (const provider of this.providers) {
      if (provider.flush) {
        try {
          await provider.flush();
        } catch (error) {
          this.logger.error(`Error flushing provider ${provider.name}:`, error);
        }
      }
    }
  }

  setUserId(userId: string): void {
    this.config.userId = userId;
  }

  setFlowId(flowId: string): void {
    this.config.flowId = flowId;
    this.flowInfo.flowId = flowId;
  }

  setFlowInfo(flowInfo: {
    flowId?: string;
    flowName?: string;
    flowVersion?: string;
    flowMetadata?: Record<string, unknown>;
    instanceId?: number;
  }): void {
    this.flowInfo = { ...this.flowInfo, ...flowInfo };
    if (flowInfo.flowId) {
      this.config.flowId = flowInfo.flowId;
    }
  }

  // Utility to prevent sensitive data from being sent to analytics
  private sanitizeContext(context: TContext): Record<string, any> {
    // Create a clean version of the context for analytics that removes sensitive data
    const sanitized = { ...context };

    // Remove potentially sensitive fields
    delete sanitized.currentUser;
    delete sanitized.apiKeys;
    delete sanitized.tokens;

    return sanitized;
  }

  private getFlowCompletionTime(context: TContext): number {
    const startTime = context.flowData._internal?.startedAt;
    return startTime ? Date.now() - startTime : 0;
  }
}
