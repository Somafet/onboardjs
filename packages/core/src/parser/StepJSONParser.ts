// @onboardjs/core/src/utils/StepJSONParser.ts

import {
  OnboardingStep,
  OnboardingContext,
  OnboardingStepType,
  MultipleChoiceStepPayload,
  SingleChoiceStepPayload,
  CustomComponentStepPayload,
  ChecklistStepPayload,
} from "../types";
import {
  StepJSONParserOptions,
  ParseResult,
  StepJSONSchema,
  SerializedStep,
  SerializedFunction,
  SerializedPayload,
  SerializedInformationPayload,
  SerializedMultipleChoicePayload,
  SerializedSingleChoicePayload,
  SerializedConfirmationPayload,
  SerializedCustomComponentPayload,
  SerializedChecklistPayload,
  SerializedChoiceOption,
  SerializedChecklistItem,
  ExportData,
} from "./types";

export class StepJSONParser {
  private static readonly VERSION = "1.0.0";
  private static readonly DEFAULT_OPTIONS: StepJSONParserOptions = {
    functionHandling: "serialize",
    includeMeta: true,
    validateSteps: true,
    preserveTypes: true,
    prettyPrint: false,
    includeValidationErrors: false,
  };

  /**
   * Serialize OnboardingStep[] to JSON string
   */
  static toJSON<TContext extends OnboardingContext = OnboardingContext>(
    steps: OnboardingStep<TContext>[],
    options: Partial<StepJSONParserOptions> = {},
  ): ParseResult<string> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate steps if requested
      if (opts.validateSteps) {
        const validationResult = this.validateSteps(steps);
        errors.push(...validationResult.errors);
        warnings.push(...validationResult.warnings);

        if (
          validationResult.errors.length > 0 &&
          !opts.includeValidationErrors
        ) {
          return {
            success: false,
            errors,
            warnings,
          };
        }
      }

      // Serialize steps
      const serializedSteps = steps.map((step, index) =>
        this.serializeStep(step, index, opts, errors, warnings),
      );

      // Create schema
      const schema: StepJSONSchema = {
        version: this.VERSION,
        steps: serializedSteps,
        metadata: {
          exportedAt: new Date().toISOString(),
          totalSteps: steps.length,
          stepTypes: [...new Set(steps.map((s) => s.type || "INFORMATION"))],
          hasCustomComponents: steps.some((s) => s.type === "CUSTOM_COMPONENT"),
          hasFunctions: this.hasAnyFunctions(steps),
        },
      };

      const jsonString = opts.prettyPrint
        ? JSON.stringify(schema, null, 2)
        : JSON.stringify(schema);

