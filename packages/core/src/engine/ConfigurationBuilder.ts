// src/engine/ConfigurationBuilder.ts
import { OnboardingContext } from "../types";
import { OnboardingEngineConfig } from "./types";

export class ConfigurationBuilder {
  static buildInitialContext<T extends OnboardingContext>(
    config: OnboardingEngineConfig<T>,
  ): T {
    const baseContext = {
      flowData: {},
      ...(config.initialContext || {}),
    } as T;

    // Ensure flowData exists and is properly structured
    if (!baseContext.flowData) {
      baseContext.flowData = {};
    }

    // Initialize internal tracking if not present
    if (!baseContext.flowData._internal) {
      baseContext.flowData._internal = {
        completedSteps: {},
        startedAt: Date.now(),
      };
    }

    return baseContext;
  }

  static mergeConfigs<T extends OnboardingContext>(
    current: OnboardingEngineConfig<T>,
    updates: Partial<OnboardingEngineConfig<T>>,
  ): OnboardingEngineConfig<T> {
    // Handle context merging specially
    const currentInitialContext = current.initialContext ?? ({} as T);
    const updatesInitialContext = updates.initialContext ?? ({} as T);

    const mergedInitialContext = {
      ...currentInitialContext,
      ...updatesInitialContext,
      flowData: {
        ...(currentInitialContext.flowData || {}),
        ...(updatesInitialContext.flowData || {}),
      },
    } as T;

    // Handle plugins merging
    const currentPlugins = current.plugins || [];
    const updatesPlugins = updates.plugins || [];
    const mergedPlugins = [...currentPlugins, ...updatesPlugins];

    // Handle steps merging (updates replace current)
    const mergedSteps = updates.steps || current.steps;

    return {
      ...current,
      ...updates,
      initialContext: mergedInitialContext,
      plugins: mergedPlugins,
      steps: mergedSteps,
    };
  }

  static validateConfig<T extends OnboardingContext>(
    config: OnboardingEngineConfig<T>,
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate steps
    if (!config.steps || config.steps.length === 0) {
      warnings.push("No steps defined in configuration");
    } else {
      const stepIds = new Set<string | number>();
      for (const step of config.steps) {
        // Check for duplicate step IDs
        if (stepIds.has(step.id)) {
          errors.push(`Duplicate step ID found: ${step.id}`);
        }
        stepIds.add(step.id);

        // Validate step structure
        if (!step.id) {
          errors.push("Step found without ID");
        }

        // Validate checklist steps
        if (step.type === "CHECKLIST") {
          const payload = step.payload;
          if (!payload?.dataKey) {
            errors.push(`Checklist step ${step.id} missing dataKey`);
          }
          if (!payload?.items || !Array.isArray(payload.items)) {
            errors.push(`Checklist step ${step.id} missing or invalid items`);
          }
        }
      }
    }

    // Validate initial step ID
    if (config.initialStepId) {
      const initialStepExists = config.steps.some(
        (step) => step.id === config.initialStepId,
      );
      if (!initialStepExists) {
        errors.push(
          `Initial step ID ${config.initialStepId} not found in steps`,
        );
      }
    }

    // Validate plugins
    if (config.plugins) {
      for (const plugin of config.plugins) {
        if (!plugin.name) {
          errors.push("Plugin found without name");
        }
        if (!plugin.install || typeof plugin.install !== "function") {
          errors.push(`Plugin ${plugin.name} missing install function`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static createDefaultConfig<
    T extends OnboardingContext,
  >(): OnboardingEngineConfig<T> {
    return {
      steps: [],
      initialContext: {
        flowData: {},
      } as T,
      plugins: [],
    };
  }

  static cloneConfig<T extends OnboardingContext>(
    config: OnboardingEngineConfig<T>,
  ): OnboardingEngineConfig<T> {
    return JSON.parse(JSON.stringify(config));
  }
}
