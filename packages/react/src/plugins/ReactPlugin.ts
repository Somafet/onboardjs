// @onboardjs/react/src/plugins/ReactPlugin.ts
import { BasePlugin, PluginConfig, PluginHooks } from '@onboardjs/core'
import { OnboardingContext } from '@onboardjs/core'

export interface ReactPluginConfig extends PluginConfig {
    /**
     * Whether this plugin should be automatically installed when the provider mounts
     */
    autoInstall?: boolean
}

export interface ReactPluginHooks<TContext extends OnboardingContext = OnboardingContext>
    extends PluginHooks<TContext> {
    /**
     * Called when the React component tree mounts
     */
    onReactMount?: () => void | Promise<void>

    /**
     * Called when the React component tree unmounts
     */
    onReactUnmount?: () => void | Promise<void>
}

export abstract class ReactPlugin<
    TContext extends OnboardingContext = OnboardingContext,
    TConfig extends ReactPluginConfig = ReactPluginConfig,
> extends BasePlugin<TContext, TConfig> {
    protected getHooks(): ReactPluginHooks<TContext> {
        return {
            ...super.getHooks(),
            ...this.getReactHooks(),
        }
    }

    /**
     * Override to provide React-specific hooks
     */
    protected getReactHooks(): ReactPluginHooks<TContext> {
        return {}
    }

    /**
     * Helper method to check if we're in a React environment
     */
    protected isReactEnvironment(): boolean {
        return typeof window !== 'undefined' && typeof document !== 'undefined'
    }
}
