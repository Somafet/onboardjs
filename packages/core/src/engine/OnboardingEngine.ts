// src/engine/OnboardingEngine.ts
import { OnboardingStep, OnboardingContext } from "../types";
import { findStepById } from "../utils/step-utils";
import { EventManager } from "./EventManager";
import {
  OnboardingEngineConfig,
  UnsubscribeFunction,
  EventListenerMap,
  LoadedData,
  DataLoadFn,
  DataPersistFn,
} from "./types";
import { OnboardingPlugin } from "../plugins/types";
import { PluginManagerImpl } from "../plugins/PluginManager";
import { ChecklistManager } from "./ChecklistManager";
import { ConfigurationBuilder } from "./ConfigurationBuilder";
import { ErrorHandler } from "./ErrorHandler";
import { EventHandlerRegistry } from "./EventHandlerRegistry";
import { NavigationManager } from "./NavigationManager";
import { OperationQueue } from "./OperationQueue";
import { PerformanceUtils } from "../utils/PerformanceUtils";
import { PersistenceManager } from "./PersistenceManager";
import { StateManager } from "./StateManager";

let engineInstanceCounter = 0; // Module-level counter

export class OnboardingEngine<
  TContext extends OnboardingContext = OnboardingContext,
> {
  public readonly instanceId: number; // Public for easy access in tests
  private steps: OnboardingStep<TContext>[];
  private currentStepInternal: OnboardingStep<TContext> | null = null;
  private contextInternal: TContext;
  private history: string[] = [];

  // Core managers
  private eventManager: EventManager<TContext>;
  private pluginManager: PluginManagerImpl<TContext>;
  private stateManager: StateManager<TContext>;
  private navigationManager: NavigationManager<TContext>;
  private checklistManager: ChecklistManager<TContext>;
  private persistenceManager: PersistenceManager<TContext>;
  private errorHandler: ErrorHandler<TContext>;
  private eventRegistry: EventHandlerRegistry<TContext>;
  private operationQueue: OperationQueue;

  // Configuration and initialization
  private initializationPromise: Promise<void> | undefined;
  private resolveInitialization!: () => void;
  private rejectInitialization!: (reason?: unknown) => void;
  private initialConfig: OnboardingEngineConfig<TContext>;

  // Callbacks from config
  private onFlowComplete?: (context: TContext) => Promise<void> | void;
  private onStepChangeCallback?: (
    newStep: OnboardingStep<TContext> | null,
    oldStep: OnboardingStep<TContext> | null,
    context: TContext,
  ) => void;

  constructor(config: OnboardingEngineConfig<TContext>) {
    this.instanceId = ++engineInstanceCounter;
    console.log(`[OnboardingEngine#${this.instanceId}] CONSTRUCTOR called`);
    // Validate configuration
    const validation = ConfigurationBuilder.validateConfig(config);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(", ")}`);
    }

    if (validation.warnings.length > 0) {
      console.warn(
        "[OnboardingEngine] Configuration warnings:",
        validation.warnings,
      );
    }

    this.initialConfig = config;
    this.steps = config.steps;
    this.contextInternal = ConfigurationBuilder.buildInitialContext(config);

    // Initialize core managers
    this.eventManager = new EventManager();
    this.stateManager = new StateManager(this.eventManager, this.steps);
    this.errorHandler = new ErrorHandler(this.eventManager, this.stateManager);
    this.persistenceManager = new PersistenceManager(
      config.loadData,
      config.persistData,
      config.clearPersistedData,
      this.errorHandler,
    );
    this.checklistManager = new ChecklistManager(
      this.eventManager,
      this.errorHandler,
    );
    // src/engine/OnboardingEngine.ts (continued)

    this.operationQueue = new OperationQueue(1); // Sequential operations
    this.navigationManager = new NavigationManager(
      this.steps,
      this.eventManager,
      this.stateManager,
      this.checklistManager,
      this.persistenceManager,
      this.errorHandler,
    );
    this.pluginManager = new PluginManagerImpl(this);
    this.eventRegistry = new EventHandlerRegistry(this.eventManager);

    // Store callbacks
    this.onFlowComplete = config.onFlowComplete;
    this.onStepChangeCallback = config.onStepChange;

    // Setup initialization promise
    this.setupInitializationPromise();

    // Start initialization
    this.initializeEngine().catch((error) => {
      console.error(
        "[OnboardingEngine] Unhandled error during constructor-initiated initialization:",
        error,
      );
      if (!this.rejectInitialization) {
        this.errorHandler.handleError(
          error,
          "constructor initialization",
          this.contextInternal,
        );
      }
    });
  }

  private setupInitializationPromise(): void {
    this.initializationPromise = new Promise((resolve, reject) => {
      this.resolveInitialization = resolve;
      this.rejectInitialization = reject;
    });
  }

  /**
   * Core initialization method
   */
  private async initializeEngine(): Promise<void> {
    return PerformanceUtils.measureAsyncPerformance(
      "initializeEngine",
      async () => {
        this.stateManager.setHydrating(true);
        this.stateManager.setLoading(true);
        this.stateManager.setError(null);

        try {
          // 1. Install plugins
          await this.installPlugins();

          // 2. Apply configuration handlers
          this.applyConfigurationHandlers();

          // 3. Load persisted data (now returns both data and error)
          const { data: loadedData, error: dataLoadError } =
            await this.loadPersistedData();

          // 4. Build context
          this.buildContext(loadedData);

          // 5. Handle data load error or navigate to initial step
          if (dataLoadError) {
            this.stateManager.setError(dataLoadError);
            this.currentStepInternal = null;
            this.stateManager.setCompleted(false);
            this.eventManager.notifyListeners(
              "error",
              dataLoadError,
              this.contextInternal,
            );
            // Still resolve initialization - engine is ready but in error state
            this.resolveInitialization();
          } else {
            // 6. Navigate to initial step
            await this.navigateToInitialStep(loadedData);
            this.resolveInitialization();
          }
        } catch (error) {
          this.handleInitializationError(error);
          throw error; // Re-throw so reset() can catch it
        } finally {
          this.stateManager.setHydrating(false);
          this.updateLoadingState();
        }
      },
    );
  }

  private async navigateToInitialStep(
    loadedData: LoadedData<TContext> | null,
  ): Promise<void> {
    const effectiveInitialStepId =
      loadedData?.currentStepId !== undefined
        ? loadedData.currentStepId
        : this.initialConfig.initialStepId ||
          (this.steps.length > 0 ? this.steps[0].id : null);

    console.log(
      "[OnboardingEngine] Effective initial step ID:",
      effectiveInitialStepId,
      "Available steps:",
      this.steps.map((s) => s.id),
    );

    if (effectiveInitialStepId && this.steps.length > 0) {
      // Check if the step exists
      const targetStep = this.steps.find(
        (s) => s.id === effectiveInitialStepId,
      );

      if (targetStep) {
        this.currentStepInternal = await this.navigationManager.navigateToStep(
          effectiveInitialStepId,
          "initial",
          this.currentStepInternal,
          this.contextInternal,
          this.history,
          this.onStepChangeCallback,
          this.onFlowComplete,
        );
        console.log(
          "[OnboardingEngine] Navigated to step:",
          this.currentStepInternal?.id,
        );
      } else {
        console.warn(
          `[OnboardingEngine] Initial step '${effectiveInitialStepId}' not found. Falling back to first step.`,
        );
        this.currentStepInternal = await this.navigationManager.navigateToStep(
          this.steps[0].id,
          "initial",
          this.currentStepInternal,
          this.contextInternal,
          this.history,
          this.onStepChangeCallback,
          this.onFlowComplete,
        );
      }
    } else if (this.steps.length === 0) {
      console.log(
        "[OnboardingEngine] No steps available, marking as completed",
      );
      this.currentStepInternal = null;
      this.stateManager.setCompleted(true);
    } else {
      console.warn(
        "[OnboardingEngine] No effective initial step ID determined",
      );
      this.currentStepInternal = null;
      this.stateManager.setCompleted(false);
    }
  }

  private async installPlugins(): Promise<void> {
    if (this.initialConfig.plugins && this.initialConfig.plugins.length > 0) {
      for (const plugin of this.initialConfig.plugins) {
        try {
          await this.pluginManager.install(plugin);
        } catch (pluginInstallError) {
          const error =
            pluginInstallError instanceof Error
              ? pluginInstallError.message
              : String(pluginInstallError);
          const errorMessage = `Plugin installation failed for "${plugin.name}": ${error}`;
          console.error(`[OnboardingEngine] ${errorMessage}`);
          throw new Error(errorMessage);
        }
      }
    }
  }

  private applyConfigurationHandlers(): void {
    // Only set handlers from config if they haven't been set by plugins
    // This allows plugins to override config handlers

    if (
      this.initialConfig.loadData !== undefined &&
      !this.persistenceManager.getDataLoadHandler()
    ) {
      this.persistenceManager.setDataLoadHandler(this.initialConfig.loadData);
    }

    if (
      this.initialConfig.persistData !== undefined &&
      !this.persistenceManager.getDataPersistHandler()
    ) {
      this.persistenceManager.setDataPersistHandler(
        this.initialConfig.persistData,
      );
    }

    if (
      this.initialConfig.clearPersistedData !== undefined &&
      !this.persistenceManager.getClearPersistedDataHandler()
    ) {
      this.persistenceManager.setClearPersistedDataHandler(
        this.initialConfig.clearPersistedData,
      );
    }

    // For callbacks, plugins should take precedence over config
    if (
      this.initialConfig.onFlowComplete !== undefined &&
      !this.onFlowComplete
    ) {
      this.onFlowComplete = this.initialConfig.onFlowComplete;
    }

    if (
      this.initialConfig.onStepChange !== undefined &&
      !this.onStepChangeCallback
    ) {
      this.onStepChangeCallback = this.initialConfig.onStepChange;
    }
  }

  private loadPersistedData() {
    try {
      return this.persistenceManager.loadPersistedData();
    } catch (error) {
      this.errorHandler.handleError(
        error,
        "loadPersistedData",
        this.contextInternal,
      );
      throw error;
    }
  }

  private buildContext(loadedData: LoadedData<TContext> | null): void {
    const configInitialContext =
      this.initialConfig.initialContext || ({} as Partial<TContext>);

    let newContextBase = {
      ...(configInitialContext as TContext),
      flowData: { ...(configInitialContext.flowData || {}) },
    };

    if (loadedData) {
      const {
        flowData: loadedFlowData,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        currentStepId: _loadedStepId,
        ...otherLoadedProps
      } = loadedData;

      newContextBase = {
        ...newContextBase,
        ...otherLoadedProps,
        flowData: {
          ...(newContextBase.flowData || {}),
          ...(loadedFlowData || {}),
        },
      } as TContext;
    }

    this.contextInternal = newContextBase;
  }

  private handleInitializationError(error: unknown): void {
    const processedError =
      error instanceof Error ? error : new Error(String(error));
    console.error(
      "[OnboardingEngine] Critical error during engine initialization:",
      processedError,
    );

    this.stateManager.setError(processedError);
    this.currentStepInternal = null;
    this.rejectInitialization(processedError);
  }

  private updateLoadingState(): void {
    if (
      this.stateManager.error ||
      this.stateManager.isCompleted ||
      (!this.currentStepInternal && this.stateManager.isLoading)
    ) {
      this.stateManager.setLoading(false);
    }
  }

  // =============================================================================
  // PUBLIC API METHODS (Simplified)
  // =============================================================================

  /**
   * Waits for the onboarding engine to be fully initialized
   */
  public async ready(): Promise<void> {
    return this.initializationPromise;
  }

  /**
   * Install a plugin
   */
  public async use(plugin: OnboardingPlugin<TContext>): Promise<this> {
    try {
      await this.pluginManager.install(plugin);
    } catch (error) {
      console.error(
        `[OnboardingEngine] Failed to install plugin "${plugin.name}" via use():`,
        error,
      );
      throw error;
    }
    return this;
  }

  /**
   * Get current engine state
   */
  public getState() {
    return this.stateManager.getState(
      this.currentStepInternal,
      this.contextInternal,
      this.history,
    );
  }

  /**
   * Navigate to next step
   */
  public async next(stepSpecificData?: Record<string, unknown>): Promise<void> {
    return this.operationQueue.enqueue(async () => {
      this.currentStepInternal = await this.navigationManager.next(
        this.currentStepInternal,
        stepSpecificData,
        this.contextInternal,
        this.history,
        this.onStepChangeCallback,
        this.onFlowComplete,
      );

      // Ensure state change is notified after step change
      this.stateManager.notifyStateChange(
        this.currentStepInternal,
        this.contextInternal,
        this.history,
      );
    });
  }

  /**
   * Navigate to previous step
   */
  public async previous(): Promise<void> {
    if (this.stateManager.isLoading) {
      console.log(
        "[OnboardingEngine] previous(): Ignoring - engine is loading",
      );
      return;
    }

    return this.operationQueue.enqueue(async () => {
      this.currentStepInternal = await this.navigationManager.previous(
        this.currentStepInternal,
        this.contextInternal,
        this.history,
        this.onStepChangeCallback,
        this.onFlowComplete,
      );

      this.stateManager.notifyStateChange(
        this.currentStepInternal,
        this.contextInternal,
        this.history,
      );
    });
  }

  /**
   * Skip current step
   */
  public async skip(): Promise<void> {
    return this.operationQueue.enqueue(async () => {
      this.currentStepInternal = await this.navigationManager.skip(
        this.currentStepInternal,
        this.contextInternal,
        this.history,
        this.onStepChangeCallback,
        this.onFlowComplete,
      );

      this.stateManager.notifyStateChange(
        this.currentStepInternal,
        this.contextInternal,
        this.history,
      );
    });
  }

  /**
   * Go to specific step
   */
  public async goToStep(
    stepId: string,
    stepSpecificData?: unknown,
  ): Promise<void> {
    return this.operationQueue.enqueue(async () => {
      this.currentStepInternal = await this.navigationManager.goToStep(
        stepId,
        stepSpecificData,
        this.currentStepInternal,
        this.contextInternal,
        this.history,
        this.onStepChangeCallback,
        this.onFlowComplete,
      );

      this.stateManager.notifyStateChange(
        this.currentStepInternal,
        this.contextInternal,
        this.history,
      );
    });
  }

  /**
   * Update context
   */
  public async updateContext(newContextData: Partial<TContext>): Promise<void> {
    return this.operationQueue.enqueue(async () => {
      const oldContext = { ...this.contextInternal };
      const oldContextJSON = JSON.stringify(this.contextInternal);

      // Extract flowData from newContextData to handle it separately
      const { flowData: newFlowData, ...otherContextData } = newContextData;

      // Update non-flowData properties
      this.contextInternal = { ...this.contextInternal, ...otherContextData };

      // Handle flowData merging separately
      if (newFlowData) {
        this.contextInternal.flowData = {
          ...(this.contextInternal.flowData || {}),
          ...newFlowData,
        };
      }

      const newContextJSON = JSON.stringify(this.contextInternal);

      if (oldContextJSON !== newContextJSON) {
        console.log(
          "[OnboardingEngine] Context updated:",
          oldContextJSON,
          "=>",
          newContextJSON,
        );

        this.eventManager.notifyListeners(
          "contextUpdate",
          oldContext,
          this.contextInternal,
        );
        await this.persistenceManager.persistDataIfNeeded(
          this.contextInternal,
          this.currentStepInternal?.id || null,
          this.stateManager.isHydrating,
        );

        console.log(
          "[Engine] Notifying full state change after context update.",
        );
        this.stateManager.notifyStateChange(
          this.currentStepInternal,
          this.contextInternal, // This context now includes the updates
          this.history,
        );
      }
    });
  }

  /**
   * Update checklist item
   */
  public async updateChecklistItem(
    itemId: string,
    isCompleted: boolean,
    stepId?: string,
  ): Promise<void> {
    return this.operationQueue.enqueue(async () => {
      const targetStep = stepId
        ? findStepById(this.steps, stepId)
        : this.currentStepInternal;

      if (!targetStep || targetStep.type !== "CHECKLIST") {
        const error = new Error(
          "Target step for checklist item update is invalid.",
        );
        console.error(
          `[OnboardingEngine] Cannot update checklist item: Step '${
            stepId || this.currentStepInternal?.id
          }' not found or not a CHECKLIST step.`,
        );
        this.stateManager.setError(error);
        return;
      }

      await this.checklistManager.updateChecklistItem(
        itemId,
        isCompleted,
        targetStep as OnboardingStep<TContext> & { type: "CHECKLIST" },
        this.contextInternal,
        async () => {
          await this.persistenceManager.persistDataIfNeeded(
            this.contextInternal,
            this.currentStepInternal?.id || null,
            this.stateManager.isHydrating,
          );
        },
      );
    });
  }

  /**
   * Reset the engine
   */
  public async reset(
    newConfigInput?: Partial<OnboardingEngineConfig<TContext>>,
  ): Promise<void> {
    console.log("[OnboardingEngine] Resetting engine...");

    // Capture current clear handler
    const activeClearHandler =
      this.persistenceManager.getClearPersistedDataHandler();

    // Cleanup
    await this.pluginManager.cleanup();
    this.operationQueue.clear();

    // Update configuration
    if (newConfigInput) {
      this.initialConfig = ConfigurationBuilder.mergeConfigs(
        this.initialConfig,
        newConfigInput,
      );
    }

    this.steps = this.initialConfig.steps || [];

    // Clear persisted data using the OLD handler (before reset)
    if (activeClearHandler) {
      try {
        console.log(
          "[OnboardingEngine] reset: Clearing persisted data using the handler active before reset...",
        );
        await activeClearHandler();
      } catch (error) {
        console.error(
          "[OnboardingEngine] reset: Error during clearPersistedData:",
          error,
        );
        this.errorHandler.handleError(
          error,
          "clearPersistedData",
          this.contextInternal,
        );
      }
    }

    // Reset internal state
    this.currentStepInternal = null;
    this.history = [];
    this.contextInternal = ConfigurationBuilder.buildInitialContext(
      this.initialConfig,
    );

    // Reset managers
    this.stateManager.setLoading(false);
    this.stateManager.setHydrating(false);
    this.stateManager.setError(null);
    this.stateManager.setCompleted(false);

    // Clear old handlers before applying new ones
    this.persistenceManager.setDataLoadHandler(undefined);
    this.persistenceManager.setDataPersistHandler(undefined);
    this.persistenceManager.setClearPersistedDataHandler(undefined);
    this.onFlowComplete = undefined;
    this.onStepChangeCallback = undefined;

    // Update navigation manager with new steps
    this.navigationManager = new NavigationManager(
      this.steps,
      this.eventManager,
      this.stateManager,
      this.checklistManager,
      this.persistenceManager,
      this.errorHandler,
    );

    // Clear performance caches
    PerformanceUtils.clearCaches();

    // Re-create initialization promise
    this.setupInitializationPromise();

    try {
      // Re-initialize: This will set isLoading, navigate to initial step, and then set isLoading to false.
      // initializeEngine SHOULD ideally emit the final stateChange event itself upon successful completion.
      await this.initializeEngine();
      console.log("[OnboardingEngine] Reset: Re-initialization complete.");

      // *** CRITICAL: Ensure a stateChange event is emitted with the final reset state ***
      // If initializeEngine doesn't guarantee this, do it here.
      // However, initializeEngine's .then() block in the Provider also sets state.
      // The most robust way is for initializeEngine to be the source of truth for its own ready state.
      // The engine's internal state (currentStepInternal, contextInternal) IS NOW CORRECT.
      // We need to make sure the StateManager reflects this and notifies.
      this.stateManager.notifyStateChange(
        this.currentStepInternal,
        this.contextInternal,
        this.history,
      );
      // This will ensure the provider's listener picks up the state where currentStep is "step1".
    } catch (error) {
      console.error(
        "[OnboardingEngine] Error during reset's re-initialization:",
        error,
      );
      const processedError =
        error instanceof Error ? error : new Error(String(error));
      this.stateManager.setError(processedError);
      // Also notify state change in case of error during reset's re-init
      this.stateManager.notifyStateChange(
        this.currentStepInternal,
        this.contextInternal,
        this.history,
      );
      // No need to throw here if reset is meant to recover gracefully,
      // but the engine will be in an error state.
    }
    console.log("[OnboardingEngine] Engine reset process finished.");
  }

  // =============================================================================
  // EVENT HANDLING (Delegated to EventHandlerRegistry)
  // =============================================================================

  public addEventListener<T extends keyof EventListenerMap<TContext>>(
    eventType: T,
    listener: EventListenerMap<TContext>[T],
  ): UnsubscribeFunction {
    return this.eventRegistry.addEventListener(eventType, listener);
  }

  public addBeforeStepChangeListener(
    listener: (
      currentStep: OnboardingStep<TContext> | null,
      nextStep: OnboardingStep<TContext>,
      context: TContext,
    ) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventRegistry.addBeforeStepChangeListener(listener);
  }

  public addAfterStepChangeListener(
    listener: (
      previousStep: OnboardingStep<TContext> | null,
      currentStep: OnboardingStep<TContext> | null,
      context: TContext,
    ) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventRegistry.addAfterStepChangeListener(listener);
  }

  public addStepActiveListener(
    listener: (
      step: OnboardingStep<TContext>,
      context: TContext,
    ) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventRegistry.addStepActiveListener(listener);
  }

  public addStepCompleteListener(
    listener: (
      step: OnboardingStep<TContext>,
      stepData: unknown,
      context: TContext,
    ) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventRegistry.addStepCompleteListener(listener);
  }

  public addFlowCompleteListener(
    listener: (context: TContext) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventRegistry.addFlowCompleteListener(listener);
  }

  public addContextUpdateListener(
    listener: (
      oldContext: TContext,
      newContext: TContext,
    ) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventRegistry.addContextUpdateListener(listener);
  }

  public addErrorListener(
    listener: (error: Error, context: TContext) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventRegistry.addErrorListener(listener);
  }

  // =============================================================================
  // PLUGIN COMPATIBILITY METHODS
  // =============================================================================

  public setDataLoadHandler(handler: DataLoadFn<TContext> | undefined): void {
    this.persistenceManager.setDataLoadHandler(handler);
  }

  public setDataPersistHandler(
    handler: DataPersistFn<TContext> | undefined,
  ): void {
    this.persistenceManager.setDataPersistHandler(handler);
  }

  public setClearPersistedDataHandler(
    handler: (() => Promise<void> | void) | undefined,
  ): void {
    this.persistenceManager.setClearPersistedDataHandler(handler);
  }

  public getSteps(): OnboardingStep<TContext>[] {
    return [...this.steps];
  }

  // =============================================================================
  // UTILITY AND DEBUG METHODS
  // =============================================================================

  /**
   * Get performance statistics
   */
  public getPerformanceStats(): {
    cache: ReturnType<typeof PerformanceUtils.getCacheStats>;
    memory: ReturnType<typeof PerformanceUtils.getMemoryUsage>;
    queue: ReturnType<typeof OperationQueue.prototype.getStats>;
    operations: Record<
      string,
      ReturnType<typeof PerformanceUtils.getPerformanceStats>
    >;
  } {
    const operations = [
      "initializeEngine",
      "navigateToStep",
      "next",
      "previous",
      "skip",
      "updateContext",
    ].reduce(
      (acc, op) => {
        const stats = PerformanceUtils.getPerformanceStats(op);
        if (stats) {
          acc[op] = stats;
        }
        return acc;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as Record<string, any>,
    );

    return {
      cache: PerformanceUtils.getCacheStats(),
      memory: PerformanceUtils.getMemoryUsage(),
      queue: this.operationQueue.getStats(),
      operations,
    };
  }

  /**
   * Get error history
   */
  public getErrorHistory(): ReturnType<
    ErrorHandler<TContext>["getErrorHistory"]
  > {
    return this.errorHandler.getErrorHistory();
  }

  /**
   * Get checklist progress for current step
   */
  public getChecklistProgress(): ReturnType<
    ChecklistManager<TContext>["getChecklistProgress"]
  > | null {
    if (
      !this.currentStepInternal ||
      this.currentStepInternal.type !== "CHECKLIST"
    ) {
      return null;
    }

    return this.checklistManager.getChecklistProgress(
      this.currentStepInternal as OnboardingStep<TContext> & {
        type: "CHECKLIST";
      },
      this.contextInternal,
    );
  }

  /**
   * Force garbage collection of caches
   */
  public clearCaches(): void {
    PerformanceUtils.clearCaches();
    this.errorHandler.clearErrorHistory();
  }

  /**
   * Get detailed engine information for debugging
   */
  public getDebugInfo(): {
    currentStep: OnboardingStep<TContext> | null;
    context: TContext;
    history: string[];
    state: ReturnType<StateManager<TContext>["getState"]>;
    performance: ReturnType<OnboardingEngine<TContext>["getPerformanceStats"]>;
    errors: ReturnType<ErrorHandler<TContext>["getRecentErrors"]>;
    config: OnboardingEngineConfig<TContext>;
  } {
    return {
      currentStep: this.currentStepInternal,
      context: this.contextInternal,
      history: [...this.history],
      state: this.getState(),
      performance: this.getPerformanceStats(),
      errors: this.errorHandler.getRecentErrors(5),
      config: this.initialConfig,
    };
  }
}
