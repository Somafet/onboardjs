"use client";

import { useState, useEffect } from "react";
import { OnboardingStep, OnboardingContext } from "@onboardjs/core";
import { XIcon } from "lucide-react";
import { OptionsListEditor } from "./components/option-list-editor.js";
import { ChecklistItemsEditor } from "./components/checklist-item-editor.js";

interface StepDetailsPanelProps<
  TContext extends OnboardingContext = OnboardingContext,
> {
  step: OnboardingStep<TContext>;
  onStepUpdate: (step: OnboardingStep<TContext>) => void;
  onClose: () => void;
  readonly?: boolean;
}

export function StepDetailsPanel<
  TContext extends OnboardingContext = OnboardingContext,
>({
  step,
  onStepUpdate,
  onClose,
  readonly = false,
}: StepDetailsPanelProps<TContext>) {
  const [editedStep, setEditedStep] = useState<OnboardingStep<TContext>>(step);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setEditedStep(step);
    setHasChanges(false);
  }, [step]);

  const handleChange = (updates: Partial<OnboardingStep<TContext>>) => {
    const newStep = { ...editedStep, ...updates } as OnboardingStep<TContext>;
    setEditedStep(newStep);
    setHasChanges(JSON.stringify(newStep) !== JSON.stringify(step));
  };

  const handleSave = () => {
    onStepUpdate(editedStep);
    setHasChanges(false);
  };

  const handlePayloadChange = (payloadUpdates: any) => {
    handleChange({
      payload: {
        ...editedStep.payload,
        ...payloadUpdates,
      },
    });
  };

  return (
    <div className="step-details-panel bg-white border-l border-gray-200 w-96 h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">Step Details</h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-md transition-colors"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Basic Info */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Basic Information</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Step ID
              </label>
              <input
                type="text"
                value={String(editedStep.id)}
                onChange={(e) => handleChange({ id: e.target.value })}
                disabled={readonly}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Step Type
              </label>
              <select
                value={editedStep.type || "INFORMATION"}
                onChange={(e) => handleChange({ type: e.target.value as any })}
                disabled={readonly}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50"
              >
                <option value="INFORMATION">Information</option>
                <option value="SINGLE_CHOICE">Single Choice</option>
                <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                <option value="CHECKLIST">Checklist</option>
                <option value="CONFIRMATION">Confirmation</option>
                <option value="CUSTOM_COMPONENT">Custom Component</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editedStep.isSkippable || false}
                  onChange={(e) =>
                    handleChange({ isSkippable: e.target.checked } as any)
                  }
                  disabled={readonly}
                />
                <span className="text-sm font-medium text-gray-700">
                  Skippable
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Payload */}
        {editedStep.type && editedStep.type !== "INFORMATION" && (
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Payload</h3>
            <PayloadEditor
              stepType={editedStep.type}
              payload={editedStep.payload || {}}
              onChange={handlePayloadChange}
              readonly={readonly}
            />
          </div>
        )}

        {/* Functions */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Functions</h3>
          <div className="space-y-3">
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={typeof editedStep.condition === "function"}
                  disabled
                />
                Has Condition Function
              </label>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={typeof editedStep.onStepActive === "function"}
                  disabled
                />
                Has onStepActive Function
              </label>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={typeof editedStep.onStepComplete === "function"}
                  disabled
                />
                Has onStepComplete Function
              </label>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Navigation</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Next Step ID
              </label>
              <input
                type="text"
                value={
                  typeof editedStep.nextStep === "function"
                    ? "[Function]"
                    : String(editedStep.nextStep || "")
                }
                onChange={(e) =>
                  handleChange({ nextStep: e.target.value || undefined } as any)
                }
                disabled={readonly || typeof editedStep.nextStep === "function"}
                placeholder="Auto (next in sequence)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Previous Step ID
              </label>
              <input
                type="text"
                value={
                  typeof editedStep.previousStep === "function"
                    ? "[Function]"
                    : String(editedStep.previousStep || "")
                }
                onChange={(e) =>
                  handleChange({
                    previousStep: e.target.value || undefined,
                  } as any)
                }
                disabled={
                  readonly || typeof editedStep.previousStep === "function"
                }
                placeholder="Auto (previous in sequence)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50"
              />
            </div>

            {editedStep.isSkippable && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Skip To Step ID
                </label>
                <input
                  type="text"
                  value={
                    typeof (editedStep as any).skipToStep === "function"
                      ? "[Function]"
                      : String((editedStep as any).skipToStep || "")
                  }
                  onChange={(e) =>
                    handleChange({
                      skipToStep: e.target.value || undefined,
                    } as any)
                  }
                  disabled={
                    readonly ||
                    typeof (editedStep as any).skipToStep === "function"
                  }
                  placeholder="Auto (next step)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      {!readonly && hasChanges && (
        <div className="border-t border-gray-200 p-4">
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Save Changes
            </button>
            <button
              onClick={() => {
                setEditedStep(step);
                setHasChanges(false);
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Payload editor component for different step types
function PayloadEditor({
  stepType,
  payload,
  onChange,
  readonly,
}: {
  stepType: string;
  payload: any;
  onChange: (updates: any) => void;
  readonly: boolean;
}) {
  switch (stepType) {
    case "SINGLE_CHOICE":
    case "MULTIPLE_CHOICE":
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Key
            </label>
            <input
              type="text"
              value={payload.dataKey || ""}
              onChange={(e) => onChange({ dataKey: e.target.value })}
              disabled={readonly}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50"
            />
          </div>
          <OptionsListEditor
            options={payload.options || []}
            onChange={(newOptions) => onChange({ options: newOptions })}
            readonly={readonly}
          />
        </div>
      );

    case "CHECKLIST":
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Key
            </label>
            <input
              type="text"
              value={payload.dataKey || ""}
              onChange={(e) => onChange({ dataKey: e.target.value })}
              disabled={readonly}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min Items to Complete
            </label>
            <input
              type="number"
              value={payload.minItemsToComplete || ""}
              onChange={(e) =>
                onChange({
                  minItemsToComplete: e.target.value
                    ? parseInt(e.target.value)
                    : undefined,
                })
              }
              disabled={readonly}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50"
            />
          </div>
          <ChecklistItemsEditor
            items={payload.items || []}
            onChange={(newItems) => onChange({ items: newItems })}
            readonly={readonly}
          />
        </div>
      );

    case "CUSTOM_COMPONENT":
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Component Key
          </label>
          <input
            type="text"
            value={payload.componentKey || ""}
            onChange={(e) => onChange({ componentKey: e.target.value })}
            disabled={readonly}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50"
          />
        </div>
      );

    default:
      return (
        <div className="text-sm text-gray-500">
          No specific payload configuration for this step type
        </div>
      );
  }
}