      return {
        success: errors.length === 0,
        data: jsonString,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push(
        `Serialization failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        errors,
        warnings,
      };
    }
  }

  /**
   * Deserialize JSON string to OnboardingStep[]
   */
  static fromJSON<TContext extends OnboardingContext = OnboardingContext>(
    jsonString: string,
    options: Partial<StepJSONParserOptions> = {},
  ): ParseResult<OnboardingStep<TContext>[]> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Parse JSON
      const schema = JSON.parse(jsonString) as StepJSONSchema;

      // Validate schema
      const schemaValidation = this.validateSchema(schema);
      errors.push(...schemaValidation.errors);
      warnings.push(...schemaValidation.warnings);

      if (schemaValidation.errors.length > 0) {
        return {
          success: false,
          errors,
          warnings,
        };
      }

      // Deserialize steps
      const steps = schema.steps
        .map((serializedStep, index) =>
          this.deserializeStep<TContext>(
            serializedStep,
            index,
            opts,
            errors,
            warnings,
          ),
        )
        .filter((step): step is OnboardingStep<TContext> => step !== null);

      // Validate deserialized steps if requested
      if (opts.validateSteps) {
        const validationResult = this.validateSteps(steps);
        errors.push(...validationResult.errors);
        warnings.push(...validationResult.warnings);
      }

      return {
        success: errors.length === 0,
        data: steps,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push(
        `Deserialization failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        errors,
        warnings,
      };
    }
  }

  // =============================================================================
  // STEP SERIALIZATION
  // =============================================================================

  private static serializeStep<TContext extends OnboardingContext>(
    step: OnboardingStep<TContext>,
    index: number,
    options: StepJSONParserOptions,
    errors: string[],
    warnings: string[],
  ): SerializedStep {
    try {
      const serialized: SerializedStep = {
        id: step.id,
      };

      // Handle type
      if (step.type) {
        serialized.type = step.type;
      }

      // Handle navigation properties
      serialized.nextStep = this.serializeStepProperty(
        step.nextStep,
        "nextStep",
        step.id,
        options,
      );
      serialized.previousStep = this.serializeStepProperty(
        step.previousStep,
        "previousStep",
        step.id,
        options,
      );

      // Handle skippable properties
      if (step.isSkippable !== undefined) {
        serialized.isSkippable = step.isSkippable;
        if (step.isSkippable && (step as any).skipToStep !== undefined) {
          serialized.skipToStep = this.serializeStepProperty(
            (step as any).skipToStep,
            "skipToStep",
            step.id,
            options,
          );
        }
      }

      // Handle function properties
      if (step.onStepActive && options.functionHandling !== "omit") {
        serialized.onStepActive = this.serializeFunction(
          step.onStepActive,
          "onStepActive",
          step.id,
          options,
        );
      }

      if (step.onStepComplete && options.functionHandling !== "omit") {
        serialized.onStepComplete = this.serializeFunction(
          step.onStepComplete,
          "onStepComplete",
          step.id,
          options,
        );
      }

      if (step.condition && options.functionHandling !== "omit") {
        serialized.condition = this.serializeFunction(
          step.condition,
          "condition",
          step.id,
          options,
        );
      }

      // Handle payload
      if (step.payload) {
        serialized.payload = this.serializePayload(
          step,
          options,
          errors,
          warnings,
        );
      }

      // Handle metadata
      if (options.includeMeta && step.meta) {
        serialized.meta = { ...step.meta };
      }

      // Handle type preservation
      if (options.preserveTypes) {
        serialized.__type = step.type || "INFORMATION";
        serialized.__version = this.VERSION;
      }

      return serialized;
    } catch (error) {
      errors.push(
        `Failed to serialize step ${step.id} at index ${index}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Return minimal valid step
      return {
        id: step.id,
        type: step.type,
      };
    }
  }

  private static serializeStepProperty(
    property: any,
    propertyName: string,
    stepId: string | number,
    options: StepJSONParserOptions,
  ): string | number | null | SerializedFunction | undefined {
    if (property === undefined) return undefined;
    if (property === null) return null;
    if (typeof property === "string" || typeof property === "number") {
      return property;
    }
    if (typeof property === "function") {
      if (options.functionHandling === "omit") return undefined;
      return this.serializeFunction(property, propertyName, stepId, options);
    }
    return property;
  }

  private static serializeFunction(
    fn: Function,
    propertyName: string,
    stepId: string | number,
    options: StepJSONParserOptions,
  ): SerializedFunction {
    if (options.functionHandling === "placeholder") {
      return {
        __isFunction: true,
        __functionBody: `// Placeholder for ${propertyName} function`,
        __functionName: fn.name || propertyName,
      };
    }

    if (options.customFunctionSerializer) {
      const customSerialized = options.customFunctionSerializer(
        fn,
        propertyName,
        stepId,
      );
      return {
        __isFunction: true,
        __functionBody: customSerialized,
        __functionName: fn.name || propertyName,
      };
    }

    // Default serialization
    const functionString = fn.toString();
    const parameters = this.extractFunctionParameters(functionString);

    return {
      __isFunction: true,
      __functionBody: functionString,
      __functionName: fn.name || propertyName,
      __parameters: parameters,
    };
  }

  private static serializePayload<TContext extends OnboardingContext>(
    step: OnboardingStep<TContext>,
    options: StepJSONParserOptions,
    errors: string[],
    warnings: string[],
  ): SerializedPayload | undefined {
    if (!step.payload) return undefined;

    const stepType = step.type || "INFORMATION";

    try {
      switch (stepType) {
        case "INFORMATION":
          return {
            ...step.payload,
            __payloadType: "INFORMATION",
          } as SerializedInformationPayload;

        case "MULTIPLE_CHOICE":
          const mcPayload = step.payload as MultipleChoiceStepPayload;
          return {
            ...mcPayload,
            __payloadType: "MULTIPLE_CHOICE",
            options:
              mcPayload.options?.map((opt) => ({
                ...opt,
                value: opt.value,
              })) || [],
          } as SerializedMultipleChoicePayload;

        case "SINGLE_CHOICE":
          const scPayload = step.payload as SingleChoiceStepPayload;
          return {
            ...scPayload,
            __payloadType: "SINGLE_CHOICE",
            options:
              scPayload.options?.map((opt) => ({
                ...opt,
                value: opt.value,
              })) || [],
          } as SerializedSingleChoicePayload;

        case "CONFIRMATION":
          return {
            ...step.payload,
            __payloadType: "CONFIRMATION",
          } as SerializedConfirmationPayload;

        case "CUSTOM_COMPONENT":
          return {
            ...step.payload,
            __payloadType: "CUSTOM_COMPONENT",
          } as SerializedCustomComponentPayload;

        case "CHECKLIST":
          const clPayload = step.payload as ChecklistStepPayload<TContext>;
          return {
            ...clPayload,
            __payloadType: "CHECKLIST",
            items:
              clPayload.items?.map((item) => ({
                id: item.id,
                label: item.label,
                description: item.description,
                isMandatory: item.isMandatory,
                condition:
                  item.condition && options.functionHandling !== "omit"
                    ? this.serializeFunction(
                        item.condition,
                        "condition",
                        step.id,
                        options,
                      )
                    : undefined,
                meta: item.meta,
              })) || [],
          } as SerializedChecklistPayload<TContext>;

        default:
          warnings.push(`Unknown step type '${stepType}' for step ${step.id}`);
          return step.payload as any;
      }
    } catch (error) {
      errors.push(
        `Failed to serialize payload for step ${step.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }

  private static deserializeStep<TContext extends OnboardingContext>(
    serializedStep: SerializedStep,
    index: number,
    options: StepJSONParserOptions,
    errors: string[],
    warnings: string[],
  ): OnboardingStep<TContext> | null {
    try {
      const step: Partial<OnboardingStep<TContext>> = {
        id: serializedStep.id,
      };

      // Handle type
      if (serializedStep.type) {
        (step as any).type = serializedStep.type;
      }

      // Handle navigation properties
      step.nextStep = this.deserializeStepProperty(
        serializedStep.nextStep,
        "nextStep",
        serializedStep.id,
        options,
      ) as any;

      step.previousStep = this.deserializeStepProperty(
        serializedStep.previousStep,
        "previousStep",
        serializedStep.id,
        options,
      ) as any;

      // Handle skippable properties
      if (serializedStep.isSkippable !== undefined) {
        (step as any).isSkippable = serializedStep.isSkippable;
        if (
          serializedStep.isSkippable &&
          serializedStep.skipToStep !== undefined
        ) {
          (step as any).skipToStep = this.deserializeStepProperty(
            serializedStep.skipToStep,
            "skipToStep",
            serializedStep.id,
            options,
          );
        }
      }

      // Handle function properties
      if (serializedStep.onStepActive) {
        step.onStepActive = this.deserializeFunction(
          serializedStep.onStepActive,
          "onStepActive",
          serializedStep.id,
          options,
        ) as any;
      }

      if (serializedStep.onStepComplete) {
        step.onStepComplete = this.deserializeFunction(
          serializedStep.onStepComplete,
          "onStepComplete",
          serializedStep.id,
          options,
        ) as any;
      }

      if (serializedStep.condition) {
        step.condition = this.deserializeFunction(
          serializedStep.condition,
          "condition",
          serializedStep.id,
          options,
        ) as any;
      }

      // Handle payload
      if (serializedStep.payload) {
        step.payload = this.deserializePayload<TContext>(
          serializedStep.payload,
          serializedStep.type,
          options,
          errors,
          warnings,
        );
      }

      // Handle metadata
      if (serializedStep.meta) {
        step.meta = { ...serializedStep.meta };
      }

      return step as OnboardingStep<TContext>;
    } catch (error) {
      errors.push(
        `Failed to deserialize step at index ${index}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private static deserializeStepProperty(
    property: any,
    propertyName: string,
    stepId: string | number,
    options: StepJSONParserOptions,
  ): any {
    if (property === undefined || property === null) return property;
    if (typeof property === "string" || typeof property === "number") {
      return property;
    }
    if (this.isSerializedFunction(property)) {
      return this.deserializeFunction(property, propertyName, stepId, options);
    }
    return property;
  }

  private static deserializeFunction(
    serializedFunction: SerializedFunction,
    propertyName: string,
    stepId: string | number,
    options: StepJSONParserOptions,
  ): Function {
    if (options.customFunctionDeserializer) {
      return options.customFunctionDeserializer(
        serializedFunction.__functionBody,
        propertyName,
        stepId,
      );
    }

    try {
      // Create function from string
      // This is a security risk in production - consider alternatives
      return new Function(`return ${serializedFunction.__functionBody}`)();
    } catch (error) {
      console.warn(
        `Failed to deserialize function ${propertyName} for step ${stepId}:`,
        error,
      );
      // Return a no-op function as fallback
      return () => {};
    }
  }

  private static deserializePayload<TContext extends OnboardingContext>(
    serializedPayload: SerializedPayload,
    stepType?: OnboardingStepType,
    options?: StepJSONParserOptions,
    errors?: string[],
    warnings?: string[],
  ): any {
    const payloadType =
      (serializedPayload as any).__payloadType || stepType || "INFORMATION";

    try {
      switch (payloadType) {
        case "INFORMATION":
          const infoPayload = { ...serializedPayload };
          delete (infoPayload as any).__payloadType;
          return infoPayload;

        case "MULTIPLE_CHOICE":
        case "SINGLE_CHOICE":
          const choicePayload = { ...serializedPayload } as any;
          delete choicePayload.__payloadType;
          if (choicePayload.options) {
            choicePayload.options = choicePayload.options.map(
              (opt: SerializedChoiceOption) => ({
                ...opt,
                value: opt.value,
              }),
            );
          }
          return choicePayload;

        case "CONFIRMATION":
          const confirmPayload = { ...serializedPayload };
          delete (confirmPayload as any).__payloadType;
          return confirmPayload;

        case "CUSTOM_COMPONENT":
          const customPayload = { ...serializedPayload };
          delete (customPayload as any).__payloadType;
          return customPayload;

        case "CHECKLIST":
          const checklistPayload = { ...serializedPayload } as any;
          delete checklistPayload.__payloadType;
          if (checklistPayload.items) {
            checklistPayload.items = checklistPayload.items.map(
              (item: SerializedChecklistItem) => ({
                id: item.id,
                label: item.label,
                description: item.description,
                isMandatory: item.isMandatory,
                condition:
                  item.condition && this.isSerializedFunction(item.condition)
                    ? this.deserializeFunction(
                        item.condition,
                        "condition",
                        item.id,
                        options!,
                      )
                    : undefined,
                meta: item.meta,
              }),
            );
          }
          return checklistPayload;

        default:
          warnings?.push(`Unknown payload type '${payloadType}'`);
          return serializedPayload;
      }
    } catch (error) {
      errors?.push(
        `Failed to deserialize payload of type '${payloadType}': ${error instanceof Error ? error.message : String(error)}`,
      );
      return serializedPayload;
    }
  }

  private static isSerializedFunction(obj: any): obj is SerializedFunction {
    return obj && typeof obj === "object" && obj.__isFunction === true;
  }

  private static extractFunctionParameters(functionString: string): string[] {
    try {
      const match = functionString.match(/\(([^)]*)\)/);
      if (!match || !match[1]) return [];

      return match[1]
        .split(",")
        .map((param) => param.trim())
        .filter((param) => param.length > 0);
    } catch {
      return [];
    }
  }

  private static hasAnyFunctions<TContext extends OnboardingContext>(
    steps: OnboardingStep<TContext>[],
  ): boolean {
    return steps.some(
      (step) =>
        typeof step.nextStep === "function" ||
        typeof step.previousStep === "function" ||
        typeof (step as any).skipToStep === "function" ||
        typeof step.onStepActive === "function" ||
        typeof step.onStepComplete === "function" ||
        typeof step.condition === "function" ||
        (step.type === "CHECKLIST" &&
          (step.payload as ChecklistStepPayload<TContext>)?.items?.some(
            (item) => typeof item.condition === "function",
          )),
    );
  }

  private static validateSteps<TContext extends OnboardingContext>(
    steps: OnboardingStep<TContext>[],
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const stepIds = new Set<string | number>();

    if (!steps || steps.length === 0) {
      warnings.push("No steps provided");
      return { errors, warnings };
    }

    steps.forEach((step, index) => {
      // Check for required properties
      if (!step.id) {
        errors.push(`Step at index ${index} is missing required 'id' property`);
        return;
      }

      // Check for duplicate IDs
      if (stepIds.has(step.id)) {
        errors.push(`Duplicate step ID found: '${step.id}'`);
      }
      stepIds.add(step.id);

      // Validate step type
      const validTypes: OnboardingStepType[] = [
        "INFORMATION",
        "MULTIPLE_CHOICE",
        "SINGLE_CHOICE",
        "CONFIRMATION",
        "CUSTOM_COMPONENT",
        "CHECKLIST",
      ];

      if (step.type && !validTypes.includes(step.type)) {
        warnings.push(`Step '${step.id}' has unknown type '${step.type}'`);
      }

      // Validate payload based on type
      this.validateStepPayload(step, errors, warnings);
    });

    return { errors, warnings };
  }

  private static validateStepPayload<TContext extends OnboardingContext>(
    step: OnboardingStep<TContext>,
    errors: string[],
    warnings: string[],
  ): void {
    if (!step.payload) {
      if (step.type && !["INFORMATION", "CONFIRMATION"].includes(step.type)) {
        warnings.push(
          `Step '${step.id}' of type '${step.type}' is missing payload`,
        );
      }
      return;
    }

    switch (step.type) {
      case "MULTIPLE_CHOICE":
      case "SINGLE_CHOICE":
        const choicePayload = step.payload as
          | MultipleChoiceStepPayload
          | SingleChoiceStepPayload;
        if (
          !choicePayload.options ||
          !Array.isArray(choicePayload.options) ||
          choicePayload.options.length === 0
        ) {
          errors.push(
            `Step '${step.id}' of type '${step.type}' must have non-empty options array`,
          );
        }
        break;

      case "CHECKLIST":
        const checklistPayload = step.payload as ChecklistStepPayload<TContext>;
        if (
          !checklistPayload.items ||
          !Array.isArray(checklistPayload.items) ||
          checklistPayload.items.length === 0
        ) {
          errors.push(
            `Step '${step.id}' of type 'CHECKLIST' must have non-empty items array`,
          );
        }
        if (!checklistPayload.dataKey) {
          errors.push(
            `Step '${step.id}' of type 'CHECKLIST' must have dataKey property`,
          );
        }
        break;

      case "CUSTOM_COMPONENT":
        const customPayload = step.payload as CustomComponentStepPayload;
        if (!customPayload.componentKey) {
          warnings.push(
            `Step '${step.id}' of type 'CUSTOM_COMPONENT' should have componentKey`,
          );
        }
        break;
    }
  }

  private static validateSchema(schema: any): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!schema) {
      errors.push("Schema is null or undefined");
      return { errors, warnings };
    }

    if (!schema.version) {
      warnings.push("Schema is missing version information");
    }

    if (!schema.steps || !Array.isArray(schema.steps)) {
      errors.push("Schema must contain a 'steps' array");
      return { errors, warnings };
    }

    if (schema.steps.length === 0) {
      warnings.push("Schema contains no steps");
    }

    return { errors, warnings };
  }

  // =============================================================================
  // CONVENIENCE METHODS
  // =============================================================================

  /**
   * Quick serialize with default options
   */
  static serialize<TContext extends OnboardingContext = OnboardingContext>(
    steps: OnboardingStep<TContext>[],
    prettyPrint: boolean = false,
  ): string | null {
    const result = this.toJSON(steps, { prettyPrint });
    return result.success ? result.data! : null;
  }

  /**
   * Quick deserialize with default options
   */
  static deserialize<TContext extends OnboardingContext = OnboardingContext>(
    jsonString: string,
  ): OnboardingStep<TContext>[] | null {
    const result = this.fromJSON<TContext>(jsonString);
    return result.success ? result.data! : null;
  }

  /**
   * Create a copy of steps (serialize then deserialize)
   */
  static clone<TContext extends OnboardingContext = OnboardingContext>(
    steps: OnboardingStep<TContext>[],
  ): OnboardingStep<TContext>[] | null {
    const serialized = this.serialize(steps);
    return serialized ? this.deserialize<TContext>(serialized) : null;
  }

  /**
   * Prepares step data for export by serializing it to a JSON string.
   * This method is UI-agnostic and does not perform any DOM operations.
   *
   * @returns A ParseResult containing the data needed to create a file for download.
   */
  static getExportableData<
    TContext extends OnboardingContext = OnboardingContext,
  >(
    steps: OnboardingStep<TContext>[],
    filename: string = "onboarding-steps.json",
    options: Partial<StepJSONParserOptions> = {},
  ): ParseResult<ExportData> {
    const result = this.toJSON(steps, { ...options, prettyPrint: true });

    if (!result.success || !result.data) {
      // Forward the errors and warnings from the toJSON call
      return {
        success: false,
        errors: result.errors,
        warnings: result.warnings,
      };
    }

    return {
      success: true,
      data: {
        filename,
        mimeType: "application/json",
        content: result.data,
      },
      errors: [],
      warnings: [],
    };
  }
}

