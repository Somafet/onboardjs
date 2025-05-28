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
      expect(state.currentStep).toBe(null); // Should not have a current step
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

    // It should handle no data returned from onDataLoad
    it("should handle no data returned from onDataLoad", async () => {
      const onDataLoad = vi.fn().mockResolvedValue(null);
      const config = { ...basicConfig, onDataLoad };

      engine = new OnboardingEngine(config);
      await engine.ready(); // Ensure engine is fully initialized

      const state = engine.getState();
      expect(state.currentStep).toBe(mockSteps[0]); // Should default to first step
      expect(state.context.flowData).toEqual({}); // Flow data should be empty
    });

    // Ensure existing flowData (if any from constructor) is not lost if loadedData is sparse
    it("should not lose existing flowData when loadedData is sparse", async () => {
      const initialContext: OnboardingContext = {
        flowData: { existingData: "initial" },
      };
      const onDataLoad = vi.fn().mockResolvedValue({
        currentStepId: "step2",
        flowData: {}, // Sparse data
      });
      const config = { ...basicConfig, onDataLoad, initialContext };

      engine = new OnboardingEngine(config);
      await engine.ready(); // Ensure engine is fully initialized

      const state = engine.getState();
      expect(state.context.flowData.existingData).toBe("initial");
    });

    // Check if context actually changed to avoid unnecessary persists
    it("should not persist if context did not change", async () => {
      const onDataPersist = vi.fn();
      const config = { ...basicConfig, onDataPersist };

      engine = new OnboardingEngine(config);

      const initialContext = engine.getState().context;
      await engine.updateContext(initialContext); // Same data

      expect(onDataPersist).not.toHaveBeenCalled(); // Should not persist
    });

    // Ensure Persist data if context changed and not hydrating
    it("should persist data if context changed and not hydrating", async () => {
      const onDataPersist = vi.fn();
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

    it("canGoPrevious should be false if navigating back to the first step", async () => {
      await engine.next(); // Go to step2
      await engine.previous(); // Back to step1

      const state = engine.getState();
      expect(state.canGoPrevious).toBe(false); // Should not be able to go back from step1
    });

    // It should navigate to previous step even if no previous step is defined
    it("should handle previous step when no previous step is defined", async () => {
      await engine.next(); // Go to step2
      await engine.previous(); // Back to step1
      await engine.previous(); // Try to go back again

      const state = engine.getState();
      expect(state.currentStep?.id).toBe("step1"); // Should remain on step1
    });

    // It should navigate to previous step even when previousStep is not defined
    it("should handle previous step when previousStep is not defined", async () => {
      const stepsWithoutPrevious: OnboardingStep[] = [
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
          payload: { mainText: "Second step" },
          previousStep: undefined, // No previous step defined
        },
      ];

      const config = { ...basicConfig, steps: stepsWithoutPrevious };
      engine = new OnboardingEngine(config);

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

    it("should handle goToStep navigation with step data", async () => {
      const stepData = { confirmation: true };
      await engine.goToStep("step3", stepData);

      const state = engine.getState();
      expect(state.currentStep?.id).toBe("step3");
      expect(state.context.flowData.confirmation).toBe(true);
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

    // it should handle errors when onFlowComplete throws
    it("should handle errors when onFlowComplete throws", async () => {
      const error = new Error("Flow complete error");
      const onFlowComplete = vi.fn().mockImplementation(() => {
        throw error;
      });
      const config = { ...basicConfig, onFlowComplete };
      engine = new OnboardingEngine(config);

      await engine.next(); // step1 -> step2
      await engine.next(); // step2 -> step3
      await engine.next(); // step3 -> complete

      const state = engine.getState();
      expect(state.isCompleted).toBe(true);
      expect(state.error).toBe(error);
    });

    it("should navigate to a valid step by id", async () => {
      await engine.ready();
      // @ts-expect-error: access private method for test
      await engine.navigateToStep("step2", "goto");
      const state = engine.getState();
      expect(state.currentStep?.id).toBe("step2");
    });

    it("should set currentStep to null if step id does not exist", async () => {
      await engine.ready();
      // @ts-expect-error: access private method for test
      await engine.navigateToStep("non-existent", "goto");
      const state = engine.getState();
      expect(state.currentStep).toBeNull();
      expect(state.isCompleted).toBe(true);
    });

    it("should skip steps with unmet condition", async () => {
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
          condition: () => false,
          nextStep: "step3",
        },
        {
          id: "step3",
          type: "INFORMATION",
          title: "Step 3",
          payload: { mainText: "Final step" },
        },
      ];
      engine = new OnboardingEngine({
        ...basicConfig,
        steps: conditionalSteps,
      });
      await engine.ready();
      // @ts-expect-error: access private method for test
      await engine.navigateToStep("step2", "next");
      const state = engine.getState();
      expect(state.currentStep?.id).toBe("step3");
    });

    it("should call beforeStepChange listeners and allow cancellation", async () => {
      await engine.ready();
      const cancelListener = vi.fn((event: BeforeStepChangeEvent) => {
        event.cancel();
      });
      engine.onBeforeStepChange(cancelListener);
      // @ts-expect-error: access private method for test
      await engine.navigateToStep("step2", "next");
      const state = engine.getState();
      expect(cancelListener).toHaveBeenCalled();
      expect(state.currentStep?.id).toBe("step1");
    });

    it("should allow beforeStepChange listener to redirect navigation", async () => {
      await engine.ready();
      const redirectListener = vi.fn((event: BeforeStepChangeEvent) => {
        if (event.redirect) event.redirect("step3");
      });
      engine.onBeforeStepChange(redirectListener);
      // @ts-expect-error: access private method for test
      await engine.navigateToStep("step2", "next");
      const state = engine.getState();
      expect(redirectListener).toHaveBeenCalled();
      expect(state.currentStep?.id).toBe("step3");
    });

    it("should call onStepActive when entering a step", async () => {
      const onStepActive = vi.fn();
      const stepsWithHook = [
        { ...basicConfig.steps[0], onStepActive },
        ...basicConfig.steps.slice(1),
      ];
      engine = new OnboardingEngine({ ...basicConfig, steps: stepsWithHook });
      await engine.ready();
      // @ts-expect-error: access private method for test
      await engine.navigateToStep("step2", "goto");
      expect(onStepActive).toHaveBeenCalled();
    });

    it("should set error if onStepActive throws", async () => {
      const error = new Error("onStepActive error");
      const onStepActive = vi.fn().mockRejectedValue(error);
      const stepsWithHook = [
        {
          ...basicConfig.steps[0],
          id: "step1",
          type: "CUSTOM_COMPONENT" as const,
          payload: {
            componentKey: "testComponent",
          },
          nextStep: "step2",
        }, // Ensure IDs are clear
        {
          ...basicConfig.steps.slice(1)[0],
          id: "step2",
          type: "CUSTOM_COMPONENT" as const,
          payload: {
            componentKey: "testComponent",
          },
          onStepActive,
        },
      ];
      engine = new OnboardingEngine({
        ...basicConfig,
        steps: stepsWithHook,
        initialStepId: "step1",
      });

      await engine.ready();
      // Now engine is past initial loading. Current step should be "step1".

      // Call the method that triggers the error
      // We expect navigateToStep to complete, including its internal async operations and state updates
      // @ts-expect-error: access private method for test
      await engine.navigateToStep("step2", "goto");

      // Add a minimal yield to the event loop, just in case.
      // This helps ensure any final microtasks from the promise rejection handling in navigateToStep complete.
      await new Promise((resolve) => setTimeout(resolve, 0)); // Or process.nextTick for Node

      const state = engine.getState();
      expect(onStepActive).toHaveBeenCalled(); // Make sure the mock was called
      expect(state.error).toBe(error); // Now check the error
      expect(state.currentStep?.id).toBe("step2");
      expect(state.isLoading).toBe(false);
    });

    it("should call onFlowComplete when navigating from the last step (which has no nextStep)", async () => {
      // engine is instantiated in the beforeEach with basicConfig
      // basicConfig.onFlowComplete is a vi.fn()

      // Ensure engine is ready and on the first step
      await engine.ready();
      expect(engine.getState().currentStep?.id).toBe("step1");

      // Navigate to the last defined step ("step3")
      await engine.goToStep("step3");
      let state = engine.getState();
      expect(state.currentStep?.id).toBe("step3");
      expect(state.isCompleted).toBe(false);
      expect(basicConfig.onFlowComplete).not.toHaveBeenCalled(); // Not yet completed

      // Now, attempt to navigate *from* step3. Since step3 has no nextStep, this should complete the flow.
      await engine.next(); // This is the action that triggers completion

      // It's good practice to allow microtasks to settle after the action that triggers the callback
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Assertions after completion
      expect(basicConfig.onFlowComplete).toHaveBeenCalledTimes(1);
      // You can also check the context passed to onFlowComplete if needed:
      // expect(basicConfig.onFlowComplete).toHaveBeenCalledWith(expect.objectContaining({ flowData: ... }));

      state = engine.getState();
      expect(state.isCompleted).toBe(true);
      expect(state.currentStep).toBeNull();
    });

    it("should persist data when flow is completed", async () => {
      const onDataPersist = vi.fn();
      engine = new OnboardingEngine({ ...basicConfig, onDataPersist });
      await engine.ready();
      // @ts-expect-error: access private method for test
      await engine.navigateToStep(null, "next");
      expect(onDataPersist).toHaveBeenCalled();
    });

    it("should update history when navigating forward", async () => {
      await engine.ready();
      // @ts-expect-error: access private method for test
      await engine.navigateToStep("step2", "next");
      // @ts-expect-error: access private property for test
      expect(engine.history).toContain("step1");
    });

    it("should not update history when navigating previous", async () => {
      await engine.ready();
      // @ts-expect-error: access private method for test
      await engine.navigateToStep("step2", "next");
      // @ts-expect-error: access private method for test
      await engine.navigateToStep("step1", "previous");
      // @ts-expect-error: access private property for test
      expect(engine.history).not.toContain("step2");
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

    // It should handle empty nextStep property (no next step defined) by getting to the next step in the steps array
    it("should handle empty nextStep property", async () => {
      const stepsWithEmptyNext: OnboardingStep[] = [
        {
          id: "step1",
          type: "INFORMATION",
          title: "Step 1",
          payload: { mainText: "First step" },
          nextStep: undefined, // No next step defined
        },
        {
          id: "step2",
          type: "INFORMATION",
          title: "Step 2",
          payload: { mainText: "Second step" },
        },
      ];

      const config = { ...basicConfig, steps: stepsWithEmptyNext };
      engine = new OnboardingEngine(config);
      await engine.ready(); // Ensure engine is fully initialized
      expect(engine.getState().currentStep?.id).toBe("step1");

      await engine.next(); // Should go to step2

      const state = engine.getState();
      expect(state.currentStep?.id).toBe("step2");
    });

    it("should handle empty nextStep property with Flow Finish if no other steps are provided", async () => {
      const stepsWithEmptyNext: OnboardingStep[] = [
        {
          id: "step1",
          type: "INFORMATION",
          title: "Step 1",
          payload: { mainText: "First step" },
          nextStep: undefined, // No next step defined
        },
      ];
      const onFlowComplete = vi.fn();

      const config = {
        ...basicConfig,
        onFlowComplete,
        steps: stepsWithEmptyNext,
      };
      engine = new OnboardingEngine(config);
      await engine.ready(); // Ensure engine is fully initialized
      expect(engine.getState().currentStep?.id).toBe("step1");

      await engine.next();

      const state = engine.getState();
      expect(state.currentStep).toBe(null);
      expect(state.isCompleted).toBe(true);
      expect(onFlowComplete).toHaveBeenCalledWith(state.context);
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

    // it should handle reset with overridden persistence handlers
    it("should handle reset with overridden persistence handlers", async () => {
      const onDataPersist = vi.fn();
      const onDataLoad = vi.fn();
      const onFlowComplete = vi.fn();
      const onStepChange = vi.fn();
      const configWithPersist = { ...basicConfig, onDataPersist };
      engine = new OnboardingEngine(configWithPersist);

      await engine.reset({
        onDataPersist: vi.fn(),
        onDataLoad: vi.fn(),
        onFlowComplete: vi.fn(),
        onStepChange: vi.fn(),
      }); // Reset with new persistence config
      await engine.updateContext({ flowData: { test: "data" } });

      expect(onDataPersist).not.toHaveBeenCalled(); // Should not call old handler
      expect(onDataLoad).not.toHaveBeenCalled(); // Should not call old handler
      expect(onFlowComplete).not.toHaveBeenCalled(); // Should not call old handler
      expect(onStepChange).not.toHaveBeenCalled(); // Should not call old handler
    });

    // It should call onClearPersistedData when it is provided
    it("should call onClearPersistedData when provided", async () => {
      const onClearPersistedData = vi.fn();
      engine = new OnboardingEngine({
        ...basicConfig,
        onClearPersistedData,
      });

      await engine.reset();

      expect(onClearPersistedData).toHaveBeenCalled();
    });

    // Mock a persistence data store and ensure that during the reset, it is cleared if the onClearPersistedData handler is provided
    it("should clear persisted data when onClearPersistedData is provided", async () => {
      const fakeStorage = {
        items: {} as Record<string | number, any>,
        get: function (key: string | number) {
          return this.items[key];
        },
        set: function (key: string | number, value: any) {
          this.items[key] = value;
        },
      };
      const onClearPersistedData = vi.fn(() => {
        // Actually clear the fake storage
        fakeStorage.items = {};
      });
      const onDataPersist = vi.fn((data, stepId) => {
        console.log(`Persisting data for step ${stepId}:`, data);

        if (stepId) {
          fakeStorage.set(stepId, data);
        }
      });

      const onDataLoad = vi.fn(async () => {
        // Simulate loading from storage
        return fakeStorage.items;
      });

      engine = new OnboardingEngine({
        ...basicConfig,
        onClearPersistedData,
        onDataPersist,
        onDataLoad,
      });

      await engine.ready(); // Ensure engine is ready

      // Simulate some persisted data for a step
      await engine.next({ test: "data" });
      expect(onDataPersist).toHaveBeenCalledWith(
        expect.objectContaining({
          flowData: expect.objectContaining({ test: "data" }),
        }),
        "step2"
      );

      // Reset the engine
      await engine.reset();

      expect(onClearPersistedData).toHaveBeenCalled();
      expect(fakeStorage.items).toMatchObject({}); // Ensure storage is cleared
    });

    // it should handle errors when onClearPersistedData throws
    it("should handle errors when onClearPersistedData throws", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const onClearPersistedData = vi.fn().mockImplementation(() => {
        throw new Error("Clear error");
      });

      engine = new OnboardingEngine({
        ...basicConfig,
        onClearPersistedData,
      });

      await engine.reset();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error during onClearPersistedData"),
        expect.any(Error)
      );
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

    describe("OnboardingEngine - setState", () => {
      let engine: OnboardingEngine;
      let basicConfig: OnboardingEngineConfig;
      let mockSteps: OnboardingStep[];

      beforeEach(() => {
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
            type: "INFORMATION",
            title: "Step 2",
            payload: { mainText: "Second step" },
            previousStep: "step1",
          },
        ];
        basicConfig = {
          steps: mockSteps,
          onFlowComplete: vi.fn(),
          onStepChange: vi.fn(),
        };
        engine = new OnboardingEngine(basicConfig);
      });

      it("should update isLoading, isHydrating, error, isCompleted in setState", () => {
        // @ts-expect-error Accessing private method for test
        engine.setState(() => ({
          isLoading: true,
          isHydrating: true,
          error: new Error("Test error"),
          isCompleted: true,
        }));
        const state = engine.getState();
        expect(state.isLoading).toBe(true);
        expect(state.isHydrating).toBe(true);
        expect(state.error?.message).toBe("Test error");
        expect(state.isCompleted).toBe(true);
      });

      it("should update context and persist if changed", async () => {
        const onDataPersist = vi.fn().mockResolvedValue(undefined);
        const config = { ...basicConfig, onDataPersist };
        engine = new OnboardingEngine(config);
        await engine.ready();

        const newContext = { flowData: { foo: "bar" } };
        // @ts-expect-error Accessing private method for test
        engine.setState(() => ({
          context: newContext,
        }));

        // Wait for persist to be called
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(engine.getState().context.flowData.foo).toBe("bar");
        expect(onDataPersist).toHaveBeenCalledWith(
          expect.objectContaining({
            flowData: expect.objectContaining({ foo: "bar" }),
          }),
          "step1"
        );
      });

      it("should not persist if context did not change", async () => {
        const onDataPersist = vi.fn();
        const config = { ...basicConfig, onDataPersist };
        engine = new OnboardingEngine(config);
        await engine.ready();

        // @ts-expect-error Accessing private method for test
        engine.setState(() => ({
          context: engine.getState().context,
        }));

        // Wait for persist to be called (should not be called)
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(onDataPersist).not.toHaveBeenCalled();
      });

      it("should not persist if hydrating", async () => {
        const onDataPersist = vi.fn();
        const config = { ...basicConfig, onDataPersist };
        engine = new OnboardingEngine(config);
        await engine.ready();

        // @ts-expect-error Accessing private method for test
        engine.isHydratingInternal = true;
        // @ts-expect-error Accessing private method for test
        engine.setState(() => ({
          context: { flowData: { test: 1 } },
        }));

        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(onDataPersist).not.toHaveBeenCalled();
      });

      it("should notify state change listeners", () => {
        const listener = vi.fn();
        engine.subscribeToStateChange(listener);
        // @ts-expect-error Accessing private method for test
        engine.setState(() => ({
          isLoading: true,
        }));
        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({ isLoading: true })
        );
      });
    });
  });
  describe("Event Handlers", () => {
    beforeEach(async () => {
      engine = new OnboardingEngine(basicConfig);
      await engine.ready();
    });

    describe("Step Change Listeners", () => {
      it("should notify step change listeners when navigating", async () => {
        const listener = vi.fn();
        const unsubscribe = engine.addStepChangeListener(listener);

        await engine.next();

        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({ id: "step2" }), // new step
          expect.objectContaining({ id: "step1" }), // old step
          expect.objectContaining({
            flowData: expect.any(Object),
          })
        );

        unsubscribe();
      });

      it("should unsubscribe step change listeners", async () => {
        const listener = vi.fn();
        const unsubscribe = engine.addStepChangeListener(listener);

        unsubscribe();
        await engine.next();

        expect(listener).not.toHaveBeenCalled();
      });

      it("should handle errors in step change listeners gracefully", async () => {
        const consoleErrorSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});
        const errorListener = vi.fn().mockImplementation(() => {
          throw new Error("Listener error");
        });

        engine.addStepChangeListener(errorListener);
        await engine.next();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("Error in stepChange listener:"),
          expect.any(Error)
        );
        expect(errorListener).toHaveBeenCalled();
      });

      it("should notify multiple step change listeners", async () => {
        const listener1 = vi.fn();
        const listener2 = vi.fn();
        const listener3 = vi.fn();

        engine.addStepChangeListener(listener1);
        engine.addStepChangeListener(listener2);
        engine.addStepChangeListener(listener3);

        await engine.next();

        expect(listener1).toHaveBeenCalled();
        expect(listener2).toHaveBeenCalled();
        expect(listener3).toHaveBeenCalled();
      });
    });

    describe("Flow Complete Listeners", () => {
      it("should notify flow complete listeners when flow completes", async () => {
        const listener = vi.fn();
        const unsubscribe = engine.addFlowCompletedListener(listener);

        // Navigate to last step and complete the flow
        await engine.goToStep("step3");
        await engine.next(); // This should complete the flow

        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            flowData: expect.any(Object),
          })
        );

        unsubscribe();
      });

      it("should unsubscribe flow complete listeners", async () => {
        const listener = vi.fn();
        const unsubscribe = engine.addFlowCompletedListener(listener);

        unsubscribe();

        // Complete the flow
        await engine.goToStep("step3");
        await engine.next();

        expect(listener).not.toHaveBeenCalled();
      });

      it("should handle errors in sync flow complete listeners gracefully", async () => {
        const consoleErrorSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});
        const errorListener = vi.fn().mockImplementation(() => {
          throw new Error("Sync listener error");
        });

        engine.addFlowCompletedListener(errorListener);

        // Complete the flow
        await engine.goToStep("step3");
        await engine.next();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("Error in sync onFlowHasCompleted listener:"),
          expect.any(Error)
        );
        expect(errorListener).toHaveBeenCalled();
      });

      it("should handle errors in async flow complete listeners gracefully", async () => {
        const consoleErrorSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});
        const asyncErrorListener = vi.fn().mockImplementation(async () => {
          throw new Error("Async listener error");
        });

        engine.addFlowCompletedListener(asyncErrorListener);

        // Complete the flow
        await engine.goToStep("step3");
        await engine.next();

        // Wait for async error handling
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            "Error in async onFlowHasCompleted listener:"
          ),
          expect.any(Error)
        );
        expect(asyncErrorListener).toHaveBeenCalled();
      });

      it("should notify multiple flow complete listeners", async () => {
        const listener1 = vi.fn();
        const listener2 = vi.fn();
        const listener3 = vi.fn();

        engine.addFlowCompletedListener(listener1);
        engine.addFlowCompletedListener(listener2);
        engine.addFlowCompletedListener(listener3);

        // Complete the flow
        await engine.goToStep("step3");
        await engine.next();

        expect(listener1).toHaveBeenCalled();
        expect(listener2).toHaveBeenCalled();
        expect(listener3).toHaveBeenCalled();
      });
    });

    describe("Before Step Change Listeners", () => {
      it("should call before step change listeners before navigation", async () => {
        const listener = vi.fn();
        engine.onBeforeStepChange(listener);

        await engine.next();

        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            currentStep: expect.objectContaining({ id: "step1" }),
            targetStepId: "step2",
            direction: "next",
            cancel: expect.any(Function),
            redirect: expect.any(Function),
          })
        );
      });

      it("should allow before step change listeners to cancel navigation", async () => {
        const cancelListener = vi.fn((event: BeforeStepChangeEvent) => {
          event.cancel();
        });
        engine.onBeforeStepChange(cancelListener);

        await engine.next();

        const state = engine.getState();
        expect(state.currentStep?.id).toBe("step1"); // Should remain on step1
        expect(cancelListener).toHaveBeenCalled();
      });

      it("should allow before step change listeners to redirect navigation", async () => {
        const redirectListener = vi.fn((event: BeforeStepChangeEvent) => {
          if (event.redirect) {
            event.redirect("step3");
          }
        });
        engine.onBeforeStepChange(redirectListener);

        await engine.next();

        const state = engine.getState();
        expect(state.currentStep?.id).toBe("step3"); // Should redirect to step3
        expect(redirectListener).toHaveBeenCalled();
      });

      it("should not allow redirect after cancel is called", async () => {
        const cancelAndRedirectListener = vi.fn(
          (event: BeforeStepChangeEvent) => {
            event.cancel();
            if (event.redirect) {
              event.redirect("step3"); // This should be ignored
            }
          }
        );
        engine.onBeforeStepChange(cancelAndRedirectListener);

        await engine.next();

        const state = engine.getState();
        expect(state.currentStep?.id).toBe("step1"); // Should remain on step1
      });

      it("should unsubscribe before step change listeners", async () => {
        const listener = vi.fn();
        const unsubscribe = engine.onBeforeStepChange(listener);

        unsubscribe();
        await engine.next();

        expect(listener).not.toHaveBeenCalled();
      });

      it("should handle async before step change listeners", async () => {
        const asyncListener = vi.fn(async (event: BeforeStepChangeEvent) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          // Allow navigation
        });
        engine.onBeforeStepChange(asyncListener);

        await engine.next();

        expect(asyncListener).toHaveBeenCalled();
        const state = engine.getState();
        expect(state.currentStep?.id).toBe("step2");
      });

      it("should call multiple before step change listeners sequentially", async () => {
        const listener1 = vi.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
        });
        const listener2 = vi.fn();
        const listener3 = vi.fn();

        engine.onBeforeStepChange(listener1);
        engine.onBeforeStepChange(listener2);
        engine.onBeforeStepChange(listener3);

        await engine.next();

        expect(listener1).toHaveBeenCalled();
        expect(listener2).toHaveBeenCalled();
        expect(listener3).toHaveBeenCalled();
      });

      it("should pass correct direction for different navigation types", async () => {
        const listener = vi.fn();
        engine.onBeforeStepChange(listener);

        // Test next
        await engine.next();
        expect(listener).toHaveBeenLastCalledWith(
          expect.objectContaining({ direction: "next" })
        );

        // Test previous
        await engine.previous();
        expect(listener).toHaveBeenLastCalledWith(
          expect.objectContaining({ direction: "previous" })
        );

        // Test goto
        await engine.goToStep("step3");
        expect(listener).toHaveBeenLastCalledWith(
          expect.objectContaining({ direction: "goto" })
        );

        // Test skip
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
          mockSteps[1],
          mockSteps[2],
        ];
        const skippableEngine = new OnboardingEngine({
          ...basicConfig,
          steps: skippableSteps,
        });
        await skippableEngine.ready();

        const skipListener = vi.fn();
        skippableEngine.onBeforeStepChange(skipListener);

        await skippableEngine.skip();
        expect(skipListener).toHaveBeenCalledWith(
          expect.objectContaining({ direction: "skip" })
        );
      });
    });

    describe("State Change Listeners", () => {
      it("should notify state change listeners when state changes", async () => {
        const listener = vi.fn();
        const unsubscribe = engine.subscribeToStateChange(listener);

        await engine.next();

        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            currentStep: expect.objectContaining({ id: "step2" }),
            isLoading: false,
          })
        );

        unsubscribe();
      });

      it("should unsubscribe state change listeners", async () => {
        const listener = vi.fn();
        const unsubscribe = engine.subscribeToStateChange(listener);

        unsubscribe();
        await engine.next();

        expect(listener).not.toHaveBeenCalled();
      });

      it("should notify state change listeners on context updates", async () => {
        const listener = vi.fn();
        engine.subscribeToStateChange(listener);

        await engine.updateContext({ flowData: { newKey: "newValue" } });

        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            context: expect.objectContaining({
              flowData: expect.objectContaining({
                newKey: "newValue",
              }),
            }),
          })
        );
      });

      it("should notify state change listeners on loading state changes", async () => {
        const listener = vi.fn();
        engine.subscribeToStateChange(listener);

        // Reset to clear previous calls
        listener.mockClear();

        // Create a promise that we can control
        let resolveNavigation: () => void;
        const navigationPromise = new Promise<void>((resolve) => {
          resolveNavigation = resolve;
        });

        // Mock the navigateToStep to add delay
        const originalNavigateToStep = (engine as any).navigateToStep;
        vi.spyOn(engine as any, "navigateToStep").mockImplementation(
          async (...args) => {
            // Call setState to set loading true
            (engine as any).setState(() => ({ isLoading: true }));
            await navigationPromise;
            return originalNavigateToStep.call(engine, ...args);
          }
        );

        // Start navigation (this will set loading to true)
        const nextPromise = engine.next();

        // Check that loading state was notified
        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            isLoading: true,
          })
        );

        // Complete the navigation
        resolveNavigation!();
        await nextPromise;

        // Should also be called when loading becomes false
        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            isLoading: false,
          })
        );
      });

      it("should notify state change listeners on error state changes", async () => {
        const listener = vi.fn();
        engine.subscribeToStateChange(listener);

        // Create a step with onStepActive that throws an error
        const errorSteps: OnboardingStep[] = [
          mockSteps[0],
          {
            ...mockSteps[1],
            onStepActive: async () => {
              throw new Error("Step activation error");
            },
          },
          mockSteps[2],
        ];

        const errorEngine = new OnboardingEngine({
          ...basicConfig,
          steps: errorSteps,
        });
        await errorEngine.ready();

        const errorListener = vi.fn();
        errorEngine.subscribeToStateChange(errorListener);

        await errorEngine.next();

        expect(errorListener).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.any(Error),
          })
        );
      });

      it("should notify multiple state change listeners", async () => {
        const listener1 = vi.fn();
        const listener2 = vi.fn();
        const listener3 = vi.fn();

        engine.subscribeToStateChange(listener1);
        engine.subscribeToStateChange(listener2);
        engine.subscribeToStateChange(listener3);

        await engine.next();

        expect(listener1).toHaveBeenCalled();
        expect(listener2).toHaveBeenCalled();
        expect(listener3).toHaveBeenCalled();
      });
    });

    describe("Integration - Multiple Event Types", () => {
      it("should call all event handlers in correct order during navigation", async () => {
        const callOrder: string[] = [];

        const beforeStepChangeListener = vi.fn(() => {
          callOrder.push("beforeStepChange");
        });
        const stepChangeListener = vi.fn(() => {
          callOrder.push("stepChange");
        });
        const stateChangeListener = vi.fn(() => {
          callOrder.push("stateChange");
        });

        engine.onBeforeStepChange(beforeStepChangeListener);
        engine.addStepChangeListener(stepChangeListener);
        engine.subscribeToStateChange(stateChangeListener);

        await engine.next();

        expect(callOrder).toEqual([
          "stateChange", // Loading state change
          "beforeStepChange",
          "stateChange", // Triggered by beforeStepChange
          "stepChange",
          "stateChange", // Final state change
        ]);
      });

      it("should handle event handler errors without affecting other handlers", async () => {
        const consoleErrorSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        const errorStepChangeListener = vi.fn(() => {
          throw new Error("Step change error");
        });
        const workingStepChangeListener = vi.fn();
        const stateChangeListener = vi.fn();

        engine.addStepChangeListener(errorStepChangeListener);
        engine.addStepChangeListener(workingStepChangeListener);
        engine.subscribeToStateChange(stateChangeListener);

        await engine.next();

        expect(errorStepChangeListener).toHaveBeenCalled();
        expect(workingStepChangeListener).toHaveBeenCalled();
        expect(stateChangeListener).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("Error in stepChange listener:"),
          expect.any(Error)
        );
      });
    });
  });
});
