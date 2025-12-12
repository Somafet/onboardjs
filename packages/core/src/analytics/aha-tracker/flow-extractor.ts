// src/analytics/aha-tracker/flow-extractor.ts
import { OnboardingEngine } from '../../engine/OnboardingEngine'
import { OnboardingEngineRegistry } from '../../engine/OnboardingEngineRegistry'
import { OnboardingFlowData } from './types'

/**
 * Extracts flow data from the OnboardingEngine for aha event context
 */
export class FlowDataExtractor {
    /**
     * Get flow data from a specific flow ID
     * @param flowId - The flow ID to get data for
     * @param registry - Optional registry to search for engines (required if flowId is provided)
     */
    static getFlowData(flowId?: string, registry?: OnboardingEngineRegistry): OnboardingFlowData | undefined {
        if (!flowId || !registry) {
            // Cannot auto-detect without registry
            return undefined
        }

        // Get engine by flow ID from registry
        const engine = registry.get(flowId)
        if (!engine) return undefined

        return FlowDataExtractor.extractFromEngine(engine)
    }

    /**
     * Extract flow data from an engine instance
     */
    static extractFromEngine(engine: OnboardingEngine<any>): OnboardingFlowData {
        const state = engine.getState()
        const context = engine.getContext()

        return {
            flow_id: engine.getFlowId() || undefined,
            flow_version: engine.getFlowVersion() || undefined,
            current_step_id: state.currentStep?.id?.toString(),
            current_step_index: undefined, // Not available in current state structure
            total_steps: state.totalSteps,
            steps_completed: context.completedSteps || [],
            steps_skipped: context.skippedSteps || [],
            flow_started_at: context.flowData?._internal?.startedAt
                ? new Date(context.flowData._internal.startedAt).toISOString()
                : undefined,
            custom_flow_data: context.flowData,
        }
    }
}
