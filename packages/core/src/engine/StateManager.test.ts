 import { describe, it, expect, vi, beforeEach, Mocked } from "vitest";
import { StateManager } from "./StateManager";
import { EventManager } from "./EventManager";
import { OnboardingContext, OnboardingStep } from "../types";
import { EngineState } from "./types";

// Mock the EventManager to isolate the StateManager during tests.
// vi.mock is hoisted, so it's correctly applied before imports are evaluated.
vi.mock("./EventManager", () => {
  return {
    EventManager: vi.fn().mockImplementation(() => {
      return {
        notifyListeners: vi.fn(),
      };
    }),
  };
});

describe("StateManager", () => {
  let mockEventManager: Mocked<EventManager<OnboardingContext>>;
  let stateManager: StateManager<OnboardingContext>;
  let mockContext: OnboardingContext;
  let mockSteps: OnboardingStep<OnboardingContext>[];

  beforeEach(() => {
    // Reset mocks and instances before each test
    mockEventManager = new EventManager() as Mocked<
      EventManager<OnboardingContext>
    >;

    mockContext = {
      flowData: {
        // A flag to test conditional steps
        shouldShowConditional: true,
      },
    };

    mockSteps = [
      { id: "step1", type: "INFORMATION", payload: {} }, // nextStep is undefined
      {
        id: "conditionalStep",
        type: "INFORMATION",
        payload: {},
        condition: (context) => context.flowData.shouldShowConditional,
        nextStep: "step3",
      },
      {
        id: "conditionalStep2",
        type: "INFORMATION",
        payload: {},
        condition: (context) => context.flowData.shouldShowConditional2,
        nextStep: "step3",
      },
      { id: "step2", type: "INFORMATION", payload: {}, nextStep: "step3" },
      { id: "step3", type: "INFORMATION", payload: {}, nextStep: null }, // Explicit end
    ];

    stateManager = new StateManager(mockEventManager, mockSteps);
  });

  describe("getState", () => {
    it("should correctly identify the first step", () => {
      const state = stateManager.getState(mockSteps[0], mockContext, []);
      expect(state.isFirstStep).toBe(true);
      expect(state.canGoPrevious).toBe(false);
      expect(state.nextStepCandidate?.id).toBe("conditionalStep");
    });

    it("should correctly identify a middle step", () => {
      const state = stateManager.getState(mockSteps[3], mockContext, ["step1"]); // step2
      expect(state.isFirstStep).toBe(false);
      expect(state.isLastStep).toBe(false);
      expect(state.canGoPrevious).toBe(true);
      expect(state.canGoNext).toBe(true);
      expect(state.nextStepCandidate?.id).toBe("step3");
    });

    it("should identify an explicit last step where nextStep is null", () => {
      const state = stateManager.getState(mockSteps[4], mockContext, [
        "step1",
        "step2",
      ]); // step3
      expect(state.isLastStep).toBe(true);
      expect(state.canGoNext).toBe(false);
      expect(state.nextStepCandidate).toBeNull();
    });

    it("should determine canGoNext is true when nextStep is undefined and the next step in array is valid", () => {
      // Current step is 'step1', next is 'conditionalStep'.
      // Context allows 'conditionalStep' to be shown.
      const state = stateManager.getState(mockSteps[0], mockContext, []);
      expect(state.isLastStep).toBe(false);
      expect(state.canGoNext).toBe(true);
    });

    it("should skip the first conditional step and find the second valid one when nextStep is undefined", () => {
      // This is the specific scenario requested.
      // We start at 'step1'.
      // 'conditionalStep' condition is FALSE.
      // 'conditionalStep2' condition is TRUE.
      // The manager should skip 'conditionalStep' and identify 'conditionalStep2' as the next step.
      const specificContext: OnboardingContext = {
        flowData: {
          shouldShowConditional: false,
          shouldShowConditional2: true,
        },
      };

      const state = stateManager.getState(mockSteps[0], specificContext, []);

      expect(state.isLastStep).toBe(false);
      expect(state.canGoNext).toBe(true);
      expect(state.nextStepCandidate?.id).toBe("conditionalStep2");
    });

    it("should skip multiple conditional steps and find the next non-conditional step", () => {
      // Both conditional steps have failing conditions.
      // The manager should skip both and find 'step2'.
      const specificContext: OnboardingContext = {
        flowData: {
          shouldShowConditional: false,
          shouldShowConditional2: false,
        },
      };
      const state = stateManager.getState(mockSteps[0], specificContext, []);
      expect(state.isLastStep).toBe(false);
      expect(state.canGoNext).toBe(true);

      expect(state.nextStepCandidate?.id).toBe("step2");
    });

    it("should disable navigation when an error is present", () => {
      stateManager.setError(new Error("Test Error"));
      const state = stateManager.getState(mockSteps[3], mockContext, ["step1"]);

      expect(state.error).toBeInstanceOf(Error);
      expect(state.canGoNext).toBe(false);
      expect(state.canGoPrevious).toBe(false);
      expect(state.isSkippable).toBe(false);
    });
  });

  describe("setState", () => {
    it("should update isLoading and notify listeners", () => {
      expect(stateManager.isLoading).toBe(false);
      stateManager.setState(() => ({ isLoading: true }), null, mockContext, []);
      expect(stateManager.isLoading).toBe(true);
      expect(mockEventManager.notifyListeners).toHaveBeenCalledOnce();
    });

    it("should update context and call onContextChange when not hydrating", () => {
      const onContextChange = vi.fn();
      const localContext = { flowData: { original: true } };
      stateManager.setHydrating(false); // Ensure not hydrating

      stateManager.setState(
        () => ({ context: { flowData: { original: false, added: true } } }),
        null,
        localContext,
        [],
        onContextChange,
      );

      expect(localContext.flowData).toEqual({ original: false, added: true });
      expect(onContextChange).toHaveBeenCalledOnce();
      expect(mockEventManager.notifyListeners).toHaveBeenCalledOnce();
    });

    it("should update context but NOT call onContextChange when hydrating", () => {
      const onContextChange = vi.fn();
      const localContext = { flowData: { original: true } };
      stateManager.setHydrating(true); // Ensure IS hydrating

      stateManager.setState(
        () => ({ context: { flowData: { added: true } } }),
        null,
        localContext,
        [],
        onContextChange,
      );

      expect(localContext.flowData).toEqual({ added: true });
      expect(onContextChange).not.toHaveBeenCalled();
      expect(mockEventManager.notifyListeners).toHaveBeenCalledOnce();
    });

    it("should not notify or call onContextChange if state does not change", () => {
      const onContextChange = vi.fn();
      stateManager.setLoading(false);

      // Attempt to set isLoading to its current value
      stateManager.setState(
        () => ({ isLoading: false }),
        null,
        mockContext,
        [],
        onContextChange,
      );

      expect(onContextChange).not.toHaveBeenCalled();
      expect(mockEventManager.notifyListeners).not.toHaveBeenCalled();
    });

    it("should not notify or call onContextChange if context data is identical", () => {
      const onContextChange = vi.fn();
      const localContext = { flowData: { key: "value" } };
      stateManager.setHydrating(false);

      stateManager.setState(
        () => ({ context: { flowData: { key: "value" } } }),
        null,
        localContext,
        [],
        onContextChange,
      );

      expect(onContextChange).not.toHaveBeenCalled();
      expect(mockEventManager.notifyListeners).not.toHaveBeenCalled();
    });

    it("should update all settable properties in one call", () => {
      const onContextChange = vi.fn();
      const testError = new Error("Test");
      stateManager.setHydrating(false);

      stateManager.setState(
        () => ({
          isLoading: true,
          isCompleted: true,
          error: testError,
          context: { flowData: { all: "updated" } },
        }),
        null,
        mockContext,
        [],
        onContextChange,
      );

      expect(stateManager.isLoading).toBe(true);
      expect(stateManager.isCompleted).toBe(true);
      expect(stateManager.error).toBe(testError);
      expect(mockContext.flowData).toEqual({ all: "updated" });
      expect(onContextChange).toHaveBeenCalledOnce();
      expect(mockEventManager.notifyListeners).toHaveBeenCalledOnce();
    });
  });

  describe("notifyStateChange", () => {
    it("should call eventManager.notifyListeners with the latest state", () => {
      const currentStep = mockSteps[0];
      const history: string[] = [];

      stateManager.notifyStateChange(currentStep, mockContext, history);

      // Check that notifyListeners was called
      expect(mockEventManager.notifyListeners).toHaveBeenCalledTimes(1);
      expect(mockEventManager.notifyListeners).toHaveBeenCalledWith(
        "stateChange",
        expect.any(Object),
      );

      // Check that the state passed to the listener is correct
      const emittedState = mockEventManager.notifyListeners.mock
        .calls[0][1] as EngineState<OnboardingContext>;

      expect(emittedState.currentStep?.id).toBe("step1");
      expect(emittedState.isFirstStep).toBe(true);
      expect(emittedState.canGoNext).toBe(true); // Verifies the core logic is used here too
    });
  });

  describe("Internal State Management", () => {
    it("should update isLoading state via setLoading", () => {
      expect(stateManager.isLoading).toBe(false);
      stateManager.setLoading(true);
      expect(stateManager.isLoading).toBe(true);
    });

    it("should update error state via setError", () => {
      expect(stateManager.error).toBeNull();
      const testError = new Error("Failure");
      stateManager.setError(testError);
      expect(stateManager.error).toBe(testError);
      expect(stateManager.hasError).toBe(true);
    });

    it("should clear error state by setting it to null", () => {
      stateManager.setError(new Error("Failure"));
      expect(stateManager.hasError).toBe(true);
      stateManager.setError(null);
      expect(stateManager.error).toBeNull();
      expect(stateManager.hasError).toBe(false);
    });
  });
});
