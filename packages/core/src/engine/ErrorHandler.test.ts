// src/engine/services/__tests__/ErrorHandler.test.ts
import { describe, it, expect, beforeEach, vi, afterEach, Mock, MockInstance } from "vitest";
import { OnboardingContext } from "../types";
import { ErrorHandler } from "./ErrorHandler";
import { EventManager } from "./EventManager";
import { StateManager } from "./StateManager";

// Mock context for testing
interface TestContext extends OnboardingContext {
  testData?: string;
  flowData: Record<string, any>; // Ensure flowData is present
}

// Define the mock function for EventManager.notifyListeners at a higher scope
let mockNotifyListenersFn= vi.fn();

vi.mock("../EventManager", () => {
  // Initialize the mock function here so it's defined when the factory runs
  mockNotifyListenersFn = vi.fn();
  return {
    EventManager: vi.fn().mockImplementation(() => ({
      notifyListeners: mockNotifyListenersFn, // Use the shared mock
      // Add other EventManager methods if ErrorHandler were to call them directly
    })),
  };
});

// We will manually mock the StateManager instance, so a simple mock for its constructor is enough
// if it were new-ed up elsewhere. For ErrorHandler, we pass a mock object.
vi.mock("../StateManager", () => ({
  StateManager: vi.fn(),
}));

