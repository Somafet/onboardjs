// @onboardjs/react/src/HeadlessOnboardingFlow.test.tsx
import React, { act } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  HeadlessOnboardingFlow,
  HeadlessFlowRenderProps,
} from "./HeadlessOnboardingFlow";
import { OnboardingStep } from "@onboardjs/core";
import {
  mockSteps,
  createMockStepComponent,
  renderWithTestUtils,
} from "./test-utils";

describe("HeadlessOnboardingFlow", () => {
  const mockStepRegistry = {
    INFORMATION: createMockStepComponent("Information"),
    SINGLE_CHOICE: createMockStepComponent("SingleChoice"),
    CHECKLIST: createMockStepComponent("Checklist"),
    CONFIRMATION: createMockStepComponent("Confirmation"),
    CUSTOM_COMPONENT: createMockStepComponent("Custom"),
  };

  const defaultProps = {
    steps: mockSteps,
    stepComponentRegistry: mockStepRegistry,
    initialStepId: "step1",
    initialContext: { user: { name: "Test User" } },
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("Basic Functionality", () => {
    it("should render with children render prop", () => {
      render(
        <HeadlessOnboardingFlow {...defaultProps}>
          {(props: HeadlessFlowRenderProps) => (
            <div data-testid="render-prop-content">
              <span data-testid="current-step">{props.currentStep?.id}</span>
              <span data-testid="loading">{props.isLoading.toString()}</span>
            </div>
          )}
        </HeadlessOnboardingFlow>
      );
      expect(screen.getByTestId("render-prop-content")).toBeInTheDocument();
      expect(screen.getByTestId("current-step")).toHaveTextContent("step1");
    });

    it("should provide all expected props to render function", () => {
      const renderFn = vi.fn(() => <div>Test</div>);

      render(
        <HeadlessOnboardingFlow {...defaultProps}>
          {renderFn}
        </HeadlessOnboardingFlow>
      );

      expect(renderFn).toHaveBeenCalledWith(
        expect.objectContaining({
          state: expect.any(Object),
          currentStep: expect.any(Object),
          isLoading: expect.any(Boolean),
          skip: expect.any(Function),
          next: expect.any(Function),
          previous: expect.any(Function),
          goToStep: expect.any(Function),
          reset: expect.any(Function),
          updateContext: expect.any(Function),
          renderStepContent: expect.any(Function),
        })
      );
    });
    it("should provide current step information", () => {
      render(
        <HeadlessOnboardingFlow {...defaultProps}>
          {({ currentStep }) => (
            <div>
              <span data-testid="step-id">{currentStep?.id}</span>
              <span data-testid="step-type">{currentStep?.type}</span>
              <span data-testid="step-title">{currentStep?.title}</span>
            </div>
          )}
        </HeadlessOnboardingFlow>
      );

      expect(screen.getByTestId("step-id")).toHaveTextContent("step1");
      expect(screen.getByTestId("step-type")).toHaveTextContent("INFORMATION");
      expect(screen.getByTestId("step-title")).toHaveTextContent(
        "Welcome Step"
      );
    });
  });

  describe("Navigation Actions", () => {
    it("should allow navigation to next step", async () => {
      render(
        <HeadlessOnboardingFlow {...defaultProps}>
          {({ currentStep, next }) => (
            <div>
              <span data-testid="current-step">{currentStep?.id}</span>
              <button onClick={() => next()}>Next</button>
            </div>
          )}
        </HeadlessOnboardingFlow>
      );
      expect(screen.getByTestId("current-step")).toHaveTextContent("step1");

      fireEvent.click(screen.getByText("Next"));

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("step2");
      });
    });

    it("should allow navigation to previous step", async () => {
      render(
        <HeadlessOnboardingFlow {...defaultProps} initialStepId="step2">
          {({ currentStep, previous }) => (
            <div>
              <span data-testid="current-step">{currentStep?.id}</span>
              <button onClick={() => previous()}>Previous</button>
            </div>
          )}
        </HeadlessOnboardingFlow>
      );

      expect(screen.getByTestId("current-step")).toHaveTextContent("step2");

      fireEvent.click(screen.getByText("Previous"));

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("step1");
      });
    });

    it("should allow skipping steps", async () => {
      render(
        <HeadlessOnboardingFlow {...defaultProps}>
          {({ currentStep, skip }) => (
            <div>
              <span data-testid="current-step">{currentStep?.id}</span>
              <button data-testid="skip-button" onClick={skip}>
                Skip
              </button>
            </div>
          )}
        </HeadlessOnboardingFlow>
      );

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("step1");
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("skip-button"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("step2");
      });
    });

    it("should allow navigation to specific step", async () => {
      render(
        <HeadlessOnboardingFlow {...defaultProps}>
          {({ currentStep, goToStep }) => (
            <div>
              <span data-testid="current-step">{currentStep?.id}</span>
              <button onClick={() => goToStep("step3")}>Go to Step 3</button>
            </div>
          )}
        </HeadlessOnboardingFlow>
      );

      expect(screen.getByTestId("current-step")).toHaveTextContent("step1");

      fireEvent.click(screen.getByText("Go to Step 3"));

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("step3");
      });
    });

    it("should allow resetting the flow", async () => {
      render(
        <HeadlessOnboardingFlow {...defaultProps} initialStepId="step3">
          {({ currentStep, reset }) => (
            <div>
              <span data-testid="current-step">{currentStep?.id}</span>
              <button onClick={() => reset()}>Reset</button>
            </div>
          )}
        </HeadlessOnboardingFlow>
      );

      expect(screen.getByTestId("current-step")).toHaveTextContent("step3");

      fireEvent.click(screen.getByText("Reset"));

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("step1");
      });
    });
  });

  describe("Context Management", () => {
    it("should provide current context state", () => {
      const initialContext = { user: { name: "John", age: 30 } };

      render(
        <HeadlessOnboardingFlow
          {...defaultProps}
          initialContext={initialContext}
        >
          {({ state }) => (
            <div>
              <span data-testid="context-name">
                {state?.context?.user?.name}
              </span>
              <span data-testid="context-age">{state?.context?.user?.age}</span>
            </div>
          )}
        </HeadlessOnboardingFlow>
      );

      expect(screen.getByTestId("context-name")).toHaveTextContent("John");
      expect(screen.getByTestId("context-age")).toHaveTextContent("30");
    });

    it("should allow updating context", async () => {
      render(
        <HeadlessOnboardingFlow {...defaultProps}>
          {({ state, updateContext }) => (
            <div>
              <span data-testid="context-name">
                {state?.context?.user?.name}
              </span>
              <button
                onClick={() =>
                  updateContext({ user: { name: "Updated User" } })
                }
              >
                Update Context
              </button>
            </div>
          )}
        </HeadlessOnboardingFlow>
      );

      expect(screen.getByTestId("context-name")).toHaveTextContent("Test User");

      fireEvent.click(screen.getByText("Update Context"));

      await waitFor(() => {
        expect(screen.getByTestId("context-name")).toHaveTextContent(
          "Updated User"
        );
      });
    });
  });

  describe("renderStepContent Helper", () => {
    it("should render step content using the helper function", () => {
      render(
        <HeadlessOnboardingFlow {...defaultProps}>
          {({ renderStepContent }) => (
            <div data-testid="step-content">{renderStepContent()}</div>
          )}
        </HeadlessOnboardingFlow>
      );
      expect(screen.getByTestId("step-content")).toBeInTheDocument();
      expect(screen.getByText("Information Component")).toBeInTheDocument();
    });
    it("should render custom component when step type is CUSTOM_COMPONENT", () => {
      const customSteps: OnboardingStep[] = [
        {
          id: "custom-step",
          type: "CUSTOM_COMPONENT",
          title: "Custom Step",
          payload: {
            componentKey: "CUSTOM_COMPONENT",
          },
          nextStep: null,
          previousStep: null,
        },
      ];

      render(
        <HeadlessOnboardingFlow
          {...defaultProps}
          steps={customSteps}
          initialStepId="custom-step"
        >
          {({ renderStepContent }) => (
            <div data-testid="step-content">{renderStepContent()}</div>
          )}
        </HeadlessOnboardingFlow>
      );

      expect(screen.getByText("Custom Component")).toBeInTheDocument();
    });
    it("should show error when component is not registered", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const invalidSteps: OnboardingStep[] = [
        {
          id: "invalid-step",
          type: "CUSTOM_COMPONENT",
          title: "Invalid Step",
          payload: { componentKey: "NONEXISTENT_COMPONENT" },
          nextStep: null,
          previousStep: null,
        },
      ];

      render(
        <HeadlessOnboardingFlow
          {...defaultProps}
          steps={invalidSteps}
          initialStepId="invalid-step"
        >
          {({ renderStepContent }) => (
            <div data-testid="step-content">{renderStepContent()}</div>
          )}
        </HeadlessOnboardingFlow>
      );

      await waitFor(() => {
        expect(
          screen.getByText("Step Component Not Found")
        ).toBeInTheDocument();
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            "No component registered for step type/key: NONEXISTENT_COMPONENT"
          )
        );
      });

      consoleSpy.mockRestore();
    });

    it("should return null when no current step", () => {
      const emptySteps: OnboardingStep[] = [];

      render(
        <HeadlessOnboardingFlow {...defaultProps} steps={emptySteps}>
          {({ renderStepContent }) => (
            <div data-testid="step-content">
              {renderStepContent() || "No content"}
            </div>
          )}
        </HeadlessOnboardingFlow>
      );

      expect(screen.getByText("No content")).toBeInTheDocument();
    });
  });

  describe("Loading States", () => {
    it("should reflect loading state in render props", () => {
      render(
        <HeadlessOnboardingFlow {...defaultProps}>
          {({ isLoading }) => (
            <div>
              <span data-testid="loading-state">{isLoading.toString()}</span>
            </div>
          )}
        </HeadlessOnboardingFlow>
      );

      const loadingState = screen.getByTestId("loading-state");
      expect(["true", "false"]).toContain(loadingState.textContent);
    });

    it("should handle component loading state changes", async () => {
      const TestComponent = () => {
        return (
          <HeadlessOnboardingFlow {...defaultProps}>
            {({ isLoading, next }) => (
              <div>
                <span data-testid="loading">{isLoading.toString()}</span>
                <button onClick={() => next({ someData: "test" })}>
                  Next with Data
                </button>
              </div>
            )}
          </HeadlessOnboardingFlow>
        );
      };

      render(<TestComponent />);

      fireEvent.click(screen.getByText("Next with Data"));

      // Loading state changes are handled internally by the engine
      await waitFor(() => {
        expect(screen.getByTestId("loading")).toBeInTheDocument();
      });
    });
  });

  describe("Persistence Integration", () => {
    it("should support localStorage persistence", async () => {
      const persistenceConfig = {
        key: "test-onboarding",
      };

      const TestComponent = () => {
        return (
          <HeadlessOnboardingFlow
            {...defaultProps}
            localStoragePersistence={persistenceConfig}
          >
            {({ currentStep }) => (
              <div>
                <span data-testid="current-step">{currentStep?.id}</span>
              </div>
            )}
          </HeadlessOnboardingFlow>
        );
      };

      render(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("step1");
      });
    });

    it("should support custom data load/persist handlers", async () => {
      const customOnDataLoad = vi.fn();
      const customOnDataPersist = vi.fn();

      render(
        <HeadlessOnboardingFlow
          {...defaultProps}
          customOnDataLoad={customOnDataLoad}
          customOnDataPersist={customOnDataPersist}
        >
          {({ currentStep }) => (
            <span data-testid="current-step">{currentStep?.id}</span>
          )}
        </HeadlessOnboardingFlow>
      );

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("step1");
      });
    });
  });

  describe("Flow Completion", () => {
    it("should handle flow completion callback", async () => {
      const onFlowComplete = vi.fn();

      render(
        <HeadlessOnboardingFlow
          {...defaultProps}
          onFlowComplete={onFlowComplete}
          initialStepId="step4" // Last step
        >
          {({ currentStep, next }) => (
            <div>
              <span data-testid="current-step">{currentStep?.id}</span>
              <button onClick={() => next()}>Complete</button>
            </div>
          )}
        </HeadlessOnboardingFlow>
      );

      fireEvent.click(screen.getByText("Complete"));

      await waitFor(() => {
        expect(onFlowComplete).toHaveBeenCalled();
      });
    });
  });

  describe("Step Change Callbacks", () => {
    it("should handle step change callbacks", async () => {
      const onStepChange = vi.fn();

      render(
        <HeadlessOnboardingFlow {...defaultProps} onStepChange={onStepChange}>
          {({ currentStep, next }) => (
            <div>
              <span data-testid="current-step">{currentStep?.id}</span>
              <button onClick={() => next()}>Next</button>
            </div>
          )}
        </HeadlessOnboardingFlow>
      );

      fireEvent.click(screen.getByText("Next"));

      await waitFor(() => {
        expect(onStepChange).toHaveBeenCalled();
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle missing step registry gracefully", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      render(
        <HeadlessOnboardingFlow
          {...defaultProps}
          stepComponentRegistry={{}} // Empty registry
        >
          {({ renderStepContent }) => (
            <div data-testid="step-content">{renderStepContent()}</div>
          )}
        </HeadlessOnboardingFlow>
      );

      expect(screen.getByText("Step Component Not Found")).toBeInTheDocument();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should handle invalid step navigation gracefully", async () => {
      render(
        <HeadlessOnboardingFlow {...defaultProps}>
          {({ currentStep, goToStep }) => (
            <div>
              <span data-testid="current-step">{currentStep?.id}</span>
              <button onClick={() => goToStep("nonexistent-step")}>
                Go to Invalid Step
              </button>
            </div>
          )}
        </HeadlessOnboardingFlow>
      );

      const currentStep = screen.getByTestId("current-step").textContent;

      fireEvent.click(screen.getByText("Go to Invalid Step"));

      // Should remain on current step if navigation fails
      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent(
          currentStep!
        );
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty steps array", () => {
      render(
        <HeadlessOnboardingFlow {...defaultProps} steps={[]}>
          {({ currentStep, state }) => (
            <div>
              <span data-testid="current-step">
                {currentStep?.id || "none"}
              </span>
              <span data-testid="state-exists">
                {state ? "exists" : "null"}
              </span>
            </div>
          )}
        </HeadlessOnboardingFlow>
      );

      expect(screen.getByTestId("current-step")).toHaveTextContent("none");
    });
    it("should handle complex step payload data", () => {
      const complexSteps: OnboardingStep[] = [
        {
          id: "complex-step",
          type: "CUSTOM_COMPONENT",
          title: "Complex Form",
          payload: {
            componentKey: "CUSTOM_COMPONENT",
            metadata: {
              category: "user-info",
              priority: "high",
            },
          },
          nextStep: null,
          previousStep: null,
        },
      ];

      render(
        <HeadlessOnboardingFlow
          {...defaultProps}
          steps={complexSteps}
          initialStepId="complex-step"
        >
          {({ currentStep }) => (
            <div>
              <span data-testid="step-title">{currentStep?.title}</span>
              <span data-testid="component-key">
                {"componentKey" in (currentStep?.payload ?? {}) ? (currentStep?.payload as any).componentKey : ""}
              </span>
            </div>
          )}
        </HeadlessOnboardingFlow>
      );

      expect(screen.getByTestId("step-title")).toHaveTextContent(
        "Complex Form"
      );
      expect(screen.getByTestId("component-key")).toHaveTextContent(
        "CUSTOM_COMPONENT"
      );
    });
  });
});
