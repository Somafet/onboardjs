"use client";

import { useState } from "react";
import { OnboardingStepType } from "@onboardjs/core";
import { StepJSONParserOptions } from "@onboardjs/core";
import { TypeScriptExportOptions } from "../utils/typescript-exporter";
import {
  CodeIcon,
  CogIcon,
  FileJsonIcon,
  GalleryHorizontalIcon,
  GalleryVerticalIcon,
  ImportIcon,
  PlusIcon,
  TrashIcon,
  WaypointsIcon,
} from "lucide-react";

export type ExportFormat = "json" | "typescript";

interface FlowToolbarProps {
  onAddStep: (stepType?: OnboardingStepType) => void;
  onExport: (format: ExportFormat) => void;
  onImport: () => void;
  onClear: () => void;
  onLayout: (direction?: "TB" | "LR") => void;
  onToggleSidebar: () => void;
  exportOptions: Partial<StepJSONParserOptions>;
  onExportOptionsChange: (options: Partial<StepJSONParserOptions>) => void;
  typeScriptExportOptions: Partial<TypeScriptExportOptions>;
  onTypeScriptExportOptionsChange: (
    options: Partial<TypeScriptExportOptions>,
  ) => void;
  readonly?: boolean;
  stepCount: number;
}

export function FlowToolbar({
  onAddStep,
  onExport,
  onImport,
  onClear,
  onLayout,
  onToggleSidebar,
  exportOptions,
  onExportOptionsChange,
  typeScriptExportOptions,
  onTypeScriptExportOptionsChange,
  readonly = false,
  stepCount,
}: FlowToolbarProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] =
    useState<ExportFormat>("json");

  const stepTypes: Array<{
    type: OnboardingStepType;
    label: string;
    description: string;
  }> = [
    {
      type: "INFORMATION",
      label: "Information",
      description: "Display information",
    },
    {
      type: "SINGLE_CHOICE",
      label: "Single Choice",
      description: "Select one option",
    },
    {
      type: "MULTIPLE_CHOICE",
      label: "Multiple Choice",
      description: "Select multiple options",
    },
    { type: "CHECKLIST", label: "Checklist", description: "Complete tasks" },
    {
      type: "CONFIRMATION",
      label: "Confirmation",
      description: "Confirm action",
    },
    {
      type: "CUSTOM_COMPONENT",
      label: "Custom",
      description: "Custom component",
    },
  ];

  return (
    <div className="flow-toolbar bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
      {/* Left section */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          title="Toggle Sidebar"
        >
          <WaypointsIcon className="w-5 h-5" />
        </button>

        <div className="h-6 w-px bg-gray-300" />

        {!readonly && (
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Add Step
            </button>

            {showAddMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[200px]">
                {stepTypes.map(({ type, label, description }) => (
                  <button
                    key={type}
                    onClick={() => {
                      onAddStep(type);
                      setShowAddMenu(false);
                    }}
                    className="block w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-sm text-gray-900">
                      {label}
                    </div>
                    <div className="text-xs text-gray-500">{description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-1">
          <button
            onClick={() => onLayout("TB")}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            title="Layout Vertically"
          >
            <GalleryHorizontalIcon className="w-5 h-5 rotate-0" />
          </button>
          <button
            onClick={() => onLayout("LR")}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            title="Layout Horizontally"
          >
            <GalleryVerticalIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Center section */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">
          {stepCount} step{stepCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setShowExportOptions(!showExportOptions)}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            title="Export Options"
          >
            <CogIcon className="w-5 h-5" />
          </button>

          {showExportOptions && (
            <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 p-4 min-w-[320px]">
              <h3 className="font-medium text-sm mb-3">Export Options</h3>

              {/* Format Selection */}
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Export Format
                  </label>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="json"
                        checked={selectedExportFormat === "json"}
                        onChange={(e) =>
                          setSelectedExportFormat(
                            e.target.value as ExportFormat,
                          )
                        }
                      />
                      <FileJsonIcon className="w-4 h-4" />
                      <span className="text-sm">JSON</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="typescript"
                        checked={selectedExportFormat === "typescript"}
                        onChange={(e) =>
                          setSelectedExportFormat(
                            e.target.value as ExportFormat,
                          )
                        }
                      />
                      <CodeIcon className="w-4 h-4" />
                      <span className="text-sm">TypeScript</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* JSON Options */}
              {selectedExportFormat === "json" && (
                <div className="space-y-3 border-t pt-3">
                  <h4 className="text-sm font-medium text-gray-700">
                    JSON Options
                  </h4>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={exportOptions.prettyPrint}
                      onChange={(e) =>
                        onExportOptionsChange({
                          ...exportOptions,
                          prettyPrint: e.target.checked,
                        })
                      }
                    />
                    <span className="text-sm">Pretty print JSON</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={exportOptions.includeMeta}
                      onChange={(e) =>
                        onExportOptionsChange({
                          ...exportOptions,
                          includeMeta: e.target.checked,
                        })
                      }
                    />
                    <span className="text-sm">Include metadata</span>
                  </label>

                  <div>
                    <label className="block text-sm mb-1">
                      Function handling:
                    </label>
                    <select
                      value={exportOptions.functionHandling}
                      onChange={(e) =>
                        onExportOptionsChange({
                          ...exportOptions,
                          functionHandling: e.target.value as
                            | "serialize"
                            | "omit"
                            | "placeholder",
                        })
                      }
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="serialize">Serialize</option>
                      <option value="omit">Omit</option>
                      <option value="placeholder">Placeholder</option>
                    </select>
                  </div>
                </div>
              )}

              {/* TypeScript Options */}
              {selectedExportFormat === "typescript" && (
                <div className="space-y-3 border-t pt-3">
                  <h4 className="text-sm font-medium text-gray-700">
                    TypeScript Options
                  </h4>

                  <div>
                    <label className="block text-sm mb-1">Variable name:</label>
                    <input
                      type="text"
                      value={
                        typeScriptExportOptions.variableName ||
                        "onboardingSteps"
                      }
                      onChange={(e) =>
                        onTypeScriptExportOptionsChange({
                          ...typeScriptExportOptions,
                          variableName: e.target.value,
                        })
                      }
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={typeScriptExportOptions.includeImports !== false}
                      onChange={(e) =>
                        onTypeScriptExportOptionsChange({
                          ...typeScriptExportOptions,
                          includeImports: e.target.checked,
                        })
                      }
                    />
                    <span className="text-sm">Include imports</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={typeScriptExportOptions.includeTypes !== false}
                      onChange={(e) =>
                        onTypeScriptExportOptionsChange({
                          ...typeScriptExportOptions,
                          includeTypes: e.target.checked,
                        })
                      }
                    />
                    <span className="text-sm">Include type annotations</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={
                        typeScriptExportOptions.includeComments !== false
                      }
                      onChange={(e) =>
                        onTypeScriptExportOptionsChange({
                          ...typeScriptExportOptions,
                          includeComments: e.target.checked,
                        })
                      }
                    />
                    <span className="text-sm">Include comments</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={typeScriptExportOptions.inlineFunctions === true}
                      onChange={(e) =>
                        onTypeScriptExportOptionsChange({
                          ...typeScriptExportOptions,
                          inlineFunctions: e.target.checked,
                        })
                      }
                    />
                    <span className="text-sm">Inline functions</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={
                        typeScriptExportOptions.includeValidation === true
                      }
                      onChange={(e) =>
                        onTypeScriptExportOptionsChange({
                          ...typeScriptExportOptions,
                          includeValidation: e.target.checked,
                        })
                      }
                    />
                    <span className="text-sm">Include validation helpers</span>
                  </label>

                  <div>
                    <label className="block text-sm mb-1">Indentation:</label>
                    <select
                      value={`${typeScriptExportOptions.indentation || "spaces"}-${typeScriptExportOptions.spacesCount || 2}`}
                      onChange={(e) => {
                        const [indentation, spacesCount] =
                          e.target.value.split("-");
                        onTypeScriptExportOptionsChange({
                          ...typeScriptExportOptions,
                          indentation: indentation as "spaces" | "tabs",
                          spacesCount: parseInt(spacesCount) as 2 | 4,
                        });
                      }}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="spaces-2">2 Spaces</option>
                      <option value="spaces-4">4 Spaces</option>
                      <option value="tabs-0">Tabs</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={onImport}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          title="Import Flow"
        >
          <ImportIcon className="w-4 h-4" />
          Import
        </button>

        <div className="flex gap-1">
          <button
            onClick={() => onExport("json")}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            title="Export as JSON"
          >
            <FileJsonIcon className="w-4 h-4" />
            JSON
          </button>

          <button
            onClick={() => onExport("typescript")}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            title="Export as TypeScript"
          >
            <CodeIcon className="w-4 h-4" />
            TS
          </button>
        </div>

        {!readonly && (
          <>
            <div className="h-6 w-px bg-gray-300" />

            <button
              onClick={onClear}
              className="flex items-center gap-2 px-3 py-2 text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
              title="Clear Flow"
            >
              <TrashIcon className="w-4 h-4" />
              Clear
            </button>
          </>
        )}
      </div>
    </div>
  );
}