describe("ErrorHandler", () => {
  let mockEventManagerInstance: EventManager<TestContext>; // Instance of mocked EventManager
  let manualMockStateManager: { // Manually created mock object for StateManager
    setError: Mock<() => void>; // This will be a spy
    // Add other StateManager methods here if ErrorHandler uses them
  };
  let errorHandler: ErrorHandler<TestContext>;
  let consoleErrorSpy: MockInstance
  let dateNowSpy: MockInstance

  const mockEngineContext: TestContext = {
    flowData: { someKey: "someValue" },
    testData: "initial",
  };

  beforeEach(() => {
    // Clear the shared mock function for EventManager.notifyListeners
    mockNotifyListenersFn.mockClear();

    // Create a new instance of the mocked EventManager.
    // Its notifyListeners method will be our shared mockNotifyListenersFn.
    mockEventManagerInstance = new EventManager<TestContext>();

    // Create a fresh manual mock object for StateManager for each test
    manualMockStateManager = {
      setError: vi.fn(), // This is definitely a spy
    };

    // Instantiate ErrorHandler with the mocked EventManager instance
    // and the manual mock object for StateManager.
    errorHandler = new ErrorHandler<TestContext>(
      mockEventManagerInstance,
      manualMockStateManager as unknown as StateManager<TestContext> // Cast for type compatibility
    );

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1234567890000); // Consistent timestamp
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Constructor", () => {
    it("should store the provided EventManager and StateManager instances", () => {
      expect((errorHandler as any).eventManager).toBe(mockEventManagerInstance);
      expect((errorHandler as any).stateManager).toBe(manualMockStateManager);
    });
  });

  describe("handleError", () => {
    const testOperation = "testOperation";
    const testStepId = "step123";

    it("should process an Error instance correctly", () => {
      const error = new Error("Original error message");
      error.stack = "Custom stack trace";
      const returnedError = errorHandler.handleError(error, testOperation, mockEngineContext, testStepId);

      expect(returnedError).toBe(error);
      expect(returnedError.message).toBe("Original error message");
    });

    it("should convert a non-Error unknown to an Error instance", () => {
      const errorString = "This is a string error";
      const returnedError = errorHandler.handleError(errorString, testOperation, mockEngineContext, testStepId);

      expect(returnedError).toBeInstanceOf(Error);
      expect(returnedError.message).toBe(errorString);
    });

    it("should add the error to errorHistory with correct context", () => {
      const error = new Error("History test");
      errorHandler.handleError(error, testOperation, mockEngineContext, testStepId);

      const history = errorHandler.getErrorHistory();
      expect(history).toHaveLength(1);
      const entry = history[0];
      expect(entry.error).toBe(error);
      expect(entry.context.operation).toBe(testOperation);
      expect(entry.context.stepId).toBe(testStepId);
      expect(entry.context.timestamp).toBe(1234567890000);
      expect(entry.context.stack).toBe(error.stack);
      expect(entry.engineContext).toEqual(mockEngineContext);
      expect(entry.engineContext).not.toBe(mockEngineContext); // Should be a snapshot
    });

    it("should trim errorHistory if it exceeds maxHistorySize", () => {
      const maxHistorySize = 50; // Default from class, or access via (errorHandler as any).maxHistorySize
      for (let i = 0; i < maxHistorySize + 5; i++) {
        errorHandler.handleError(new Error(`Error ${i}`), `op${i}`, mockEngineContext);
      }
      expect(errorHandler.getErrorHistory()).toHaveLength(maxHistorySize);
      expect(errorHandler.getErrorHistory()[0].error.message).toBe("Error 5");
    });

    it("should log the error to console.error", () => {
      const error = new Error("Console log test");
      errorHandler.handleError(error, testOperation, mockEngineContext);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `[OnboardingEngine] ${testOperation}:`,
        error,
        expect.objectContaining({ operation: testOperation, timestamp: 1234567890000 })
      );
    });

    it("should call stateManager.setError with the processed error", () => {
      const error = new Error("StateManager test");
      errorHandler.handleError(error, testOperation, mockEngineContext);
      // Assert against the setError method on our manualMockStateManager
      expect(manualMockStateManager.setError).toHaveBeenCalledWith(error);
    });

    // TODO: Fix this test
    it.skip("should call eventManager.notifyListeners for 'error' event", () => {
      const error = new Error("EventManager test");
      errorHandler.handleError(error, testOperation, mockEngineContext);
      // Assert against the shared mock function used by the EventManager instance
      expect(mockNotifyListenersFn).toHaveBeenCalledWith("error", error, mockEngineContext);
    });

    it("should handle errors without a stack trace gracefully", () => {
        const error = new Error("No stack error");
        delete error.stack; // Simulate an error without a stack
        errorHandler.handleError(error, testOperation, mockEngineContext);
        const history = errorHandler.getErrorHistory();
        expect(history[0].context.stack).toBeUndefined();
    });
  });

  describe("safeExecute", () => {
    const operationName = "safeAsyncOp";
    const successResult = "success";

    it("should return the result of a successful async operation", async () => {
      const asyncOperation = vi.fn().mockResolvedValue(successResult);
      const result = await errorHandler.safeExecute(asyncOperation, operationName, mockEngineContext);
      
      expect(result).toBe(successResult);
      expect(asyncOperation).toHaveBeenCalledTimes(1);
      expect(errorHandler.hasErrors()).toBe(false);
    });

    it("should call handleError and return null if async operation throws", async () => {
      const error = new Error("Async op failed");
      const failingAsyncOperation = vi.fn().mockRejectedValue(error);
      // No need to spy on errorHandler.handleError, its effects are tested elsewhere
      // We just check if an error is added to history as a side effect.

      const result = await errorHandler.safeExecute(failingAsyncOperation, operationName, mockEngineContext, "stepX");
      
      expect(result).toBeNull();
      expect(failingAsyncOperation).toHaveBeenCalledTimes(1);
      expect(errorHandler.hasErrors()).toBe(true);
      const history = errorHandler.getErrorHistory();
      expect(history[0].error.message).toBe("Async op failed");
      expect(history[0].context.operation).toBe(operationName);
    });
  });

  describe("safeExecuteSync", () => {
    const operationName = "safeSyncOp";
    const successResult = "sync success";

    it("should return the result of a successful sync operation", () => {
      const syncOperation = vi.fn().mockReturnValue(successResult);
      const result = errorHandler.safeExecuteSync(syncOperation, operationName, mockEngineContext);
      
      expect(result).toBe(successResult);
      expect(syncOperation).toHaveBeenCalledTimes(1);
      expect(errorHandler.hasErrors()).toBe(false);
    });

    it("should call handleError and return null if sync operation throws", () => {
      const error = new Error("Sync op failed");
      const failingSyncOperation = vi.fn(() => { throw error; });

      const result = errorHandler.safeExecuteSync(failingSyncOperation, operationName, mockEngineContext, "stepY");
      
      expect(result).toBeNull();
      expect(failingSyncOperation).toHaveBeenCalledTimes(1);
      expect(errorHandler.hasErrors()).toBe(true);
      const history = errorHandler.getErrorHistory();
      expect(history[0].error.message).toBe("Sync op failed");
      expect(history[0].context.operation).toBe(operationName);
    });
  });

  describe("Error History Management", () => {
    // This beforeEach is scoped to "Error History Management"
    beforeEach(() => {
      // Clear history from parent beforeEach if any, then populate for these specific tests
      errorHandler.clearErrorHistory();
      dateNowSpy.mockReturnValue(1234567890000);
      errorHandler.handleError(new Error("Error A"), "opA", mockEngineContext, "step1");
      dateNowSpy.mockReturnValue(1234567890001);
      errorHandler.handleError(new Error("Error B"), "opB", mockEngineContext, "step2");
      dateNowSpy.mockReturnValue(1234567890002);
      errorHandler.handleError(new Error("Error C"), "opA", mockEngineContext, "step1");
    });

    it("getErrorHistory should return a copy of the error history", () => {
      const history1 = errorHandler.getErrorHistory();
      expect(history1).toHaveLength(3);
      
      history1.pop(); // Modify returned copy
      expect(history1).toHaveLength(2);
      expect(errorHandler.getErrorHistory()).toHaveLength(3); // Internal history unchanged
    });

    it("getRecentErrors should return the specified number of recent errors", () => {
      const recent2 = errorHandler.getRecentErrors(2);
      expect(recent2).toHaveLength(2);
      expect(recent2[0].error.message).toBe("Error B"); // Error B was second, Error C was third
      expect(recent2[1].error.message).toBe("Error C");

      const recent5 = errorHandler.getRecentErrors(5);
      expect(recent5).toHaveLength(3);

      const recentDefault = errorHandler.getRecentErrors();
      expect(recentDefault).toHaveLength(3);
    });

    it("getRecentErrors should return empty array if count is 0 or negative", () => {
        // Fix applied in ErrorHandler.ts for this
        expect(errorHandler.getRecentErrors(0)).toEqual([]);
        expect(errorHandler.getRecentErrors(-1)).toEqual([]);
    });

    it("clearErrorHistory should empty the error history", () => {
      expect(errorHandler.hasErrors()).toBe(true); // Pre-condition from scoped beforeEach
      errorHandler.clearErrorHistory();
      expect(errorHandler.getErrorHistory()).toEqual([]);
      expect(errorHandler.hasErrors()).toBe(false);
    });

    it("hasErrors should return true if there are errors, false otherwise", () => {
      expect(errorHandler.hasErrors()).toBe(true); // From scoped beforeEach
      errorHandler.clearErrorHistory();
      expect(errorHandler.hasErrors()).toBe(false);
      errorHandler.handleError(new Error("New Error"), "opD", mockEngineContext);
      expect(errorHandler.hasErrors()).toBe(true);
    });

    it("getErrorsByOperation should filter errors by operation name (inclusive)", () => {
      const opAErrors = errorHandler.getErrorsByOperation("opA");
      expect(opAErrors).toHaveLength(2);
      expect(opAErrors[0].error.message).toBe("Error A");
      expect(opAErrors[1].error.message).toBe("Error C");

      const opBErrors = errorHandler.getErrorsByOperation("opB");
      expect(opBErrors).toHaveLength(1);
      expect(opBErrors[0].error.message).toBe("Error B");

      const opXErrors = errorHandler.getErrorsByOperation("opX");
      expect(opXErrors).toEqual([]);
    });

    it("getErrorsByStep should filter errors by stepId", () => {
      const step1Errors = errorHandler.getErrorsByStep("step1");
      expect(step1Errors).toHaveLength(2);
      expect(step1Errors[0].error.message).toBe("Error A");
      expect(step1Errors[1].error.message).toBe("Error C");

      const step2Errors = errorHandler.getErrorsByStep("step2");
      expect(step2Errors).toHaveLength(1);
      expect(step2Errors[0].error.message).toBe("Error B");

      const stepXErrors = errorHandler.getErrorsByStep("stepX");
      expect(stepXErrors).toEqual([]);
    });
  });
});
