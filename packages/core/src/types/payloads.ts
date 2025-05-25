// @onboardjs/core/src/types/payloads.ts

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
