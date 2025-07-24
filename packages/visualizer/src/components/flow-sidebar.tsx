"use client";

import {
  OnboardingStep,
  OnboardingContext,
  OnboardingStepType,
} from "@onboardjs/core";
import { PlusIcon, TrashIcon, XIcon } from "lucide-react";

interface FlowSidebarProps<
  TContext extends OnboardingContext = OnboardingContext,
> {
  steps: OnboardingStep<TContext>[];
  onStepSelect: (step: OnboardingStep<TContext>) => void;
  onStepAdd: (stepType?: OnboardingStepType) => void;
  onStepDelete: (stepId: string | number) => void;
  onClose: () => void;
  readonly?: boolean;
}

export function FlowSidebar<
  TContext extends OnboardingContext = OnboardingContext,
>({
  steps,
  onStepSelect,
  onStepAdd,
  onStepDelete,
  onClose,
  readonly = false,
}: FlowSidebarProps<TContext>) {
  return (
    <div className="flow-sidebar bg-white border-l border-gray-200 w-80 h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">Steps</h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-md transition-colors"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Steps list */}
      <div className="flex-1 overflow-y-auto">
        {steps.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p>No steps yet</p>
            {!readonly && (
              <button
                onClick={() => onStepAdd()}
                className="mt-2 text-blue-500 hover:text-blue-600"
              >
                Add your first step
              </button>
            )}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="group flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200"
                onClick={() => onStepSelect(step)}
              >
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 truncate">
                    {getStepDisplayName(step)}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {step.type || "INFORMATION"} • ID: {step.id}
                  </div>
                  {step.isSkippable && (
                    <div className="text-xs text-yellow-600">Skippable</div>
                  )}
                </div>

                {!readonly && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStepDelete(step.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 text-red-500 rounded transition-all"
                    title="Delete step"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add button */}
      {!readonly && (
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => onStepAdd()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Add Step
          </button>
        </div>
      )}
    </div>
  );
}

function getStepDisplayName<
  TContext extends OnboardingContext = OnboardingContext,
>(step: OnboardingStep<TContext>): string {
  const payload = step.payload as any;

  if (payload?.title) return payload.title;
  if (payload?.label) return payload.label;
  if (payload?.question) return payload.question;
  if (payload?.componentKey) return payload.componentKey;

  return `Step ${step.id}`;
}
