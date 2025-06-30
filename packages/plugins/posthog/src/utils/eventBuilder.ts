import { OnboardingStep, OnboardingContext } from "@onboardjs/core";
import { PostHogPluginConfig, PerformanceMetrics } from "../types";

export class EventDataBuilder<TContext extends OnboardingContext> {
  constructor(private config: PostHogPluginConfig) {}

  buildEventData(
    eventType: string,
    baseData: Record<string, any>,
    step?: OnboardingStep<TContext>,
    context?: TContext,
    performanceMetrics?: PerformanceMetrics,
  ): Record<string, any> {
    let eventData = { ...baseData };

    // Add timestamp
    eventData.timestamp = new Date().toISOString();
    eventData.event_type = eventType;

    // Add global properties
    if (this.config.globalProperties) {
      eventData = { ...eventData, ...this.config.globalProperties };
    }

    // Add user properties
    if (this.config.includeUserProperties && context?.currentUser) {
      eventData.user_properties = this.buildUserProperties(context.currentUser);
    }

    // Add flow data
    if (this.config.includeFlowData && context?.flowData) {
      eventData.flow_data = this.sanitizeFlowData(context.flowData);
    }

    // Add step metadata
    if (this.config.includeStepMetadata && step) {
      eventData.step_metadata = this.buildStepMetadata(step);
    }

    // Add session data
    if (this.config.includeSessionData) {
      eventData.session_data = this.buildSessionData();
    }

    // Add performance metrics
    if (this.config.includePerformanceMetrics && performanceMetrics) {
      eventData.performance = performanceMetrics;
    }

    // Apply step-specific enrichment
    if (step && this.config.stepPropertyEnrichers) {
      const enricher = this.config.stepPropertyEnrichers[step.type ?? "INFORMATION"];
      if (enricher) {
        const enrichedData = enricher(step, context);
        eventData = { ...eventData, ...enrichedData };
      }
    }

    // Apply custom sanitization
    if (this.config.sanitizeData) {
      eventData = this.config.sanitizeData(eventData);
    }

    // Remove excluded personal data
    if (this.config.excludePersonalData) {
      eventData = this.removePersonalData(eventData);
    }

    return eventData;
  }

  private buildUserProperties(user: any): Record<string, any> {
    if (this.config.userPropertyMapper) {
      return this.config.userPropertyMapper(user);
    }

    // Default user property mapping
    return {
      user_id: user.id,
      user_email: user.email,
      user_name: user.name,
      user_created_at: user.createdAt,
      user_plan: user.plan,
      user_role: user.role,
    };
  }

  private sanitizeFlowData(flowData: Record<string, any>): Record<string, any> {
    const sanitized = { ...flowData };

    // Remove excluded keys
    if (this.config.excludeFlowDataKeys) {
      this.config.excludeFlowDataKeys.forEach((key) => {
        delete sanitized[key];
      });
    }

    // Remove internal data
    delete sanitized._internal;

    return sanitized;
  }

  private buildStepMetadata(step: OnboardingStep<TContext>): Record<string, any> {
    return {
      step_id: step.id,
      step_type: step.type,
      has_condition: !!step.condition,
      is_skippable: !!step.isSkippable,
      has_validation: this.hasValidation(step),
      payload_keys: Object.keys(step.payload || {}),
      payload_size: JSON.stringify(step.payload || {}).length,
    };
  }

  private buildSessionData(): Record<string, any> {
    return {
      session_id: this.getSessionId(),
      page_url:
        typeof window !== "undefined" ? window.location.href : undefined,
      user_agent:
        typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      screen_resolution:
        typeof screen !== "undefined"
          ? `${screen.width}x${screen.height}`
          : undefined,
      viewport_size:
        typeof window !== "undefined"
          ? `${window.innerWidth}x${window.innerHeight}`
          : undefined,
    };
  }

  private hasValidation(step: OnboardingStep<TContext>): boolean {
    // Check if step has validation logic
    return !!(
      step.payload &&
      (step.payload.validation ||
        step.payload.required ||
        step.payload.minSelections ||
        step.payload.maxSelections)
    );
  }

  private removePersonalData(data: Record<string, any>): Record<string, any> {
    const sensitiveKeys = [
      "email",
      "phone",
      "address",
      "ssn",
      "credit_card",
      "password",
      "token",
      "api_key",
      "secret",
    ];

    const cleaned = { ...data };

    const removeSensitiveData = (obj: any): any => {
      if (typeof obj !== "object" || obj === null) return obj;

      if (Array.isArray(obj)) {
        return obj.map(removeSensitiveData);
      }

      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
          result[key] = "[REDACTED]";
        } else {
          result[key] = removeSensitiveData(value);
        }
      }
      return result;
    };

    return removeSensitiveData(cleaned);
  }

  private getSessionId(): string {
    // Simple session ID generation
    if (typeof window !== "undefined") {
      let sessionId = sessionStorage.getItem("onboardjs_session_id");
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem("onboardjs_session_id", sessionId);
      }
      return sessionId;
    }
    return `server_session_${Date.now()}`;
  }
}
