// src/engine/OnboardingEngine.ts
import { OnboardingStep, OnboardingContext } from '../types'
import { findStepById } from '../utils/step-utils'
import { EventManager } from './EventManager'
import { Logger } from '../services/Logger'
import {
    OnboardingEngineConfig,
    UnsubscribeFunction,
    EventListenerMap,
    LoadedData,
    DataLoadFn,
    DataPersistFn,
    StepActiveEvent,
    StepChangeEvent,
    StepCompletedEvent,
    FlowCompletedEvent,
    ContextUpdateEvent,
    ErrorEvent,
    BeforeStepChangeEvent,
    FlowInfo,
    FlowContext,
    FlowRegisteredEvent,
    FlowUnregisteredEvent,
} from './types'
import { OnboardingPlugin } from '../plugins/types'
import { PluginManagerImpl } from '../plugins/PluginManager'
import { ChecklistManager } from './ChecklistManager'
import { ConfigurationBuilder } from './ConfigurationBuilder'
import { ErrorHandler } from './ErrorHandler'
import { EventHandlerRegistry } from './EventHandlerRegistry'
import { AsyncOperationQueue } from '../services/AsyncOperationQueue'
import { PerformanceUtils } from '../utils/PerformanceUtils'
import { PersistenceService } from '../services/PersistenceService'
import { StateManager } from './StateManager'
import { CoreEngineService } from '../services/CoreEngineService'
import { NavigationService } from '../services/NavigationService'
import { AnalyticsManager } from '../analytics/analytics-manager'
import { AnalyticsConfig, AnalyticsProvider } from '../analytics/types'
import { HttpProvider } from '../analytics/providers/http-provider'
import { OnboardingEngineRegistry } from './OnboardingEngineRegistry'

let engineInstanceCounter = 0 // Module-level counter

export class OnboardingEngine<TContext extends OnboardingContext = OnboardingContext> {
    // =============================================================================
    // INSTANCE PROPERTIES
    // =============================================================================

    public readonly instanceId: number // Public for easy access in tests
    public readonly flowContext: FlowContext

    private _steps: OnboardingStep<TContext>[]
    private _currentStepInternal: OnboardingStep<TContext> | null = null
    private _contextInternal: TContext
    private _history: string[] = []
    private _logger: Logger

    // Registry management
    private _registry: OnboardingEngineRegistry | null = null

    // Core managers
    private _analyticsManager: AnalyticsManager<TContext>
    private _eventManager: EventManager<TContext>
    private _pluginManager: PluginManagerImpl<TContext>
    private _coreEngineService: CoreEngineService<TContext>
    private _navigationService: NavigationService<TContext>
    private _checklistManager: ChecklistManager<TContext>
    private _persistenceService: PersistenceService<TContext>
    private _errorHandler: ErrorHandler<TContext>
    private _eventRegistry: EventHandlerRegistry<TContext>
    private _operationQueue: AsyncOperationQueue

    // Configuration and initialization
    private _initializationPromise: Promise<void> | undefined
    private _resolveInitialization!: () => void
    private _rejectInitialization!: (reason?: unknown) => void
    private _config: OnboardingEngineConfig<TContext>

    // Callbacks from config
    private _onFlowComplete?: (context: TContext) => Promise<void> | void
    private _onStepChangeCallback?: (
        newStep: OnboardingStep<TContext> | null,
        oldStep: OnboardingStep<TContext> | null,
        context: TContext
    ) => void

