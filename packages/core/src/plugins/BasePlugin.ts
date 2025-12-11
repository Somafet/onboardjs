// @onboardjs/core/src/plugins/BasePlugin.ts

import { OnboardingEngine } from '../engine/OnboardingEngine'
import { OnboardingContext } from '../types'
import { OnboardingPlugin, PluginHooks, PluginConfig, PluginCleanup } from './types'

export abstract class BasePlugin<
    TContext extends OnboardingContext = OnboardingContext,
    TConfig extends PluginConfig = PluginConfig,
> implements OnboardingPlugin<TContext> {
    abstract readonly name: string
    abstract readonly version: string
    readonly description?: string
    readonly dependencies?: string[]

    protected config: TConfig
    protected engine!: OnboardingEngine<TContext>
    private _unsubscribeFunctions: (() => void)[] = []

    constructor(config: TConfig) {
        this.config = config
    }

    async install(engine: OnboardingEngine<TContext>): Promise<PluginCleanup> {
        this.engine = engine

        // Setup hooks
        this.setupHooks()

        // Call plugin-specific initialization
        await this.onInstall()

        // Return cleanup function
        return async () => {
            await this.onUninstall()
            this._cleanup()
        }
    }

    protected setupHooks(): void {
        const hooks = this.getHooks()
        // Map PluginHooks keys to engine listener methods
        const hookToEngineMethod: Record<string, keyof OnboardingEngine<TContext>> = {
            beforeStepChange: 'addBeforeStepChangeListener',
            afterStepChange: 'addAfterStepChangeListener',
            onStepActive: 'addStepActiveListener',
            onStepCompleted: 'addStepCompletedListener',
            onFlowCompleted: 'addFlowCompletedListener',
            onContextUpdate: 'addContextUpdateListener',
            onError: 'addErrorListener',
            onFlowStarted: 'addEventListener', // Special: use addEventListener for generic events
            onFlowPaused: 'addEventListener',
            onFlowResumed: 'addEventListener',
            onFlowAbandoned: 'addEventListener',
            onFlowReset: 'addEventListener',
            onStepStarted: 'addEventListener',
            onStepSkipped: 'addEventListener',
            onStepRetried: 'addEventListener',
            onStepValidationFailed: 'addEventListener',
            onStepHelpRequested: 'addEventListener',
            onStepAbandoned: 'addEventListener',
            onNavigationBack: 'addEventListener',
            onNavigationForward: 'addEventListener',
            onNavigationJump: 'addEventListener',
            onUserIdle: 'addEventListener',
            onUserReturned: 'addEventListener',
            onDataChanged: 'addEventListener',
            onStepRenderTime: 'addEventListener',
            onPersistenceSuccess: 'addEventListener',
            onPersistenceFailure: 'addEventListener',
            onChecklistItemToggled: 'addEventListener',
            onChecklistProgressChanged: 'addEventListener',
            onPluginInstalled: 'addEventListener',
            onPluginError: 'addEventListener',
        }

        for (const [hookName, handler] of Object.entries(hooks)) {
            if (typeof handler === 'function' && hookToEngineMethod[hookName]) {
                if (hookToEngineMethod[hookName] === 'addEventListener') {
                    // The event name is the hook name with 'on' stripped and lowercased first letter
                    // e.g. onFlowStarted -> flowStarted
                    const eventName = hookName.replace(/^on/, '')
                    const eventKey = eventName.charAt(0).toLowerCase() + eventName.slice(1)
                    // @ts-ignore
                    const unsubscribe = this.engine.addEventListener(eventKey, handler)
                    this._unsubscribeFunctions.push(unsubscribe)
                } else {
                    // @ts-ignore
                    const engineMethod = this.engine[hookToEngineMethod[hookName]] as (handler: any) => () => void
                    const unsubscribe = engineMethod.call(this.engine, handler)
                    this._unsubscribeFunctions.push(unsubscribe)
                }
            }
        }
    }

    private _cleanup(): void {
        this._unsubscribeFunctions.forEach((unsubscribe) => unsubscribe())
        this._unsubscribeFunctions = []
    }

    /** Override to provide plugin hooks */
    protected getHooks(): PluginHooks<TContext> {
        return {}
    }

    /** Override to handle plugin installation */
    protected async onInstall(): Promise<void> {
        // Default implementation does nothing
    }

    /** Override to handle plugin uninstallation */
    protected async onUninstall(): Promise<void> {
        // Default implementation does nothing
    }

    /** Get plugin configuration */
    protected getConfig(): TConfig {
        return this.config
    }

    /** Update plugin configuration */
    protected updateConfig(newConfig: Partial<TConfig>): void {
        this.config = { ...this.config, ...newConfig }
    }
}
