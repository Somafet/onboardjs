import { BaseOnboardingStep, OnboardingContext } from "./common"; // Import OnboardingContext for the generic constraint
import {
  MultipleChoiceStepPayload,
  SingleChoiceStepPayload,
  ConfirmationStepPayload,
  CustomComponentStepPayload,
  ChecklistStepPayload, // This will now be ChecklistStepPayload<TContext>
  InformationStepPayload,
} from "./payloads";

export type OnboardingStepType =
  | "INFORMATION"
  | "MULTIPLE_CHOICE"
  | "SINGLE_CHOICE"
  | "CONFIRMATION"
  | "CUSTOM_COMPONENT"
  | "CHECKLIST";

// Make OnboardingStep generic for TContext
export type OnboardingStep<TContext extends OnboardingContext = OnboardingContext> =
  | (BaseOnboardingStep<"INFORMATION", CustomComponentStepPayload, TContext> & {
      type?: never; // Allow type to be optional for INFORMATION step
      payload?: CustomComponentStepPayload;
    })
  | (BaseOnboardingStep<"INFORMATION", InformationStepPayload, TContext> & {
      type: "INFORMATION";
      payload?: InformationStepPayload;
    })
  | (BaseOnboardingStep<
      "MULTIPLE_CHOICE",
      MultipleChoiceStepPayload,
      TContext
    > & {
      type: "MULTIPLE_CHOICE";
      payload: MultipleChoiceStepPayload;
    })
  | (BaseOnboardingStep<"SINGLE_CHOICE", SingleChoiceStepPayload, TContext> & {
      type: "SINGLE_CHOICE";
      payload: SingleChoiceStepPayload;
    })
  | (BaseOnboardingStep<"CONFIRMATION", ConfirmationStepPayload, TContext> & {
      type: "CONFIRMATION";
      payload?: ConfirmationStepPayload;
    })
  | (BaseOnboardingStep<
      "CHECKLIST",
      ChecklistStepPayload<TContext>, // Use generic ChecklistStepPayload
      TContext
    > & {
      type: "CHECKLIST";
      payload: ChecklistStepPayload<TContext>; // Use generic ChecklistStepPayload
    })
  | (BaseOnboardingStep<
      "CUSTOM_COMPONENT",
      CustomComponentStepPayload,
      TContext
    > & {
      type: "CUSTOM_COMPONENT";
      payload?: CustomComponentStepPayload;
    });
