// src/engine/__tests__/ConfigurationBuilder.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  MockInstance,
} from "vitest";
import { OnboardingPlugin } from "../plugins";
import { OnboardingContext, OnboardingStep } from "../types";
import { ConfigurationBuilder } from "./ConfigurationBuilder";
import { OnboardingEngineConfig } from "./types";

interface TestContext extends OnboardingContext {
  user?: { id: string; name: string };
  settings?: { theme: string };
  flowData: {
    initialFlowKey?: string;
    mergedFlowKey?: string;
    userRole?: string;
    _internal?: any; // For testing _internal creation
  } & Record<string, any>;
}

const mockStep1: OnboardingStep<TestContext> = {
  id: "s1",
  type: "INFORMATION",
  payload: { mainText: "Hello World!" },
};
const mockStep2: OnboardingStep<TestContext> = {
  id: "s2",
  type: "INFORMATION",
  payload: { mainText: "Hello World!" },
};
const mockChecklistStep: OnboardingStep<TestContext> = {
  id: "checklist1",
  type: "CHECKLIST",
  payload: {
    dataKey: "checklistData",
    items: [{ id: "item1", label: "Item 1" }],
  },
};

describe("ConfigurationBuilder", () => {
  let dateNowSpy: MockInstance;
  const fixedTimestamp = 1234567890000;

  beforeEach(() => {
    dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(fixedTimestamp);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  describe("buildInitialContext", () => {
    it("should return a context with empty flowData if no initialContext is provided", () => {
      const config: OnboardingEngineConfig<TestContext> = { steps: [] };
      const context = ConfigurationBuilder.buildInitialContext(config);
      expect(context.flowData).toEqual({
        _internal: { completedSteps: {}, startedAt: fixedTimestamp },
      });
    });

    it("should merge provided initialContext (excluding flowData initially)", () => {
      const initialContextData: Partial<TestContext> = {
        user: { id: "user1", name: "Test User" },
      };
      const config: OnboardingEngineConfig<TestContext> = {
        steps: [],
        initialContext: initialContextData,
      };
      const context = ConfigurationBuilder.buildInitialContext(config);
      expect(context.user).toEqual({ id: "user1", name: "Test User" });
      expect(context.flowData).toEqual({
        _internal: { completedSteps: {}, startedAt: fixedTimestamp },
      });
    });

    it("should merge initialContext.flowData into context.flowData", () => {
      const initialContextData: Partial<TestContext> = {
        flowData: { initialFlowKey: "initialValue" },
      };
      const config: OnboardingEngineConfig<TestContext> = {
        steps: [],
        initialContext: initialContextData,
      };
      const context = ConfigurationBuilder.buildInitialContext(config);
      expect(context.flowData.initialFlowKey).toBe("initialValue");
      expect(context.flowData._internal).toEqual({
        completedSteps: {},
        startedAt: fixedTimestamp,
      });
    });

    it("should create _internal tracking in flowData if not present", () => {
      const config: OnboardingEngineConfig<TestContext> = {
        steps: [],
        initialContext: { flowData: { someKey: "value" } },
      };
      const context = ConfigurationBuilder.buildInitialContext(config);
      expect(context.flowData.someKey).toBe("value");
      expect(context.flowData._internal).toBeDefined();
      expect(context.flowData._internal?.startedAt).toBe(fixedTimestamp);
      expect(context.flowData._internal?.completedSteps).toEqual({});
    });

    it("should not overwrite existing _internal tracking if provided in initialContext.flowData", () => {
      const customInternal = {
        completedSteps: { s1: 123 },
        startedAt: 1000000000000,
      };
      const config: OnboardingEngineConfig<TestContext> = {
        steps: [],
        initialContext: { flowData: { _internal: customInternal } },
      };
      const context = ConfigurationBuilder.buildInitialContext(config);
      expect(context.flowData._internal).toEqual(customInternal);
    });

    it("should handle initialContext being completely empty", () => {
      const config: OnboardingEngineConfig<TestContext> = {
        steps: [],
        initialContext: {},
      };
      const context = ConfigurationBuilder.buildInitialContext(config);
      expect(context.flowData).toEqual({
        _internal: { completedSteps: {}, startedAt: fixedTimestamp },
      });
    });

    it("should handle initialContext.flowData being empty", () => {
      const config: OnboardingEngineConfig<TestContext> = {
        steps: [],
        initialContext: { flowData: {} },
      };
      const context = ConfigurationBuilder.buildInitialContext(config);
      expect(context.flowData).toEqual({
        _internal: { completedSteps: {}, startedAt: fixedTimestamp },
      });
    });
  });

  describe("mergeConfigs", () => {
    const baseConfig: OnboardingEngineConfig<TestContext> = {
      steps: [mockStep1],
      initialStepId: "s1",
      initialContext: {
        user: { id: "user1", name: "Base User" },
        flowData: { initialFlowKey: "baseValue", userRole: "guest" },
      },
      plugins: [{ version: "v1.0.0", name: "pluginA", install: vi.fn() }],
    };

    it("should merge top-level properties, with updates taking precedence", () => {
      const updates: Partial<OnboardingEngineConfig<TestContext>> = {
        initialStepId: "s2",
      };
      const merged = ConfigurationBuilder.mergeConfigs(baseConfig, updates);
      expect(merged.initialStepId).toBe("s2");
      expect(merged.steps).toEqual(baseConfig.steps); // Steps not in updates, so baseConfig.steps used
    });

    it("should merge initialContext, with updates' properties taking precedence (except flowData)", () => {
      const updates: Partial<OnboardingEngineConfig<TestContext>> = {
        initialContext: {
          user: { id: "user2", name: "Updated User" }, // Overwrites base user
          settings: { theme: "dark" }, // New property
        },
      };
      const merged = ConfigurationBuilder.mergeConfigs(baseConfig, updates);
      expect(merged.initialContext?.user).toEqual({
        id: "user2",
        name: "Updated User",
      });
      expect(merged.initialContext?.settings).toEqual({ theme: "dark" });
      // flowData from base should still be there because updates.initialContext didn't have flowData
      expect(merged.initialContext?.flowData?.initialFlowKey).toBe("baseValue");
    });

    it("should deeply merge flowData within initialContext", () => {
      const updates: Partial<OnboardingEngineConfig<TestContext>> = {
        initialContext: {
          flowData: { mergedFlowKey: "updateValue", userRole: "admin" }, // One new, one overwrite
        },
      };
      const merged = ConfigurationBuilder.mergeConfigs(baseConfig, updates);
      expect(merged.initialContext?.flowData?.initialFlowKey).toBe("baseValue"); // From base
      expect(merged.initialContext?.flowData?.mergedFlowKey).toBe(
        "updateValue",
      ); // From update
      expect(merged.initialContext?.flowData?.userRole).toBe("admin"); // Overwritten by update
    });

    it("should concatenate plugins arrays", () => {
      const updates: Partial<OnboardingEngineConfig<TestContext>> = {
        plugins: [{ version: "v1.0.0", name: "pluginB", install: vi.fn() }],
      };
      const merged = ConfigurationBuilder.mergeConfigs(baseConfig, updates);
      expect(merged.plugins).toHaveLength(2);
      expect(merged.plugins?.map((p) => p.name)).toEqual([
        "pluginA",
        "pluginB",
      ]);
    });

    it("should replace steps if updates provide them", () => {
      const newSteps = [mockStep2];
      const updates: Partial<OnboardingEngineConfig<TestContext>> = {
        steps: newSteps,
      };
      const merged = ConfigurationBuilder.mergeConfigs(baseConfig, updates);
      expect(merged.steps).toEqual(newSteps);
    });

    it("should keep current steps if updates do not provide them", () => {
      const updates: Partial<OnboardingEngineConfig<TestContext>> = {
        initialStepId: "s2", // No steps in update
      };
      const merged = ConfigurationBuilder.mergeConfigs(baseConfig, updates);
      expect(merged.steps).toEqual(baseConfig.steps);
    });

    it("should handle empty or undefined parts in current or updates gracefully", () => {
      const emptyBase: OnboardingEngineConfig<TestContext> = { steps: [] };
      const updatesWithData: Partial<OnboardingEngineConfig<TestContext>> = {
        initialContext: { flowData: { mergedFlowKey: "val" } },
        plugins: [{ version: "v1.0.0", name: "p1", install: vi.fn() }],
        steps: [mockStep1],
      };
      let merged = ConfigurationBuilder.mergeConfigs(
        emptyBase,
        updatesWithData,
      );
      expect(merged.initialContext?.flowData?.mergedFlowKey).toBe("val");
      expect(merged.plugins).toHaveLength(1);
      expect(merged.steps).toEqual([mockStep1]);

      const baseWithData: OnboardingEngineConfig<TestContext> = {
        steps: [mockStep1],
        initialContext: { flowData: { initialFlowKey: "val" } },
      };
      const emptyUpdates: Partial<OnboardingEngineConfig<TestContext>> = {};
      merged = ConfigurationBuilder.mergeConfigs(baseWithData, emptyUpdates);
      expect(merged.steps).toEqual(baseWithData.steps);
      expect(merged.initialContext?.flowData?.initialFlowKey).toBe("val");
    });

    it("should handle current.initialContext being undefined", () => {
      const currentNoCtx: OnboardingEngineConfig<TestContext> = {
        steps: [mockStep1],
      };
      const updatesWithCtx: Partial<OnboardingEngineConfig<TestContext>> = {
        initialContext: {
          user: { id: "u1", name: "N" },
          flowData: { key: "v" },
        },
      };
      const merged = ConfigurationBuilder.mergeConfigs(
        currentNoCtx,
        updatesWithCtx,
      );
      expect(merged.initialContext?.user?.id).toBe("u1");
      expect(merged.initialContext?.flowData?.key).toBe("v");
    });

    it("should handle updates.initialContext being undefined", () => {
      const currentWithCtx: OnboardingEngineConfig<TestContext> = {
        steps: [mockStep1],
        initialContext: {
          user: { id: "u1", name: "N" },
          flowData: { key: "v" },
        },
      };
      const updatesNoCtx: Partial<OnboardingEngineConfig<TestContext>> = {
        initialStepId: "s1",
      };
      const merged = ConfigurationBuilder.mergeConfigs(
        currentWithCtx,
        updatesNoCtx,
      );
      expect(merged.initialContext?.user?.id).toBe("u1");
      expect(merged.initialContext?.flowData?.key).toBe("v");
    });

    it("should handle current.plugins being undefined", () => {
      const currentNoPlugins: OnboardingEngineConfig<TestContext> = {
        steps: [],
      };
      const updatesWithPlugins: Partial<OnboardingEngineConfig<TestContext>> = {
        plugins: [{ version: "v1.0.0", name: "p1", install: vi.fn() }],
      };
      const merged = ConfigurationBuilder.mergeConfigs(
        currentNoPlugins,
        updatesWithPlugins,
      );
      expect(merged.plugins).toHaveLength(1);
      expect(merged.plugins?.[0].name).toBe("p1");
    });
  });

  describe("validateConfig", () => {
    it("should return isValid: true and no errors/warnings for a valid minimal config", () => {
      const config: OnboardingEngineConfig<TestContext> = {
        steps: [mockStep1],
      };
      const result = ConfigurationBuilder.validateConfig(config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it("should issue a warning if no steps are defined", () => {
      const config: OnboardingEngineConfig<TestContext> = { steps: [] };
      const result = ConfigurationBuilder.validateConfig(config);
      expect(result.isValid).toBe(true); // Still valid, just a warning
      expect(result.warnings).toContain("No steps defined in configuration");
    });

    it("should detect duplicate step IDs", () => {
      const config: OnboardingEngineConfig<TestContext> = {
        steps: [mockStep1, { ...mockStep2, id: "s1" }],
      };
      const result = ConfigurationBuilder.validateConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Duplicate step ID found: s1");
    });

    it("should detect steps without an ID", () => {
      const config: OnboardingEngineConfig<TestContext> = {
        steps: [
          mockStep1,
          { type: "INFORMATION", payload: {} } as OnboardingStep<TestContext>,
        ],
      };
      const result = ConfigurationBuilder.validateConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Step found without ID");
    });

    it("should validate checklist steps: missing dataKey", () => {
      const config: OnboardingEngineConfig<TestContext> = {
        steps: [{ id: "c1", type: "CHECKLIST", payload: { items: [] } } as any],
      };
      const result = ConfigurationBuilder.validateConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Checklist step c1 missing dataKey");
    });

    it("should validate checklist steps: missing items array", () => {
      const config: OnboardingEngineConfig<TestContext> = {
        steps: [
          { id: "c1", type: "CHECKLIST", payload: { dataKey: "d" } } as any,
        ],
      };
      const result = ConfigurationBuilder.validateConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Checklist step c1 missing or invalid items",
      );
    });

    it("should validate checklist steps: items is not an array", () => {
      const config: OnboardingEngineConfig<TestContext> = {
        steps: [
          {
            id: "c1",
            type: "CHECKLIST",
            payload: { dataKey: "d", items: {} },
          } as any,
        ],
      };
      const result = ConfigurationBuilder.validateConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Checklist step c1 missing or invalid items",
      );
    });

    it("should validate initialStepId if provided and exists", () => {
      const config: OnboardingEngineConfig<TestContext> = {
        steps: [mockStep1, mockStep2],
        initialStepId: "s2",
      };
      const result = ConfigurationBuilder.validateConfig(config);
      expect(result.isValid).toBe(true);
    });

    it("should detect if initialStepId does not exist in steps", () => {
      const config: OnboardingEngineConfig<TestContext> = {
        steps: [mockStep1],
        initialStepId: "nonExistent",
      };
      const result = ConfigurationBuilder.validateConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Initial step ID nonExistent not found in steps",
      );
    });

    it("should validate plugins: missing name", () => {
      const config: OnboardingEngineConfig<TestContext> = {
        steps: [mockStep1],
        plugins: [
          {
            version: "v1.0.0",
            install: vi.fn(),
          } as unknown as OnboardingPlugin<TestContext>,
        ],
      };
      const result = ConfigurationBuilder.validateConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Plugin found without name");
    });

    it("should validate plugins: missing install function", () => {
      const config: OnboardingEngineConfig<TestContext> = {
        steps: [mockStep1],
        plugins: [{ name: "p1" } as OnboardingPlugin<TestContext>],
      };
      const result = ConfigurationBuilder.validateConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Plugin p1 missing install function");
    });

    it("should validate plugins: install is not a function", () => {
      const config: OnboardingEngineConfig<TestContext> = {
        steps: [mockStep1],
        plugins: [{ name: "p1", install: "not a function" } as any],
      };
      const result = ConfigurationBuilder.validateConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Plugin p1 missing install function");
    });

    it("should handle multiple errors and warnings", () => {
      const config: OnboardingEngineConfig<TestContext> = {
        steps: [
          { id: "s1", type: "INFO", payload: {} },
          { id: "s1", type: "INFO", payload: {} }, // Duplicate ID
          { type: "INFO", payload: {} } as any, // Missing ID
        ],
        initialStepId: "s3", // Non-existent
        plugins: [{ install: vi.fn() } as any], // Missing name
      };
      const result = ConfigurationBuilder.validateConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      // It might also have a warning for "No steps defined" if all steps are invalid,
      // but the errors take precedence for isValid.
      // In this case, it will have errors for duplicate, missing ID, initialStepId, plugin.
      expect(result.errors).toContain("Duplicate step ID found: s1");
      expect(result.errors).toContain("Step found without ID");
      expect(result.errors).toContain("Initial step ID s3 not found in steps");
      expect(result.errors).toContain("Plugin found without name");
    });
  });

  describe("createDefaultConfig", () => {
    it("should return a config with empty steps, empty flowData in initialContext, and empty plugins", () => {
      const defaultConfig =
        ConfigurationBuilder.createDefaultConfig<TestContext>();
      expect(defaultConfig.steps).toEqual([]);
      expect(defaultConfig.initialContext).toEqual({ flowData: {} });
      expect(defaultConfig.plugins).toEqual([]);
      expect(defaultConfig.initialStepId).toBeUndefined();
    });
  });

  describe("cloneConfig", () => {
    it("should create a deep clone of the configuration object", () => {
      const originalConfig: OnboardingEngineConfig<TestContext> = {
        steps: [
          mockStep1,
          {
            ...mockStep2,
            payload: { data: "original", mainText: "Hello world" },
          },
        ],
        initialContext: {
          flowData: { key: "value" },
          user: { id: "u1", name: "N" },
        },
        plugins: [{ version: "v1.0.0", name: "p1", install: vi.fn() }],
      };

      const clonedConfig = ConfigurationBuilder.cloneConfig(originalConfig);

      const originalConfigWithoutFunctions = JSON.parse(
        JSON.stringify(originalConfig),
      );

      // Check for equality against the version without functions
      expect(clonedConfig).toEqual(originalConfigWithoutFunctions);

      // Check for referential inequality (deep clone)
      expect(clonedConfig).not.toBe(originalConfig);
      expect(clonedConfig.steps).not.toBe(originalConfig.steps);
      expect(clonedConfig.steps[0]).not.toBe(originalConfig.steps[0]);
      expect(clonedConfig.initialContext).not.toBe(
        originalConfig.initialContext,
      );
      expect(clonedConfig.initialContext?.flowData).not.toBe(
        originalConfig.initialContext?.flowData,
      );
      expect(clonedConfig.initialContext?.user).not.toBe(
        originalConfig.initialContext?.user,
      );
      expect(clonedConfig.plugins).not.toBe(originalConfig.plugins);
      if (clonedConfig.plugins && originalConfig.plugins) {
        expect(clonedConfig.plugins[0]).not.toBe(originalConfig.plugins[0]);
      }

      // Modify cloned and check original is unchanged
      clonedConfig.steps.push(mockChecklistStep);
      (clonedConfig.steps[1].payload as any).data = "modified";
      if (clonedConfig.initialContext?.flowData) {
        clonedConfig.initialContext.flowData.key = "newValue";
      }
      if (clonedConfig.initialContext?.user) {
        clonedConfig.initialContext.user.name = "New Name";
      }

      expect(originalConfig.steps).toHaveLength(2);
      expect((originalConfig.steps[1].payload as any).data).toBe("original");
      expect(originalConfig.initialContext?.flowData?.key).toBe("value");
      expect(originalConfig.initialContext?.user?.name).toBe("N");
    });

    it("should handle functions in config (e.g., plugin install) by not cloning them (JSON.stringify limitation)", () => {
      const installFn = vi.fn();
      const originalConfig: OnboardingEngineConfig<TestContext> = {
        steps: [],
        plugins: [{ version: "v1.0.0", name: "p1", install: installFn }],
      };
      const clonedConfig = ConfigurationBuilder.cloneConfig(originalConfig);
      // Functions are removed by JSON.stringify -> JSON.parse
      expect(clonedConfig.plugins?.[0].install).toBeUndefined();
      // The rest should be cloned
      expect(clonedConfig.plugins?.[0].name).toBe("p1");
    });

    it("should handle undefined or null properties gracefully", () => {
      const originalConfig: OnboardingEngineConfig<TestContext> = {
        steps: [],
        initialStepId: undefined,
        initialContext: null as any, // Test null explicitly
        plugins: undefined,
      };
      const clonedConfig = ConfigurationBuilder.cloneConfig(originalConfig);
      expect(clonedConfig.steps).toEqual([]);
      expect(clonedConfig.initialStepId).toBeUndefined();
      expect(clonedConfig.initialContext).toBeNull();
      expect(clonedConfig.plugins).toBeUndefined();
    });
  });
});
