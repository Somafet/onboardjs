// @onboardjs/core/src/engine/types.ts (Corrected and Refactored)

import { OnboardingPlugin } from "../plugins";
import { OnboardingStep, OnboardingContext } from "../types";

// =============================================================================
// Engine State & Base Types
// =============================================================================

export interface EngineState<
  TContext extends OnboardingContext = OnboardingContext,
> {
  currentStep: OnboardingStep<TContext> | null;
  context: TContext;
  isFirstStep: boolean;
  isLastStep: boolean;
  canGoNext: boolean;
  canGoPrevious: boolean;
  isSkippable: boolean;
  isLoading: boolean;
  isHydrating: boolean;
  error: Error | null;
  isCompleted: boolean;
  nextStepCandidate: OnboardingStep<TContext> | null;
  previousStepCandidate: OnboardingStep<TContext> | null;
  totalSteps: number;
  completedSteps: number;
  progressPercentage: number;
  currentStepNumber: number;
}

export type EngineStateChangeListener<
  TContext extends OnboardingContext = OnboardingContext,
> = (event: { state: EngineState<TContext> }) => void;

export type UnsubscribeFunction = () => void;

// =============================================================================
// Event Object Interfaces
// =============================================================================

export interface BeforeStepChangeEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  currentStep: OnboardingStep<TContext> | null;
  targetStepId: string | number | null | undefined;
  direction: "next" | "previous" | "skip" | "goto" | "initial";
  cancel: () => void;
  redirect: (newTargetId: string | number | null | undefined) => void;
}

export interface StepChangeEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  newStep: OnboardingStep<TContext> | null;
  oldStep: OnboardingStep<TContext> | null;
  context: TContext;
}

export interface FlowCompletedEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  context: TContext;
}

export interface StepActiveEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  step: OnboardingStep<TContext>;
  context: TContext;
  startTime: number;
}

export interface StepCompletedEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  step: OnboardingStep<TContext>;
  stepData: Record<string, unknown>;
  context: TContext;
}

export interface ContextUpdateEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  oldContext: TContext;
  newContext: TContext;
}

export interface ErrorEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  error: Error;
  context: TContext;
}

export interface FlowStartedEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  context: TContext;
  startMethod: "fresh" | "resumed";
}

export interface FlowPausedEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  context: TContext;
  reason: "user_action" | "timeout" | "error";
}

export interface FlowResumedEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  context: TContext;
  resumePoint: string;
}

export interface FlowAbandonedEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  context: TContext;
  abandonmentReason: string;
}

export interface FlowResetEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  context: TContext;
  resetReason: string;
}

export interface StepSkippedEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  step: OnboardingStep<TContext>;
  context: TContext;
  skipReason: string;
}

export interface StepRetriedEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  step: OnboardingStep<TContext>;
  context: TContext;
  retryCount: number;
}

export interface StepValidationFailedEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  step: OnboardingStep<TContext>;
  context: TContext;
  validationErrors: string[];
}

export interface StepHelpRequestedEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  step: OnboardingStep<TContext>;
  context: TContext;
  helpType: string;
}

export interface StepAbandonedEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  step: OnboardingStep<TContext>;
  context: TContext;
  timeOnStep: number;
}

export interface NavigationBackEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  fromStep: OnboardingStep<TContext>;
  toStep: OnboardingStep<TContext>;
  context: TContext;
}

export interface NavigationForwardEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  fromStep: OnboardingStep<TContext>;
  toStep: OnboardingStep<TContext>;
  context: TContext;
}

export interface NavigationJumpEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  fromStep: OnboardingStep<TContext>;
  toStep: OnboardingStep<TContext>;
  context: TContext;
}

export interface UserIdleEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  step: OnboardingStep<TContext>;
  context: TContext;
  idleDuration: number;
}

export interface UserReturnedEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  step: OnboardingStep<TContext>;
  context: TContext;
  awayDuration: number;
}

export interface DataChangedEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  step: OnboardingStep<TContext>;
  context: TContext;
  changedFields: string[];
}

export interface StepRenderTimeEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  step: OnboardingStep<TContext>;
  context: TContext;
  renderTime: number;
}

export interface PersistenceSuccessEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  context: TContext;
  persistenceTime: number;
}

export interface PersistenceFailureEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  context: TContext;
  error: Error;
}

export interface ChecklistItemToggledEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  itemId: string;
  isCompleted: boolean;
  step: OnboardingStep<TContext>;
  context: TContext;
}

export interface ChecklistProgressChangedEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  step: OnboardingStep<TContext>;
  context: TContext;
  progress: {
    completed: number;
    total: number;
    percentage: number;
    isComplete: boolean;
  };
}

export interface PluginInstalledEvent {
  pluginName: string;
  pluginVersion: string;
}

