// src/engine/ConfigurationBuilder.ts
import { OnboardingContext } from '../types'
import { OnboardingEngineConfig } from './types'
import { StepValidator } from './StepValidator'

export class ConfigurationBuilder {
    static buildInitialContext<T extends OnboardingContext>(config: OnboardingEngineConfig<T>): T {
        const baseContext = {
            flowData: {},
            ...(config.initialContext || {}),
        } as T

        // Ensure flowData exists
        if (!baseContext.flowData) {
            baseContext.flowData = {}
        }

        // Initialize internal tracking if not present, including stepStartTimes
        if (!baseContext.flowData._internal) {
            baseContext.flowData._internal = {
                completedSteps: {},
                startedAt: Date.now(), // Sets the flow start time
                stepStartTimes: {}, // Initialize step start times map
            }
        } else {
            // If _internal already exists (e.g., from initialContext), ensure stepStartTimes is present
            if (!baseContext.flowData._internal.stepStartTimes) {
                baseContext.flowData._internal.stepStartTimes = {}
            }
            // Ensure startedAt is set if _internal was provided but missed it
            if (!baseContext.flowData._internal.startedAt) {
                baseContext.flowData._internal.startedAt = Date.now()
            }
        }

        return baseContext
    }

    static mergeConfigs<T extends OnboardingContext>(
        current: OnboardingEngineConfig<T>,
        updates: Partial<OnboardingEngineConfig<T>>
    ): OnboardingEngineConfig<T> {
        // Handle context merging specially
        const currentInitialContext = current.initialContext ?? ({} as T)
        const updatesInitialContext = updates.initialContext ?? ({} as T)

        const mergedInitialContext = {
            ...currentInitialContext,
            ...updatesInitialContext,
            flowData: {
                ...(currentInitialContext.flowData || {}),
                ...(updatesInitialContext.flowData || {}),
            },
        } as T

        // Handle plugins merging
        const currentPlugins = current.plugins || []
        const updatesPlugins = updates.plugins || []
        const mergedPlugins = [...currentPlugins, ...updatesPlugins]

        // Handle steps merging (updates replace current)
        const mergedSteps = updates.steps || current.steps

        return {
            ...current,
            ...updates,
            initialContext: mergedInitialContext,
            plugins: mergedPlugins,
            steps: mergedSteps,
        }
    }

    static validateConfig<T extends OnboardingContext>(
        config: OnboardingEngineConfig<T>
    ): {
        isValid: boolean
        errors: string[]
        warnings: string[]
    } {
        const errors: string[] = []
        const warnings: string[] = []

        // Validate steps using StepValidator (TASK-035)
        if (!config.steps || config.steps.length === 0) {
            warnings.push('No steps defined in configuration')
        } else {
            const validator = new StepValidator<T>(100, false)
            const validationResult = validator.validateSteps(config.steps)

            // Add validation errors
            validationResult.errors.forEach((error) => {
                errors.push(error.message)
            })

            // Add validation warnings
            validationResult.warnings.forEach((warning) => {
                warnings.push(warning.message)
            })
        }

        // Validate initial step ID
        if (config.initialStepId) {
            const initialStepExists = config.steps.some((step) => step.id === config.initialStepId)
            if (!initialStepExists) {
                errors.push(`Initial step ID ${config.initialStepId} not found in steps`)
            }
        }

        // Validate plugins
        if (config.plugins) {
            for (const plugin of config.plugins) {
                if (!plugin.name) {
                    errors.push('Plugin found without name')
                }
                if (!plugin.install || typeof plugin.install !== 'function') {
                    errors.push(`Plugin ${plugin.name} missing install function`)
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        }
    }

    static createDefaultConfig<T extends OnboardingContext>(): OnboardingEngineConfig<T> {
        return {
            steps: [],
            initialContext: {
                flowData: {},
            } as T,
            plugins: [],
        }
    }

    static cloneConfig<T extends OnboardingContext>(config: OnboardingEngineConfig<T>): OnboardingEngineConfig<T> {
        return JSON.parse(JSON.stringify(config))
    }
}
