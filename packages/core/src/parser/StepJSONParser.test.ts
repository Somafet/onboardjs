import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import StepJSONParser, { StepJSONParserUtils } from "./StepJSONParser";
import { OnboardingStep } from "../types";
import { StepJSONParserOptions } from "./types";

const mockSteps: OnboardingStep[] = [
  {
    id: "welcome",
    type: "INFORMATION",
    payload: {
      title: "Welcome!",
      content: "This is the start of your journey.",
    },
    meta: { author: "Soma" },
    nextStep: "choose-path",
  },
  {
    id: "choose-path",
    type: "SINGLE_CHOICE",
    payload: {
      title: "Choose Your Path",
      options: [
        { id: "dev", label: "Developer", value: "dev" },
        { id: "design", label: "Designer", value: "design" },
      ],
    },
    nextStep: (context) =>
      context.data["choose-path"] === "dev" ? "dev-tools" : "design-tools",
  },
  {
    id: "dev-tools",
    type: "CHECKLIST",
    payload: {
      title: "Select Your Tools",
      dataKey: "devtools",
      items: [
        { id: "vscode", label: "VS Code" },
        { id: "git", label: "Git", isMandatory: true },
        {
          id: "docker",
          label: "Docker",
          condition: (context) => context.user.isPro,
        },
      ],
    },
    onStepComplete: () => {
      console.log("Dev tools selected");
    },
  },
  {
    id: "custom-comp",
    type: "CUSTOM_COMPONENT",
    payload: {
      componentKey: "UserProfileForm",
    },
    isSkippable: true,
    skipToStep: "final",
  },
  {
    id: "final",
    type: "CONFIRMATION",
    payload: {
      title: "All Done!",
    },
  },
];

