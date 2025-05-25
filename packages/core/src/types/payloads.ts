// @onboardjs/core/src/types/payloads.ts

import { OnboardingContext } from "./common";

// --- Example: Welcome Step ---
export interface WelcomeStepPayload {
  mainText: string;
  subText?: string;
  imageUrl?: string;
  imageAlt?: string;
}

// --- Example: Form Input Step ---
export interface FormFieldOption {
  label: string;
  value: string | number;
}

export interface FormFieldValidation {
  required?: boolean | string;
  minLength?: { value: number; message: string };
  maxLength?: { value: number; message: string };
  pattern?: { value: RegExp; message: string };
  custom?: (
    value: any,
    allFormData: Record<string, any>
  ) => string | null | Promise<string | null>;
}

export interface FormField {
  id: string;
  name: string;
  label: string;
  type:
    | "text"
    | "email"
    | "password"
    | "number"
    | "textarea"
    | "select"
    | "checkbox"
    | "radio_group";
  placeholder?: string;
  defaultValue?: any;
  options?: FormFieldOption[];
  validation?: FormFieldValidation;
  helperText?: string;
}

export interface FormInputStepPayload {
  fields: FormField[];
  submitButtonText?: string;
}

// --- Example: Multiple Choice Selection Step ---
export interface ChoiceOption<TValue = string | number> {
  id: string;
  label: string;
  value: TValue;
  description?: string;
  icon?: string;
}

export interface MultipleChoiceStepPayload {
  question: string;
  options: ChoiceOption[];
  minSelections?: number;
  maxSelections?: number;
  dataKey: string;
}

// --- Example: Single Choice Selection Step ---
export interface SingleChoiceStepPayload {
  question: string;
  options: ChoiceOption[];
  dataKey: string;
}

/** Defines the structure of an item in a checklist step's payload. */
export interface ChecklistItemDefinition {
  id: string; // Unique identifier for the item within this checklist
  label: string;
  description?: string;
  isMandatory?: boolean; // Defaults to true if not specified by the engine's logic
  /** Optional condition to determine if this item should be shown/considered. */
  condition?: (context: OnboardingContext) => boolean;
  meta?: Record<string, any>; // For custom data per item
}

/** Payload for a checklist step. */
export interface ChecklistStepPayload {
  /** An array of item definitions for the checklist. */
  items: ChecklistItemDefinition[];
  /**
   * The key under which the state of checklist items (e.g., Array<{id: string, isCompleted: boolean}>)
   * will be stored in the step's data within `flowData`.
   */
  dataKey: string;
  /**
   * Optional: Minimum number of items that must be completed for the step to be considered complete.
   * If not provided, all mandatory items must be completed.
   */
  minItemsToComplete?: number;
  /** Optional: Title or heading for the checklist itself, if different from step.title */
  checklistTitle?: string;
}

// Runtime state of a checklist item, typically stored in flowData
export interface ChecklistItemState {
  id: string;
  isCompleted: boolean;
}

// --- Example: Feature Highlight Step ---
export interface FeatureHighlightStepPayload {
  elementSelector?: string;
  highlightPosition?: "top" | "bottom" | "left" | "right" | "center" | "auto";
  text: string;
  imageUrl?: string;
  beacon?: boolean;
}

// --- Example: Video Tutorial Step ---
export interface VideoTutorialStepPayload {
  videoUrl: string;
  caption?: string;
  autoPlay?: boolean;
  showControls?: boolean;
}

// --- Example: Confirmation Step ---
export interface ConfirmationStepPayload {
  confirmationTitle?: string;
  confirmationMessage: string;
  details?: Array<{ label: string; value: string | (() => string) }>;
  showDataSummary?: boolean | string[];
}

// --- For Custom Components (interpreted by the UI package) ---
export interface CustomComponentStepPayload {
  componentKey: string;
  [key: string]: any;
}

// --- Welcome Step with Input Fields ---
export interface WelcomeInputFormStepPayload {
  mainHeading: string;
  introductionText?: string;
  imageUrl?: string;
  imageAlt?: string;
  nameField: {
    label: string;
    placeholder?: string;
    dataKey: string;
    validation?: {
      required?: boolean | string;
      minLength?: { value: number; message: string };
    };
  };
  companyField: {
    label: string;
    placeholder?: string;
    dataKey: string;
    validation?: {
      required?: boolean | string;
      minLength?: { value: number; message: string };
    };
  };
}
