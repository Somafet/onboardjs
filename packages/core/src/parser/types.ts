import {
  OnboardingStepType,
  InformationStepPayload,
  MultipleChoiceStepPayload,
  SingleChoiceStepPayload,
  ConfirmationStepPayload,
  CustomComponentStepPayload,
  OnboardingContext,
  ChecklistStepPayload,
  ChoiceOption,
} from "../types";

export interface StepJSONParserOptions {
  /**
   * How to handle functions during serialization
   * - 'serialize': Convert functions to string representations
   * - 'omit': Remove function properties from JSON
   * - 'placeholder': Replace with placeholder strings
   */
  functionHandling: "serialize" | "omit" | "placeholder";

  /**
   * Whether to include metadata in the JSON output
   */
  includeMeta: boolean;

  /**
   * Whether to validate steps during parsing
   */
  validateSteps: boolean;

  /**
   * Custom function serializer
   */
  customFunctionSerializer?: (
    fn: Function,
    propertyName: string,
    stepId: string | number,
  ) => string;

  /**
   * Custom function deserializer
   */
  customFunctionDeserializer?: (
    fnString: string,
    propertyName: string,
    stepId: string | number,
  ) => Function;

  /**
   * Whether to preserve type information in JSON
   */
  preserveTypes: boolean;

  /**
   * Pretty print JSON output
   */
  prettyPrint: boolean;

  /**
   * Include validation errors in output
   */
  includeValidationErrors: boolean;
}

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  errors: string[];
  warnings: string[];
}

export interface SerializedStep {
  // Core properties
  id: string | number;
  type?: OnboardingStepType;

  // Navigation properties (can be functions serialized as strings)
  nextStep?: string | number | null | SerializedFunction;
  previousStep?: string | number | null | SerializedFunction;
  skipToStep?: string | number | null | SerializedFunction;

  // Boolean properties
  isSkippable?: boolean;

  // Function properties
  onStepActive?: SerializedFunction;
  onStepComplete?: SerializedFunction;
  condition?: SerializedFunction;

  // Payload and metadata
  payload?: SerializedPayload;
  meta?: Record<string, any>;

  // Type preservation
  __type?: string;
  __version?: string;
}

export interface SerializedFunction {
  __isFunction: true;
  __functionBody: string;
  __functionName?: string;
  __parameters?: string[];
}

export type SerializedPayload =
  | SerializedInformationPayload
  | SerializedMultipleChoicePayload
  | SerializedSingleChoicePayload
  | SerializedConfirmationPayload
  | SerializedCustomComponentPayload
  | SerializedChecklistPayload;

export interface SerializedInformationPayload extends InformationStepPayload {
  __payloadType: "INFORMATION";
}

export interface SerializedMultipleChoicePayload
  extends Omit<MultipleChoiceStepPayload, "options"> {
  __payloadType: "MULTIPLE_CHOICE";
  options: SerializedChoiceOption[];
}

export interface SerializedSingleChoicePayload
  extends Omit<SingleChoiceStepPayload, "options"> {
  __payloadType: "SINGLE_CHOICE";
  options: SerializedChoiceOption[];
}

export interface SerializedConfirmationPayload extends ConfirmationStepPayload {
  __payloadType: "CONFIRMATION";
}

export interface SerializedCustomComponentPayload
  extends CustomComponentStepPayload {
  __payloadType: "CUSTOM_COMPONENT";
}

export interface SerializedChecklistPayload<
  TContext extends OnboardingContext = OnboardingContext,
> extends Omit<ChecklistStepPayload<TContext>, "items"> {
  __payloadType: "CHECKLIST";
  items: SerializedChecklistItem[];
}

export interface SerializedChoiceOption extends Omit<ChoiceOption, "value"> {
  value: string | number;
}

export interface SerializedChecklistItem {
  id: string;
  label: string;
  description?: string;
  isMandatory?: boolean;
  condition?: SerializedFunction;
  meta?: Record<string, unknown>;
}

export interface StepJSONSchema {
  version: string;
  steps: SerializedStep[];
  metadata?: {
    exportedAt: string;
    totalSteps: number;
    stepTypes: string[];
    hasCustomComponents: boolean;
    hasFunctions: boolean;
  };
}

export interface ExportData {
  filename: string;
  mimeType: "application/json";
  content: string;
}
