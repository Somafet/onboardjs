// src/analytics/aha-tracker/flow-extractor.ts
import { OnboardingEngine } from '../../engine/OnboardingEngine'
import { OnboardingFlowData } from './types'

/**
 * Extracts flow data from the OnboardingEngine for aha event context
 */
export class FlowDataExtractor {
    /**
     * Get flow data from a specific flow ID
     */
    static getFlowData(flowId?: string): OnboardingFlowData | undefined {
        if (!flowId) {
            // Try to auto-detect from active engines
            const engines = OnboardingEngine.getAllEngines()
            if (engines.length === 1) {
                return FlowDataExtractor.extractFromEngine(engines[0])
            }
            return undefined
        }

        // Get engine by flow ID
        const engine = OnboardingEngine.getByFlowId(flowId)
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
