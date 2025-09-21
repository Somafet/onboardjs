'use client'

import { useState } from 'react'
import { StepJSONParserOptions } from '@onboardjs/core'
import { TypeScriptExportOptions } from '../utils/typescript-exporter'
import {
    CodeIcon,
    CogIcon,
    FileJsonIcon,
    GalleryHorizontalIcon,
    GalleryVerticalIcon,
    ImportIcon,
    TrashIcon,
    WaypointsIcon,
} from 'lucide-react'
import { ExportFormat } from '../types'

interface FlowToolbarProps {
    onExport: (format: ExportFormat) => void
    onImport: () => void
    onClear: () => void
    onLayout: (direction?: 'TB' | 'LR') => void
    onToggleSidebar: () => void
    exportOptions: Partial<StepJSONParserOptions>
    onExportOptionsChange: (options: Partial<StepJSONParserOptions>) => void
    typeScriptExportOptions: Partial<TypeScriptExportOptions>
    onTypeScriptExportOptionsChange: (options: Partial<TypeScriptExportOptions>) => void
    readonly?: boolean
    stepCount: number
}

export function FlowToolbar({
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
    const [showExportOptions, setShowExportOptions] = useState(false)
    const [selectedExportFormat, setSelectedExportFormat] = useState<ExportFormat>('json')

    return (
        <div className="flow-toolbar vis:bg-white vis:border-b vis:border-gray-200 vis:px-4 vis:py-2 vis:flex vis:items-center vis:justify-between">
            {/* Left section */}
            <div className="vis:flex vis:items-center vis:gap-2">
                <button
                    onClick={onToggleSidebar}
                    className="vis:p-2 vis:hover:bg-gray-100 vis:rounded-md vis:transition-colors"
                    title="Toggle Sidebar"
                >
                    <WaypointsIcon className="vis:w-5 vis:h-5" />
                </button>

                <div className="vis:h-6 vis:w-px vis:bg-gray-300" />

                <div className="vis:flex vis:gap-1">
                    <button
                        onClick={() => onLayout('TB')}
                        className="vis:p-2 vis:hover:bg-gray-100 vis:rounded-md vis:transition-colors"
                        title="Layout Vertically"
                    >
                        <GalleryHorizontalIcon className="vis:w-5 vis:h-5 vis:rotate-0" />
                    </button>
                    <button
                        onClick={() => onLayout('LR')}
                        className="vis:p-2 vis:hover:bg-gray-100 vis:rounded-md vis:transition-colors"
                        title="Layout Horizontally"
                    >
                        <GalleryVerticalIcon className="vis:w-5 vis:h-5" />
                    </button>
                </div>
            </div>

            {/* Center section */}
            <div className="vis:flex vis:items-center vis:gap-4">
                <span className="vis:text-sm vis:text-gray-600">
                    {stepCount} step{stepCount !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Right section */}
            <div className="vis:flex vis:items-center vis:gap-2">
                <div className="vis:relative">
                    <button
                        onClick={() => setShowExportOptions(!showExportOptions)}
                        className="vis:p-2 vis:hover:bg-gray-100 vis:rounded-md vis:transition-colors"
                        title="Export Options"
                    >
                        <CogIcon className="vis:w-5 vis:h-5" />
                    </button>

                    {showExportOptions && (
                        <div className="vis:absolute vis:top-full vis:right-0 vis:mt-1 vis:bg-white vis:border vis:border-gray-200 vis:rounded-md vis:shadow-lg vis:z-50 vis:p-4 vis:min-w-[320px]">
                            <h3 className="vis:font-medium vis:text-sm vis:mb-3">Export Options</h3>

                            {/* Format Selection */}
                            <div className="vis:space-y-3 vis:mb-4">
                                <div>
                                    <label className="vis:block vis:text-sm vis:font-medium vis:text-gray-700 vis:mb-2">
                                        Export Format
                                    </label>
                                    <div className="vis:flex vis:gap-2">
                                        <label className="vis:flex vis:items-center vis:gap-2 vis:cursor-pointer">
                                            <input
                                                type="radio"
                                                value="json"
                                                checked={selectedExportFormat === 'json'}
                                                onChange={(e) =>
                                                    setSelectedExportFormat(e.target.value as ExportFormat)
                                                }
                                            />
                                            <FileJsonIcon className="vis:w-4 vis:h-4" />
                                            <span className="vis:text-sm">JSON</span>
                                        </label>
                                        <label className="vis:flex vis:items-center vis:gap-2 vis:cursor-pointer">
                                            <input
                                                type="radio"
                                                value="typescript"
                                                checked={selectedExportFormat === 'typescript'}
                                                onChange={(e) =>
                                                    setSelectedExportFormat(e.target.value as ExportFormat)
                                                }
                                            />
                                            <CodeIcon className="vis:w-4 vis:h-4" />
                                            <span className="vis:text-sm">TypeScript</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* JSON Options */}
                            {selectedExportFormat === 'json' && (
                                <div className="vis:space-y-3 vis:border-t vis:pt-3">
                                    <h4 className="vis:text-sm vis:font-medium vis:text-gray-700">JSON Options</h4>

                                    <label className="vis:flex vis:items-center vis:gap-2">
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
                                        <span className="vis:text-sm">Pretty print JSON</span>
                                    </label>

                                    <label className="vis:flex vis:items-center vis:gap-2">
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
                                        <span className="vis:text-sm">Include metadata</span>
                                    </label>

                                    <div>
                                        <label className="vis:block vis:text-sm vis:mb-1">Function handling:</label>
                                        <select
                                            value={exportOptions.functionHandling}
                                            onChange={(e) =>
                                                onExportOptionsChange({
                                                    ...exportOptions,
                                                    functionHandling: e.target.value as
                                                        | 'serialize'
                                                        | 'omit'
                                                        | 'placeholder',
                                                })
                                            }
                                            className="vis:w-full vis:px-2 vis:py-1 vis:border vis:border-gray-300 vis:rounded vis:text-sm"
                                        >
                                            <option value="serialize">Serialize</option>
                                            <option value="omit">Omit</option>
                                            <option value="placeholder">Placeholder</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* TypeScript Options */}
                            {selectedExportFormat === 'typescript' && (
                                <div className="vis:space-y-3 vis:border-t vis:pt-3">
                                    <h4 className="vis:text-sm vis:font-medium vis:text-gray-700">
                                        TypeScript Options
                                    </h4>

                                    <div>
                                        <label className="vis:block vis:text-sm vis:mb-1">Variable name:</label>
                                        <input
                                            type="text"
                                            value={typeScriptExportOptions.variableName || 'onboardingSteps'}
                                            onChange={(e) =>
                                                onTypeScriptExportOptionsChange({
                                                    ...typeScriptExportOptions,
                                                    variableName: e.target.value,
                                                })
                                            }
                                            className="vis:w-full vis:px-2 vis:py-1 vis:border vis:border-gray-300 vis:rounded vis:text-sm"
                                        />
                                    </div>

                                    <label className="vis:flex vis:items-center vis:gap-2">
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
                                        <span className="vis:text-sm">Include imports</span>
                                    </label>

                                    <label className="vis:flex vis:items-center vis:gap-2">
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
                                        <span className="vis:text-sm">Include type annotations</span>
                                    </label>

                                    <label className="vis:flex vis:items-center vis:gap-2">
                                        <input
                                            type="checkbox"
                                            checked={typeScriptExportOptions.includeComments !== false}
                                            onChange={(e) =>
                                                onTypeScriptExportOptionsChange({
                                                    ...typeScriptExportOptions,
                                                    includeComments: e.target.checked,
                                                })
                                            }
                                        />
                                        <span className="vis:text-sm">Include comments</span>
                                    </label>

                                    <label className="vis:flex vis:items-center vis:gap-2">
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
                                        <span className="vis:text-sm">Inline functions</span>
                                    </label>

                                    <label className="vis:flex vis:items-center vis:gap-2">
                                        <input
                                            type="checkbox"
                                            checked={typeScriptExportOptions.includeValidation === true}
                                            onChange={(e) =>
                                                onTypeScriptExportOptionsChange({
                                                    ...typeScriptExportOptions,
                                                    includeValidation: e.target.checked,
                                                })
                                            }
                                        />
                                        <span className="vis:text-sm">Include validation helpers</span>
                                    </label>

                                    <div>
                                        <label className="vis:block vis:text-sm vis:mb-1">Indentation:</label>
                                        <select
                                            value={`${typeScriptExportOptions.indentation || 'spaces'}-${typeScriptExportOptions.spacesCount || 2}`}
                                            onChange={(e) => {
                                                const [indentation, spacesCount] = e.target.value.split('-')
                                                onTypeScriptExportOptionsChange({
                                                    ...typeScriptExportOptions,
                                                    indentation: indentation as 'spaces' | 'tabs',
                                                    spacesCount: parseInt(spacesCount) as 2 | 4,
                                                })
                                            }}
                                            className="vis:w-full vis:px-2 vis:py-1 vis:border vis:border-gray-300 vis:rounded vis:text-sm"
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
                    className="vis:flex vis:items-center vis:gap-2 vis:px-3 vis:py-2 vis:border vis:border-gray-300 vis:rounded-md vis:hover:bg-gray-50 vis:transition-colors"
                    title="Import Flow"
                >
                    <ImportIcon className="vis:w-4 vis:h-4" />
                    Import
                </button>

                <div className="vis:flex vis:gap-1">
                    <button
                        onClick={() => onExport('json')}
                        className="vis:flex vis:items-center vis:gap-2 vis:px-3 vis:py-2 vis:border vis:border-gray-300 vis:rounded-md vis:hover:bg-gray-50 vis:transition-colors"
                        title="Export as JSON"
                    >
                        <FileJsonIcon className="vis:w-4 vis:h-4" />
                        JSON
                    </button>

                    <button
                        onClick={() => onExport('typescript')}
                        className="vis:flex vis:items-center vis:gap-2 vis:px-3 vis:py-2 vis:border vis:border-gray-300 vis:rounded-md vis:hover:bg-gray-50 vis:transition-colors"
                        title="Export as TypeScript"
                    >
                        <CodeIcon className="vis:w-4 vis:h-4" />
                        TS
                    </button>
                </div>

                {!readonly && (
                    <>
                        <div className="vis:h-6 vis:w-px vis:bg-gray-300" />

                        <button
                            onClick={onClear}
                            className="vis:flex vis:items-center vis:gap-2 vis:px-3 vis:py-2 vis:text-red-600 vis:border vis:border-red-300 vis:rounded-md vis:hover:bg-red-50 vis:transition-colors"
                            title="Clear Flow"
                        >
                            <TrashIcon className="vis:w-4 vis:h-4" />
                            Clear
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}
