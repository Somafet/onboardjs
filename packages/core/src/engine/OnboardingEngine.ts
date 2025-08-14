// src/engine/OnboardingEngine.ts
import { OnboardingStep, OnboardingContext } from "../types";
import { findStepById } from "../utils/step-utils";
import { EventManager } from "./EventManager";
import { Logger } from "../services/Logger";
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
import { AnalyticsManager } from "../analytics/analytics-manager";
import { AnalyticsConfig, AnalyticsProvider } from "../analytics/types";
import { HttpProvider } from "../analytics/providers/http-provider";

let engineInstanceCounter = 0; // Module-level counter
const engineRegistry = new Map<string, OnboardingEngine<any>>(); // Registry for flow-based lookups

export class OnboardingEngine<
  TContext extends OnboardingContext = OnboardingContext,
> {
  // =============================================================================
  // STATIC REGISTRY METHODS
  // =============================================================================

  /**
   * Get an engine instance by its flow ID
   */
  static getByFlowId<TContext extends OnboardingContext = OnboardingContext>(
    flowId: string,
  ): OnboardingEngine<TContext> | undefined {
    return engineRegistry.get(flowId) as OnboardingEngine<TContext> | undefined;
  }

  /**
   * Get all registered engine instances
   */
  static getAllEngines(): OnboardingEngine<any>[] {
    return Array.from(engineRegistry.values());
  }

  /**
   * Get engines by version pattern
   */
  static getEnginesByVersion(versionPattern: string): OnboardingEngine<any>[] {
    return Array.from(engineRegistry.values()).filter((engine) =>
      engine.isVersionCompatible(versionPattern),
    );
  }

  /**
   * Clear the engine registry (useful for testing)
   */
  static clearRegistry(): void {
    engineRegistry.clear();
  }

  /**
   * Get registry statistics
   */
  static getRegistryStats(): {
    totalEngines: number;
    enginesByFlow: Record<string, number>;
    enginesByVersion: Record<string, number>;
  } {
    const engines = Array.from(engineRegistry.values());
    const enginesByFlow: Record<string, number> = {};
    const enginesByVersion: Record<string, number> = {};

    engines.forEach((engine) => {
      const flowName = engine.getFlowName() || "unnamed";
      const version = engine.getFlowVersion() || "unversioned";

      enginesByFlow[flowName] = (enginesByFlow[flowName] || 0) + 1;
      enginesByVersion[version] = (enginesByVersion[version] || 0) + 1;
    });

    return {
      totalEngines: engines.length,
      enginesByFlow,
      enginesByVersion,
    };
  }

  // =============================================================================
  // INSTANCE PROPERTIES
  // =============================================================================

  public readonly instanceId: number; // Public for easy access in tests
  public readonly flowContext: FlowContext;

  private steps: OnboardingStep<TContext>[];
  private currentStepInternal: OnboardingStep<TContext> | null = null;
  private contextInternal: TContext;
  private history: string[] = [];
  private logger: Logger; // Core managers
  private analyticsManager: AnalyticsManager<TContext>;
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
  private config: OnboardingEngineConfig<TContext>;

  // Callbacks from config
  private onFlowComplete?: (context: TContext) => Promise<void> | void;
  private onStepChangeCallback?: (
    newStep: OnboardingStep<TContext> | null,
    oldStep: OnboardingStep<TContext> | null,
    context: TContext,
  ) => void;

  constructor(config: OnboardingEngineConfig<TContext>) {
    this.instanceId = ++engineInstanceCounter;

    // Initialize flow context
    this.flowContext = {
      flowId: config.flowId || null,
      flowName: config.flowName || null,
      flowVersion: config.flowVersion || null,
      flowMetadata: config.flowMetadata || null,
      instanceId: this.instanceId,
      createdAt: Date.now(),
    };

    this.logger = new Logger({
      debugMode: config.debug,
      prefix: `OnboardingEngine[${this.flowContext.flowId || this.instanceId}]`,
    }); // Validate configuration
    const validation = ConfigurationBuilder.validateConfig(config);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(", ")}`);
    }

    if (validation.warnings.length > 0) {
      this.logger.warn("Configuration warnings:", validation.warnings);
    }

    this.config = config;
    this.steps = config.steps;
    const effectiveInitialStepId =
      this.config.initialStepId ||
      (this.steps.length > 0 ? this.steps[0].id : null);

    this.contextInternal = ConfigurationBuilder.buildInitialContext(config);

    // Initialize core managers
    this.eventManager = new EventManager();
    this.stateManager = new StateManager(
      this.eventManager,
      this.steps,
      effectiveInitialStepId,
      this.flowContext,
      config.debug,
    );
    this.errorHandler = new ErrorHandler(this.eventManager, this.stateManager);
    this.persistenceManager = new PersistenceManager(
      config.loadData,
      config.persistData,
      config.clearPersistedData,
      this.errorHandler,
      this.eventManager,
      config.debug,
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
      this.logger,
    );
    this.pluginManager = new PluginManagerImpl(
      this,
      this.eventManager,
      config.debug,
    );
    this.eventRegistry = new EventHandlerRegistry(this.eventManager);

    // Store callbacks
    this.onFlowComplete = config.onFlowComplete;
    this.onStepChangeCallback = config.onStepChange;

    // Setup initialization promise
    this.setupInitializationPromise();

    // Start initialization
    this.initializeEngine().catch((error) => {
      this.logger.error(
        "Unhandled error during constructor-initiated initialization:",
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

    // Initialize analytics
    this.analyticsManager = this.initializeAnalytics(config);

    // Register engine if it has a flowId
    if (this.flowContext.flowId) {
      engineRegistry.set(this.flowContext.flowId, this);
      this.logger.debug(
        `Engine registered with flowId: ${this.flowContext.flowId}`,
      );

      // Emit flow registered event
      this.eventManager.notifyListeners("flowRegistered", {
        flowInfo: this.getFlowInfo(),
        context: this.contextInternal,
      });
    }
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

          const startMethod: "fresh" | "resumed" = loadedData?.currentStepId
            ? "resumed"
            : "fresh";

          this.logger.debug(
            `[OnboardingEngine] Onboarding Flow started: ${startMethod}`,
          );

          this.eventManager.notifyListeners("flowStarted", {
            context: this.contextInternal,
            startMethod,
          });

          // 4. Build context
          this.buildContext(loadedData);

          // 5. Handle data load error or navigate to initial step
          if (dataLoadError) {
            this.stateManager.setError(dataLoadError);
            this.currentStepInternal = null;
            this.stateManager.setCompleted(false);
            this.eventManager.notifyListeners("error", {
              error: dataLoadError,
              context: this.contextInternal,
            });
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
        : this.config.initialStepId ||
          (this.steps.length > 0 ? this.steps[0].id : null);

    this.logger.debug(
      "Effective initial step ID:",
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
        this.logger.debug("Navigated to step:", this.currentStepInternal?.id);
      } else {
        this.logger.warn(
          `Initial step '${effectiveInitialStepId}' not found. Falling back to first step.`,
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
      this.logger.debug("No steps available, marking as completed");

      this.currentStepInternal = null;
      this.stateManager.setCompleted(true);
    }
    // Add a case where if the loaded state's currentStepId is `null`, mark the flow as completed
    else if (loadedData?.currentStepId === null) {
      this.logger.debug("Loaded completed flow state. Marking as completed");

      this.currentStepInternal = null;
      this.stateManager.setCompleted(true);
    } else {
      this.logger.warn("No effective initial step ID determined");
      this.currentStepInternal = null;
      this.stateManager.setCompleted(false);
    }
  }

  private async installPlugins(): Promise<void> {
    if (this.config.plugins && this.config.plugins.length > 0) {
      for (const plugin of this.config.plugins) {
        try {
          await this.pluginManager.install(plugin);
        } catch (pluginInstallError) {
          const error =
            pluginInstallError instanceof Error
              ? pluginInstallError.message
              : String(pluginInstallError);
          const errorMessage = `Plugin installation failed for "${plugin.name}": ${error}`;
          this.logger.error(errorMessage);
          throw new Error(errorMessage);
        }
      }
    }
  }

  private applyConfigurationHandlers(): void {
    // Only set handlers from config if they haven't been set by plugins
    // This allows plugins to override config handlers

    if (
      this.config.loadData !== undefined &&
      !this.persistenceManager.getDataLoadHandler()
    ) {
      this.persistenceManager.setDataLoadHandler(this.config.loadData);
    }

    if (
      this.config.persistData !== undefined &&
      !this.persistenceManager.getDataPersistHandler()
    ) {
      this.persistenceManager.setDataPersistHandler(this.config.persistData);
    }

    if (
      this.config.clearPersistedData !== undefined &&
      !this.persistenceManager.getClearPersistedDataHandler()
    ) {
      this.persistenceManager.setClearPersistedDataHandler(
        this.config.clearPersistedData,
      );
    }

    // For callbacks, plugins should take precedence over config
    if (this.config.onFlowComplete !== undefined && !this.onFlowComplete) {
      this.onFlowComplete = this.config.onFlowComplete;
    }

    if (this.config.onStepChange !== undefined && !this.onStepChangeCallback) {
      this.onStepChangeCallback = this.config.onStepChange;
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
    // 1. Start with a fresh, fully initialized context.
    // This guarantees that `flowData._internal` and its sub-properties (`stepStartTimes`, etc.)
    // are always present and correctly structured from the start.
    let newContext: TContext = ConfigurationBuilder.buildInitialContext(
      this.config,
    );

    // 2. If persisted data was loaded, merge it into the new context.
    if (loadedData) {
      const {
        flowData: loadedFlowData,
        // Exclude currentStepId as it's handled separately for navigation
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        currentStepId: _loadedStepId,
        ...otherLoadedProps
      } = loadedData;

      // Merge top-level properties from loaded data.
      // This will overwrite properties like `currentUser` if they are in `loadedData`.
      newContext = {
        ...newContext, // Preserve the _internal structure from buildInitialContext
        ...otherLoadedProps, // Overlay with loaded data's top-level properties
      };

      // Merge `flowData` specifically.
      // The `newContext.flowData` already contains the guaranteed `_internal` structure.
      // We overlay it with `loadedFlowData`, allowing loaded custom data to prevail,
      // but ensuring `_internal` (from `newContext.flowData`) is not lost or overwritten
      // if `loadedFlowData` itself doesn't contain `_internal` or is an empty object.
      newContext.flowData = {
        ...newContext.flowData, // This ensures `_internal` is carried over
        ...(loadedFlowData || {}), // Add/overwrite with custom data from loadedFlowData
      };

      // Additional safety check: Ensure critical _internal properties are not undefined
      // after merging, in case loadedData's _internal was malformed or missing parts.
      if (!newContext.flowData._internal) {
        newContext.flowData._internal = {
          completedSteps: {},
          startedAt: Date.now(),
          stepStartTimes: {},
        };
      } else {
        if (!newContext.flowData._internal.completedSteps)
          newContext.flowData._internal.completedSteps = {};
        if (!newContext.flowData._internal.startedAt)
          newContext.flowData._internal.startedAt = Date.now();
        if (!newContext.flowData._internal.stepStartTimes)
          newContext.flowData._internal.stepStartTimes = {};
      }
    }

    // 3. Set the engine's internal context to the newly built one.
    this.contextInternal = newContext;
  }

  private handleInitializationError(error: unknown): void {
    const processedError =
      error instanceof Error ? error : new Error(String(error));
    this.logger.error(
      "Critical error during engine initialization:",
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
      this.logger.error(
        `Failed to install plugin "${plugin.name}" via use():`,
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
      this.logger.debug("previous(): Ignoring - engine is loading");
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
        this.logger.debug(
          "Context updated:",
          oldContextJSON,
          "=>",
          newContextJSON,
        );

        this.eventManager.notifyListeners("contextUpdate", {
          oldContext,
          newContext: this.contextInternal,
        });
        await this.persistenceManager.persistDataIfNeeded(
          this.contextInternal,
          this.currentStepInternal?.id || null,
          this.stateManager.isHydrating,
        );

        this.logger.debug("Notifying full state change after context update.");
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
        this.logger.error(
          `Cannot update checklist item: Step '${
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
    this.logger.debug("Resetting engine...");

    const resetReason = newConfigInput
      ? "configuration_change"
      : "manual_reset";
    this.eventManager.notifyListeners("flowReset", {
      context: this.contextInternal,
      resetReason,
    });

    // Capture current clear handler
    const activeClearHandler =
      this.persistenceManager.getClearPersistedDataHandler();

    // Cleanup
    await this.pluginManager.cleanup();
    this.operationQueue.clear();

    // Update configuration
    if (newConfigInput) {
      // Unregister old flowId if it's changing
      if (
        this.flowContext.flowId &&
        newConfigInput.flowId &&
        this.flowContext.flowId !== newConfigInput.flowId
      ) {
        engineRegistry.delete(this.flowContext.flowId);
      }

      this.config = ConfigurationBuilder.mergeConfigs(
        this.config,
        newConfigInput,
      );

      // Update flow identification properties
      if (newConfigInput.flowId !== undefined) {
        (this as any).flowId = newConfigInput.flowId;
      }
      if (newConfigInput.flowName !== undefined) {
        (this as any).flowName = newConfigInput.flowName;
      }
      if (newConfigInput.flowVersion !== undefined) {
        (this as any).flowVersion = newConfigInput.flowVersion;
      }
      if (newConfigInput.flowMetadata !== undefined) {
        (this as any).flowMetadata = newConfigInput.flowMetadata;
      }
    }

    this.steps = this.config.steps || [];

    // Clear persisted data using the OLD handler (before reset)
    if (activeClearHandler) {
      try {
        this.logger.debug(
          "reset: Clearing persisted data using the handler active before reset...",
        );
        await activeClearHandler();
      } catch (error) {
        this.logger.error("reset: Error during clearPersistedData:", error);
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
      this.config,
    );

    // Reset managers
    this.stateManager = new StateManager(
      this.eventManager,
      this.steps,
      this.config.initialStepId ||
        (this.steps.length > 0 ? this.steps[0].id : null),
      this.flowContext,
      this.config.debug,
    );
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
      this.logger,
    );

    // Re-register engine if it has a flowId
    if (this.flowContext.flowId) {
      engineRegistry.set(this.flowContext.flowId, this);
      this.logger.debug(
        `Engine re-registered with flowId: ${this.flowContext.flowId}`,
      );
    }

    // Clear performance caches
    PerformanceUtils.clearCaches();

    // Re-create initialization promise
    this.setupInitializationPromise();

    try {
      // Re-initialize: This will set isLoading, navigate to initial step, and then set isLoading to false.
      // initializeEngine SHOULD ideally emit the final stateChange event itself upon successful completion.
      await this.initializeEngine();
      this.logger.debug("Reset: Re-initialization complete.");

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
      this.logger.error("Error during reset's re-initialization:", error);
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

    this.logger.debug("Engine reset process finished.");
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
    listener: (event: BeforeStepChangeEvent<TContext>) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventRegistry.addBeforeStepChangeListener(listener);
  }

  public addAfterStepChangeListener(
    listener: (event: StepChangeEvent<TContext>) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventRegistry.addAfterStepChangeListener(listener);
  }

  public addStepActiveListener(
    listener: (event: StepActiveEvent<TContext>) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventRegistry.addStepActiveListener(listener);
  }

  public addStepCompletedListener(
    listener: (event: StepCompletedEvent<TContext>) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventRegistry.addStepCompletedListener(listener);
  }

  public addFlowCompletedListener(
    listener: (event: FlowCompletedEvent<TContext>) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventRegistry.addFlowCompletedListener(listener);
  }

  public addContextUpdateListener(
    listener: (event: ContextUpdateEvent<TContext>) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventRegistry.addContextUpdateListener(listener);
  }

  public addErrorListener(
    listener: (event: ErrorEvent<TContext>) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.eventRegistry.addErrorListener(listener);
  }

  public addFlowRegisteredListener(
    listener: (event: FlowRegisteredEvent<TContext>) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.addEventListener("flowRegistered", listener);
  }

  public addFlowUnregisteredListener(
    listener: (event: FlowUnregisteredEvent<TContext>) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.addEventListener("flowUnregistered", listener);
  }

  /**
   * Get flow identification information
   */
  public getFlowInfo(): FlowInfo {
    return { ...this.flowContext };
  }

  /**
   * Get the unique identifier for this flow
   */
  public getFlowId(): string | null {
    return this.flowContext.flowId;
  }

  /**
   * Get the version of this flow
   */
  public getFlowVersion(): string | null {
    return this.flowContext.flowVersion;
  }

  /**
   * Get the name of this flow
   */
  public getFlowName(): string | null {
    return this.flowContext.flowName;
  }

  /**
   * Get metadata associated with this flow
   */
  public getFlowMetadata(): Record<string, unknown> | null {
    return this.flowContext.flowMetadata;
  }

  /**
   * Get the instance ID for this flow
   */
  public getInstanceId(): number {
    return this.instanceId;
  }

  /**
   * Generate a namespaced key for persistence based on flow identification
   */
  public generatePersistenceKey(baseKey: string = "onboarding"): string {
    const parts = [baseKey];

    if (this.flowContext.flowId) {
      parts.push(this.flowContext.flowId);
    } else if (this.flowContext.flowName) {
      parts.push(this.flowContext.flowName.replace(/\s+/g, "_").toLowerCase());
    }

    if (this.flowContext.flowVersion) {
      parts.push(`v${this.flowContext.flowVersion}`);
    }

    return parts.join("_");
  }

  /**
   * Check if this engine instance matches the given flow identifier
   */
  public matchesFlow(flowId: string): boolean {
    return this.flowContext.flowId === flowId;
  }

  /**
   * Check if this engine instance is compatible with a given version
   * Uses semantic versioning comparison
   */
  public isVersionCompatible(requiredVersion: string): boolean {
    if (!this.flowContext.flowVersion) return false;

    // Simple major version compatibility check
    // In a real implementation, you might want to use a proper semver library
    const currentMajor = this.flowContext.flowVersion.split(".")[0];
    const requiredMajor = requiredVersion.split(".")[0];

    return currentMajor === requiredMajor;
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

  /**
   * Get all steps in the onboarding flow.
   * This includes all steps defined in the initial configuration.
   * @returns An array of all steps in the onboarding flow.
   */
  public getSteps(): OnboardingStep<TContext>[] {
    return [...this.steps];
  }

  /**
   * Get the index of a specific step in the onboarding flow based on relevant steps.
   * @param stepId The ID of the step to find.
   * @returns The index of the step, or -1 if not found.
   */
  public getStepIndex(stepId: string | number): number {
    return this.stateManager
      .getRelevantSteps(this.contextInternal)
      .findIndex((step) => step.id === stepId);
  }

  /**
   * Get relevant steps in the flow based on the current context.
   * @returns An array of steps that are relevant to the current context.
   */
  public getRelevantSteps(): OnboardingStep<TContext>[] {
    return this.stateManager.getRelevantSteps(this.contextInternal);
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
   * Allows plugins or external code to report an error to the engine's
   * centralized error handler.
   * @param error The error object or unknown value.
   * @param operation A string describing the operation that failed (e.g., 'MyPlugin.saveData').
   */
  public reportError(error: unknown, operation: string): void {
    // This method safely calls the internal handler with the correct context.
    this.errorHandler.handleError(error, operation, this.contextInternal);
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

  // For plugins to report step validation failures
  public reportStepValidationFailure(
    step: OnboardingStep<TContext>,
    validationErrors: string[],
  ): void {
    this.eventManager.notifyListeners("stepValidationFailed", {
      step,
      context: this.contextInternal,
      validationErrors,
    });
  }

  // For plugins to report help requests
  public reportHelpRequest(helpType: string): void {
    if (this.currentStepInternal) {
      this.eventManager.notifyListeners("stepHelpRequested", {
        step: this.currentStepInternal,
        context: this.contextInternal,
        helpType,
      });
    }
  }

  public getContext(): TContext {
    return { ...this.contextInternal };
  }

  /**
   * Force garbage collection of caches
   */
  public clearCaches(): void {
    PerformanceUtils.clearCaches();
    this.errorHandler.clearErrorHistory();
  }

  private initializeAnalytics(
    config: OnboardingEngineConfig<TContext>,
  ): AnalyticsManager<TContext> {
    // Create default analytics config
    let analyticsConfig: AnalyticsConfig = { enabled: false };

    // Handle boolean shorthand
    if (typeof config.analytics === "boolean") {
      analyticsConfig.enabled = config.analytics;
    }
    // Handle full config object
    else if (config.analytics) {
      analyticsConfig = config.analytics;
    }

    // Initialize cloud provider if credentials provided
    if (config.publicKey && config.apiHost) {
      if (!analyticsConfig.providers) {
        analyticsConfig.providers = [];
      }

      analyticsConfig.enabled = true; // Enable analytics if cloud config is provided

      analyticsConfig.providers.push(
        new HttpProvider({
          publicKey: config.publicKey,
          apiHost: config.apiHost,
          debug: config.debug,
        }),
      );
    }

    const manager = new AnalyticsManager<TContext>(
      analyticsConfig,
      this.logger,
    );

    // Set flow information in analytics manager
    manager.setFlowInfo({
      flowId: this.flowContext.flowId || undefined,
      flowName: this.flowContext.flowName || undefined,
      flowVersion: this.flowContext.flowVersion || undefined,
      flowMetadata: this.flowContext.flowMetadata || undefined,
      instanceId: this.instanceId,
    });

    if (analyticsConfig.enabled && manager.providerCount === 0) {
      this.logger.warn(
        "[Analytics] Analytics tracking is enabled, but no external analytics " +
          "providers were configured. Events will be tracked internally (e.g., " +
          "logged to console in debug mode) but will NOT be sent to any external " +
          "service. To enable sending, please either: \n" +
          "1. Provide `config.apiKey` and `config.apiHost` for OnboardJS Cloud integration. \n" +
          "2. Add custom providers to `config.analytics.providers`",
      );
    }

    // Set up event listeners for auto-tracking by default unless explicitly false
    const autoTrackSetting = analyticsConfig.autoTrack ?? true;
    const shouldSetupListeners =
      analyticsConfig.enabled &&
      (autoTrackSetting === true ||
        (typeof autoTrackSetting === "object" &&
          autoTrackSetting.steps !== false));

    // Set up event listeners for auto-tracking
    if (shouldSetupListeners) {
      this.setupAnalyticsEventListeners(manager);
    } else {
      this.logger.debug(
        "Auto-tracking analytics events is disabled or analytics is not enabled.",
      );
    }

    return manager;
  }

  private setupAnalyticsEventListeners(
    manager: AnalyticsManager<TContext>,
  ): void {
    // Track step viewed
    this.addEventListener("stepActive", (event) => {
      manager.trackStepViewed(event.step, event.context);
    });

    // Track step completed
    this.addEventListener("stepCompleted", (event) => {
      const startTime =
        event.context.flowData?._internal?.stepStartTimes?.[event.step.id] || 0;
      const duration = startTime ? Date.now() - startTime : 0;
      manager.trackStepCompleted(event.step, event.context, duration);
    });

    // Track flow started
    this.addEventListener("flowStarted", (event) => {
      manager.trackFlowStarted(event.context, event.startMethod === "resumed");
    });

    // Track flow completed
    this.addEventListener("flowCompleted", (event) => {
      manager.trackFlowCompleted(event.context);
      manager.flush();
    });

    // Track flow registration events
    this.addEventListener("flowRegistered", (event) => {
      manager.trackEvent("flow_registered", {
        flowInfo: event.flowInfo,
        timestamp: Date.now(),
      });
    });

    this.addEventListener("flowUnregistered", (event) => {
      manager.trackEvent("flow_unregistered", {
        flowInfo: event.flowInfo,
        timestamp: Date.now(),
      });
    });

    // Track flow reset events with version info
    this.addEventListener("flowReset", (event) => {
      manager.trackEvent("flow_reset", {
        resetReason: event.resetReason,
        flowInfo: this.getFlowInfo(),
      });
    });
  }

  // Public method to track custom events
  public trackEvent(
    eventName: string,
    properties: Record<string, any> = {},
  ): void {
    this.analyticsManager.trackEvent(eventName, properties);
  }

  // Public method to register additional analytics providers
  public registerAnalyticsProvider(provider: AnalyticsProvider): void {
    this.analyticsManager.registerProvider(provider);
  }

  // Method to flush analytics events
  public flushAnalytics(): Promise<void> {
    return this.analyticsManager.flush();
  }

  // Method to set user ID for analytics
  public setAnalyticsUserId(userId: string): void {
    this.analyticsManager.setUserId(userId);
  }

  /**
   * Cleanup and destroy the engine instance
   */
  public async destroy(): Promise<void> {
    this.logger.debug("Destroying engine...");

    // Emit flow unregistered event before cleanup
    if (
      this.flowContext.flowId &&
      engineRegistry.get(this.flowContext.flowId) === this
    ) {
      this.eventManager.notifyListeners("flowUnregistered", {
        flowInfo: this.getFlowInfo(),
        context: this.contextInternal,
      });
    }

    // Unregister from global registry
    if (
      this.flowContext.flowId &&
      engineRegistry.get(this.flowContext.flowId) === this
    ) {
      engineRegistry.delete(this.flowContext.flowId);
      this.logger.debug(
        `Engine unregistered from flowId: ${this.flowContext.flowId}`,
      );
    }

    // Cleanup managers
    await this.pluginManager.cleanup();
    this.operationQueue.clear();

    // Clear performance caches
    PerformanceUtils.clearCaches();

    this.logger.debug("Engine destroyed.");
  }

  /**
   * Get detailed engine information for debugging
   */
  public getDebugInfo(): {
    flowInfo: FlowInfo;
    currentStep: OnboardingStep<TContext> | null;
    context: TContext;
    history: string[];
    state: ReturnType<StateManager<TContext>["getState"]>;
    performance: ReturnType<OnboardingEngine<TContext>["getPerformanceStats"]>;
    errors: ReturnType<ErrorHandler<TContext>["getRecentErrors"]>;
    config: OnboardingEngineConfig<TContext>;
  } {
    return {
      flowInfo: this.getFlowInfo(),
      currentStep: this.currentStepInternal,
      context: this.contextInternal,
      history: [...this.history],
      state: this.getState(),
      performance: this.getPerformanceStats(),
      errors: this.errorHandler.getRecentErrors(5),
      config: this.config,
    };
  }
}
