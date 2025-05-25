// @onboardjs/core/src/types/step.ts

import { BaseOnboardingStep } from "./common";
import {
  WelcomeStepPayload,
  FormInputStepPayload,
  MultipleChoiceStepPayload,
  SingleChoiceStepPayload,
  FeatureHighlightStepPayload,
  VideoTutorialStepPayload,
  ConfirmationStepPayload,
  CustomComponentStepPayload,
  WelcomeInputFormStepPayload,
  ChecklistStepPayload,
} from "./payloads";

export type OnboardingStepType =
  | "WELCOME"
  | "WELCOME_INPUT_FORM"
  | "FORM_INPUT"
  | "MULTIPLE_CHOICE"
  | "SINGLE_CHOICE"
  | "FEATURE_HIGHLIGHT"
  | "VIDEO_TUTORIAL"
  | "CONFIRMATION"
  | "CUSTOM_COMPONENT"
  | "CHECKLIST";

export type OnboardingStep =
  | (BaseOnboardingStep & {
      type: "WELCOME";
      payload: WelcomeStepPayload;
    })
  | (BaseOnboardingStep & {
      type: "WELCOME_INPUT_FORM";
      payload: WelcomeInputFormStepPayload;
    })
  | (BaseOnboardingStep & {
      type: "FORM_INPUT";
      payload: FormInputStepPayload;
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
      type: "FEATURE_HIGHLIGHT";
      payload: FeatureHighlightStepPayload;
    })
  | (BaseOnboardingStep & {
      type: "VIDEO_TUTORIAL";
      payload: VideoTutorialStepPayload;
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
