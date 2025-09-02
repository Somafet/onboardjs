// @onboardjs/react/src/hooks/useOnboarding.types.ts
import {
    OnboardingEngine,
    EngineState,
    OnboardingContext,
    DataLoadFn,
    DataPersistFn,
    OnboardingPlugin,
    PluginManager,
    BeforeStepChangeEvent,
    FlowCompletedEvent,
} from '@onboardjs/core'
import { OnboardingActions } from '../context/OnboardingProvider'

export interface UseOnboardingOptions<TContext extends OnboardingContext = OnboardingContext> {
    /**
     * Callback executed when the entire onboarding flow is completed.
     * This callback is specific to this instance of the `useOnboarding` hook.
     */
    onFlowCompleted?: (event: FlowCompletedEvent<TContext>) => void | Promise<void>

    /**
     * Callback executed when the current step changes.
     * Specific to this instance of the `useOnboarding` hook.
     */
    onStepChange?: (
        newStep: ReturnType<OnboardingEngine<TContext>['getState']>['currentStep'],
        oldStep: ReturnType<OnboardingEngine<TContext>['getState']>['currentStep'],
        context: TContext
    ) => void

    /**
     * Callback executed before the current step changes.
     * This allows you to perform checks or actions before the step transition.
     */
    onBeforeStepChange?: (event: BeforeStepChangeEvent<TContext>) => void | Promise<void>

    /**
     * Callback executed when data is loaded for the current step.
     * This can be used to trigger UI updates or other actions based on loaded data.
     */
    loadData?: DataLoadFn<TContext>

    /**
     * Callback executed when data is persisted for the current step.
     * Useful for triggering actions after data is saved.
     */
    persistData?: DataPersistFn<TContext>
}

export interface UseOnboardingReturn<TContext extends OnboardingContext = OnboardingContext> extends OnboardingActions {
    engine: OnboardingEngine<TContext> | null
    state: EngineState<TContext> | null
    isLoading: boolean
    isCompleted: boolean
    currentStep: EngineState<TContext>['currentStep']
    // Plugin management
    pluginManager: PluginManager<TContext> | null
    installPlugin: (plugin: OnboardingPlugin<TContext>) => Promise<void>
    uninstallPlugin: (pluginName: string) => Promise<void>
    getInstalledPlugins: () => OnboardingPlugin<TContext>[]
    isPluginInstalled: (pluginName: string) => boolean
}
