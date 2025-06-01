import React from "react";
import { render, RenderOptions } from "@testing-library/react";
import { vi } from "vitest";
import { OnboardingStep, OnboardingEngineConfig } from "@onboardjs/core";
import { OnboardingProvider } from "./context/OnboardingProvider";
import { StepComponentRegistry } from "./types";

// Helper function to create mock step components
export const createMockStepComponent =
  (name: string) =>
  ({ payload, onDataChange }: any) => (
    <div data-testid={`${name.toLowerCase()}-step`}>
      <h2>{name} Component</h2>
      <p>Step content for {name}</p>
      {onDataChange && (
        <button onClick={() => onDataChange({}, true)}>{name} Action</button>
      )}
    </div>
  );

// Mock step components for testing
export const mockStepComponents: StepComponentRegistry = {
  INFORMATION: ({ payload, onDataChange }) => (
    <div data-testid="information-step">
      <h2>Information Component</h2>
      <p>{payload?.mainText}</p>
      {payload?.subText && <p>{payload.subText}</p>}
    </div>
  ),
  SINGLE_CHOICE: ({ payload, onDataChange }) => {
    const { question, options } = payload;
    return (
      <div data-testid="single-choice-step">
        <h2>{question}</h2>
        {options?.map((option: any) => (
          <label key={option.id}>
            <input
              type="radio"
              name="choice"
              value={option.value}
              onChange={(e) =>
                onDataChange({ [payload.dataKey]: e.target.value }, true)
              }
            />
            {option.label}
          </label>
        ))}
      </div>
    );
  },
  MULTIPLE_CHOICE: ({ payload, onDataChange }) => {
    const { question, options } = payload;
    const [selected, setSelected] = React.useState<string[]>([]);

    const handleChange = (value: string, checked: boolean) => {
      const newSelected = checked
        ? [...selected, value]
        : selected.filter((v) => v !== value);
      setSelected(newSelected);
      onDataChange({ [payload.dataKey]: newSelected }, newSelected.length > 0);
    };

    return (
      <div data-testid="multiple-choice-step">
        <h2>{question}</h2>
        {options?.map((option: any) => (
          <label key={option.id}>
            <input
              type="checkbox"
              value={option.value}
              onChange={(e) => handleChange(e.target.value, e.target.checked)}
            />
            {option.label}
          </label>
        ))}
      </div>
    );
  },
  CHECKLIST: ({ payload, onDataChange }) => {
    const { items } = payload;
    return (
      <div data-testid="checklist-step">
        <h2>Checklist Component</h2>
        {items?.map((item: any) => (
          <label key={item.id} htmlFor={item.id}>
            <input
              id={item.id}
              name={item.id}
              data-testid={item.id}
              type="checkbox"
              onChange={(e) =>
                onDataChange({ [item.id]: e.target.checked }, true)
              }
            />
            {item.label}
          </label>
        ))}
      </div>
    );
  },
  CONFIRMATION: ({ payload, onDataChange }) => (
    <div data-testid="confirmation-step">
      <h2>Confirmation Component</h2>
      <p>{payload?.confirmationMessage}</p>
      <button onClick={() => onDataChange(true, true)}>Confirm</button>
    </div>
  ),
  CUSTOM_COMPONENT: ({ payload, onDataChange }) => (
    <div data-testid="custom-component-step">
      <h2>Custom Component</h2>
      <p>Component Key: {payload?.componentKey}</p>
    </div>
  ),
};

// Mock steps for testing
export const mockSteps: OnboardingStep[] = [
  {
    id: "step1",
    type: "INFORMATION",
    payload: {
      title: "Welcome Step",
      mainText: "Welcome to the onboarding flow!",
      subText: "Let's get started",
    },
    nextStep: "step2",
    isSkippable: true,
    skipToStep: "step2",
  },
  {
    id: "step2",
    type: "SINGLE_CHOICE",
    payload: {
      title: "Role Selection",
      question: "What is your role?",
      options: [
        { id: "dev", label: "Developer", value: "developer" },
        { id: "des", label: "Designer", value: "designer" },
      ],
      dataKey: "userRole",
    },
    previousStep: "step1",
    nextStep: "step3",
  },
  {
    id: "step3",
    type: "CHECKLIST",
    payload: {
      title: "Complete Tasks",
      items: [
        { id: "task1", label: "Task 1", isMandatory: true },
        { id: "task2", label: "Task 2", isMandatory: false },
      ],
      dataKey: "taskData",
    },
    previousStep: "step2",
    nextStep: "step4",
  },
  {
    id: "step4",
    type: "CONFIRMATION",
    payload: {
      title: "Final Step",
      confirmationMessage: "All done!",
    },
    previousStep: "step3",
    nextStep: null,
  },
];

// Mock steps for testing
export const mockStepsWithoutCriteria: OnboardingStep[] = [
  {
    id: "step1",
    type: "INFORMATION",
    payload: {
      title: "Welcome Step",
      mainText: "Welcome to the onboarding flow!",
      subText: "Let's get started",
    },
    isSkippable: true,
    skipToStep: "step2",
  },
  {
    id: "step2",
    type: "INFORMATION",
    payload: {
      title: "Welcome Step",
      mainText: "Welcome to step 2!",
      subText: "Let's get started",
    },
  },
  {
    id: "step3",
    type: "INFORMATION",
    payload: {
      title: "Step 3",
      mainText: "Welcome to step 3!",
      subText: "Let's get started",
    },
  },
  {
    id: "step4",
    type: "CONFIRMATION",
    payload: {
      title: "Final Step",
      confirmationMessage: "All done!",
    },
    nextStep: null,
  },
];

// Custom render function with OnboardingProvider
interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  onboardingConfig?: Partial<OnboardingEngineConfig>;
  localStoragePersistence?: any;
}

export function renderWithOnboardingProvider(
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) {
  const {
    onboardingConfig = {},
    localStoragePersistence,
    ...renderOptions
  } = options;

  const defaultConfig: OnboardingEngineConfig = {
    steps: mockSteps,
    onFlowComplete: vi.fn(),
    onStepChange: vi.fn(),
    ...onboardingConfig,
  };

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <OnboardingProvider
        {...defaultConfig}
        localStoragePersistence={localStoragePersistence}
      >
        {children}
      </OnboardingProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Alternative render function for tests that don't need provider
export function renderWithTestUtils(
  ui: React.ReactElement,
  options: RenderOptions = {}
) {
  return render(ui, options);
}
