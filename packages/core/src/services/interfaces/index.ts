// src/services/interfaces/index.ts
// Service interfaces for dependency injection and testability
// These contracts define the boundaries between consolidated services

import type { OnboardingContext, OnboardingStep } from '../../types'
import type { EngineState, LoadedData, DataLoadFn, DataPersistFn } from '../../engine/types'
import type { Result } from '../../types/Result'

/**
 * Core state management service interface.
 * Handles engine state, loading, hydration, and state change notifications.
 *
 * Replaces: StateManager
 */
export interface ICoreEngineService<TContext extends OnboardingContext = OnboardingContext> {
    // State getters
    readonly isLoading: boolean
    readonly isHydrating: boolean
    readonly error: Error | null
    readonly isCompleted: boolean
    readonly hasError: boolean

    // State management
    getState(currentStep: OnboardingStep<TContext> | null, context: TContext, history: string[]): EngineState<TContext>

    setState(
        updater: (prevState: EngineState<TContext>) => Partial<EngineState<TContext>>,
        currentStep: OnboardingStep<TContext> | null,
        context: TContext,
        history: string[],
        onContextChange?: (oldContext: TContext, newContext: TContext) => void
    ): void

    notifyStateChange(currentStep: OnboardingStep<TContext> | null, context: TContext, history: string[]): void

    // State setters
    setLoading(loading: boolean): void
    setHydrating(hydrating: boolean): void
    setError(error: Error | null): void
    setCompleted(completed: boolean): void

    // Step utilities
    getRelevantSteps(context: TContext): OnboardingStep<TContext>[]
    getStepById(stepId: string | number): OnboardingStep<TContext> | undefined
    getCompletedSteps(context: TContext): OnboardingStep<TContext>[]
}

/**
 * Persistence service interface.
 * Handles data loading, persisting, and clearing.
 *
 * Replaces: PersistenceManager (unchanged functionality)
 */
export interface IPersistenceService<TContext extends OnboardingContext = OnboardingContext> {
    // Core operations
    loadPersistedData(): Promise<{
        data: LoadedData<TContext> | null
        error: Error | null
    }>

    persistDataIfNeeded(context: TContext, currentStepId: string | number | null, isHydrating: boolean): Promise<void>

    clearData(): Promise<void>

    // Handler management
    setDataLoadHandler(handler?: DataLoadFn<TContext>): void
    setDataPersistHandler(handler?: DataPersistFn<TContext>): void
    setClearPersistedDataHandler(handler?: () => Promise<void> | void): void

    // Handler getters
    getDataLoadHandler(): DataLoadFn<TContext> | undefined
    getDataPersistHandler(): DataPersistFn<TContext> | undefined
    getClearPersistedDataHandler(): (() => Promise<void> | void) | undefined
}

/**
 * Event coordination service interface.
 * Handles event emission, plugin lifecycle, and event handler registration.
 *
 * Replaces: EventManager + PluginManager + EventHandlerRegistry
 */
export interface IEventCoordinator {
    // Event listener management
    addEventListener<K extends string>(eventType: K, listener: (...args: any[]) => void): () => void

    removeEventListener<K extends string>(eventType: K, listener: (...args: any[]) => void): boolean

    // Event emission
    notifyListeners<K extends string>(eventType: K, ...args: any[]): void

    notifyListenersSequential<K extends string>(eventType: K, ...args: any[]): Promise<void>

    // Listener inspection
    getListenerCount(eventType: string): number
    hasListeners(eventType: string): boolean

    // Plugin management
    installPlugin(plugin: any): Promise<void>
    uninstallPlugin(pluginName: string): Promise<void>
    getInstalledPlugins(): string[]
    isPluginInstalled(pluginName: string): boolean
}

/**
 * Navigation service interface.
 * Handles step navigation, checklist management, and flow progression.
 *
 * Replaces: NavigationManager + ChecklistManager
 */
export interface INavigationService<TContext extends OnboardingContext = OnboardingContext> {
    // Navigation
    navigateToStep(
        targetStepId: string | number | null | undefined,
        direction: 'next' | 'previous' | 'skip' | 'goto' | 'initial',
        currentStep: OnboardingStep<TContext> | null,
        context: TContext,
        history: string[],
        onStepChangeCallback?: (
            newStep: OnboardingStep<TContext> | null,
            oldStep: OnboardingStep<TContext> | null,
            context: TContext
        ) => void,
        onFlowComplete?: (context: TContext) => Promise<void> | void
    ): Promise<OnboardingStep<TContext> | null>

    calculateNextStep(currentStep: OnboardingStep<TContext>, context: TContext): OnboardingStep<TContext> | null

    calculatePreviousStep(
        currentStep: OnboardingStep<TContext>,
        context: TContext,
        history: string[]
    ): OnboardingStep<TContext> | null

    // Checklist operations
    getChecklistState(step: OnboardingStep<TContext>, context: TContext): any[]

    isChecklistComplete(step: OnboardingStep<TContext>, context: TContext): boolean

    updateChecklistItem(
        itemId: string,
        isCompleted: boolean,
        step: OnboardingStep<TContext>,
        context: TContext,
        persistCallback?: () => Promise<void>
    ): Promise<void>
}

/**
 * Observability service interface.
 * Handles error management, logging, and basic analytics.
 *
 * Replaces: ErrorHandler (with Result type integration)
 */
export interface IObservabilityService<TContext extends OnboardingContext = OnboardingContext> {
    // Error handling
    handleError(error: unknown, operation: string, context: TContext, stepId?: string | number): Error

    // Safe execution wrappers
    safeExecute<T>(
        operation: () => Promise<T>,
        operationName: string,
        context: TContext,
        stepId?: string | number
    ): Promise<Result<T, Error>>

    safeExecuteSync<T>(
        operation: () => T,
        operationName: string,
        context: TContext,
        stepId?: string | number
    ): Result<T, Error>

    // Error history
    getErrorHistory(): Array<{
        error: Error
        context: { operation: string; stepId?: string | number; timestamp: number }
    }>

    clearErrorHistory(): void
}
