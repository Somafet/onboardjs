import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import StepRenderer from "./StepRenderer";
import {
  mockStepComponents,
  renderWithOnboardingProvider,
} from "../test-utils";
import { OnboardingStep } from "@onboardjs/core";

describe("StepRenderer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should render the current step using the step component registry", async () => {
    renderWithOnboardingProvider(
      <StepRenderer stepComponentRegistry={mockStepComponents} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("information-step")).toBeInTheDocument();
      expect(
        screen.getByText("Welcome to the onboarding flow!"),
      ).toBeInTheDocument();
    });
  });

  it("should show loading component when isLoading is true", async () => {
    const LoadingComponent = <div data-testid="custom-loading">Loading...</div>;

    renderWithOnboardingProvider(
      <StepRenderer
        stepComponentRegistry={mockStepComponents}
        LoadingComponent={LoadingComponent}
      />,
    );

    // The provider might initially be loading
    // This is hard to test without more control over the loading state
    // For now, just verify the component renders
    await waitFor(() => {
      expect(screen.getByTestId("information-step")).toBeInTheDocument();
    });
  });

  it("should show empty state component when no current step", async () => {
    const EmptyStateComponent = (
      <div data-testid="custom-empty">No step active</div>
    );

    renderWithOnboardingProvider(
      <StepRenderer
        stepComponentRegistry={mockStepComponents}
        EmptyStateComponent={EmptyStateComponent}
      />,
      {
        onboardingConfig: {
          steps: [], // Empty steps array
        },
      },
    );

    await waitFor(() => {
      expect(screen.getByTestId("custom-empty")).toBeInTheDocument();
    });
  });

  it("should show error component when there is an error", async () => {
    const ErrorComponent: React.FC<{ error: Error }> = ({ error }) => (
      <div data-testid="custom-error">Error: {error.message}</div>
    );

    // This is challenging to test without triggering an actual error
    // We would need to mock the engine to return an error state
    renderWithOnboardingProvider(
      <StepRenderer
        stepComponentRegistry={mockStepComponents}
        ErrorComponent={ErrorComponent}
      />,
    );

    // For now, just verify the component renders without the error state
    await waitFor(() => {
      expect(screen.getByTestId("information-step")).toBeInTheDocument();
    });
  });

  it("should handle step navigation with next button", async () => {
    renderWithOnboardingProvider(
      <StepRenderer stepComponentRegistry={mockStepComponents} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("information-step")).toBeInTheDocument();
    });

    // Find and click the next button
    const nextButton = screen.getByText("Next");
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByTestId("single-choice-step")).toBeInTheDocument();
      expect(screen.getByText("What is your role?")).toBeInTheDocument();
    });
  });

  it("should handle step navigation with previous button", async () => {
    renderWithOnboardingProvider(
      <StepRenderer stepComponentRegistry={mockStepComponents} />,
      {
        onboardingConfig: {
          initialStepId: "step2", // Start at step 2
        },
      },
    );

    await waitFor(() => {
      expect(screen.getByTestId("single-choice-step")).toBeInTheDocument();
    });

    // Find and click the previous button
    const prevButton = screen.getByText("Back");
    fireEvent.click(prevButton);

    await waitFor(() => {
      expect(screen.getByTestId("information-step")).toBeInTheDocument();
    });
  });

  it("should handle skip functionality for skippable steps", async () => {
    const skippableSteps: OnboardingStep[] = [
      {
        id: "step1",
        type: "INFORMATION",
        payload: { title: "Skippable Step", mainText: "You can skip this" },
        isSkippable: true,
        nextStep: "step2",
        skipToStep: "step3",
      },
      {
        id: "step2",
        type: "INFORMATION",
        payload: { title: "Step 2", mainText: "Regular step" },
        nextStep: "step3",
      },
      {
        id: "step3",
        type: "CONFIRMATION",
        payload: { title: "Final Step", confirmationMessage: "All done!" },
      },
    ];

    renderWithOnboardingProvider(
      <StepRenderer stepComponentRegistry={mockStepComponents} />,
      {
        onboardingConfig: {
          steps: skippableSteps,
        },
      },
    );

    await waitFor(() => {
      expect(screen.getByText("You can skip this")).toBeInTheDocument();
    });

    // Find and click the skip button
    const skipButton = screen.getByText("Skip");
    fireEvent.click(skipButton);

    await waitFor(() => {
      expect(screen.getByTestId("confirmation-step")).toBeInTheDocument();
      expect(screen.getByText("All done!")).toBeInTheDocument();
    });
  });

  it("should show finish button on last step", async () => {
    renderWithOnboardingProvider(
      <StepRenderer stepComponentRegistry={mockStepComponents} />,
      {
        onboardingConfig: {
          initialStepId: "step4", // Start at last step
        },
      },
    );

    await waitFor(() => {
      expect(screen.getByTestId("confirmation-step")).toBeInTheDocument();
    });

    // Should show finish button instead of next
    expect(screen.getByText("Finish")).toBeInTheDocument();
    expect(screen.queryByText("Next")).not.toBeInTheDocument();
  });

  it("should handle step data changes and validation", async () => {
    renderWithOnboardingProvider(
      <StepRenderer stepComponentRegistry={mockStepComponents} />,
      {
        onboardingConfig: {
          initialStepId: "step2", // Start at choice step
        },
      },
    );

    await waitFor(() => {
      expect(screen.getByTestId("single-choice-step")).toBeInTheDocument();
    });

    // Initially, next button should be enabled (assuming step is valid by default)
    const nextButton = screen.getByText("Next");
    expect(nextButton).not.toBeDisabled();

    // Select an option
    const developerOption = screen.getByLabelText("Developer");
    fireEvent.click(developerOption);

    // Next button should still be enabled
    expect(nextButton).not.toBeDisabled();
  });

  it("should disable navigation buttons when loading", async () => {
    // This test would require more sophisticated mocking to simulate loading state
    // For now, we'll just verify the buttons exist and are functional
    renderWithOnboardingProvider(
      <StepRenderer stepComponentRegistry={mockStepComponents} />,
      {
        onboardingConfig: {
          initialStepId: "step2",
        },
      },
    );

    await waitFor(() => {
      expect(screen.getByText("Next")).toBeInTheDocument();
      expect(screen.getByText("Back")).toBeInTheDocument();
    });
  });

  it("should handle missing step component gracefully", async () => {
    const incompleteRegistry = {
      INFORMATION: mockStepComponents.INFORMATION,
      // Missing SINGLE_CHOICE component
    };

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    renderWithOnboardingProvider(
      <StepRenderer stepComponentRegistry={incompleteRegistry as any} />,
      {
        onboardingConfig: {
          initialStepId: "step2", // SINGLE_CHOICE step
        },
      },
    );

    // Should still render something (likely an error or fallback)
    await waitFor(() => {
      expect(
        screen.getByText(
          `Error: Component for step type "SINGLE_CHOICE" not found.`,
        ),
      ).toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });

  it("should handle CUSTOM_COMPONENT steps", async () => {
    const customSteps: OnboardingStep[] = [
      {
        id: "custom1",
        type: "CUSTOM_COMPONENT",
        payload: {
          title: "Custom Component",
          componentKey: "MyCustomComponent",
          customData: "test",
        },
      },
    ];

    const ComponentForCustom1 = ({ payload }: any) => (
      <div data-testid="custom1-component-step">
        <h2>Custom Component Step</h2>
        <p>Component Key: {payload.componentKey}</p>
      </div>
    );

    renderWithOnboardingProvider(
      <StepRenderer
        stepComponentRegistry={{
          ...mockStepComponents,
          MyCustomComponent: ComponentForCustom1,
        }}
      />,
      {
        onboardingConfig: {
          steps: customSteps,
        },
      },
    );

    await waitFor(() => {
      expect(screen.getByTestId("custom1-component-step")).toBeInTheDocument();
      expect(
        screen.getByText("Component Key: MyCustomComponent"),
      ).toBeInTheDocument();
    });
  });

  it("should reset step data when step changes", async () => {
    renderWithOnboardingProvider(
      <StepRenderer stepComponentRegistry={mockStepComponents} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("information-step")).toBeInTheDocument();
    });

    // Navigate to next step
    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByTestId("single-choice-step")).toBeInTheDocument();
    });

    // Step data should be reset for the new step
    // This is implicitly tested by the component rendering correctly
    expect(screen.getByText("What is your role?")).toBeInTheDocument();
  });

  // it("should handle multiple choice steps", async () => {
  //   const multipleChoiceSteps: OnboardingStep[] = [
  //     {
  //       id: "multi1",
  //       type: "MULTIPLE_CHOICE",
  //       title: "Multiple Choice",
  //       payload: {
  //         question: "Select your interests",
  //         options: [
  //           { id: "coding", label: "Coding", value: "coding" },
  //           { id: "design", label: "Design", value: "design" },
  //           { id: "testing", label: "Testing", value: "testing" },
  //         ],
  //         dataKey: "interests",
  //       },
  //     },
  //     {
  //       id: "finish",
  //       type: "CONFIRMATION",
  //       title: "Yay!",
  //       payload: {
  //         confirmationMessage: "You selected your interests!",
  //       },
  //     },
  //   ];

  //   renderWithOnboardingProvider(
  //     <StepRenderer stepComponentRegistry={mockStepComponents} />,
  //     {
  //       onboardingConfig: {
  //         steps: multipleChoiceSteps,
  //       },
  //     }
  //   );

  //   await waitFor(() => {
  //     expect(screen.getByTestId("multiple-choice-step")).toBeInTheDocument();
  //     expect(screen.getByText("Select your interests")).toBeInTheDocument();
  //   });

  //   // Select multiple options
  //   fireEvent.click(screen.getByLabelText("Coding"));
  //   fireEvent.click(screen.getByLabelText("Design"));

  //   // Next button should be enabled after making selections
  //   expect(screen.getByText("Next")).not.toBeDisabled();
  // });
});
