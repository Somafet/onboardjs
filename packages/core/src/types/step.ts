// @onboardjs/core/src/types/step.ts

import { BaseOnboardingStep } from "./common";
import {
  MultipleChoiceStepPayload,
  SingleChoiceStepPayload,
  ConfirmationStepPayload,
  CustomComponentStepPayload,
  ChecklistStepPayload,
  InformationStepPayload,
} from "./payloads";

export type OnboardingStepType =
  | "INFORMATION"
  | "MULTIPLE_CHOICE"
  | "SINGLE_CHOICE"
  | "CONFIRMATION"
  | "CUSTOM_COMPONENT"
  | "CHECKLIST";

export type OnboardingStep =
  | (BaseOnboardingStep<"INFORMATION", InformationStepPayload> & {
      type: "INFORMATION";
      payload: InformationStepPayload;
    })
  | (BaseOnboardingStep<"MULTIPLE_CHOICE", MultipleChoiceStepPayload> & {
      type: "MULTIPLE_CHOICE";
      payload: MultipleChoiceStepPayload;
    })
  | (BaseOnboardingStep<"SINGLE_CHOICE", SingleChoiceStepPayload> & {
      type: "SINGLE_CHOICE";
      payload: SingleChoiceStepPayload;
    })
  | (BaseOnboardingStep<"CONFIRMATION", ConfirmationStepPayload> & {
      type: "CONFIRMATION";
      payload: ConfirmationStepPayload;
    })
  | (BaseOnboardingStep<"CHECKLIST", ChecklistStepPayload> & {
      type: "CHECKLIST";
      payload: ChecklistStepPayload;
    })
  | (BaseOnboardingStep<"CUSTOM_COMPONENT", CustomComponentStepPayload> & {
      type: "CUSTOM_COMPONENT";
      payload: CustomComponentStepPayload;
    });
