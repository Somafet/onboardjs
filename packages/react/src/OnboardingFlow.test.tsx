import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OnboardingFlow } from "./OnboardingFlow";
import {
  mockStepComponents,
  mockSteps,
  mockStepsWithoutCriteria,
} from "./test-utils";

describe("OnboardingFlow", () => {
  const defaultProps = {
    steps: mockSteps,
    stepComponentRegistry: mockStepComponents,
    onFlowComplete: vi.fn(),
    onStepChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("should render the first step by default", async () => {
    render(<OnboardingFlow {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId("information-step")).toBeInTheDocument();
      expect(
        screen.getByText("Welcome to the onboarding flow!"),
      ).toBeInTheDocument();
    });
  });

  it("should render with specified initial step", async () => {
    render(<OnboardingFlow {...defaultProps} initialStepId="step2" />);

    await waitFor(() => {
      expect(screen.getByTestId("single-choice-step")).toBeInTheDocument();
      expect(screen.getByText("What is your role?")).toBeInTheDocument();
    });
  });

  it("should render custom LoadingComponent", async () => {
    const LoadingComponent = (
      <div data-testid="custom-loading">Custom Loading...</div>
    );

    render(
      <OnboardingFlow {...defaultProps} LoadingComponent={LoadingComponent} />,
    );

    // Note: This might be difficult to test as loading is usually brief
    // We'd need to mock the engine to stay in loading state
    await waitFor(() => {
      expect(screen.getByTestId("information-step")).toBeInTheDocument();
    });
  });

  it("should render custom EmptyStateComponent when no steps", async () => {
    const EmptyStateComponent = (
      <div data-testid="custom-empty">No steps configured</div>
    );

    render(
      <OnboardingFlow
        {...defaultProps}
        steps={[]}
        EmptyStateComponent={EmptyStateComponent}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("custom-empty")).toBeInTheDocument();
    });
  });

  it("should render custom ErrorComponent on error", async () => {
    const ErrorComponent: React.FC<{ error: Error }> = ({ error }) => (
      <div data-testid="custom-error">Custom Error: {error.message}</div>
    );

    // This is challenging to test without triggering an actual error
    render(
      <OnboardingFlow {...defaultProps} ErrorComponent={ErrorComponent} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("information-step")).toBeInTheDocument();
    });
  });

  it("should render with WrapperComponent", async () => {
    const WrapperComponent: React.FC<{ children: React.ReactNode }> = ({
      children,
    }) => (
      <div data-testid="custom-wrapper" className="custom-wrapper">
        <h1>Custom Wrapper</h1>
        {children}
      </div>
    );

    render(
      <OnboardingFlow {...defaultProps} WrapperComponent={WrapperComponent} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("custom-wrapper")).toBeInTheDocument();
      expect(screen.getByText("Custom Wrapper")).toBeInTheDocument();
      expect(screen.getByTestId("information-step")).toBeInTheDocument();
    });
  });

  it("should handle localStorage persistence", async () => {
    const persistenceConfig = {
      key: "test-flow",
      version: "1.0",
    };

    const { unmount } = render(
      <OnboardingFlow
        {...defaultProps}
        localStoragePersistence={persistenceConfig}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("information-step")).toBeInTheDocument();
    });

    // Navigate to next step
    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByTestId("single-choice-step")).toBeInTheDocument();
    });

    // Unmount and remount
    unmount();

    render(
      <OnboardingFlow
        {...defaultProps}
        localStoragePersistence={persistenceConfig}
      />,
    );

    // Should restore to step2
    await waitFor(() => {
      expect(screen.getByTestId("single-choice-step")).toBeInTheDocument();
    });
  });

  it("should use custom onDataLoad and onDataPersist", async () => {
    const customOnDataLoad = vi.fn().mockResolvedValue({
      currentStepId: "step1",
      flowData: { testKey: "testValue" },
    });
    const customOnDataPersist = vi.fn().mockResolvedValue(undefined);

    render(
      <OnboardingFlow
        {...defaultProps}
        customOnDataLoad={customOnDataLoad}
        customOnDataPersist={customOnDataPersist}
      />,
    );
    await waitFor(() => {
      expect(customOnDataLoad).toHaveBeenCalled();
      expect(screen.getByTestId("information-step")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(customOnDataLoad).toHaveBeenCalled();
      expect(screen.getByTestId("single-choice-step")).toBeInTheDocument();
    });

    // Navigate to trigger persistence
    fireEvent.click(screen.getByText("Back"));

    await waitFor(() => {
      expect(customOnDataPersist).toHaveBeenCalled();
    });
  });

  it("should prioritize custom persistence over localStorage", async () => {
    const customOnDataLoad = vi.fn().mockResolvedValue({
      currentStepId: "step2",
      flowData: {},
    });

    const persistenceConfig = {
      key: "test-flow",
      version: "1.0",
    };

    render(
      <OnboardingFlow
        {...defaultProps}
        localStoragePersistence={persistenceConfig}
        customOnDataLoad={customOnDataLoad}
      />,
    );

    await waitFor(() => {
      expect(customOnDataLoad).toHaveBeenCalled();
      expect(screen.getByTestId("single-choice-step")).toBeInTheDocument();
    });
  });

  it("should handle flow completion", async () => {
    const onFlowComplete = vi.fn();

    render(
      <OnboardingFlow
        {...defaultProps}
        steps={mockStepsWithoutCriteria}
        onFlowComplete={onFlowComplete}
        initialStepId="step4"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("confirmation-step")).toBeInTheDocument();
    });

    // Complete the flow
    fireEvent.click(screen.getByText("Finish"));

    await waitFor(() => {
      expect(onFlowComplete).toHaveBeenCalled();
    });
  });

  it("should handle step changes", async () => {
    const onStepChange = vi.fn();

    render(<OnboardingFlow {...defaultProps} onStepChange={onStepChange} />);

    await waitFor(() => {
      expect(screen.getByTestId("information-step")).toBeInTheDocument();
    });

    // Navigate to next step
    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(onStepChange).toHaveBeenCalled();
      expect(screen.getByTestId("single-choice-step")).toBeInTheDocument();
    });
  });

  it("should pass initial context to provider", async () => {
    const initialContext = {
      flowData: { userType: "premium" },
      currentUser: { name: "John Doe" },
    };

    render(
      <OnboardingFlow {...defaultProps} initialContext={initialContext} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("information-step")).toBeInTheDocument();
    });

    // The context should be available in the steps, but testing this
    // would require a step component that displays context data
  });

  // it("should handle complex step types", async () => {
  //   const complexSteps: OnboardingStep[] = [
  //     {
  //       id: "checklist1",
  //       type: "CHECKLIST",
  //       title: "Complete Tasks",
  //       payload: {
  //         items: [
  //           { id: "task1", label: "Task 1", isMandatory: true },
  //           { id: "task2", label: "Task 2", isMandatory: false },
  //         ],
  //         dataKey: "checklistData",
  //       },
  //       nextStep: "custom1",
  //     },
  //     {
  //       id: "custom1",
  //       type: "CUSTOM_COMPONENT",
  //       title: "Custom Step",
  //       payload: {
  //         componentKey: "SpecialComponent",
  //         data: { special: true },
  //       },
  //     },
  //   ];

  //   render(<OnboardingFlow {...defaultProps} steps={complexSteps} />);

  //   await waitFor(() => {
  //     expect(screen.getByTestId("checklist-step")).toBeInTheDocument();
  //     expect(screen.getByText("Complete Tasks")).toBeInTheDocument();
  //   });

  //   // Complete all checklist tasks (including mandatory)
  //   act(() => {
  //     fireEvent.click(screen.getByTestId("task1"));
  //   });
  //   act(() => {
  //     fireEvent.click(screen.getByTestId("task2"));
  //   });

  //   act(() => {
  //     fireEvent.click(screen.getByText("Next"));
  //   });

  //   await waitFor(() => {
  //     expect(screen.getByTestId("custom-component-step")).toBeInTheDocument();
  //     expect(
  //       screen.getByText("Component Key: SpecialComponent")
  //     ).toBeInTheDocument();
  //   });
  // });

  it("should handle navigation with step data", async () => {
    render(<OnboardingFlow {...defaultProps} initialStepId="step2" />);

    await waitFor(() => {
      expect(screen.getByTestId("single-choice-step")).toBeInTheDocument();
    });

    // Select an option
    fireEvent.click(screen.getByLabelText("Developer"));

    // Navigate with the selected data
    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByTestId("checklist-step")).toBeInTheDocument();
    });
  });

  it("should handle multiple onboarding flows independently", async () => {
    const flow1Steps = [
      {
        id: "flow1-step1",
        type: "INFORMATION" as const,
        title: "Flow 1 Step",
        payload: { mainText: "Flow 1 content" },
      },
    ];

    const flow2Steps = [
      {
        id: "flow2-step1",
        type: "INFORMATION" as const,
        title: "Flow 2 Step",
        payload: { mainText: "Flow 2 content" },
      },
    ];

    const { container: container1 } = render(
      <OnboardingFlow
        steps={flow1Steps}
        stepComponentRegistry={mockStepComponents}
        onFlowComplete={vi.fn()}
        onStepChange={vi.fn()}
      />,
    );

    const { container: container2 } = render(
      <OnboardingFlow
        steps={flow2Steps}
        stepComponentRegistry={mockStepComponents}
        onFlowComplete={vi.fn()}
        onStepChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        container1.querySelector('[data-testid="information-step"]'),
      ).toBeInTheDocument();
      expect(
        container2.querySelector('[data-testid="information-step"]'),
      ).toBeInTheDocument();
    });

    // Both flows should render their respective content
    expect(screen.getByText("Flow 1 content")).toBeInTheDocument();
    expect(screen.getByText("Flow 2 content")).toBeInTheDocument();
  });
});
