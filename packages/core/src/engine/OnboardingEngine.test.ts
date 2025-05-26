import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { OnboardingEngine } from "./OnboardingEngine";
import type {
  OnboardingEngineConfig,
  EngineState,
  BeforeStepChangeEvent,
  LoadedData,
} from "./types";
import type {
  OnboardingStep,
  OnboardingContext,
  ChecklistStepPayload,
  ChecklistItemState,
} from "../types";

describe("OnboardingEngine", () => {
  let engine: OnboardingEngine;
  let basicConfig: OnboardingEngineConfig;
  let mockSteps: OnboardingStep[];

  beforeEach(() => {
    // Reset console mocks
    vi.clearAllMocks();

    mockSteps = [
      {
        id: "step1",
        type: "INFORMATION",
        title: "Welcome",
        payload: { mainText: "Welcome to onboarding" },
        nextStep: "step2",
      },
      {
        id: "step2",
        type: "SINGLE_CHOICE",
        title: "Choose Option",
        payload: {
          question: "What is your role?",
          options: [
            { id: "dev", label: "Developer", value: "developer" },
            { id: "designer", label: "Designer", value: "designer" },
          ],
          dataKey: "userRole",
        },
        nextStep: "step3",
        previousStep: "step1",
      },
      {
        id: "step3",
        type: "CONFIRMATION",
        title: "Confirm",
        payload: { confirmationMessage: "Are you ready?" },
        previousStep: "step2",
      },
    ];

    basicConfig = {
      steps: mockSteps,
      onFlowComplete: vi.fn(),
      onStepChange: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Initialization", () => {
    it("should initialize with first step when no initial step is specified", async () => {
      engine = new OnboardingEngine(basicConfig);

      // Wait for initialization to complete

      const state = engine.getState();
      expect(state.currentStep).toEqual(mockSteps[0]);
      expect(state.isHydrating).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it("should initialize with specified initial step", async () => {
      const config = { ...basicConfig, initialStepId: "step2" };
      engine = new OnboardingEngine(config);

      const state = engine.getState();
      expect(state.currentStep).toEqual(mockSteps[1]);
    });

    it("should handle empty steps array", async () => {
      const config = { ...basicConfig, steps: [] };
      engine = new OnboardingEngine(config);

      const state = engine.getState();
      expect(state.currentStep).toBeNull();
      expect(state.isCompleted).toBe(true);
    });

    it("should merge initial context with default context", async () => {
      const initialContext = {
        flowData: { existingData: "test" },
        currentUser: { name: "John" },
      };
      const config = { ...basicConfig, initialContext };
      engine = new OnboardingEngine(config);

      const state = engine.getState();
      expect(state.context.flowData.existingData).toBe("test");
      expect(state.context.currentUser.name).toBe("John");
    });
  });

  describe("Data Loading and Persistence", () => {
    it("should load data on initialization when onDataLoad is provided", async () => {
      const loadedData: LoadedData = {
        currentStepId: "step2",
        flowData: { userRole: "developer" },
        currentUser: { name: "Jane" },
      };

      const onDataLoad = vi.fn().mockResolvedValue(loadedData);
      const config = { ...basicConfig, onDataLoad };

      engine = new OnboardingEngine(config);
      await engine.ready(); // Ensure engine is fully initialized

      expect(onDataLoad).toHaveBeenCalled();
      const state = engine.getState();
      expect(state.currentStep?.id).toBe("step2");
      expect(state.context.flowData.userRole).toBe("developer");
      expect(state.context.currentUser.name).toBe("Jane");
    });

    it("should handle data loading errors gracefully", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const onDataLoad = vi.fn().mockRejectedValue(new Error("Load failed"));
      const config = { ...basicConfig, onDataLoad };

      engine = new OnboardingEngine(config);

      await engine.ready(); // Ensure engine is fully initialized

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error during onDataLoad"),
        expect.any(Error)
      );

      const state = engine.getState();
      expect(state.currentStep?.id).toBe("step1"); // Should fall back to default
    });

    it("should persist data when context changes", async () => {
      const onDataPersist = vi.fn().mockResolvedValue(undefined);
      const config = { ...basicConfig, onDataPersist };

      engine = new OnboardingEngine(config);

      await engine.updateContext({ flowData: { newData: "value" } });

      expect(onDataPersist).toHaveBeenCalledWith(
        expect.objectContaining({
          flowData: expect.objectContaining({ newData: "value" }),
        }),
        "step1"
      );
    });

    it("should handle persistence errors gracefully", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const onDataPersist = vi
        .fn()
        .mockRejectedValue(new Error("Persist failed"));
      const config = { ...basicConfig, onDataPersist };

      engine = new OnboardingEngine(config);

      await engine.updateContext({ flowData: { test: "data" } });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error during onDataPersist"),
        expect.any(Error)
      );
    });
  });

  describe("Navigation", () => {
    beforeEach(async () => {
      engine = new OnboardingEngine(basicConfig);
    });

    it("should navigate to next step", async () => {
      await engine.next();

      const state = engine.getState();
      expect(state.currentStep?.id).toBe("step2");
    });

    it("should navigate to previous step", async () => {
      await engine.next(); // Go to step2
      await engine.previous(); // Back to step1

      const state = engine.getState();
      expect(state.currentStep?.id).toBe("step1");
    });

    it("should navigate to specific step using goToStep", async () => {
      await engine.goToStep("step3");

      const state = engine.getState();
      expect(state.currentStep?.id).toBe("step3");
    });

    it("should handle navigation with step data", async () => {
      const stepData = { userRole: "developer" };
      await engine.next(stepData);

      const state = engine.getState();
      expect(state.context.flowData.userRole).toBe("developer");
    });

    it("should maintain navigation history", async () => {
      await engine.next(); // step1 -> step2
      await engine.goToStep("step3"); // step2 -> step3
      await engine.previous(); // step3 -> step2 (from history)

      const state = engine.getState();
      expect(state.currentStep?.id).toBe("step2");
    });

    it("should complete flow when reaching end", async () => {
      await engine.next(); // step1 -> step2
      await engine.next(); // step2 -> step3
      await engine.next(); // step3 -> complete

      const state = engine.getState();
      expect(state.isCompleted).toBe(true);
      expect(state.currentStep).toBeNull();
      expect(basicConfig.onFlowComplete).toHaveBeenCalledWith(state.context);
    });
  });

  describe("Step Conditions", () => {
    it("should skip steps that do not meet conditions", async () => {
      const conditionalSteps: OnboardingStep[] = [
        {
          id: "step1",
          type: "INFORMATION",
          title: "Step 1",
          payload: { mainText: "First step" },
          nextStep: "step2",
        },
        {
          id: "step2",
          type: "INFORMATION",
          title: "Step 2",
          payload: { mainText: "Conditional step" },
          condition: (context) => context.flowData.showStep2 === true,
          nextStep: "step3",
        },
        {
          id: "step3",
          type: "INFORMATION",
          title: "Step 3",
          payload: { mainText: "Final step" },
        },
      ];

      const config = { ...basicConfig, steps: conditionalSteps };
      engine = new OnboardingEngine(config);

      await engine.next(); // Should skip step2 and go to step3

      const state = engine.getState();
      expect(state.currentStep?.id).toBe("step3");
    });
  });

  describe("Dynamic Navigation Functions", () => {
    it("should handle function-based nextStep", async () => {
      const dynamicSteps: OnboardingStep[] = [
        {
          id: "step1",
          type: "INFORMATION",
          title: "Dynamic Step",
          payload: { mainText: "Choose path" },
          nextStep: (context) =>
            context.flowData.userRole === "admin" ? "admin-step" : "user-step",
        },
        {
          id: "admin-step",
          type: "INFORMATION",
          title: "Admin Step",
          payload: { mainText: "Admin content" },
        },
        {
          id: "user-step",
          type: "INFORMATION",
          title: "User Step",
          payload: { mainText: "User content" },
        },
      ];

      const config = { ...basicConfig, steps: dynamicSteps };
      engine = new OnboardingEngine(config);

      await engine.next({ userRole: "admin" });

      const state = engine.getState();
      expect(state.currentStep?.id).toBe("admin-step");
    });
  });

  describe("Skip Functionality", () => {
    it("should skip step when skippable", async () => {
      const skippableSteps: OnboardingStep[] = [
        {
          id: "step1",
          type: "INFORMATION",
          title: "Skippable Step",
          payload: { mainText: "You can skip this" },
          isSkippable: true,
          nextStep: "step2",
          skipToStep: "step3",
        },
        {
          id: "step2",
          type: "INFORMATION",
          title: "Step 2",
          payload: { mainText: "Regular step" },
          nextStep: "step3",
        },
        {
          id: "step3",
          type: "INFORMATION",
          title: "Step 3",
          payload: { mainText: "Final step" },
        },
      ];

      const config = { ...basicConfig, steps: skippableSteps };
      engine = new OnboardingEngine(config);

      await engine.skip();

      const state = engine.getState();
      expect(state.currentStep?.id).toBe("step3");
    });

    it("should not skip non-skippable step", async () => {
      const testSteps: OnboardingStep[] = [
        {
          id: "step1",
          type: "INFORMATION",
          title: "Non-Skippable Step",
          payload: { mainText: "You can skip this" },
          isSkippable: false,
          nextStep: "step2",
          skipToStep: "step3",
        },
        {
          id: "step2",
          type: "INFORMATION",
          title: "Step 2",
          payload: { mainText: "Regular step" },
          nextStep: "step3",
        },
        {
          id: "step3",
          type: "INFORMATION",
          title: "Step 3",
          payload: { mainText: "Final step" },
        },
      ];
      const config = { ...basicConfig, steps: testSteps };
      engine = new OnboardingEngine(config);
      await engine.skip(); // step1 is non-skippable

      const state = engine.getState();
      expect(state.currentStep?.id).toBe("step1"); // Should remain on step1
    });
  });

  describe("Checklist Steps", () => {
    let checklistSteps: OnboardingStep[];

    beforeEach(() => {
      checklistSteps = [
        {
          id: "checklist-step",
          type: "CHECKLIST",
          title: "Complete Tasks",
          payload: {
            items: [
              { id: "task1", label: "Task 1", isMandatory: true },
              { id: "task2", label: "Task 2", isMandatory: true },
              { id: "task3", label: "Task 3", isMandatory: false },
            ],
            dataKey: "checklistData",
          } as ChecklistStepPayload,
          nextStep: "next-step",
        },
        {
          id: "next-step",
          type: "INFORMATION",
          title: "Next Step",
          payload: { mainText: "Checklist completed" },
        },
      ];
    });

    it("should initialize checklist items state", async () => {
      const config = { ...basicConfig, steps: checklistSteps };
      engine = new OnboardingEngine(config);

      const state = engine.getState();
      const checklistData = state.context.flowData
        .checklistData as ChecklistItemState[];

      expect(checklistData).toHaveLength(3);
      expect(checklistData.every((item) => !item.isCompleted)).toBe(true);
    });

    it("should update checklist item state", async () => {
      const config = { ...basicConfig, steps: checklistSteps };
      engine = new OnboardingEngine(config);

      await engine.updateChecklistItem("task1", true);

      const state = engine.getState();
      const checklistData = state.context.flowData
        .checklistData as ChecklistItemState[];
      const task1 = checklistData.find((item) => item.id === "task1");

      expect(task1?.isCompleted).toBe(true);
    });

    it("should prevent navigation when mandatory items not completed", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const config = { ...basicConfig, steps: checklistSteps };
      engine = new OnboardingEngine(config);

      await engine.updateChecklistItem("task1", true); // Only complete task1
      await engine.next(); // Should fail

      const state = engine.getState();
      expect(state.currentStep?.id).toBe("checklist-step");
      expect(state.error?.message).toContain("Checklist criteria not met");
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it("should allow navigation when all mandatory items completed", async () => {
      const config = { ...basicConfig, steps: checklistSteps };
      engine = new OnboardingEngine(config);

      await engine.updateChecklistItem("task1", true);
      await engine.updateChecklistItem("task2", true);
      await engine.next();

      const state = engine.getState();
      expect(state.currentStep?.id).toBe("next-step");
    });

    it("should handle minItemsToComplete rule", async () => {
      const modifiedChecklistSteps = [...checklistSteps];
      (
        modifiedChecklistSteps[0].payload as ChecklistStepPayload
      ).minItemsToComplete = 2;

      const config = { ...basicConfig, steps: modifiedChecklistSteps };
      engine = new OnboardingEngine(config);

      await engine.updateChecklistItem("task1", true);
      await engine.updateChecklistItem("task3", true); // Non-mandatory item
      await engine.next();

      const state = engine.getState();
      expect(state.currentStep?.id).toBe("next-step");
    });

    it("should handle conditional checklist items", async () => {
      const conditionalChecklistSteps: OnboardingStep[] = [
        {
          id: "conditional-checklist",
          type: "CHECKLIST",
          title: "Conditional Tasks",
          payload: {
            items: [
              { id: "task1", label: "Task 1", isMandatory: true },
              {
                id: "task2",
                label: "Task 2",
                isMandatory: true,
                condition: (context) => context.flowData.showTask2 === true,
              },
            ],
            dataKey: "conditionalChecklistData",
          } as ChecklistStepPayload,
        },
      ];

      const config = { ...basicConfig, steps: conditionalChecklistSteps };
      engine = new OnboardingEngine(config);

      // With showTask2 false, only task1 should be required
      await engine.updateChecklistItem("task1", true);
      await engine.next();

      const state = engine.getState();
      expect(state.isCompleted).toBe(true);
    });
  });

  describe("State Management", () => {
    beforeEach(async () => {
      engine = new OnboardingEngine(basicConfig);
    });

    it("should provide correct state information", () => {
      const state = engine.getState();

      expect(state.currentStep).toEqual(mockSteps[0]);
      expect(state.isFirstStep).toBe(true);
      expect(state.isLastStep).toBe(false);
      expect(state.canGoNext).toBe(true);
      expect(state.canGoPrevious).toBe(false);
      expect(state.isSkippable).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.isHydrating).toBe(false);
      expect(state.isCompleted).toBe(false);
      expect(state.error).toBeNull();
    });

    it("should update state when navigating", async () => {
      await engine.next();

      const state = engine.getState();
      expect(state.isFirstStep).toBe(false);
      expect(state.canGoPrevious).toBe(true);
    });

    it("should update context correctly", async () => {
      const newContextData = {
        flowData: { userPreference: "dark" },
        customField: "value",
      };

      await engine.updateContext(newContextData);

      const state = engine.getState();
      expect(state.context.flowData.userPreference).toBe("dark");
      expect(state.context.customField).toBe("value");
    });
  });

  describe("Event Listeners", () => {
    beforeEach(async () => {
      engine = new OnboardingEngine(basicConfig);
    });

    it("should notify state change listeners", async () => {
      const listener = vi.fn();
      engine.subscribeToStateChange(listener);

      await engine.next();

      expect(listener).toHaveBeenCalled();
    });

    it("should unsubscribe state change listeners", async () => {
      const listener = vi.fn();
      const unsubscribe = engine.subscribeToStateChange(listener);

      unsubscribe();
      await engine.next();

      expect(listener).not.toHaveBeenCalled();
    });

    it("should handle beforeStepChange listeners", async () => {
      const listener = vi
        .fn()
        .mockImplementation((event: BeforeStepChangeEvent) => {
          // Allow navigation
        });

      engine.onBeforeStepChange(listener);
      await engine.next();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          currentStep: expect.objectContaining({ id: "step1" }),
          targetStepId: "step2",
          direction: "next",
        })
      );
    });

    it("should allow beforeStepChange listeners to cancel navigation", async () => {
      const listener = vi
        .fn()
        .mockImplementation((event: BeforeStepChangeEvent) => {
          event.cancel();
        });

      engine.onBeforeStepChange(listener);
      await engine.next();

      const state = engine.getState();
      expect(state.currentStep?.id).toBe("step1"); // Should remain on step1
    });

    it("should allow beforeStepChange listeners to redirect navigation", async () => {
      const listener = vi
        .fn()
        .mockImplementation((event: BeforeStepChangeEvent) => {
          if (event.redirect) {
            event.redirect("step3");
          }
        });

      engine.onBeforeStepChange(listener);
      await engine.next();

      const state = engine.getState();
      expect(state.currentStep?.id).toBe("step3"); // Should redirect to step3
    });
  });

  describe("Step Lifecycle Hooks", () => {
    it("should call onStepActive when entering a step", async () => {
      const onStepActive = vi.fn();
      const stepsWithHooks: OnboardingStep[] = [
        {
          ...mockSteps[0],
          onStepActive,
        },
        ...mockSteps.slice(1),
      ];

      const config = { ...basicConfig, steps: stepsWithHooks };
      engine = new OnboardingEngine(config);

      expect(onStepActive).toHaveBeenCalledWith(expect.any(Object));
    });

    it("should call onStepComplete when leaving a step", async () => {
      const onStepComplete = vi.fn();
      const stepsWithHooks: OnboardingStep[] = [
        {
          ...mockSteps[0],
          onStepComplete,
        },
        ...mockSteps.slice(1),
      ];

      const config = { ...basicConfig, steps: stepsWithHooks };
      engine = new OnboardingEngine(config);

      const stepData = { userData: "test" };
      await engine.next(stepData);

      expect(onStepComplete).toHaveBeenCalledWith(stepData, expect.any(Object));
    });

    it("should handle errors in lifecycle hooks", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const onStepActive = vi.fn().mockRejectedValue(new Error("Hook error"));

      const stepsWithHooks: OnboardingStep[] = [
        {
          ...mockSteps[0],
          onStepActive,
        },
        ...mockSteps.slice(1),
      ];

      const config = { ...basicConfig, steps: stepsWithHooks };
      engine = new OnboardingEngine(config);
      // Wait for the state to reflect the error or for loading/hydration to finish
      await new Promise<void>((resolve) => {
        const unsubscribe = engine.subscribeToStateChange((state) => {
          if (state.error || (!state.isLoading && !state.isHydrating)) {
            unsubscribe();
            resolve();
          }
        });
      });

      const finalState = engine.getState();

      expect(finalState.error?.message).toBe("Hook error");
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("Reset Functionality", () => {
    beforeEach(async () => {
      engine = new OnboardingEngine(basicConfig);

      await engine.next(); // Move to step2
    });

    it("should reset to initial state", async () => {
      await engine.reset();

      const state = engine.getState();
      expect(state.currentStep?.id).toBe("step1");
      expect(state.isCompleted).toBe(false);
      expect(state.error).toBeNull();
    });

    it("should reset with new configuration", async () => {
      const newSteps: OnboardingStep[] = [
        {
          id: "new-step",
          type: "INFORMATION",
          title: "New Step",
          payload: { mainText: "New content" },
        },
      ];

      await engine.reset({ steps: newSteps, initialStepId: "new-step" });

      const state = engine.getState();
      expect(state.currentStep?.id).toBe("new-step");
    });

    it("should preserve persistence handlers when not overridden", async () => {
      const onDataPersist = vi.fn();
      const configWithPersist = { ...basicConfig, onDataPersist };
      engine = new OnboardingEngine(configWithPersist);

      await engine.reset(); // Reset without new persistence config
      await engine.updateContext({ flowData: { test: "data" } });

      expect(onDataPersist).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    beforeEach(async () => {
      engine = new OnboardingEngine(basicConfig);
    });

    it("should handle invalid step ID in goToStep", async () => {
      await engine.goToStep("non-existent-step");

      const state = engine.getState();
      expect(state.currentStep).toBeNull();
    });

    it("should handle errors in next() method", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const errorStep: OnboardingStep = {
        ...mockSteps[0],
        onStepComplete: vi.fn().mockRejectedValue(new Error("Step error")),
      };

      const stepsWithError = [errorStep, ...mockSteps.slice(1)];
      const config = { ...basicConfig, steps: stepsWithError };
      engine = new OnboardingEngine(config);

      await engine.next();

      const state = engine.getState();
      expect(state.error?.message).toBe("Step error");
      expect(state.isLoading).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should prevent operations during loading state", async () => {
      // Mock a slow operation to keep loading state
      const slowOnStepComplete = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100))
        );

      const slowStep: OnboardingStep = {
        ...mockSteps[0],
        onStepComplete: slowOnStepComplete,
      };

      const stepsWithSlow = [slowStep, ...mockSteps.slice(1)];
      const config = { ...basicConfig, steps: stepsWithSlow };
      engine = new OnboardingEngine(config);

      // Start navigation
      const nextPromise = engine.next();

      // Try to navigate again while loading
      await engine.previous(); // Should be ignored
      await engine.skip(); // Should be ignored
      await engine.goToStep("step3"); // Should be ignored

      // Wait for original navigation to complete
      await nextPromise;

      const state = engine.getState();
      expect(state.currentStep?.id).toBe("step2"); // Should be on step2 from original next()
    });
  });

  describe("Edge Cases", () => {
    it("should handle updateChecklistItem on non-existent step", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      engine = new OnboardingEngine(basicConfig);

      await engine.updateChecklistItem("item1", true, "non-existent-step");
      const state = engine.getState();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Cannot update checklist item")
      );
      expect(state.error?.message).toContain(
        "Target step for checklist item update is invalid."
      );
    });

    it("should handle updateChecklistItem on non-checklist step", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      engine = new OnboardingEngine(basicConfig);

      await engine.updateChecklistItem("item1", true, "step1"); // step1 is INFORMATION type

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Cannot update checklist item")
      );
    });

    it("should warn when updating non-existent checklist item", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const checklistSteps: OnboardingStep[] = [
        {
          id: "checklist-step",
          type: "CHECKLIST",
          title: "Tasks",
          payload: {
            items: [{ id: "task1", label: "Task 1" }],
            dataKey: "checklistData",
          } as ChecklistStepPayload,
        },
      ];

      const config = { ...basicConfig, steps: checklistSteps };
      engine = new OnboardingEngine(config);

      await engine.updateChecklistItem("non-existent-item", true);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Attempted to update non-existent checklist item"
        )
      );
    });

    it("should not persist data during hydration", async () => {
      const onDataPersist = vi.fn();
      const onDataLoad = vi.fn().mockResolvedValue({
        currentStepId: "step2",
        flowData: { test: "data" },
      });

      const config = {
        ...basicConfig,
        onDataLoad,
        onDataPersist,
        initialContext: { flowData: { initial: "data" } },
      };

      engine = new OnboardingEngine(config);

      // onDataPersist should not be called during hydration
      // Only after explicit context updates
      expect(onDataPersist).not.toHaveBeenCalled();
    });

    it("should handle context updates that don't actually change data", async () => {
      const onDataPersist = vi.fn();
      const config = { ...basicConfig, onDataPersist };

      engine = new OnboardingEngine(config);

      const originalContext = engine.getState().context;
      await engine.updateContext(originalContext); // Same data

      // Should not persist since nothing changed
      expect(onDataPersist).not.toHaveBeenCalled();
    });

    describe("ready()", () => {
      it("should resolve after initialization is complete", async () => {
        const config = { ...basicConfig };
        engine = new OnboardingEngine(config);

        // ready should resolve (not throw) and after it resolves, engine should be initialized
        await expect(engine.ready()).resolves.toBeUndefined();

        const state = engine.getState();
        expect(state.currentStep).toEqual(config.steps[0]);
        expect(state.isHydrating).toBe(false);
      });

      it("should resolve after data loading if onDataLoad is async", async () => {
        const loadedData: LoadedData = {
          currentStepId: "step2",
          flowData: { foo: "bar" },
        };
        const onDataLoad = vi.fn().mockResolvedValue(loadedData);
        const config = { ...basicConfig, onDataLoad };

        engine = new OnboardingEngine(config);

        await expect(engine.ready()).resolves.toBeUndefined();

        const state = engine.getState();
        expect(state.currentStep?.id).toBe("step2");
        expect(state.context.flowData.foo).toBe("bar");
      });

      it("should resolve even if data loading fails", async () => {
        const onStepActive = vi.fn().mockRejectedValue(new Error("Hook error"));

        const stepsWithHooks: OnboardingStep[] = [
          {
            ...mockSteps[0],
            onStepActive,
          },
          ...mockSteps.slice(1),
        ];

        const config = { ...basicConfig, steps: stepsWithHooks };

        engine = new OnboardingEngine(config);

        await expect(engine.ready()).resolves.toBeUndefined();

        const state = engine.getState();

        expect(state.error).not.toBeNull();
        expect(state.currentStep?.id).toBe("step1");
      });

      it("should allow calling ready() multiple times", async () => {
        engine = new OnboardingEngine(basicConfig);

        await Promise.all([engine.ready(), engine.ready(), engine.ready()]);

        const state = engine.getState();
        expect(state.currentStep?.id).toBe("step1");
      });
    });
  });
});