describe("StepJSONParser", () => {
  describe("Core Serialization (toJSON)", () => {
    it("should serialize steps to a JSON string with default options", () => {
      const result = StepJSONParser.toJSON(mockSteps);
      expect(result.success).toBe(true);
      expect(typeof result.data).toBe("string");
      const parsed = JSON.parse(result.data!);
      expect(parsed.version).toBe("1.0.0");
      expect(parsed.steps).toHaveLength(mockSteps.length);
      expect(parsed.metadata).toBeDefined();
    });

    it("should pretty-print JSON when prettyPrint is true", () => {
      const result = StepJSONParser.toJSON(mockSteps, { prettyPrint: true });
      expect(result.data).toContain("\n");
      expect(result.data).toContain("  ");
    });

    it("should omit metadata when includeMeta is false", () => {
      const result = StepJSONParser.toJSON(mockSteps, { includeMeta: false });
      const serialized = JSON.parse(result.data!);
      const step = serialized.steps.find((s: any) => s.id === "welcome");
      expect(step.meta).toBeUndefined();
    });

    it("should handle functions with 'serialize' option", () => {
      const result = StepJSONParser.toJSON(mockSteps, {
        functionHandling: "serialize",
      });
      const parsed = JSON.parse(result.data!);
      const choosePathStep = parsed.steps.find(
        (s: any) => s.id === "choose-path",
      );
      expect(choosePathStep.nextStep.__isFunction).toBe(true);
      expect(choosePathStep.nextStep.__functionBody).toContain(
        'context.data["choose-path"]',
      );
    });

    it("should handle functions with 'omit' option", () => {
      const result = StepJSONParser.toJSON(mockSteps, {
        functionHandling: "omit",
      });
      const parsed = JSON.parse(result.data!);
      const choosePathStep = parsed.steps.find(
        (s: any) => s.id === "choose-path",
      );
      const devToolsStep = parsed.steps.find((s: any) => s.id === "dev-tools");
      expect(choosePathStep.nextStep).toBeUndefined();
      expect(devToolsStep.onStepComplete).toBeUndefined();
    });

    it("should handle functions with 'placeholder' option", () => {
      const result = StepJSONParser.toJSON(mockSteps, {
        functionHandling: "placeholder",
      });
      const parsed = JSON.parse(result.data!);
      const choosePathStep = parsed.steps.find(
        (s: any) => s.id === "choose-path",
      );
      expect(choosePathStep.nextStep.__isFunction).toBe(true);
      expect(choosePathStep.nextStep.__functionBody).toContain("Placeholder");
    });

    it("should use a custom function serializer", () => {
      const customSerializer = vi.fn(
        (fn, propName, stepId) => `CUSTOMIZED::${stepId}::${propName}`,
      );
      const result = StepJSONParser.toJSON(mockSteps, {
        customFunctionSerializer: customSerializer,
      });
      const parsed = JSON.parse(result.data!);
      const choosePathStep = parsed.steps.find(
        (s: any) => s.id === "choose-path",
      );
      expect(customSerializer).toHaveBeenCalled();
      expect(choosePathStep.nextStep.__functionBody).toBe(
        "CUSTOMIZED::choose-path::nextStep",
      );
    });
  });

  describe("Core Deserialization (fromJSON)", () => {
    let serializedJSON: string;

    beforeAll(() => {
      const result = StepJSONParser.toJSON(mockSteps);
      serializedJSON = result.data!;
    });

    it("should deserialize a JSON string to an array of steps", () => {
      const result = StepJSONParser.fromJSON(serializedJSON);
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data).toHaveLength(mockSteps.length);
      const welcomeStep = result.data!.find((s) => s.id === "welcome");
      expect(welcomeStep?.meta).toEqual({ author: "Soma" });
    });

    it("should correctly deserialize functions", () => {
      const result = StepJSONParser.fromJSON(serializedJSON);
      const choosePathStep = result.data!.find((s) => s.id === "choose-path");
      const devToolsStep = result.data!.find((s) => s.id === "dev-tools");

      expect(typeof choosePathStep?.nextStep).toBe("function");
      expect(typeof devToolsStep?.onStepComplete).toBe("function");

      // Test the deserialized function's logic
      const mockContext = { data: { "choose-path": "dev" } };
      expect((choosePathStep!.nextStep as Function)(mockContext)).toBe(
        "dev-tools",
      );
    });

    it("should use a custom function deserializer", () => {
      const customDeserializer = vi.fn(
        (fnString, propName, stepId) => () => `DESERIALIZED::${stepId}`,
      );
      const result = StepJSONParser.fromJSON(serializedJSON, {
        customFunctionDeserializer: customDeserializer,
      });
      expect(customDeserializer).toHaveBeenCalled();
      const choosePathStep = result.data!.find((s) => s.id === "choose-path");
      const deserializedFn = choosePathStep!.nextStep as Function;
      expect(deserializedFn()).toBe("DESERIALIZED::choose-path");
    });

    it("should handle invalid JSON gracefully", () => {
      const result = StepJSONParser.fromJSON("{ not json }");
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Deserialization failed");
    });

    it("should handle JSON with missing 'steps' array", () => {
      const result = StepJSONParser.fromJSON('{ "version": "1.0.0" }');
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("Schema must contain a 'steps' array");
    });
  });

  describe("End-to-End (Serialization -> Deserialization)", () => {
    it("should produce a near-identical object after a full cycle", () => {
      const result = StepJSONParser.toJSON(mockSteps);
      expect(result.success).toBe(true);

      const deserializedResult = StepJSONParser.fromJSON(result.data!);
      expect(deserializedResult.success).toBe(true);

      const original = mockSteps;
      const final = deserializedResult.data!;

      expect(final).toHaveLength(original.length);

      // Check properties, accounting for functions
      final.forEach((finalStep, i) => {
        const originalStep = original[i];
        expect(finalStep.id).toBe(originalStep.id);
        expect(finalStep.type).toBe(originalStep.type);
        expect(finalStep.payload?.title).toBe(originalStep.payload?.title);

        // Check for function properties
        if (typeof originalStep.nextStep === "function") {
          expect(finalStep.nextStep).toEqual(expect.any(Function));
        } else {
          expect(finalStep.nextStep).toBe(originalStep.nextStep);
        }

        if (typeof originalStep.onStepComplete === "function") {
          expect(finalStep.onStepComplete).toEqual(expect.any(Function));
        }
      });
    });
  });

  describe("Validation Logic", () => {
    it("should fail serialization if a step has a duplicate ID", () => {
      const invalidSteps = [
        { id: "step1", type: "INFORMATION" },
        { id: "step1", type: "CONFIRMATION" },
      ];
      const result = StepJSONParser.toJSON(invalidSteps as any);
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("Duplicate step ID found: 'step1'");
    });

    it("should fail serialization if a step is missing an ID", () => {
      const invalidSteps = [{ type: "INFORMATION" }];
      const result = StepJSONParser.toJSON(invalidSteps as any);
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("missing required 'id' property");
    });

    it("should succeed serialization with invalid steps if validateSteps is false", () => {
      const invalidSteps = [{ id: "step1" }, { id: "step1" }];
      const result = StepJSONParser.toJSON(invalidSteps as any, {
        validateSteps: false,
      });
      expect(result.success).toBe(true);
    });

    it("should include validation errors in output if requested", () => {
      const invalidSteps = [{ id: "step1" }, { id: "step1" }];
      const result = StepJSONParser.toJSON(invalidSteps as any, {
        includeValidationErrors: true,
      });
      expect(result.success).toBe(false); // Still false because errors exist
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Duplicate step ID");
    });

    it("should report error for CHECKLIST step missing dataKey", () => {
      const invalidSteps = [
        {
          id: "checklist-bad",
          type: "CHECKLIST",
          payload: { items: [{ id: "a", label: "A" }] },
        },
      ];
      const result = StepJSONParser.toJSON(invalidSteps as any);
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("must have dataKey property");
    });
  });

  describe("Convenience Methods", () => {
    it("serialize() should return a JSON string or null", () => {
      const json = StepJSONParser.serialize(mockSteps);
      expect(typeof json).toBe("string");

      const invalidSteps = [{ id: "a" }, { id: "a" }];
      const nullResult = StepJSONParser.serialize(invalidSteps as any);
      expect(nullResult).toBeNull();
    });

    it("deserialize() should return an array of steps or null", () => {
      const json = StepJSONParser.serialize(mockSteps);
      const steps = StepJSONParser.deserialize(json!);
      expect(steps).toBeInstanceOf(Array);
      expect(steps).toHaveLength(mockSteps.length);

      const nullResult = StepJSONParser.deserialize("{ not json }");
      expect(nullResult).toBeNull();
    });

    it("clone() should create a deep copy of steps", () => {
      const clonedSteps = StepJSONParser.clone(mockSteps);
      expect(clonedSteps).not.toBe(mockSteps); // Different reference
      // A simple deep equal check (ignoring function reference inequality)
      expect(JSON.stringify(clonedSteps)).toEqual(
        JSON.stringify(
          StepJSONParser.deserialize(StepJSONParser.serialize(mockSteps)!),
        ),
      );
    });
  });

  describe("getExportableData", () => {
    // Mock data for these specific tests
    const mockSteps: OnboardingStep[] = [{ id: "step1", type: "INFORMATION" }];

    // Clean up spies after each test to ensure isolation
    afterAll(() => {
      vi.restoreAllMocks();
    });

    it("should return a successful result with the correct data structure on success", () => {
      const mockJsonString = '{\n  "steps": []\n}';
      const toJSONSpy = vi.spyOn(StepJSONParser, "toJSON").mockReturnValue({
        success: true,
        data: mockJsonString,
        errors: [],
        warnings: [],
      });

      const result = StepJSONParser.getExportableData(mockSteps);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.filename).toBe("onboarding-steps.json"); // Default filename
      expect(result.data?.mimeType).toBe("application/json");
      expect(result.data?.content).toBe(mockJsonString);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);

      expect(toJSONSpy).toHaveBeenCalledWith(mockSteps, { prettyPrint: true });
    });

    it("should return a failure result if the underlying toJSON call fails", () => {
      const mockErrors = ["Serialization failed due to duplicate ID"];
      const mockWarnings = ["Step 'step1' has an unknown type"];
      vi.spyOn(StepJSONParser, "toJSON").mockReturnValue({
        success: false,
        data: undefined,
        errors: mockErrors,
        warnings: mockWarnings,
      });

      const result = StepJSONParser.getExportableData(mockSteps);

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.errors).toEqual(mockErrors);
      expect(result.warnings).toEqual(mockWarnings);
    });

    it("should use a custom filename and pass options down to toJSON", () => {
      const customFilename = "my-custom-flow.json";
      const customOptions: Partial<StepJSONParserOptions> = {
        includeMeta: false,
        functionHandling: "omit",
      };
      const toJSONSpy = vi.spyOn(StepJSONParser, "toJSON").mockReturnValue({
        success: true,
        data: "{}",
        errors: [],
        warnings: [],
      });

      const result = StepJSONParser.getExportableData(
        mockSteps,
        customFilename,
        customOptions,
      );

      expect(result.success).toBe(true);
      expect(result.data?.filename).toBe(customFilename);

      expect(toJSONSpy).toHaveBeenCalledWith(mockSteps, {
        ...customOptions,
        prettyPrint: true, // `prettyPrint` is always forced to true
      });
    });
  });

  describe("StepJSONParserUtils Namespace", () => {
    let validJson: string;
    let invalidJson = "{ invalid }";

    beforeAll(() => {
      validJson = StepJSONParser.serialize(mockSteps)!;
    });

    it("isValidStepJSON() should correctly identify valid/invalid JSON", () => {
      expect(StepJSONParserUtils.isValidStepJSON(validJson)).toBe(true);
      expect(StepJSONParserUtils.isValidStepJSON(invalidJson)).toBe(false);
      expect(StepJSONParserUtils.isValidStepJSON('{"steps":[]}')).toBe(false); // as per implementation
    });

    it("getStepTypesFromJSON() should return an array of step types", () => {
      const types = StepJSONParserUtils.getStepTypesFromJSON(validJson);
      expect(types).toEqual([
        "INFORMATION",
        "SINGLE_CHOICE",
        "CHECKLIST",
        "CUSTOM_COMPONENT",
        "CONFIRMATION",
      ]);
      expect(StepJSONParserUtils.getStepTypesFromJSON(invalidJson)).toEqual([]);
    });

    it("getStepIdsFromJSON() should return an array of step IDs", () => {
      const ids = StepJSONParserUtils.getStepIdsFromJSON(validJson);
      expect(ids).toEqual([
        "welcome",
        "choose-path",
        "dev-tools",
        "custom-comp",
        "final",
      ]);
      expect(StepJSONParserUtils.getStepIdsFromJSON(invalidJson)).toEqual([]);
    });

    it("hasCustomComponents() should detect custom component steps", () => {
      expect(StepJSONParserUtils.hasCustomComponents(validJson)).toBe(true);
      const noCustomCompJson = StepJSONParser.serialize(
        mockSteps.filter((s) => s.type !== "CUSTOM_COMPONENT"),
      )!;
      expect(StepJSONParserUtils.hasCustomComponents(noCustomCompJson)).toBe(
        false,
      );
    });

    it("hasFunctions() should detect serialized functions", () => {
      expect(StepJSONParserUtils.hasFunctions(validJson)).toBe(true);
      const noFuncSteps = [
        { id: "a", type: "INFORMATION", nextStep: "b" },
        { id: "b", type: "CONFIRMATION" },
      ];
      const noFuncJson = StepJSONParser.serialize(noFuncSteps as any)!;
      expect(StepJSONParserUtils.hasFunctions(noFuncJson)).toBe(false);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    afterAll(() => {
      // Restore any mocks after each test
      vi.restoreAllMocks();
    });

    describe("toJSON", () => {
      it("should handle a top-level serialization error", () => {
        const circularObject: any = {};
        circularObject.a = circularObject;
        const stepsWithCircularRef = [{ id: "circular", meta: circularObject }];

        const result = StepJSONParser.toJSON(stepsWithCircularRef as any);

        expect(result.success).toBe(false);
        expect(result.data).toBeUndefined();
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toMatch(/circular|cyclic/i);
      });
    });

    describe("fromJSON", () => {
      it("should handle invalid JSON during parsing", () => {
        const invalidJsonString = "{ this is not valid json, }";

        const result = StepJSONParser.fromJSON(invalidJsonString);

        expect(result.success).toBe(false);
        expect(result.data).toBeUndefined();
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain("Deserialization failed");
        expect(result.errors[0]).toContain("Expected property name");
      });
    });

    describe("serializeStep", () => {
      it("should catch an error during individual step serialization", () => {
        const errorMessage = "Schema is null or undefined";
        vi.spyOn(StepJSONParser as any, "serializePayload").mockImplementation(
          () => {
            throw new Error(errorMessage);
          },
        );
        const steps = [{ id: "step1", type: "INFORMATION", payload: {} }];

        const result = StepJSONParser.toJSON(steps as any);

        expect(result.success).toBe(false); // The error is pushed, so success is false
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain("Failed to serialize step step1");
        expect(result.errors[0]).toContain(errorMessage);

        // Check that the returned step is the minimal fallback
        const parsedData = JSON.parse(result.data!);
        expect(parsedData.steps[0]).toEqual({
          id: "step1",
          type: "INFORMATION",
        });
      });
    });

    describe("serializePayload", () => {
      it("should catch an error when a payload has an invalid structure", () => {
        const invalidSteps = [
          {
            id: "bad-payload",
            type: "MULTIPLE_CHOICE",
            payload: {
              title: "Invalid",
              options: null, // This will cause a TypeError
            },
          },
        ];

        const result = StepJSONParser.toJSON(invalidSteps as any);

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain(
          "Step 'bad-payload' of type 'MULTIPLE_CHOICE' must have non-empty options array",
        );
      });
    });

    describe("deserializeStep", () => {
      it("should catch an error during individual step deserialization", () => {
        const validJson = StepJSONParser.serialize([
          { id: "s1", type: "INFORMATION", payload: {} },
        ])!;
        const errorMessage = "Schema is null or undefined";
        vi.spyOn(
          StepJSONParser as any,
          "deserializePayload",
        ).mockImplementation(() => {
          throw new Error(errorMessage);
        });

        const result = StepJSONParser.fromJSON(validJson);

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain("Schema is null or undefined");
        expect(result.errors[0]).toContain(errorMessage);
        expect(result.data).toEqual(undefined);
      });
    });

    describe("deserializeFunction", () => {
      it("should catch syntax errors in a function body and return a no-op", () => {
        const consoleWarnSpy = vi
          .spyOn(console, "warn")
          .mockImplementation(() => {});
        const invalidSerializedFunc = {
          __isFunction: true,
          __functionBody: "return { this is invalid syntax",
        };

        const resultFn = (StepJSONParser as any).deserializeFunction(
          invalidSerializedFunc,
          "testProp",
          "testId",
          {},
        );

        expect(consoleWarnSpy).toHaveBeenCalled();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          "Failed to deserialize function testProp for step testId:",
          expect.any(SyntaxError),
        );
        expect(typeof resultFn).toBe("function");
        // The fallback function should do nothing and return undefined
        expect(resultFn()).toBeUndefined();

        consoleWarnSpy.mockRestore();
      });
    });

    describe("StepJSONParserUtils", () => {
      it("should handle invalid JSON gracefully", () => {
        const invalidJson = "{ not json }";
        expect(StepJSONParserUtils.isValidStepJSON(invalidJson)).toBe(false);
        expect(StepJSONParserUtils.getStepTypesFromJSON(invalidJson)).toEqual(
          [],
        );
        expect(StepJSONParserUtils.getStepIdsFromJSON(invalidJson)).toEqual([]);
        expect(StepJSONParserUtils.hasCustomComponents(invalidJson)).toBe(
          false,
        );
        expect(StepJSONParserUtils.hasFunctions(invalidJson)).toBe(false);
      });
    });
  });
});
