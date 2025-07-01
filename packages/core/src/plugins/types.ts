// @onboardjs/core/src/plugins/types.ts

import { OnboardingEngine } from "../engine/OnboardingEngine";
import {
  BeforeStepChangeEvent,
  ContextUpdateEvent,
  ErrorEvent,
  FlowCompletedEvent,
  FlowStartedEvent,
  FlowPausedEvent,
  FlowResumedEvent,
  FlowAbandonedEvent,
  FlowResetEvent,
  StepActiveEvent,
  StepChangeEvent,
  StepCompletedEvent,
  StepSkippedEvent,
  StepRetriedEvent,
  StepValidationFailedEvent,
  StepHelpRequestedEvent,
  StepAbandonedEvent,
  NavigationBackEvent,
  NavigationForwardEvent,
  NavigationJumpEvent,
  UserIdleEvent,
  UserReturnedEvent,
  DataChangedEvent,
  StepRenderTimeEvent,
  PersistenceSuccessEvent,
  PersistenceFailureEvent,
  ChecklistItemToggledEvent,
  ChecklistProgressChangedEvent,
  PluginInstalledEvent,
  PluginErrorEvent,
} from "../engine/types";
import { OnboardingContext, OnboardingStep } from "../types";

export interface OnboardingPlugin<
  TContext extends OnboardingContext = OnboardingContext,
> {
  /** Unique plugin identifier */
  name: string;
  /** Plugin version for compatibility checking */
  version: string;
  /** Plugin description */
  description?: string;
  /** Plugin dependencies */
  dependencies?: string[];
  /** Install function called when plugin is added to engine */
  install: (
    engine: OnboardingEngine<TContext>,
  ) => PluginCleanup | Promise<PluginCleanup>;
}

export type PluginCleanup = () => any | Promise<any>;

export interface PluginManager<
  TContext extends OnboardingContext = OnboardingContext,
> {
  /** Install a plugin */
  install(plugin: OnboardingPlugin<TContext>): Promise<any>;
  /** Uninstall a plugin */
  uninstall(pluginName: string): Promise<any>;
  /** Get installed plugin */
  getPlugin(name: string): OnboardingPlugin<TContext> | undefined;
  /** Get all installed plugins */
  getInstalledPlugins(): OnboardingPlugin<TContext>[];
  /** Check if plugin is installed */
  isInstalled(name: string): boolean;
  /** Cleanup all plugins */
  cleanup(): Promise<any>;
}

export interface PluginHooks<
  TContext extends OnboardingContext = OnboardingContext,
> {
  /** Called before step change */
  beforeStepChange?: (
    event: BeforeStepChangeEvent<TContext>,
  ) => void | Promise<void>;

  /** Called after step change */
  afterStepChange?: (event: StepChangeEvent<TContext>) => void | Promise<void>;

  /** Called when step becomes active */
  onStepActive?: (event: StepActiveEvent<TContext>) => void | Promise<void>;

  /** Called when step is completed */
  onStepCompleted?: (
    event: StepCompletedEvent<TContext>,
  ) => void | Promise<void>;

  /** Called when flow is completed */
  onFlowCompleted?: (
    event: FlowCompletedEvent<TContext>,
  ) => void | Promise<void>;

  /** Called when context is updated */
  onContextUpdate?: (
    event: ContextUpdateEvent<TContext>,
  ) => void | Promise<void>;

  /** Called on engine errors */
  onError?: (event: ErrorEvent<TContext>) => void | Promise<void>;

  /** Called when flow starts */
  onFlowStarted?: (event: FlowStartedEvent<TContext>) => void | Promise<void>;

  /** Called when flow is paused */
  onFlowPaused?: (event: FlowPausedEvent<TContext>) => void | Promise<void>;

  /** Called when flow is resumed */
  onFlowResumed?: (event: FlowResumedEvent<TContext>) => void | Promise<void>;

  /** Called when flow is abandoned */
  onFlowAbandoned?: (
    event: FlowAbandonedEvent<TContext>,
  ) => void | Promise<void>;

  /** Called when flow is reset */
  onFlowReset?: (event: FlowResetEvent<TContext>) => void | Promise<void>;

  /** Called when a step is skipped */
  onStepSkipped?: (event: StepSkippedEvent<TContext>) => void | Promise<void>;

  /** Called when a step is retried */
  onStepRetried?: (event: StepRetriedEvent<TContext>) => void | Promise<void>;

  /** Called when step validation fails */
  onStepValidationFailed?: (
    event: StepValidationFailedEvent<TContext>,
  ) => void | Promise<void>;

  /** Called when help is requested on a step */
  onStepHelpRequested?: (
    event: StepHelpRequestedEvent<TContext>,
  ) => void | Promise<void>;

  /** Called when a step is abandoned */
  onStepAbandoned?: (
    event: StepAbandonedEvent<TContext>,
  ) => void | Promise<void>;

  /** Called on navigation back */
  onNavigationBack?: (
    event: NavigationBackEvent<TContext>,
  ) => void | Promise<void>;

  /** Called on navigation forward */
  onNavigationForward?: (
    event: NavigationForwardEvent<TContext>,
  ) => void | Promise<void>;

  /** Called on navigation jump */
  onNavigationJump?: (
    event: NavigationJumpEvent<TContext>,
  ) => void | Promise<void>;

  /** Called when user is idle */
  onUserIdle?: (event: UserIdleEvent<TContext>) => void | Promise<void>;

  /** Called when user returns */
  onUserReturned?: (event: UserReturnedEvent<TContext>) => void | Promise<void>;

  /** Called when data changes */
  onDataChanged?: (event: DataChangedEvent<TContext>) => void | Promise<void>;

  /** Called on step render time event */
  onStepRenderTime?: (
    event: StepRenderTimeEvent<TContext>,
  ) => void | Promise<void>;

  /** Called on persistence success */
  onPersistenceSuccess?: (
    event: PersistenceSuccessEvent<TContext>,
  ) => void | Promise<void>;

  /** Called on persistence failure */
  onPersistenceFailure?: (
    event: PersistenceFailureEvent<TContext>,
  ) => void | Promise<void>;

  /** Called when a checklist item is toggled */
  onChecklistItemToggled?: (
    event: ChecklistItemToggledEvent<TContext>,
  ) => void | Promise<void>;

  /** Called when checklist progress changes */
  onChecklistProgressChanged?: (
    event: ChecklistProgressChangedEvent<TContext>,
  ) => void | Promise<void>;

  /** Called when a plugin is installed */
  onPluginInstalled?: (event: PluginInstalledEvent) => void | Promise<void>;

  /** Called on plugin error */
  onPluginError?: (event: PluginErrorEvent<TContext>) => void | Promise<void>;
}

export interface PluginConfig {
  [key: string]: any;
}
