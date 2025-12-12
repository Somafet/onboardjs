// src/engine/OnboardingEngineRegistry.ts
// Class-based registry for managing OnboardingEngine instances
// Replaces module-level static registry for SSR safety

import type { OnboardingContext } from '../types'
import type { OnboardingEngine } from './OnboardingEngine'
import type { FlowInfo } from './types'

/**
 * Statistics about the registry contents
 */
export interface RegistryStats {
    totalEngines: number
    enginesByFlow: Record<string, number>
    enginesByVersion: Record<string, number>
}

/**
 * Options for registry iteration and filtering
 */
export interface RegistryQueryOptions {
    flowName?: string
    versionPattern?: string
}

/**
 * OnboardingEngineRegistry provides SSR-safe instance management.
 *
 * Unlike the previous static module-level registry, this class-based approach:
 * - Prevents cross-instance pollution in multi-tenant/SSR environments
 * - Allows explicit lifecycle management
 * - Supports multiple isolated registries for testing
 *
 * @example
 * ```typescript
 * // Create a registry for your application
 * const registry = new OnboardingEngineRegistry()
 *
 * // Register engines with a flow ID
 * const engine = new OnboardingEngine({
 *   flowId: 'user-onboarding',
 *   steps: [...],
 *   registry // Pass the registry to the engine
 * })
 *
 * // Retrieve engine by flow ID
 * const retrieved = registry.get('user-onboarding')
 * ```
 */
export class OnboardingEngineRegistry {
    private _engines: Map<string, OnboardingEngine<any>> = new Map()

    /**
     * Register an engine instance with a flow ID
     */
    register<TContext extends OnboardingContext = OnboardingContext>(
        flowId: string,
        engine: OnboardingEngine<TContext>
    ): void {
        if (this._engines.has(flowId)) {
            console.warn(
                `[OnboardingEngineRegistry] Overwriting existing engine with flowId: ${flowId}. ` +
                    'Consider using a unique flowId for each engine instance.'
            )
        }
        this._engines.set(flowId, engine)
    }

    /**
     * Unregister an engine by flow ID
     */
    unregister(flowId: string): boolean {
        return this._engines.delete(flowId)
    }

    /**
     * Get an engine by flow ID
     */
    get<TContext extends OnboardingContext = OnboardingContext>(
        flowId: string
    ): OnboardingEngine<TContext> | undefined {
        return this._engines.get(flowId) as OnboardingEngine<TContext> | undefined
    }

    /**
     * Check if an engine exists with the given flow ID
     */
    has(flowId: string): boolean {
        return this._engines.has(flowId)
    }

    /**
     * Get all registered engines
     */
    getAll(): OnboardingEngine<any>[] {
        return Array.from(this._engines.values())
    }

    /**
     * Get all registered flow IDs
     */
    getFlowIds(): string[] {
        return Array.from(this._engines.keys())
    }

    /**
     * Get engines matching a version pattern (semver-style matching)
     */
    getByVersion(versionPattern: string): OnboardingEngine<any>[] {
        return Array.from(this._engines.values()).filter((engine) => engine.isVersionCompatible(versionPattern))
    }

    /**
     * Get engines matching specific query options
     */
    query(options: RegistryQueryOptions): OnboardingEngine<any>[] {
        let results = Array.from(this._engines.values())

        if (options.flowName) {
            results = results.filter((engine) => engine.getFlowName() === options.flowName)
        }

        if (options.versionPattern) {
            results = results.filter((engine) => engine.isVersionCompatible(options.versionPattern!))
        }

        return results
    }

    /**
     * Get registry statistics
     */
    getStats(): RegistryStats {
        const engines = Array.from(this._engines.values())
        const enginesByFlow: Record<string, number> = {}
        const enginesByVersion: Record<string, number> = {}

        engines.forEach((engine) => {
            const flowName = engine.getFlowName() || 'unnamed'
            const version = engine.getFlowVersion() || 'unversioned'

            enginesByFlow[flowName] = (enginesByFlow[flowName] || 0) + 1
            enginesByVersion[version] = (enginesByVersion[version] || 0) + 1
        })

        return {
            totalEngines: engines.length,
            enginesByFlow,
            enginesByVersion,
        }
    }

    /**
     * Clear all registered engines
     */
    clear(): void {
        this._engines.clear()
    }

    /**
     * Get the number of registered engines
     */
    get size(): number {
        return this._engines.size
    }

    /**
     * Iterate over all engines
     */
    forEach(callback: (engine: OnboardingEngine<any>, flowId: string) => void): void {
        this._engines.forEach((engine, flowId) => callback(engine, flowId))
    }

    /**
     * Get flow info for all registered engines
     */
    getAllFlowInfo(): FlowInfo[] {
        return Array.from(this._engines.values()).map((engine) => engine.getFlowInfo())
    }
}

/**
 * Creates a new isolated registry instance
 * Use this in SSR environments or tests where you need isolated state
 */
export function createRegistry(): OnboardingEngineRegistry {
    return new OnboardingEngineRegistry()
}
