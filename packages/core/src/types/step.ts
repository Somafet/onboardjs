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
  | (BaseOnboardingStep & {
      type: "INFORMATION";
      payload: InformationStepPayload;
    })
  | (BaseOnboardingStep & {
      type: "MULTIPLE_CHOICE";
      payload: MultipleChoiceStepPayload;
    })
  | (BaseOnboardingStep & {
      type: "SINGLE_CHOICE";
      payload: SingleChoiceStepPayload;
    })
  | (BaseOnboardingStep & {
      type: "CONFIRMATION";
      payload: ConfirmationStepPayload;
    })
  | (BaseOnboardingStep & {
      type: "CHECKLIST";
      payload: ChecklistStepPayload;
    })
  | (BaseOnboardingStep & {
      type: "CUSTOM_COMPONENT";
      payload: CustomComponentStepPayload;
    });
