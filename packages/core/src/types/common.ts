// @onboardjs/core/src/types/common.ts

/**
 * Represents the shared context available throughout the onboarding flow.
 * This context is passed to dynamic functions (like condition, nextStep)
 * and can be made available to UI components.
 */
export interface OnboardingContext {
  /** Data collected from all completed steps so far. */
  flowData: Record<string, any>;
  /** Information about the current user, if available. */
  currentUser?: any; // Replace 'any' with your actual User type
  /** Any other global state or services relevant to the onboarding flow. */
  // Example: featureFlags?: Record<string, boolean>;
  [key: string]: any; // Allow for extensibility
}

/**
 * Base properties common to all onboarding steps.
 */
export interface BaseOnboardingStep {
  /** A unique identifier for this step. */
  id: string | number;
  /** The title displayed for the step (e.g., in a header). */
  title: string;
  /** An optional, more detailed description or instructions for the step. */
  description?: string;
  /** Optional: Identifier for an icon associated with the step. */
  icon?: string;

  // --- Navigation Logic ---
  nextStep?:
    | string
    | number
    | null
    | ((context: OnboardingContext) => string | null | undefined)
    | undefined;
  /**
   * Determines the ID of the previous step.
   * Can be a static string, null (no previous), undefined, or a function.
   */
  previousStep?:
    | string
    | number
    | null
    | ((context: OnboardingContext) => string | null | undefined)
    | undefined;

  // --- Step Behavior ---
  isSkippable?: boolean;
  /**
   * If skippable, specifies the ID of the step to navigate to when skipped.
   * Can be a static string, null, undefined, or a function.
   */
  skipToStep?:
    | string
    | number
    | null
    | ((context: OnboardingContext) => string | null | undefined)
    | undefined;

  // --- Lifecycle Hooks & Logic ---
  onStepActive?: (context: OnboardingContext) => Promise<void> | void;
  onStepComplete?: (
    stepData: any,
    context: OnboardingContext
  ) => Promise<void> | void;
  condition?: (context: OnboardingContext) => boolean;

  // --- UI Customization Hints (for the UI package) ---
  ctaLabel?: string;
  secondaryCtaLabel?: string;
  skipLabel?: string;

  /** Arbitrary metadata for custom use cases or extensions. */
  meta?: Record<string, any>;
}
