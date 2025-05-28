/**
 * Represents the shared context available throughout the onboarding flow.
 * This context is passed to dynamic functions (like condition, nextStep)
 * and can be made available to UI components.
 */
export interface OnboardingContext {
  /** Data collected from all completed steps so far. */
  flowData: Record<string, any>;
  /** Information about the current user, if available. */
  currentUser?: any;
  /** Any other global state or services relevant to the onboarding flow. */
  [key: string]: any;
}

type SkipableStep = {
  isSkippable: true;
  skipToStep:
    | string
    | number
    | null
    | ((context: OnboardingContext) => string | null | undefined)
    | undefined;
  skipLabel?: string;
};

type NonSkipableStep = {
  isSkippable?: false;
  skipToStep?: never;
  skipLabel?: never;
};

/**
 * Base properties common to all onboarding steps.
 */
export type BaseOnboardingStep = {
  /** A unique identifier for this step. */
  id: string | number;
  /** The title displayed for the step (e.g., in a header). */
  title: string;
  /** An optional, more detailed description or instructions for the step. */
  description?: string;
  /** Optional: Identifier for an icon associated with the step. */
  icon?: string;
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
  onStepActive?: (context: OnboardingContext) => Promise<void> | void;
  onStepComplete?: (
    stepData: any,
    context: OnboardingContext
  ) => Promise<void> | void;
  condition?: (context: OnboardingContext) => boolean;
  ctaLabel?: string;
  secondaryCtaLabel?: string;
  /** Arbitrary metadata for custom use cases or extensions. */
  meta?: Record<string, any>;
} & (SkipableStep | NonSkipableStep);