// =============================================================================
// TYPE GUARDS AND UTILITIES
// =============================================================================

export namespace StepJSONParserUtils {
  export function isValidStepJSON(json: string): boolean {
    try {
      const parsed = JSON.parse(json);
      return (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray(parsed.steps) &&
        parsed.steps.length > 0
      );
    } catch {
      return false;
    }
  }

  export function getStepTypesFromJSON(json: string): OnboardingStepType[] {
    try {
      const parsed = JSON.parse(json) as StepJSONSchema;
      return parsed.steps.map((step) => step.type || "INFORMATION");
    } catch {
      return [];
    }
  }

  export function getStepIdsFromJSON(json: string): (string | number)[] {
    try {
      const parsed = JSON.parse(json) as StepJSONSchema;
      return parsed.steps.map((step) => step.id);
    } catch {
      return [];
    }
  }

  export function hasCustomComponents(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as StepJSONSchema;
      return (
        parsed.metadata?.hasCustomComponents ||
        parsed.steps.some((step) => step.type === "CUSTOM_COMPONENT")
      );
    } catch {
      return false;
    }
  }

  export function hasFunctions(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as StepJSONSchema;
      return (
        parsed.metadata?.hasFunctions ||
        parsed.steps.some(
          (step) =>
            StepJSONParser["isSerializedFunction"](step.nextStep) ||
            StepJSONParser["isSerializedFunction"](step.previousStep) ||
            StepJSONParser["isSerializedFunction"](step.skipToStep) ||
            StepJSONParser["isSerializedFunction"](step.onStepActive) ||
            StepJSONParser["isSerializedFunction"](step.onStepComplete) ||
            StepJSONParser["isSerializedFunction"](step.condition),
        )
      );
    } catch {
      return false;
    }
  }
}

export default StepJSONParser;
