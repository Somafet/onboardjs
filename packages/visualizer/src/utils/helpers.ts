import { OnboardingContext, OnboardingStep } from "@onboardjs/core";

export function getStepLabel<TContext extends OnboardingContext>(
  step: OnboardingStep<TContext>,
): string {
  // Try to get label from various payload properties
  const payload = step.payload as any;

  if (payload?.title) return payload.title;
  if (payload?.label) return payload.label;
  if (payload?.question) return payload.question;
  if (payload?.componentKey) return payload.componentKey;

  return `Step ${step.id}`;
}