export interface PluginErrorEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  pluginName: string;
  error: Error;
  context: TContext;
}

// =============================================================================
// Event Listener Map
// =============================================================================

export interface EventListenerMap<
  TContext extends OnboardingContext = OnboardingContext,
> {
  stateChange: (event: { state: EngineState<TContext> }) => void;
  beforeStepChange: (
    event: BeforeStepChangeEvent<TContext>,
  ) => void | Promise<void>;
  stepChange: (event: StepChangeEvent<TContext>) => void | Promise<void>;
  stepActive: (event: StepActiveEvent<TContext>) => void | Promise<void>;
  stepCompleted: (event: StepCompletedEvent<TContext>) => void | Promise<void>;
  contextUpdate: (event: ContextUpdateEvent<TContext>) => void | Promise<void>;
  error: (event: ErrorEvent<TContext>) => void | Promise<void>;

  // Flow-level events
  flowStarted: (event: FlowStartedEvent<TContext>) => void | Promise<void>;
  flowCompleted: (event: FlowCompletedEvent<TContext>) => void | Promise<void>;
  flowPaused: (event: FlowPausedEvent<TContext>) => void | Promise<void>;
  flowResumed: (event: FlowResumedEvent<TContext>) => void | Promise<void>;
  flowAbandoned: (event: FlowAbandonedEvent<TContext>) => void | Promise<void>;
  flowReset: (event: FlowResetEvent<TContext>) => void | Promise<void>;

  // Step-level events
  stepSkipped: (event: StepSkippedEvent<TContext>) => void | Promise<void>;
  stepRetried: (event: StepRetriedEvent<TContext>) => void | Promise<void>;
  stepValidationFailed: (
    event: StepValidationFailedEvent<TContext>,
  ) => void | Promise<void>;
  stepHelpRequested: (
    event: StepHelpRequestedEvent<TContext>,
  ) => void | Promise<void>;
  stepAbandoned: (event: StepAbandonedEvent<TContext>) => void | Promise<void>;

  // Navigation events
  navigationBack: (
    event: NavigationBackEvent<TContext>,
  ) => void | Promise<void>;
  navigationForward: (
    event: NavigationForwardEvent<TContext>,
  ) => void | Promise<void>;
  navigationJump: (
    event: NavigationJumpEvent<TContext>,
  ) => void | Promise<void>;

  // Interaction events
  userIdle: (event: UserIdleEvent<TContext>) => void | Promise<void>;
  userReturned: (event: UserReturnedEvent<TContext>) => void | Promise<void>;
  dataChanged: (event: DataChangedEvent<TContext>) => void | Promise<void>;

  // Performance events
  stepRenderTime: (
    event: StepRenderTimeEvent<TContext>,
  ) => void | Promise<void>;
  persistenceSuccess: (
    event: PersistenceSuccessEvent<TContext>,
  ) => void | Promise<void>;
  persistenceFailure: (
    event: PersistenceFailureEvent<TContext>,
  ) => void | Promise<void>;

  // Checklist-specific events
  checklistItemToggled: (
    event: ChecklistItemToggledEvent<TContext>,
  ) => void | Promise<void>;
  checklistProgressChanged: (
    event: ChecklistProgressChangedEvent<TContext>,
  ) => void | Promise<void>;

  // Plugin events
  pluginInstalled: (event: PluginInstalledEvent) => void | Promise<void>;
  pluginError: (event: PluginErrorEvent<TContext>) => void | Promise<void>;
}

// =============================================================================
// Data Persistence & Engine Config
// =============================================================================

export type LoadedData<TContext extends OnboardingContext = OnboardingContext> =
  Partial<TContext> & {
    currentStepId?: string | number | null;
  };

export type DataLoadFn<TContext extends OnboardingContext = OnboardingContext> =
  () =>
    | Promise<LoadedData<TContext> | null | undefined>
    | LoadedData<TContext>
    | null
    | undefined;

export type DataPersistFn<
  TContext extends OnboardingContext = OnboardingContext,
> = (
  context: TContext,
  currentStepId: string | number | null,
) => Promise<void> | void;

export interface OnboardingEngineConfig<
  TContext extends OnboardingContext = OnboardingContext,
> {
  steps: OnboardingStep<TContext>[];
  initialStepId?: string | number;
  initialContext?: Partial<TContext>;
  onFlowComplete?: (context: TContext) => void | Promise<void>;
  onStepChange?: (
    newStep: OnboardingStep<TContext> | null,
    oldStep: OnboardingStep<TContext> | null,
    context: TContext,
  ) => void;
  loadData?: DataLoadFn<TContext>;
  persistData?: DataPersistFn<TContext>;
  clearPersistedData?: () => Promise<void> | void;
  plugins?: OnboardingPlugin<TContext>[];
}
