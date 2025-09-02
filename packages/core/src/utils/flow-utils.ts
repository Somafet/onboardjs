// src/utils/flow-utils.ts

import { OnboardingEngine } from '../engine/OnboardingEngine'
import { OnboardingContext } from '../types'

/**
 * Utility functions for working with multiple flows
 */
export class FlowUtils {
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
     */
    static getEnginesByPattern(pattern: {
        flowId?: string
        flowName?: string
        flowVersion?: string
    }): OnboardingEngine<any>[] {
        const allEngines = OnboardingEngine.getAllEngines()

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
     */
    static getLatestVersionByFlowName(flowName: string): OnboardingEngine<any> | null {
        const engines = FlowUtils.getEnginesByPattern({ flowName })

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
                    console.error(`Error loading data for ${persistenceKey}:`, error)
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
                    console.error(`Error saving data for ${persistenceKey}:`, error)
                }
            },

            async clear(): Promise<void> {
                try {
                    localStorage.removeItem(persistenceKey)
                } catch (error) {
                    console.error(`Error clearing data for ${persistenceKey}:`, error)
                }
            },

            getKey(): string {
                return persistenceKey
            },
        }
    }
}
