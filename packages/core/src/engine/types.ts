// @onboardjs/core/src/engine/types.ts

import { OnboardingStep, OnboardingContext } from "../types";

export interface EngineState {
  currentStep: OnboardingStep | null;
  context: OnboardingContext;
  isFirstStep: boolean;
  isLastStep: boolean;
  canGoNext: boolean; // Considers if nextStep exists and current step is valid (validity handled by UI)
  canGoPrevious: boolean; // Considers if previousStep exists
  isSkippable: boolean;
  /**
   * Indicates if the engine is currently hydrating or restoring state.
   */
  isHydrating: boolean;
  isLoading: boolean; // For async operations within the engine
  error: Error | null;
  isCompleted: boolean;
}

export type EngineStateChangeListener = (state: EngineState) => void;
export type UnsubscribeFunction = () => void;

export interface OnboardingEngineConfig {
  steps: OnboardingStep[];
  initialStepId?: string | number;
  initialContext?: Partial<OnboardingContext>;
  onFlowComplete?: (context: OnboardingContext) => void;
  onStepChange?: (
    newStep: OnboardingStep | null,
    oldStep: OnboardingStep | null,
    context: OnboardingContext
  ) => void;
  onDataLoad?: DataLoadListener;
  onDataPersist?: DataPersistListener;
}

/**
 * Event object passed to listeners before an onboarding step changes.
 *
 * This event allows handlers to inspect the current and target steps,
 * determine the direction of navigation, and optionally prevent or redirect
 * the navigation.
 *
 * @property currentStep - The current onboarding step, or `null` if not set.
 * @property targetStepId - The ID of the step being navigated to, or `null`/`undefined` if not specified.
 * @property direction - The direction of navigation: `"next"`, `"previous"`, `"skip"`, `"goto"`, or `"initial"`.
 * @property cancel - Call this function to prevent the navigation from occurring.
 * @property redirect - Optionally call this function with a new target step ID to redirect the navigation.
 *   This will only take effect if `cancel()` is not called.
 */
export interface BeforeStepChangeEvent {
  currentStep: OnboardingStep | null;
  targetStepId: string | number | null | undefined;
  direction: "next" | "previous" | "skip" | "goto" | "initial";
  /** Call this function to prevent the navigation. */
  cancel: () => void;
  /**
   * Optionally, provide a new targetStepId if you want to redirect the navigation
   * instead of just cancelling. This will only be respected if cancel() is not called.
   */
  redirect?: (newTargetStepId: string | number | null) => void;
}

/**
 * A listener function that is called before a step change occurs.
 *
 * @param event - The event object containing information about the impending step change.
 * @returns A promise that resolves when the listener has completed its work, or void for synchronous listeners.
 */
export type BeforeStepChangeListener = (
  event: BeforeStepChangeEvent
) => Promise<void> | void;

export interface LoadedData {
  flowData?: Record<string, any>;
  currentStepId?: string | number | null;
  /** Optional: Any other context fields the user wants to restore */
  [key: string]: any;
}

/**
 * A function type that asynchronously loads data and returns a promise
 * resolving to a {@link LoadedData} object, or `null`/`undefined` if no data is loaded.
 *
 * @returns {Promise<LoadedData | null | undefined>} A promise that resolves with the loaded data,
 *          or `null`/`undefined` if no data is available.
 */
export type DataLoadListener = () => Promise<LoadedData | null | undefined>;

/**
 * A callback function that is invoked to persist onboarding data.
 *
 * @param context - The current onboarding context containing relevant state and data.
 * @param currentStepId - The identifier of the current onboarding step, or `null` if not applicable.
 * @returns A promise that resolves when persistence is complete, or void for synchronous operations.
 */
export type DataPersistListener = (
  context: OnboardingContext,
  currentStepId: string | number | null
) => Promise<void> | void;