    constructor(config: OnboardingEngineConfig<TContext>) {
        this.instanceId = ++engineInstanceCounter

        // Initialize flow context
        this.flowContext = {
            flowId: config.flowId || null,
            flowName: config.flowName || null,
            flowVersion: config.flowVersion || null,
            flowMetadata: config.flowMetadata || null,
            instanceId: this.instanceId,
            createdAt: Date.now(),
        }

        this._logger = new Logger({
            debugMode: config.debug,
            prefix: `OnboardingEngine[${this.flowContext.flowId || this.instanceId}]`,
        }) // Validate configuration
        const validation = ConfigurationBuilder.validateConfig(config)
        if (!validation.isValid) {
            throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`)
        }

        if (validation.warnings.length > 0) {
            this._logger.warn('Configuration warnings:', validation.warnings)
        }

        this._config = config
        this._steps = config.steps
        const effectiveInitialStepId = this._config.initialStepId || (this._steps.length > 0 ? this._steps[0].id : null)

        this._contextInternal = ConfigurationBuilder.buildInitialContext(config)

        // Initialize core managers
        this._eventManager = new EventManager()
        this._coreEngineService = new CoreEngineService(
            this._eventManager,
            this._steps,
            effectiveInitialStepId,
            this.flowContext,
            config.debug
        )
        this._errorHandler = new ErrorHandler(
            this._eventManager,
            this._coreEngineService as unknown as StateManager<TContext>
        )
        this._persistenceService = new PersistenceService(
            config.loadData,
            config.persistData,
            config.clearPersistedData,
            this._errorHandler,
            this._eventManager,
            config.debug
        )
        this._checklistManager = new ChecklistManager(this._eventManager, this._errorHandler)
        // src/engine/OnboardingEngine.ts (continued)

        this._operationQueue = new AsyncOperationQueue(1) // Sequential operations
        this._navigationService = new NavigationService(
            this._steps,
            this._eventManager,
            this._coreEngineService as unknown as StateManager<TContext>,
            this._persistenceService,
            this._errorHandler,
            this._logger
        )
        this._pluginManager = new PluginManagerImpl(this, this._eventManager, config.debug)
        this._eventRegistry = new EventHandlerRegistry(this._eventManager)

        // Store callbacks
        this._onFlowComplete = config.onFlowComplete
        this._onStepChangeCallback = config.onStepChange

        // Setup initialization promise
        this._setupInitializationPromise()

        // Start initialization
        this._initializeEngine().catch((error) => {
            this._logger.error('Unhandled error during constructor-initiated initialization:', error)
            if (!this._rejectInitialization) {
                this._errorHandler.handleError(error, 'constructor initialization', this._contextInternal)
            }
        })

        // Initialize analytics
        this._analyticsManager = this._initializeAnalytics(config)

        // Register engine with the appropriate registry
        this._registerWithRegistry(config)
    }

    /**
     * Register engine with the registry if provided in configuration.
     */
    private _registerWithRegistry(config: OnboardingEngineConfig<TContext>): void {
        if (!this.flowContext.flowId || !config.registry) {
            return // No registration needed without a flowId or registry
        }

        // Use the provided registry (SSR-safe)
        this._registry = config.registry
        this._registry.register(this.flowContext.flowId, this)
        this._logger.debug(`Engine registered with provided registry: ${this.flowContext.flowId}`)

        // Emit flow registered event
        this._eventManager.notifyListeners('flowRegistered', {
            flowInfo: this.getFlowInfo(),
            context: this._contextInternal,
        })
    }

    /**
     * Unregister engine from its current registry
     */
    private _unregisterFromRegistry(): void {
        if (!this.flowContext.flowId || !this._registry) {
            return
        }

        // Unregister from provided registry
        const registered = this._registry.get(this.flowContext.flowId)
        if (registered === (this as unknown)) {
            this._registry.unregister(this.flowContext.flowId)
            this._logger.debug(`Engine unregistered from provided registry: ${this.flowContext.flowId}`)
        }
    }

    /**
     * Check if this engine is currently registered
     */
    private _isRegistered(): boolean {
        if (!this.flowContext.flowId || !this._registry) {
            return false
        }

        return this._registry.get(this.flowContext.flowId) === (this as unknown)
    }

    /**
     * Re-register engine with its current registry (used during reset)
     */
    private _registerWithCurrentRegistry(): void {
        if (!this.flowContext.flowId || !this._registry) {
            return
        }

        this._registry.register(this.flowContext.flowId, this)
    }

    private _setupInitializationPromise(): void {
        this._initializationPromise = new Promise((resolve, reject) => {
            this._resolveInitialization = resolve
            this._rejectInitialization = reject
        })
    }

    /**
     * Core initialization method
     */
    private async _initializeEngine(): Promise<void> {
        return PerformanceUtils.measureAsyncPerformance('initializeEngine', async () => {
            this._coreEngineService.setHydrating(true)
            this._coreEngineService.setLoading(true)
            this._coreEngineService.setError(null)

            try {
                // 1. Install plugins
                await this._installPlugins()

                // 2. Apply configuration handlers
                this._applyConfigurationHandlers()

                // 3. Load persisted data (now returns both data and error)
                const { data: loadedData, error: dataLoadError } = await this._loadPersistedData()

                const startMethod: 'fresh' | 'resumed' = loadedData?.currentStepId ? 'resumed' : 'fresh'

                this._logger.debug(`[OnboardingEngine] Onboarding Flow started: ${startMethod}`)

                this._eventManager.notifyListeners('flowStarted', {
                    context: this._contextInternal,
                    startMethod,
                })

                // 4. Build context
                this._buildContext(loadedData)

                // 5. Handle data load error or navigate to initial step
                if (dataLoadError) {
                    this._coreEngineService.setError(dataLoadError)
                    this._currentStepInternal = null
                    this._coreEngineService.setCompleted(false)
                    this._eventManager.notifyListeners('error', {
                        error: dataLoadError,
                        context: this._contextInternal,
                    })
                    // Still resolve initialization - engine is ready but in error state
                    this._resolveInitialization()
                } else {
                    // 6. Navigate to initial step
                    await this._navigateToInitialStep(loadedData)
                    this._resolveInitialization()
                }
            } catch (error) {
                this._handleInitializationError(error)
                throw error // Re-throw so reset() can catch it
            } finally {
                this._coreEngineService.setHydrating(false)
                this._updateLoadingState()
            }
        })
    }

    private async _navigateToInitialStep(loadedData: LoadedData<TContext> | null): Promise<void> {
        const effectiveInitialStepId =
            loadedData?.currentStepId !== undefined
                ? loadedData.currentStepId
                : this._config.initialStepId || (this._steps.length > 0 ? this._steps[0].id : null)

        this._logger.debug(
            'Effective initial step ID:',
            effectiveInitialStepId,
            'Available steps:',
            this._steps.map((s) => s.id)
        )

        if (effectiveInitialStepId && this._steps.length > 0) {
            // Check if the step exists
            const targetStep = this._steps.find((s) => s.id === effectiveInitialStepId)

            if (targetStep) {
                this._currentStepInternal = await this._navigationService.navigateToStep(
                    effectiveInitialStepId,
                    'initial',
                    this._currentStepInternal,
                    this._contextInternal,
                    this._history,
                    this._onStepChangeCallback,
                    this._onFlowComplete
                )
                this._logger.debug('Navigated to step:', this._currentStepInternal?.id)
            } else {
                this._logger.warn(`Initial step '${effectiveInitialStepId}' not found. Falling back to first step.`)
                this._currentStepInternal = await this._navigationService.navigateToStep(
                    this._steps[0].id,
                    'initial',
                    this._currentStepInternal,
                    this._contextInternal,
                    this._history,
                    this._onStepChangeCallback,
                    this._onFlowComplete
                )
            }
        } else if (this._steps.length === 0) {
            this._logger.debug('No steps available, marking as completed')

            this._currentStepInternal = null
            this._coreEngineService.setCompleted(true)
        }
        // Add a case where if the loaded state's currentStepId is `null`, mark the flow as completed
        else if (loadedData?.currentStepId === null) {
            this._logger.debug('Loaded completed flow state. Marking as completed')

            this._currentStepInternal = null
            this._coreEngineService.setCompleted(true)
        } else {
            this._logger.warn('No effective initial step ID determined')
            this._currentStepInternal = null
            this._coreEngineService.setCompleted(false)
        }
    }

    private async _installPlugins(): Promise<void> {
        if (this._config.plugins && this._config.plugins.length > 0) {
            for (const plugin of this._config.plugins) {
                try {
                    await this._pluginManager.install(plugin)
                } catch (pluginInstallError) {
                    const error =
                        pluginInstallError instanceof Error ? pluginInstallError.message : String(pluginInstallError)
                    const errorMessage = `Plugin installation failed for "${plugin.name}": ${error}`
                    this._logger.error(errorMessage)
                    throw new Error(errorMessage)
                }
            }
        }
    }

    private _applyConfigurationHandlers(): void {
        // Only set handlers from config if they haven't been set by plugins
        // This allows plugins to override config handlers

        if (this._config.loadData !== undefined && !this._persistenceService.getDataLoadHandler()) {
            this._persistenceService.setDataLoadHandler(this._config.loadData)
        }

        if (this._config.persistData !== undefined && !this._persistenceService.getDataPersistHandler()) {
            this._persistenceService.setDataPersistHandler(this._config.persistData)
        }

        if (this._config.clearPersistedData !== undefined && !this._persistenceService.getClearPersistedDataHandler()) {
            this._persistenceService.setClearPersistedDataHandler(this._config.clearPersistedData)
        }

        // For callbacks, plugins should take precedence over config
        if (this._config.onFlowComplete !== undefined && !this._onFlowComplete) {
            this._onFlowComplete = this._config.onFlowComplete
        }

        if (this._config.onStepChange !== undefined && !this._onStepChangeCallback) {
            this._onStepChangeCallback = this._config.onStepChange
        }
    }

    private _loadPersistedData() {
        try {
            return this._persistenceService.loadPersistedData()
        } catch (error) {
            this._errorHandler.handleError(error, 'loadPersistedData', this._contextInternal)
            throw error
        }
    }

    private _buildContext(loadedData: LoadedData<TContext> | null): void {
        // 1. Start with a fresh, fully initialized context.
        // This guarantees that `flowData._internal` and its sub-properties (`stepStartTimes`, etc.)
        // are always present and correctly structured from the start.
        let newContext: TContext = ConfigurationBuilder.buildInitialContext(this._config)

        // 2. If persisted data was loaded, merge it into the new context.
        if (loadedData) {
            const {
                flowData: loadedFlowData,
                // Exclude currentStepId as it's handled separately for navigation
                // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
                currentStepId: _loadedStepId,
                ...otherLoadedProps
            } = loadedData

            // Merge top-level properties from loaded data.
            // This will overwrite properties like `currentUser` if they are in `loadedData`.
            newContext = {
                ...newContext, // Preserve the _internal structure from buildInitialContext
                ...otherLoadedProps, // Overlay with loaded data's top-level properties
            }

            // Merge `flowData` specifically.
            // The `newContext.flowData` already contains the guaranteed `_internal` structure.
            // We overlay it with `loadedFlowData`, allowing loaded custom data to prevail,
            // but ensuring `_internal` (from `newContext.flowData`) is not lost or overwritten
            // if `loadedFlowData` itself doesn't contain `_internal` or is an empty object.
            newContext.flowData = {
                ...newContext.flowData, // This ensures `_internal` is carried over
                ...(loadedFlowData || {}), // Add/overwrite with custom data from loadedFlowData
            }

            // Additional safety check: Ensure critical _internal properties are not undefined
            // after merging, in case loadedData's _internal was malformed or missing parts.
            if (!newContext.flowData._internal) {
                newContext.flowData._internal = {
                    completedSteps: {},
                    startedAt: Date.now(),
                    stepStartTimes: {},
                }
            } else {
                if (!newContext.flowData._internal.completedSteps) newContext.flowData._internal.completedSteps = {}
                if (!newContext.flowData._internal.startedAt) newContext.flowData._internal.startedAt = Date.now()
                if (!newContext.flowData._internal.stepStartTimes) newContext.flowData._internal.stepStartTimes = {}
            }
        }

        // 3. Set the engine's internal context to the newly built one.
        this._contextInternal = newContext
    }

    private _handleInitializationError(error: unknown): void {
        const processedError = error instanceof Error ? error : new Error(String(error))
        this._logger.error('Critical error during engine initialization:', processedError)

        this._coreEngineService.setError(processedError)
        this._currentStepInternal = null
        this._rejectInitialization(processedError)
    }

    private _updateLoadingState(): void {
        if (
            this._coreEngineService.error ||
            this._coreEngineService.isCompleted ||
            (!this._currentStepInternal && this._coreEngineService.isLoading)
        ) {
            this._coreEngineService.setLoading(false)
        }
    }

    // =============================================================================
    // PUBLIC API METHODS (Simplified)
    // =============================================================================

    /**
     * Waits for the onboarding engine to be fully initialized
     */
    public async ready(): Promise<void> {
        return this._initializationPromise
    }

    /**
     * Install a plugin
     */
    public async use(plugin: OnboardingPlugin<TContext>): Promise<this> {
        try {
            await this._pluginManager.install(plugin)
        } catch (error) {
            this._logger.error(`Failed to install plugin "${plugin.name}" via use():`, error)
            throw error
        }
        return this
    }

    /**
     * Get current engine state
     */
    public getState() {
        return this._coreEngineService.getState(this._currentStepInternal, this._contextInternal, this._history)
    }

    /**
     * Navigate to next step
     */
    public async next(stepSpecificData?: Record<string, unknown>): Promise<void> {
        return this._operationQueue.enqueue(async () => {
            this._currentStepInternal = await this._navigationService.next(
                this._currentStepInternal,
                stepSpecificData,
                this._contextInternal,
                this._history,
                this._onStepChangeCallback,
                this._onFlowComplete
            )

            // Ensure state change is notified after step change
            this._coreEngineService.notifyStateChange(this._currentStepInternal, this._contextInternal, this._history)
        })
    }

    /**
     * Navigate to previous step
     */
    public async previous(): Promise<void> {
        if (this._coreEngineService.isLoading) {
            this._logger.debug('previous(): Ignoring - engine is loading')
            return
        }

        return this._operationQueue.enqueue(async () => {
            this._currentStepInternal = await this._navigationService.previous(
                this._currentStepInternal,
                this._contextInternal,
                this._history,
                this._onStepChangeCallback,
                this._onFlowComplete
            )

            this._coreEngineService.notifyStateChange(this._currentStepInternal, this._contextInternal, this._history)
        })
    }

    /**
     * Skip current step
     */
    public async skip(): Promise<void> {
        return this._operationQueue.enqueue(async () => {
            this._currentStepInternal = await this._navigationService.skip(
                this._currentStepInternal,
                this._contextInternal,
                this._history,
                this._onStepChangeCallback,
                this._onFlowComplete
            )

            this._coreEngineService.notifyStateChange(this._currentStepInternal, this._contextInternal, this._history)
        })
    }

    /**
     * Go to specific step
     */
    public async goToStep(stepId: string, stepSpecificData?: unknown): Promise<void> {
        return this._operationQueue.enqueue(async () => {
            this._currentStepInternal = await this._navigationService.goToStep(
                stepId,
                stepSpecificData,
                this._currentStepInternal,
                this._contextInternal,
                this._history,
                this._onStepChangeCallback,
                this._onFlowComplete
            )

            this._coreEngineService.notifyStateChange(this._currentStepInternal, this._contextInternal, this._history)
        })
    }

    /**
     * Update context
     */
    public async updateContext(newContextData: Partial<TContext>): Promise<void> {
        return this._operationQueue.enqueue(async () => {
            const oldContext = { ...this._contextInternal }
            const oldContextJSON = JSON.stringify(this._contextInternal)

            // Extract flowData from newContextData to handle it separately
            const { flowData: newFlowData, ...otherContextData } = newContextData

            // Update non-flowData properties
            this._contextInternal = { ...this._contextInternal, ...otherContextData }

            // Handle flowData merging separately
            if (newFlowData) {
                this._contextInternal.flowData = {
                    ...(this._contextInternal.flowData || {}),
                    ...newFlowData,
                }
            }

            const newContextJSON = JSON.stringify(this._contextInternal)

            if (oldContextJSON !== newContextJSON) {
                this._logger.debug('Context updated:', oldContextJSON, '=>', newContextJSON)

                this._eventManager.notifyListeners('contextUpdate', {
                    oldContext,
                    newContext: this._contextInternal,
                })
                await this._persistenceService.persistDataIfNeeded(
                    this._contextInternal,
                    this._currentStepInternal?.id || null,
                    this._coreEngineService.isHydrating
                )

                this._logger.debug('Notifying full state change after context update.')
                this._coreEngineService.notifyStateChange(
                    this._currentStepInternal,
                    this._contextInternal, // This context now includes the updates
                    this._history
                )
            }
        })
    }

    /**
     * Update checklist item
     */
    public async updateChecklistItem(itemId: string, isCompleted: boolean, stepId?: string): Promise<void> {
        return this._operationQueue.enqueue(async () => {
            const targetStep = stepId ? findStepById(this._steps, stepId) : this._currentStepInternal

            if (!targetStep || targetStep.type !== 'CHECKLIST') {
                const error = new Error('Target step for checklist item update is invalid.')
                this._logger.error(
                    `Cannot update checklist item: Step '${
                        stepId || this._currentStepInternal?.id
                    }' not found or not a CHECKLIST step.`
                )
                this._coreEngineService.setError(error)
                return
            }

            await this._checklistManager.updateChecklistItem(
                itemId,
                isCompleted,
                targetStep as OnboardingStep<TContext> & { type: 'CHECKLIST' },
                this._contextInternal,
                async () => {
                    await this._persistenceService.persistDataIfNeeded(
                        this._contextInternal,
                        this._currentStepInternal?.id || null,
                        this._coreEngineService.isHydrating
                    )
                }
            )
        })
    }

    /**
     * Reset the engine
     */
    public async reset(newConfigInput?: Partial<OnboardingEngineConfig<TContext>>): Promise<void> {
        this._logger.debug('Resetting engine...')

        const resetReason = newConfigInput ? 'configuration_change' : 'manual_reset'
        this._eventManager.notifyListeners('flowReset', {
            context: this._contextInternal,
            resetReason,
        })

        // Capture current clear handler
        const activeClearHandler = this._persistenceService.getClearPersistedDataHandler()

        // Cleanup
        await this._pluginManager.cleanup()
        this._operationQueue.clear()

        // Update configuration
        if (newConfigInput) {
            // Unregister old flowId if it's changing
            if (this.flowContext.flowId && newConfigInput.flowId && this.flowContext.flowId !== newConfigInput.flowId) {
                this._unregisterFromRegistry()
            }

            this._config = ConfigurationBuilder.mergeConfigs(this._config, newConfigInput)

            // Update flow identification properties
            if (newConfigInput.flowId !== undefined) {
                ;(this as any).flowId = newConfigInput.flowId
            }
            if (newConfigInput.flowName !== undefined) {
                ;(this as any).flowName = newConfigInput.flowName
            }
            if (newConfigInput.flowVersion !== undefined) {
                ;(this as any).flowVersion = newConfigInput.flowVersion
            }
            if (newConfigInput.flowMetadata !== undefined) {
                ;(this as any).flowMetadata = newConfigInput.flowMetadata
            }
        }

        this._steps = this._config.steps || []

        // Clear persisted data using the OLD handler (before reset)
        if (activeClearHandler) {
            try {
                this._logger.debug('reset: Clearing persisted data using the handler active before reset...')
                await activeClearHandler()
            } catch (error) {
                this._logger.error('reset: Error during clearPersistedData:', error)
                this._errorHandler.handleError(error, 'clearPersistedData', this._contextInternal)
            }
        }

        // Reset internal state
        this._currentStepInternal = null
        this._history = []
        this._contextInternal = ConfigurationBuilder.buildInitialContext(this._config)

        // Reset managers
        this._coreEngineService = new CoreEngineService(
            this._eventManager,
            this._steps,
            this._config.initialStepId || (this._steps.length > 0 ? this._steps[0].id : null),
            this.flowContext,
            this._config.debug
        )
        this._coreEngineService.setLoading(false)
        this._coreEngineService.setHydrating(false)
        this._coreEngineService.setError(null)
        this._coreEngineService.setCompleted(false)

        // Clear old handlers before applying new ones
        this._persistenceService.setDataLoadHandler(undefined)
        this._persistenceService.setDataPersistHandler(undefined)
        this._persistenceService.setClearPersistedDataHandler(undefined)
        this._onFlowComplete = undefined
        this._onStepChangeCallback = undefined

        // Update navigation service with new steps
        this._navigationService = new NavigationService(
            this._steps,
            this._eventManager,
            this._coreEngineService as unknown as StateManager<TContext>,
            this._persistenceService,
            this._errorHandler,
            this._logger
        )

        // Re-register engine if it has a flowId
        if (this.flowContext.flowId) {
            this._registerWithCurrentRegistry()
            this._logger.debug(`Engine re-registered with flowId: ${this.flowContext.flowId}`)
        }

        // Clear performance caches
        PerformanceUtils.clearCaches()

        // Re-create initialization promise
        this._setupInitializationPromise()

        try {
            // Re-initialize: This will set isLoading, navigate to initial step, and then set isLoading to false.
            // initializeEngine SHOULD ideally emit the final stateChange event itself upon successful completion.
            await this._initializeEngine()
            this._logger.debug('Reset: Re-initialization complete.')

            // *** CRITICAL: Ensure a stateChange event is emitted with the final reset state ***
            // If initializeEngine doesn't guarantee this, do it here.
            // However, initializeEngine's .then() block in the Provider also sets state.
            // The most robust way is for initializeEngine to be the source of truth for its own ready state.
            // The engine's internal state (currentStepInternal, contextInternal) IS NOW CORRECT.
            // We need to make sure the StateManager reflects this and notifies.
            this._coreEngineService.notifyStateChange(this._currentStepInternal, this._contextInternal, this._history)
            // This will ensure the provider's listener picks up the state where currentStep is "step1".
        } catch (error) {
            this._logger.error("Error during reset's re-initialization:", error)
            const processedError = error instanceof Error ? error : new Error(String(error))
            this._coreEngineService.setError(processedError)
            // Also notify state change in case of error during reset's re-init
            this._coreEngineService.notifyStateChange(this._currentStepInternal, this._contextInternal, this._history)
            // No need to throw here if reset is meant to recover gracefully,
            // but the engine will be in an error state.
        }

        this._logger.debug('Engine reset process finished.')
    }

    // =============================================================================
    // EVENT HANDLING (Delegated to EventHandlerRegistry)
    // =============================================================================

    public addEventListener<T extends keyof EventListenerMap<TContext>>(
        eventType: T,
        listener: EventListenerMap<TContext>[T]
    ): UnsubscribeFunction {
        return this._eventRegistry.addEventListener(eventType, listener)
    }

    public addBeforeStepChangeListener(
        listener: (event: BeforeStepChangeEvent<TContext>) => void | Promise<void>
    ): UnsubscribeFunction {
        return this._eventRegistry.addBeforeStepChangeListener(listener)
    }

    public addAfterStepChangeListener(
        listener: (event: StepChangeEvent<TContext>) => void | Promise<void>
    ): UnsubscribeFunction {
        return this._eventRegistry.addAfterStepChangeListener(listener)
    }

    public addStepActiveListener(
        listener: (event: StepActiveEvent<TContext>) => void | Promise<void>
    ): UnsubscribeFunction {
        return this._eventRegistry.addStepActiveListener(listener)
    }

    public addStepCompletedListener(
        listener: (event: StepCompletedEvent<TContext>) => void | Promise<void>
    ): UnsubscribeFunction {
        return this._eventRegistry.addStepCompletedListener(listener)
    }

    public addFlowCompletedListener(
        listener: (event: FlowCompletedEvent<TContext>) => void | Promise<void>
    ): UnsubscribeFunction {
        return this._eventRegistry.addFlowCompletedListener(listener)
    }

    public addContextUpdateListener(
        listener: (event: ContextUpdateEvent<TContext>) => void | Promise<void>
    ): UnsubscribeFunction {
        return this._eventRegistry.addContextUpdateListener(listener)
    }

    public addErrorListener(listener: (event: ErrorEvent<TContext>) => void | Promise<void>): UnsubscribeFunction {
        return this._eventRegistry.addErrorListener(listener)
    }

    public addFlowRegisteredListener(
        listener: (event: FlowRegisteredEvent<TContext>) => void | Promise<void>
    ): UnsubscribeFunction {
        return this.addEventListener('flowRegistered', listener)
    }

    public addFlowUnregisteredListener(
        listener: (event: FlowUnregisteredEvent<TContext>) => void | Promise<void>
    ): UnsubscribeFunction {
        return this.addEventListener('flowUnregistered', listener)
    }

    /**
     * Get flow identification information
     */
    public getFlowInfo(): FlowInfo {
        return { ...this.flowContext }
    }

    /**
     * Get the unique identifier for this flow
     */
    public getFlowId(): string | null {
        return this.flowContext.flowId
    }

    /**
     * Get the version of this flow
     */
    public getFlowVersion(): string | null {
        return this.flowContext.flowVersion
    }

    /**
     * Get the name of this flow
     */
    public getFlowName(): string | null {
        return this.flowContext.flowName
    }

    /**
     * Get metadata associated with this flow
     */
    public getFlowMetadata(): Record<string, unknown> | null {
        return this.flowContext.flowMetadata
    }

    /**
     * Get the instance ID for this flow
     */
    public getInstanceId(): number {
        return this.instanceId
    }

    /**
     * Generate a namespaced key for persistence based on flow identification
     */
    public generatePersistenceKey(baseKey: string = 'onboarding'): string {
        const parts = [baseKey]

        if (this.flowContext.flowId) {
            parts.push(this.flowContext.flowId)
        } else if (this.flowContext.flowName) {
            parts.push(this.flowContext.flowName.replace(/\s+/g, '_').toLowerCase())
        }

        if (this.flowContext.flowVersion) {
            parts.push(`v${this.flowContext.flowVersion}`)
        }

        return parts.join('_')
    }

    /**
     * Check if this engine instance matches the given flow identifier
     */
    public matchesFlow(flowId: string): boolean {
        return this.flowContext.flowId === flowId
    }

    /**
     * Check if this engine instance is compatible with a given version
     * Uses semantic versioning comparison
     */
    public isVersionCompatible(requiredVersion: string): boolean {
        if (!this.flowContext.flowVersion) return false

        // Simple major version compatibility check
        // In a real implementation, you might want to use a proper semver library
        const currentMajor = this.flowContext.flowVersion.split('.')[0]
        const requiredMajor = requiredVersion.split('.')[0]

        return currentMajor === requiredMajor
    }

    // =============================================================================
    // PLUGIN COMPATIBILITY METHODS
    // =============================================================================

    public setDataLoadHandler(handler: DataLoadFn<TContext> | undefined): void {
        this._persistenceService.setDataLoadHandler(handler)
    }

    public setDataPersistHandler(handler: DataPersistFn<TContext> | undefined): void {
        this._persistenceService.setDataPersistHandler(handler)
    }

    public setClearPersistedDataHandler(handler: (() => Promise<void> | void) | undefined): void {
        this._persistenceService.setClearPersistedDataHandler(handler)
    }

    // =============================================================================
    // BACKWARD COMPATIBILITY LAYER (Deprecated)
    // =============================================================================

    /**
     * @deprecated Use `coreEngineService` or the engine's state management methods directly.
     * This getter is provided for backward compatibility during the v1.0 migration.
     * It will be removed in a future major version.
     */
    public get stateManager(): StateManager<TContext> {
        if (this._config.debug) {
            this._logger.warn(
                'DEPRECATED: Accessing `stateManager` directly is deprecated. ' +
                    'The engine now uses `CoreEngineService` internally. ' +
                    'This property is provided for backward compatibility and will be removed in v2.0.'
            )
        }
        // Return the CoreEngineService cast as StateManager for backward compatibility
        // since CoreEngineService implements the same interface
        return this._coreEngineService as unknown as StateManager<TContext>
    }

    /**
     * Get all steps in the onboarding flow.
     * This includes all steps defined in the initial configuration.
     * @returns An array of all steps in the onboarding flow.
     */
    public getSteps(): OnboardingStep<TContext>[] {
        return [...this._steps]
    }

    /**
     * Get the index of a specific step in the onboarding flow based on relevant steps.
     * @param stepId The ID of the step to find.
     * @returns The index of the step, or -1 if not found.
     */
    public getStepIndex(stepId: string | number): number {
        return this._coreEngineService.getRelevantSteps(this._contextInternal).findIndex((step) => step.id === stepId)
    }

    /**
     * Get relevant steps in the flow based on the current context.
     * @returns An array of steps that are relevant to the current context.
     */
    public getRelevantSteps(): OnboardingStep<TContext>[] {
        return this._coreEngineService.getRelevantSteps(this._contextInternal)
    }

    // =============================================================================
    // UTILITY AND DEBUG METHODS
    // =============================================================================

    /**
     * Get performance statistics
     */
    public getPerformanceStats(): {
        cache: ReturnType<typeof PerformanceUtils.getCacheStats>
        memory: ReturnType<typeof PerformanceUtils.getMemoryUsage>
        queue: ReturnType<typeof AsyncOperationQueue.prototype.getStats>
        operations: Record<string, ReturnType<typeof PerformanceUtils.getPerformanceStats>>
    } {
        const operations = ['initializeEngine', 'navigateToStep', 'next', 'previous', 'skip', 'updateContext'].reduce(
            (acc, op) => {
                const stats = PerformanceUtils.getPerformanceStats(op)
                if (stats) {
                    acc[op] = stats
                }
                return acc
            },
            {} as Record<string, any>
        )

        return {
            cache: PerformanceUtils.getCacheStats(),
            memory: PerformanceUtils.getMemoryUsage(),
            queue: this._operationQueue.getStats(),
            operations,
        }
    }

    /**
     * Get error history
     */
    public getErrorHistory(): ReturnType<ErrorHandler<TContext>['getErrorHistory']> {
        return this._errorHandler.getErrorHistory()
    }

    /**
     * Allows plugins or external code to report an error to the engine's
     * centralized error handler.
     * @param error The error object or unknown value.
     * @param operation A string describing the operation that failed (e.g., 'MyPlugin.saveData').
     */
    public reportError(error: unknown, operation: string): void {
        // This method safely calls the internal handler with the correct context.
        this._errorHandler.handleError(error, operation, this._contextInternal)
    }

    /**
     * Get checklist progress for current step
     */
    public getChecklistProgress(): ReturnType<ChecklistManager<TContext>['getChecklistProgress']> | null {
        if (!this._currentStepInternal || this._currentStepInternal.type !== 'CHECKLIST') {
            return null
        }

        return this._checklistManager.getChecklistProgress(
            this._currentStepInternal as OnboardingStep<TContext> & {
                type: 'CHECKLIST'
            },
            this._contextInternal
        )
    }

    // For plugins to report step validation failures
    public reportStepValidationFailure(step: OnboardingStep<TContext>, validationErrors: string[]): void {
        this._eventManager.notifyListeners('stepValidationFailed', {
            step,
            context: this._contextInternal,
            validationErrors,
        })
    }

    // For plugins to report help requests
    public reportHelpRequest(helpType: string): void {
        if (this._currentStepInternal) {
            this._eventManager.notifyListeners('stepHelpRequested', {
                step: this._currentStepInternal,
                context: this._contextInternal,
                helpType,
            })
        }
    }

    public getContext(): TContext {
        return { ...this._contextInternal }
    }

    /**
     * Force garbage collection of caches
     */
    public clearCaches(): void {
        PerformanceUtils.clearCaches()
        this._errorHandler.clearErrorHistory()
    }

    /**
     * Pause the onboarding flow
     * This emits a flowPaused event for analytics tracking
     */
    public pauseFlow(reason: 'user_action' | 'timeout' | 'error' = 'user_action'): void {
        this._eventManager.notifyListeners('flowPaused', {
            context: this._contextInternal,
            reason,
        })
    }

    /**
     * Resume the onboarding flow
     * This emits a flowResumed event for analytics tracking
     */
    public resumeFlow(resumePoint: string = 'current_step'): void {
        this._eventManager.notifyListeners('flowResumed', {
            context: this._contextInternal,
            resumePoint,
        })
    }

    /**
     * Mark the flow as abandoned
     * This emits a flowAbandoned event for analytics tracking
     */
    public abandonFlow(abandonmentReason: string = 'user_action'): void {
        this._eventManager.notifyListeners('flowAbandoned', {
            context: this._contextInternal,
            abandonmentReason,
        })
    }

    /**
     * Mark the current step as abandoned due to timeout or other reasons
     * This emits a stepAbandoned event for analytics tracking
     */
    public abandonStep(timeOnStep?: number): void {
        if (this._currentStepInternal) {
            const actualTimeOnStep = timeOnStep || this._getTimeOnCurrentStep()
            this._eventManager.notifyListeners('stepAbandoned', {
                step: this._currentStepInternal,
                context: this._contextInternal,
                timeOnStep: actualTimeOnStep,
            })
        }
    }

    /**
     * Mark the current step as retried
     * This emits a stepRetried event for analytics tracking
     */
    public retryStep(retryCount: number = 1): void {
        if (this._currentStepInternal) {
            this._eventManager.notifyListeners('stepRetried', {
                step: this._currentStepInternal,
                context: this._contextInternal,
                retryCount,
            })
        }
    }

    /**
     * Get the time spent on the current step in milliseconds
     */
    private _getTimeOnCurrentStep(): number {
        if (!this._currentStepInternal) return 0

        const stepStartTime = this._contextInternal.flowData._internal?.stepStartTimes?.[this._currentStepInternal.id]
        return stepStartTime ? Date.now() - stepStartTime : 0
    }

    private _initializeAnalytics(config: OnboardingEngineConfig<TContext>): AnalyticsManager<TContext> {
        // Create default analytics config
        let analyticsConfig: AnalyticsConfig = { enabled: false }

        // Handle boolean shorthand
        if (typeof config.analytics === 'boolean') {
            analyticsConfig.enabled = config.analytics
        }
        // Handle full config object
        else if (config.analytics) {
            analyticsConfig = config.analytics
        }

        // Initialize cloud provider if credentials provided
        if (config.publicKey && config.apiHost) {
            if (!analyticsConfig.providers) {
                analyticsConfig.providers = []
            }

            analyticsConfig.enabled = true // Enable analytics if cloud config is provided

            analyticsConfig.providers.push(
                new HttpProvider({
                    publicKey: config.publicKey,
                    apiHost: config.apiHost,
                    debug: config.debug,
                })
            )
        }

        const manager = new AnalyticsManager<TContext>(analyticsConfig, this._logger)

        // Set flow information in analytics manager
        manager.setFlowInfo({
            flowId: this.flowContext.flowId || undefined,
            flowName: this.flowContext.flowName || undefined,
            flowVersion: this.flowContext.flowVersion || undefined,
            flowMetadata: this.flowContext.flowMetadata || undefined,
            instanceId: this.instanceId,
        })

        if (this._config.userId) {
            manager.setUserId(this._config.userId)
        }

        if (analyticsConfig.enabled && manager.providerCount === 0) {
            this._logger.warn(
                '[Analytics] Analytics tracking is enabled, but no external analytics ' +
                    'providers were configured. Events will be tracked internally (e.g., ' +
                    'logged to console in debug mode) but will NOT be sent to any external ' +
                    'service. To enable sending, please either: \n' +
                    '1. Provide `config.apiKey` and `config.apiHost` for OnboardJS Cloud integration. \n' +
                    '2. Add custom providers to `config.analytics.providers`'
            )
        }

        // Set up event listeners for auto-tracking by default unless explicitly false
        const autoTrackSetting = analyticsConfig.autoTrack ?? true
        const shouldSetupListeners =
            analyticsConfig.enabled &&
            (autoTrackSetting === true || (typeof autoTrackSetting === 'object' && autoTrackSetting.steps !== false))

        // Set up event listeners for auto-tracking
        if (shouldSetupListeners) {
            this._setupAnalyticsEventListeners(manager)
        } else {
            this._logger.debug('Auto-tracking analytics events is disabled or analytics is not enabled.')
        }

        return manager
    }

    private _setupAnalyticsEventListeners(manager: AnalyticsManager<TContext>): void {
        // Track step viewed
        this.addEventListener('stepActive', (event) => {
            manager.trackStepViewed(event.step, event.context)
        })

        // Track step completed
        this.addEventListener('stepCompleted', (event) => {
            const startTime = event.context.flowData?._internal?.stepStartTimes?.[event.step.id] || 0
            const duration = startTime ? Date.now() - startTime : 0
            manager.trackStepCompleted(event.step, event.context, duration, event.stepData)
        })

        // Track step skipped
        this.addEventListener('stepSkipped', (event) => {
            manager.trackStepSkipped(event.step, event.context, event.skipReason)
        })

        // Track step validation failed
        this.addEventListener('stepValidationFailed', (event) => {
            manager.trackStepValidationFailed(event.step, event.context, event.validationErrors)
        })

        // Track step help requested
        this.addEventListener('stepHelpRequested', (event) => {
            manager.trackStepHelpRequested(event.step, event.context, event.helpType)
        })

        // Track flow started
        this.addEventListener('flowStarted', (event) => {
            manager.trackFlowStarted(event.context, event.startMethod)
        })

        // Track flow completed
        this.addEventListener('flowCompleted', (event) => {
            manager.trackFlowCompleted(event.context)
            manager.flush()
        })

        // Track flow reset
        this.addEventListener('flowReset', (event) => {
            manager.trackFlowReset(event.context, event.resetReason)
        })

        // Track flow paused
        this.addEventListener('flowPaused', (event) => {
            manager.trackFlowPaused(event.context, event.reason)
        })

        // Track flow resumed
        this.addEventListener('flowResumed', (event) => {
            manager.trackFlowResumed(event.context, event.resumePoint)
        })

        // Track flow abandoned
        this.addEventListener('flowAbandoned', (event) => {
            manager.trackFlowAbandoned(event.context, event.abandonmentReason)
        })

        // Track step abandoned
        this.addEventListener('stepAbandoned', (event) => {
            manager.trackStepAbandoned(event.step, event.context, event.timeOnStep)
        })

        // Track step retried
        this.addEventListener('stepRetried', (event) => {
            manager.trackStepRetried(event.step, event.context, event.retryCount)
        })

        // Track navigation events
        this.addEventListener('navigationBack', (event) => {
            manager.trackNavigationBack(event.fromStep, event.toStep, event.context)
        })

        this.addEventListener('navigationForward', (event) => {
            manager.trackNavigationForward(event.fromStep, event.toStep, event.context)
        })

        this.addEventListener('navigationJump', (event) => {
            manager.trackNavigationJump(event.fromStep, event.toStep, event.context)
        })

        // Track context updates (data changes)
        this.addEventListener('contextUpdate', (event) => {
            // Extract changed fields from the context comparison
            const changedFields = this._getChangedFields(event.oldContext, event.newContext)
            manager.trackDataChanged(
                event.newContext,
                changedFields,
                event.oldContext.flowData,
                event.newContext.flowData
            )
        })

        // Track user activity
        this.addEventListener('userIdle', (event) => {
            manager.trackUserIdle(event.step, event.context, event.idleDuration)
        })

        this.addEventListener('userReturned', (event) => {
            manager.trackUserReturned(event.step, event.context, event.awayDuration)
        })

        this.addEventListener('persistenceFailure', (event) => {
            manager.trackPersistenceFailure(event.context, event.error)
        })

        // Track errors
        this.addEventListener('error', (event) => {
            manager.trackErrorEncountered(event.error, event.context)
        })

        // Track flow registration events
        this.addEventListener('flowRegistered', (event) => {
            manager.trackEvent('flow_registered', {
                flowInfo: event.flowInfo,
                timestamp: Date.now(),
            })
        })

        this.addEventListener('flowUnregistered', (event) => {
            manager.trackEvent('flow_unregistered', {
                flowInfo: event.flowInfo,
                timestamp: Date.now(),
            })
        })

        // Track plugin events
        this.addEventListener('pluginInstalled', (event) => {
            manager.trackEvent('plugin_installed', {
                pluginName: event.pluginName,
                timestamp: Date.now(),
            })
        })

        this.addEventListener('pluginError', (event) => {
            manager.trackEvent('plugin_error', {
                pluginName: event.pluginName,
                errorMessage: event.error.message,
                timestamp: Date.now(),
            })
        })
    }

    /**
     * Helper method to identify changed fields between contexts
     */
    private _getChangedFields(oldContext: TContext, newContext: TContext): string[] {
        const changedFields: string[] = []
        const oldData = oldContext.flowData
        const newData = newContext.flowData

        // Simple comparison of top-level properties
        const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)])

        allKeys.forEach((key) => {
            if (key === '_internal') return // Skip internal properties

            const oldValue = JSON.stringify(oldData[key])
            const newValue = JSON.stringify(newData[key])

            if (oldValue !== newValue) {
                changedFields.push(key)
            }
        })

        return changedFields
    }

    // Public method to track custom events
    public trackEvent(eventName: string, properties: Record<string, any> = {}): void {
        this._analyticsManager.trackEvent(eventName, properties)
    }

    /**
     * Track a custom business event with enhanced context information.
     * This method automatically enriches the event with current flow context.
     *
     * @param eventName The name of the custom event
     * @param properties Additional properties to include with the event
     * @param options Optional configuration for the event
     */
    public trackCustomEvent(
        eventName: string,
        properties: Record<string, any> = {},
        options: {
            /** Include current step information in the event */
            includeStepContext?: boolean
            /** Include current flow progress in the event */
            includeFlowProgress?: boolean
            /** Include current context data (sanitized) */
            includeContextData?: boolean
            /** Custom event category for organization */
            category?: string
            /** Event priority level */
            priority?: 'low' | 'normal' | 'high' | 'critical'
        } = {}
    ): void {
        const {
            includeStepContext = true,
            includeFlowProgress = true,
            includeContextData = false,
            category = 'custom',
            priority = 'normal',
        } = options

        // Build enhanced properties
        const enhancedProperties: Record<string, any> = {
            ...properties,
            category,
            priority,
            timestamp: Date.now(),
        }

        // Add step context if requested
        if (includeStepContext && this._currentStepInternal) {
            enhancedProperties.stepContext = {
                currentStepId: this._currentStepInternal.id,
                currentStepType: this._currentStepInternal.type,
                stepIndex: this.getStepIndex(this._currentStepInternal.id),
                isFirstStep: this.getStepIndex(this._currentStepInternal.id) === 0,
                isLastStep: this.getStepIndex(this._currentStepInternal.id) === this.getRelevantSteps().length - 1,
            }
        }

        // Add flow progress if requested
        if (includeFlowProgress) {
            const relevantSteps = this.getRelevantSteps()
            const currentStepIndex = this._currentStepInternal ? this.getStepIndex(this._currentStepInternal.id) : -1

            enhancedProperties.flowProgress = {
                totalSteps: relevantSteps.length,
                currentStepNumber: currentStepIndex + 1,
                progressPercentage:
                    relevantSteps.length > 0 ? Math.round(((currentStepIndex + 1) / relevantSteps.length) * 100) : 0,
                isCompleted: this._coreEngineService.isCompleted,
            }
        }

        // Add context data if requested (sanitized)
        if (includeContextData) {
            enhancedProperties.contextData = this._sanitizeContextForAnalytics(this._contextInternal)
        }

        // Track the event
        this._analyticsManager.trackEvent(`custom.${eventName}`, enhancedProperties)
    }

    /**
     * Sanitize context data for analytics tracking by removing sensitive information
     */
    private _sanitizeContextForAnalytics(context: TContext): Record<string, any> {
        const sanitized = { ...context }

        // Remove potentially sensitive fields
        delete sanitized.apiKeys
        delete sanitized.tokens
        delete sanitized.password
        delete sanitized.secret

        // Remove internal tracking data that's not useful for custom events
        if (sanitized.flowData && sanitized.flowData._internal) {
            const flowDataCopy = { ...sanitized.flowData }
            delete flowDataCopy._internal
            sanitized.flowData = flowDataCopy
        }

        return sanitized
    }

    // Public method to register additional analytics providers
    public registerAnalyticsProvider(provider: AnalyticsProvider): void {
        this._analyticsManager.registerProvider(provider)
    }

    // Method to flush analytics events
    public flushAnalytics(): Promise<void> {
        return this._analyticsManager.flush()
    }

    // Method to set user ID for analytics
    public setAnalyticsUserId(userId: string): void {
        this._config.userId = userId
        this._analyticsManager.setUserId(userId)
    }

    /**
     * Cleanup and destroy the engine instance
     */
    public async destroy(): Promise<void> {
        this._logger.debug('Destroying engine...')

        // Emit flow unregistered event before cleanup
        if (this.flowContext.flowId && this._isRegistered()) {
            this._eventManager.notifyListeners('flowUnregistered', {
                flowInfo: this.getFlowInfo(),
                context: this._contextInternal,
            })
        }

        // Unregister from registry
        this._unregisterFromRegistry()

        // Cleanup managers
        await this._pluginManager.cleanup()
        this._operationQueue.clear()

        // Clear performance caches
        PerformanceUtils.clearCaches()

        this._logger.debug('Engine destroyed.')
    }

    /**
     * Get detailed engine information for debugging
     */
    public getDebugInfo(): {
        flowInfo: FlowInfo
        currentStep: OnboardingStep<TContext> | null
        context: TContext
        history: string[]
        state: ReturnType<CoreEngineService<TContext>['getState']>
        performance: ReturnType<OnboardingEngine<TContext>['getPerformanceStats']>
        errors: ReturnType<ErrorHandler<TContext>['getRecentErrors']>
        config: OnboardingEngineConfig<TContext>
    } {
        return {
            flowInfo: this.getFlowInfo(),
            currentStep: this._currentStepInternal,
            context: this._contextInternal,
            history: [...this._history],
            state: this.getState(),
            performance: this.getPerformanceStats(),
            errors: this._errorHandler.getRecentErrors(5),
            config: this._config,
        }
    }
}
