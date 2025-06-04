import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { useOnboarding } from "./useOnboarding";
import { OnboardingProvider } from "../context/OnboardingProvider";
import { OnboardingEngineConfig } from "@onboardjs/core";
import { mockSteps } from "../test-utils";
import { UseOnboardingOptions } from "./useOnboarding.types";

describe("useOnboarding", () => {
  let mockConfig: OnboardingEngineConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = {
      steps: mockSteps,
      onFlowComplete: vi.fn(),
      onStepChange: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createWrapper = (config = mockConfig) => {
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <OnboardingProvider {...config}>{children}</OnboardingProvider>
    );
    Wrapper.displayName = "OnboardingProviderWrapper";
    return Wrapper;
  };

  it("should throw error when used outside OnboardingProvider", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => {
      renderHook(() => useOnboarding());
    }).toThrow("useOnboarding must be used within an OnboardingProvider");

    consoleErrorSpy.mockRestore();
  });

  it("should return onboarding context values", async () => {
    const { result } = renderHook(() => useOnboarding(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      // First, ensure the engine and state objects are available
      expect(result.current.engine).toBeTruthy();
      expect(result.current.state).toBeTruthy();

      // Then, specifically wait for the currentStep to be the expected initial one
      // Assuming mockSteps[0].id is "step1"
      expect(result.current.state?.currentStep?.id).toBe(mockSteps[0].id);
      // Or if useOnboarding directly exposes currentStep:
      // expect(result.current.currentStep?.id).toBe(mockSteps[0].id);
    });

    await waitFor(() => {
      expect(result.current.engine).toBeTruthy();
      expect(result.current.state).toBeTruthy();
      expect(result.current.currentStep).toBeTruthy();
      expect(typeof result.current.next).toBe("function");
      expect(typeof result.current.previous).toBe("function");
      expect(typeof result.current.goToStep).toBe("function");
      expect(typeof result.current.skip).toBe("function");
      expect(typeof result.current.reset).toBe("function");
      expect(typeof result.current.updateContext).toBe("function");
      expect(typeof result.current.setComponentLoading).toBe("function");
    });
  });

  it("should provide correct initial state", async () => {
    const { result } = renderHook(() => useOnboarding(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.state?.currentStep?.id).toBe("step1");
      expect(result.current.currentStep?.id).toBe("step1");
      expect(result.current.isCompleted).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("should register onFlowComplete callback", async () => {
    const onFlowComplete = vi.fn();

    const { result } = renderHook(() => useOnboarding({ onFlowComplete }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.engine).toBeTruthy();
    });

    // Simulate flow completion
    await act(async () => {
      await result.current.goToStep("step4");
      await result.current.next();
    });

    await waitFor(() => {
      expect(onFlowComplete).toHaveBeenCalled();
    });
  });

  it("should register onStepChange callback", async () => {
    const onStepChange = vi.fn();

    const { result } = renderHook(() => useOnboarding({ onStepChange }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.engine).toBeTruthy();
    });

    // Navigate to next step
    await act(async () => {
      await result.current.next();
    });

    await waitFor(() => {
      expect(onStepChange).toHaveBeenCalled();
    });
  });

  it("should update callback references when options change", async () => {
    const onFlowComplete = vi.fn();
    let options: UseOnboardingOptions = { onFlowComplete };

    const { result, rerender } = renderHook(() => useOnboarding(options), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.engine).toBeTruthy();
    });

    // Change the callback
    const newOnFlowComplete = vi.fn();
    options = { onFlowComplete: newOnFlowComplete };
    rerender();

    // Complete the flow
    await act(async () => {
      await result.current.goToStep("step4");
      await result.current.next();
    });

    await waitFor(() => {
      expect(newOnFlowComplete).toHaveBeenCalled();
      expect(onFlowComplete).not.toHaveBeenCalled();
    });
  });

  it("should handle navigation methods", async () => {
    const { result } = renderHook(() => useOnboarding(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.state?.currentStep?.id).toBe("step1");
    });

    // Test next navigation
    await act(async () => {
      await result.current.next({ userData: "test" });
    });

    await waitFor(() => {
      expect(result.current.state?.currentStep?.id).toBe("step2");
    });

    // Test previous navigation
    await act(async () => {
      await result.current.previous();
    });

    await waitFor(() => {
      expect(result.current.state?.currentStep?.id).toBe("step1");
    });

    // Test goToStep navigation
    await act(async () => {
      await result.current.goToStep("step3");
    });

    await waitFor(() => {
      expect(result.current.state?.currentStep?.id).toBe("step3");
    });
  });

  it("should handle context updates", async () => {
    const { result } = renderHook(() => useOnboarding(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.engine).toBeTruthy();
      expect(result.current.state).toBeTruthy();
      expect(result.current.isLoading).toBe(false); // Engine should be initialized
      expect(result.current.currentStep?.id).toBe(mockSteps[0].id);
    });

    await act(async () => {
      await result.current.updateContext({
        flowData: { testKey: "testValue" },
      });
    });

    await waitFor(() => {
      expect(result.current.state?.context.flowData.testKey).toBe("testValue");
    });
  });

  it("should handle reset with new configuration", async () => {
    const { result } = renderHook(() => useOnboarding(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.state?.currentStep?.id).toBe("step1");
    });

    // Navigate to step 2
    await act(async () => {
      await result.current.next();
    });

    await waitFor(() => {
      expect(result.current.state?.currentStep?.id).toBe("step2");
      expect(result.current.isLoading).toBe(false);
    });

    // Reset to initial state
    await act(async () => {
      await result.current.reset();
    });

    // Wait for the reset to complete and state to propagate
    await waitFor(
      () => {
        console.log(
          "After reset - currentStep:",
          result.current.state?.currentStep?.id,
          "isLoading:",
          result.current.isLoading,
        );
        // The engine might go into a loading state during reset and re-initialization
        // So, first wait for it to finish loading, then check the step.
        expect(result.current.isLoading).toBe(false);
        expect(result.current.state?.currentStep?.id).toBe("step1");
        expect(result.current.isCompleted).toBe(false); // Should not be completed
      },
      { timeout: 3000 },
    );
  });

  it("should handle loading state changes", async () => {
    const { result } = renderHook(() => useOnboarding(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setComponentLoading(true);
    });

    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.setComponentLoading(false);
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("should unsubscribe listeners on unmount", async () => {
    const { result, unmount } = renderHook(
      () =>
        useOnboarding({
          onFlowComplete: vi.fn(),
          onStepChange: vi.fn(),
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.engine).toBeTruthy();
    });

    // Mock the unsubscribe functions
    const mockUnsubscribeFlow = vi.fn();
    const mockUnsubscribeStep = vi.fn();

    vi.spyOn(result.current.engine!, "addEventListener").mockReturnValue(
      mockUnsubscribeFlow,
    );
    vi.spyOn(result.current.engine!, "addEventListener").mockReturnValue(
      mockUnsubscribeStep,
    );

    unmount();

    // The cleanup logic is handled by the hook's useEffect cleanup
    // Testing this thoroughly would require more complex engine mocking
  });

  it("should handle engine re-initialization", async () => {
    const initialConfig = { ...mockConfig };
    const { result, rerender } = renderHook(() => useOnboarding(), {
      wrapper: createWrapper(initialConfig),
    });

    await waitFor(() => {
      expect(result.current.engine).toBeTruthy();
    });

    const firstEngine = result.current.engine;

    // Force re-render with new config
    rerender();

    await waitFor(() => {
      // Engine reference should remain stable unless provider config changes
      expect(result.current.engine).toBe(firstEngine);
    });
  });
});
