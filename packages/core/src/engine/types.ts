// @onboardjs/core/src/engine/types.ts

import { OnboardingPlugin } from "../plugins";
import { OnboardingStep, OnboardingContext } from "../types";

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

  /**
   * The next step the engine will navigate to, considering conditions.
   * Useful for debugging and UI previews. Can be null if at the end of the flow.
   */
  nextStepCandidate: OnboardingStep<TContext> | null;
}

export type EngineStateChangeListener<
  TContext extends OnboardingContext = OnboardingContext,
> = (state: EngineState<TContext>) => void;

export type UnsubscribeFunction = () => void;

export interface BeforeStepChangeEvent<
  TContext extends OnboardingContext = OnboardingContext,
> {
  currentStep: OnboardingStep<TContext> | null;
  targetStepId: string | number | null | undefined;
  direction: "next" | "previous" | "skip" | "goto" | "initial";
  cancel: () => void;
  redirect: (newTargetId: string | number | null | undefined) => void;
}

export type BeforeStepChangeListener<
  TContext extends OnboardingContext = OnboardingContext,
> = (event: BeforeStepChangeEvent<TContext>) => void | Promise<void>;

export type StepChangeListener<
  TContext extends OnboardingContext = OnboardingContext,
> = (
  newStep: OnboardingStep<TContext> | null,
  oldStep: OnboardingStep<TContext> | null,
  context: TContext,
) => void | Promise<void>;

export type FlowCompleteListener<
  TContext extends OnboardingContext = OnboardingContext,
> = (context: TContext) => void | Promise<void>;

export interface EventListenerMap<
  TContext extends OnboardingContext = OnboardingContext,
> {
  stateChange: EngineStateChangeListener<TContext>;
  beforeStepChange: BeforeStepChangeListener<TContext>;
  stepChange: StepChangeListener<TContext>;
  flowComplete: FlowCompleteListener<TContext>;
  dataLoad: DataLoadFn<TContext>;
  dataPersist: DataPersistFn<TContext>;
  clearPersistedData: () => void | Promise<void>;
  stepActive: (
    step: OnboardingStep<TContext>,
    context: TContext,
  ) => void | Promise<void>;
  stepComplete: (
    step: OnboardingStep<TContext>,
    stepData: any,
    context: TContext,
  ) => void | Promise<void>;
  contextUpdate: (
    oldContext: TContext,
    newContext: TContext,
  ) => void | Promise<void>;
  error: (error: Error, context: TContext) => void | Promise<void>;
}

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
  onFlowComplete?: FlowCompleteListener<TContext>;
  onStepChange?: (
    newStep: OnboardingStep<TContext> | null,
    oldStep: OnboardingStep<TContext> | null,
    context: TContext,
  ) => void;

  /**
   * The function that should load the initial data for the onboarding flow.
   */
  loadData?: DataLoadFn<TContext>;

  /**
   * The function that should persist the current state of the onboarding flow.
   */
  persistData?: DataPersistFn<TContext>;

  /**
   * Optional function to clear any persisted data, e.g. from local storage or a database.
   * This can be useful for resetting the onboarding state.
   */
  clearPersistedData?: () => Promise<void> | void;

  /**
   * Optional plugins to be installed at initialization.
   * These plugins can extend the functionality of the onboarding engine.
   */
  plugins?: OnboardingPlugin<TContext>[];
}
