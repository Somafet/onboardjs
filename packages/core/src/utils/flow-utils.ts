// src/utils/flow-utils.ts

import { OnboardingEngine } from '../engine/OnboardingEngine'
import { OnboardingEngineRegistry } from '../engine/OnboardingEngineRegistry'
import { OnboardingContext } from '../types'
import { Logger } from '../services'

/**
 * Utility functions for working with multiple flows
 */
export class FlowUtils {
    private static _logger = Logger.getInstance({ prefix: '[FlowUtils]' })

    /**
     * Generate a namespaced persistence key based on flow identification
     */
    static generatePersistenceKey(engine: OnboardingEngine<any>, baseKey: string = 'onboarding'): string {
        const parts = [baseKey]

        const flowId = engine.getFlowId()
        const flowName = engine.getFlowName()
        const flowVersion = engine.getFlowVersion()

        if (flowId) {
            parts.push(flowId)
        } else if (flowName) {
            parts.push(flowName.replace(/\s+/g, '_').toLowerCase())
        }

        if (flowVersion) {
            parts.push(`v${flowVersion}`)
        }

        return parts.join('_')
    }

    /**
     * Get all engines matching a flow pattern
     * @param pattern - Pattern to match engines
     * @param registry - Registry to search in
     */
    static getEnginesByPattern(
        pattern: {
            flowId?: string
            flowName?: string
            flowVersion?: string
        },
        registry: OnboardingEngineRegistry
    ): OnboardingEngine<any>[] {
        const allEngines = registry.getAll()

        return allEngines.filter((engine) => {
            if (pattern.flowId && engine.getFlowId() !== pattern.flowId) {
                return false
            }
            if (pattern.flowName && engine.getFlowName() !== pattern.flowName) {
                return false
            }
            if (pattern.flowVersion && engine.getFlowVersion() !== pattern.flowVersion) {
                return false
            }
            return true
        })
    }

    /**
     * Get the most recent version of a flow by name
     * @param flowName - Name of the flow to find
     * @param registry - Registry to search in
     */
    static getLatestVersionByFlowName(
        flowName: string,
        registry: OnboardingEngineRegistry
    ): OnboardingEngine<any> | null {
        const engines = FlowUtils.getEnginesByPattern({ flowName }, registry)

        if (engines.length === 0) return null

        // Sort by version (simple string comparison for semantic versions)
        engines.sort((a, b) => {
            const versionA = a.getFlowVersion() || '0.0.0'
            const versionB = b.getFlowVersion() || '0.0.0'
            return versionB.localeCompare(versionA)
        })

        return engines[0]
    }

    /**
     * Check if two engines are compatible versions of the same flow
     */
    static areFlowsCompatible(engine1: OnboardingEngine<any>, engine2: OnboardingEngine<any>): boolean {
        // Same flow ID or name
        const sameFlow =
            (engine1.getFlowId() && engine1.getFlowId() === engine2.getFlowId()) ||
            (engine1.getFlowName() && engine1.getFlowName() === engine2.getFlowName())

        if (!sameFlow) return false

        // Check version compatibility (same major version)
        const version1 = engine1.getFlowVersion()
        const version2 = engine2.getFlowVersion()

        if (!version1 || !version2) return true // No version constraint

        const major1 = version1.split('.')[0]
        const major2 = version2.split('.')[0]

        return major1 === major2
    }

    /**
     * Create a flow-aware data persistence wrapper
     */
    static createFlowAwarePersistence<TContext extends OnboardingContext>(engine: OnboardingEngine<TContext>) {
        const persistenceKey = FlowUtils.generatePersistenceKey(engine)

        return {
            async load(): Promise<Partial<TContext> | null> {
                try {
                    const data = localStorage.getItem(persistenceKey)
                    return data ? JSON.parse(data) : null
                } catch (error) {
                    FlowUtils._logger.error(`Error loading data for ${persistenceKey}:`, error)
                    return null
                }
            },

            async save(context: TContext, currentStepId: string | number | null): Promise<void> {
                try {
                    const dataToSave = {
                        ...context,
                        currentStepId,
                        savedAt: Date.now(),
                        flowInfo: engine.getFlowInfo(),
                    }
                    localStorage.setItem(persistenceKey, JSON.stringify(dataToSave))
                } catch (error) {
                    FlowUtils._logger.error(`Error saving data for ${persistenceKey}:`, error)
                }
            },

            async clear(): Promise<void> {
                try {
                    localStorage.removeItem(persistenceKey)
                } catch (error) {
                    FlowUtils._logger.error(`Error clearing data for ${persistenceKey}:`, error)
                }
            },

            getKey(): string {
                return persistenceKey
            },
        }
    }
}
