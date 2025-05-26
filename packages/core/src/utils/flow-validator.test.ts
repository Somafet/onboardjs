import { validateFlow, ValidationIssue } from "./flow-validator";
import { OnboardingStep } from "../types"; // Adjust path as needed
import { describe, it, expect } from "vitest"; // Using Vitest for testing

describe("validateFlow", () => {
  // Helper to easily check for a specific issue message
  const expectIssueWithMessage = (
    issues: ValidationIssue[],
    messagePart: string,
    level: "error" | "warning" = "error"
  ) => {
    expect(
      issues.some(
        (issue) => issue.message.includes(messagePart) && issue.level === level
      )
    ).toBe(true);
  };

  const expectNoIssueWithMessage = (
    issues: ValidationIssue[],
    messagePart: string
  ) => {
    expect(issues.some((issue) => issue.message.includes(messagePart))).toBe(
      false
    );
  };

  it("should return no issues for a valid minimal flow", () => {
    const steps: OnboardingStep[] = [
      {
        id: "step1",
        type: "INFORMATION",
        title: "Welcome Step 1",
        payload: { mainText: "Hi" },
        nextStep: 2,
      },
      {
        id: 2,
        type: "INFORMATION",
        title: "Input Form Step 2",
        payload: { mainText: "Please enter your details" },
        previousStep: "step1",
      },
    ];
    const issues = validateFlow(steps);
    expect(issues).toEqual([]);
  });

  it("should return no issues for a valid flow with CUSTOM_COMPONENT", () => {
    const steps: OnboardingStep[] = [
      {
        id: "custom1",
        type: "CUSTOM_COMPONENT",
        title: "Custom Component",
        payload: { componentKey: "MyCustomWelcome", title: "Welcome!" },
        nextStep: null,
      },
    ];
    const issues = validateFlow(steps);
    expect(issues).toEqual([]);
  });

  it("should return a warning for an empty flow", () => {
    const steps: OnboardingStep[] = [];
    const issues = validateFlow(steps);
    expect(issues.length).toBe(1);
    expectIssueWithMessage(
      issues,
      "onboarding flow has no steps defined",
      "warning"
    );
  });

  it("should return an error for a step missing an ID", () => {
    const steps: any[] = [
      // Use any to simulate missing properties
      {
        type: "INFORMATION",
        title: "Missing ID Step",
        payload: { mainText: "Hi" },
      },
    ];
    const issues = validateFlow(steps as OnboardingStep[]);
    expect(issues.length).toBe(1);
    expectIssueWithMessage(issues, "Step at index 0 is missing an 'id'");
  });

  it("should return an error for duplicate step IDs", () => {
    const steps: OnboardingStep[] = [
      {
        id: "step1",
        type: "INFORMATION",
        title: "Welcome",
        payload: { mainText: "Hi" },
      },
      {
        id: "step1",
        type: "INFORMATION",
        title: "Input Form",
        payload: { mainText: "Please enter your details" },
      },
    ];
    const issues = validateFlow(steps);
    expect(issues.length).toBe(1);
    expectIssueWithMessage(issues, "Duplicate step ID found: 'step1'");
  });

  it("should return an error for a step missing a type", () => {
    const steps: any[] = [
      { id: "step1", title: "Missing Type Step", payload: { mainText: "Hi" } },
    ];
    const issues = validateFlow(steps as OnboardingStep[]);
    expect(issues.length).toBe(1);
    expectIssueWithMessage(issues, "Step 'step1' is missing a 'type'");
  });

  it("should return an error for CUSTOM_COMPONENT missing payload.componentKey", () => {
    const steps: OnboardingStep[] = [
      {
        id: "custom1",
        type: "CUSTOM_COMPONENT",
        title: "Custom Component Missing Key", // Added title
        payload: { title: "Oops" } as any,
      }, // Cast to any to simulate missing key
    ];
    const issues = validateFlow(steps);
    expect(issues.length).toBe(1);
    expectIssueWithMessage(
      issues,
      "Step 'custom1' is of type 'CUSTOM_COMPONENT' but is missing 'payload.componentKey'"
    );
  });

  it("should return an error for CUSTOM_COMPONENT with null payload", () => {
    const steps: OnboardingStep[] = [
      {
        id: "custom1",
        type: "CUSTOM_COMPONENT",
        title: "Custom Null Payload",
        payload: null as any,
      },
    ];
    const issues = validateFlow(steps);
    expect(issues.length).toBe(1);
    expectIssueWithMessage(
      issues,
      "Step 'custom1' is of type 'CUSTOM_COMPONENT' but is missing 'payload.componentKey'"
    );
  });

  it("should return a warning for a broken nextStep link", () => {
    const steps: OnboardingStep[] = [
      {
        id: "step1",
        type: "INFORMATION",
        title: "Broken Next Step", // Added title
        payload: { mainText: "Hi" },
        nextStep: "nonExistentStep",
      },
    ];
    const issues = validateFlow(steps);
    expect(issues.length).toBe(1);
    expectIssueWithMessage(
      issues,
      "Step 'step1' has a 'nextStep' property pointing to a non-existent step ID: 'nonExistentStep'",
      "warning"
    );
    expect(issues[0].relatedStepId).toBe("nonExistentStep");
  });

  it("should return a warning for a broken skipToStep link", () => {
    const steps: OnboardingStep[] = [
      {
        id: "step1",
        type: "INFORMATION",
        title: "Broken Skip Step", // Added title
        payload: { mainText: "Hi" },
        isSkippable: true,
        skipToStep: "nonExistentSkipTarget",
      },
    ];
    const issues = validateFlow(steps);
    expect(issues.length).toBe(1);
    expectIssueWithMessage(
      issues,
      "Step 'step1' has a 'skipToStep' property pointing to a non-existent step ID: 'nonExistentSkipTarget'",
      "warning"
    );
  });

  it("should NOT return a warning for a null nextStep (end of flow)", () => {
    const steps: OnboardingStep[] = [
      {
        id: "step1",
        type: "INFORMATION",
        title: "Null Next Step", // Added title
        payload: { mainText: "Hi" },
        nextStep: null,
      },
    ];
    const issues = validateFlow(steps);
    expect(issues).toEqual([]);
  });

  it("should NOT return a warning for an undefined nextStep (end of flow)", () => {
    const steps: OnboardingStep[] = [
      {
        id: "step1",
        type: "INFORMATION",
        title: "Undefined Next Step",
        payload: { mainText: "Hi" },
      }, // nextStep is undefined
    ];
    const issues = validateFlow(steps);
    expect(issues).toEqual([]);
  });

  it("should handle functional nextStep without validation error (static analysis limitation)", () => {
    const steps: OnboardingStep[] = [
      {
        id: "step1",
        type: "INFORMATION",
        title: "Functional Next Step 1", // Added title
        payload: { mainText: "Hi" },
        nextStep: () => "step2",
      },
      {
        id: "step2",
        type: "INFORMATION",
        title: "Functional Next Step 2",
        payload: { mainText: "There" },
      }, // Added title
    ];
    const issues = validateFlow(steps);
    // We don't expect an error for the functional link because static analysis can't resolve it.
    // The validator currently only checks string links.
    expectNoIssueWithMessage(issues, "pointing to a non-existent step ID");
    expect(issues).toEqual([]);
  });

  it("should correctly identify multiple issues in a complex broken flow", () => {
    const steps: OnboardingStep[] = [
      {
        id: "s1",
        type: "INFORMATION",
        title: "Step S1",
        payload: { mainText: "1" },
        nextStep: "s_non_existent",
      },
      {
        id: "s2",
        type: "CUSTOM_COMPONENT",
        title: "Step S2",
        payload: {} as any,
      }, // Missing componentKey
      {
        id: "s1",
        type: "INFORMATION",
        title: "Step S1 Duplicate",
        payload: { mainText: "1-dup" },
      }, // Duplicate ID
      {
        id: "s3",
        type: null as any,
        title: "Step S3",
        payload: { mainText: "3" },
      }, // Missing type
      {
        id: "s4",
        type: "INFORMATION",
        title: "Step S4",
        payload: { mainText: "4" },
        isSkippable: true,
        skipToStep: "s_skip_non_existent",
      },
    ];
    const issues = validateFlow(steps);
    expect(issues.length).toBeGreaterThanOrEqual(4); // Could be 5 if duplicate ID also triggers other checks on the second 's1'
    expectIssueWithMessage(
      issues,
      "pointing to a non-existent step ID: 's_non_existent'",
      "warning"
    );
    expectIssueWithMessage(
      issues,
      "Step 's2' is of type 'CUSTOM_COMPONENT' but is missing 'payload.componentKey'"
    );
    expectIssueWithMessage(issues, "Duplicate step ID found: 's1'");
    expectIssueWithMessage(issues, "Step 's3' is missing a 'type'");
    expectIssueWithMessage(
      issues,
      "pointing to a non-existent step ID: 's_skip_non_existent'",
      "warning"
    );
  });

  it("should not warn for valid previousStep links", () => {
    const steps: OnboardingStep[] = [
      {
        id: "step1",
        type: "INFORMATION",
        title: "Valid Previous Step 1", // Added title
        payload: { mainText: "Hi" },
        nextStep: "step2",
      },
      {
        id: "step2",
        type: "INFORMATION",
        title: "Valid Previous Step 2", // Added title
        payload: { mainText: "Please enter your details" },
        previousStep: "step1",
      },
    ];
    const issues = validateFlow(steps);
    expect(issues).toEqual([]);
  });

  it("should not warn for null or undefined previousStep", () => {
    const steps: OnboardingStep[] = [
      {
        id: "step1",
        type: "INFORMATION",
        title: "Null Previous Step", // Added title
        payload: { mainText: "Hi" },
        previousStep: null,
      },
      {
        id: "step2",
        type: "INFORMATION",
        title: "Undefined Previous Step",
        payload: { mainText: "Hi" },
      }, // undefined previousStep
    ];
    const issues = validateFlow(steps);
    expect(issues).toEqual([]);
  });

  it("should return an error for SINGLE_CHOICE with no options", () => {
    const steps: OnboardingStep[] = [
      {
        id: "singleChoice1",
        type: "SINGLE_CHOICE",
        title: "Single Choice Step",
        payload: {
          question: "What is your role?",
          options: [], // No options provided
          dataKey: "userRole",
        },
      },
    ];
    const issues = validateFlow(steps);
    expect(issues.length).toBe(1);
    expectIssueWithMessage(
      issues,
      "Step 'singleChoice1' is of type 'SINGLE_CHOICE' but has no valid 'options'."
    );
  });

  it("should return an error for MULTIPLE_CHOICE with no options", () => {
    const steps: OnboardingStep[] = [
      {
        id: "multipleChoice1",
        type: "MULTIPLE_CHOICE",
        title: "Multiple Choice Step",
        payload: {
          question: "Select your interests",
          options: [], // No options provided
          dataKey: "userInterests",
        },
      },
    ];
    const issues = validateFlow(steps);
    expect(issues.length).toBe(1);
    expectIssueWithMessage(
      issues,
      "Step 'multipleChoice1' is of type 'MULTIPLE_CHOICE' but has no valid 'options'."
    );
  });
});
