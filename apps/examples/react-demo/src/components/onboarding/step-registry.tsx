import type {
  StepComponentProps,
  StepComponentRegistry,
} from "@onboardjs/react";
import { lazy, type ComponentType } from "react";

// Preloading components for better video performance
import DevShowcase from "./steps/dev-path/dev-showcase";
import InitialStep from "./steps/initial-step";
import BusinessWelcome from "./steps/business-path/business-welcome";
import BusinessWithOnboardJS from "./steps/business-path/business-onboardjs";
import DevTypeSelector from "./steps/dev-path/dev-type";
import BusinessStep3 from "./steps/business-path/business-3";

// Lazy loading components to reduce initial bundle size
const EndStep: ComponentType<StepComponentProps> = lazy(
  async () => import("./steps/end-step"),
);

const DevImpl: ComponentType<StepComponentProps> = lazy(
  async () => import("./steps/dev-path/dev-impl"),
);

// Registering all the Step Components for the specified step IDs in `step.ts`
export const stepRegistry: StepComponentRegistry = {
  initial: InitialStep,
  "dev-showcase": DevShowcase,
  "dev-impl": DevImpl,
  "dev-type": DevTypeSelector,
  "business-welcome": BusinessWelcome,
  "business-onboardjs": BusinessWithOnboardJS,
  "business-step-3": BusinessStep3,

  // You can reuse the EndStep for both developer and business paths by providing different props
  // in the step.ts 'business-end' and 'dev-end' steps.
  "dev-end": EndStep,
  "business-end": EndStep,
};
