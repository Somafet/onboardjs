import { OnboardingContext } from "./common";

export interface BasePayload {
  [key: string]: any;
}
export interface InformationStepPayload extends BasePayload {
  mainText: string;
  subText?: string;
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
    allFormData: Record<string, any>,
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

// --- Example: Multiple Choice Selection Step ---
export interface ChoiceOption<TValue = string | number> {
  id: string;
  label: string;
  value: TValue;
  description?: string;
  icon?: string;
}

export interface MultipleChoiceStepPayload extends BasePayload {
  question: string;
  options: ChoiceOption[];
  minSelections?: number;
  maxSelections?: number;
  dataKey: string;
}

// --- Example: Single Choice Selection Step ---
export interface SingleChoiceStepPayload extends BasePayload {
  question: string;
  options: ChoiceOption[];
  dataKey: string;
}

/** Defines the structure of an item in a checklist step's payload. */
export interface ChecklistItemDefinition<
  TContext extends OnboardingContext = OnboardingContext,
> {
  id: string; // Unique identifier for the item within this checklist
  label: string;
  description?: string;
  isMandatory?: boolean; // Defaults to true if not specified by the engine's logic
  /** Optional condition to determine if this item should be shown/considered. */
  condition?: (context: TContext) => boolean; // Use TContext
  meta?: Record<string, any>; // For custom data per item
}

/** Payload for a checklist step. */
export interface ChecklistStepPayload<
  TContext extends OnboardingContext = OnboardingContext,
> extends BasePayload {
  /** An array of item definitions for the checklist. */
  items: ChecklistItemDefinition<TContext>[]; // Use generic ChecklistItemDefinition
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

// --- Example: Confirmation Step ---
export interface ConfirmationStepPayload extends BasePayload {
  confirmationTitle?: string;
  confirmationMessage: string;
  details?: Array<{ label: string; value: string | (() => string) }>;
  showDataSummary?: boolean | string[];
}

// --- For Custom Components (interpreted by the UI package) ---
export interface CustomComponentStepPayload extends BasePayload {
  componentKey: string;
}
