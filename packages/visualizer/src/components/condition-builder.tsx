'use client'

import { useState, useCallback, useMemo } from 'react'
import { PlusIcon, TrashIcon, CodeIcon, EyeIcon } from 'lucide-react'
import { ConditionGroup, ConditionRule, conditionToCode } from '../utils/conditon'

interface ConditionBuilderProps {
    condition?: ConditionGroup[]
    onConditionChange: (condition: ConditionGroup[] | undefined) => void
    readonly?: boolean
}

export function ConditionBuilder({ condition, onConditionChange, readonly = false }: ConditionBuilderProps) {
    const [isVisualMode, setIsVisualMode] = useState(true)
    const [conditionGroups, setConditionGroups] = useState<ConditionGroup[]>(
        condition && condition.length > 0
            ? condition
            : [
                  {
                      id: 'group_1',
                      logic: 'AND',
                      rules: [],
                  },
              ]
    )
    const conditionCode = useMemo(() => conditionToCode(conditionGroups), [conditionGroups])

    const addRule = useCallback(
        (groupId: string) => {
            if (readonly) return

            setConditionGroups((prev) =>
                prev.map((group) =>
                    group.id === groupId
                        ? {
                              ...group,
                              rules: [
                                  ...group.rules,
                                  {
                                      id: `rule_${Date.now()}`,
                                      field: '',
                                      operator: 'equals',
                                      value: '',
                                      valueType: 'string',
                                  },
                              ],
                          }
                        : group
                )
            )
        },
        [readonly]
    )

    const removeRule = useCallback(
        (groupId: string, ruleId: string) => {
            if (readonly) return

            setConditionGroups((prev) =>
                prev.map((group) =>
                    group.id === groupId
                        ? {
                              ...group,
                              rules: group.rules.filter((rule) => rule.id !== ruleId),
                          }
                        : group
                )
            )
        },
        [readonly]
    )

    const updateRule = useCallback(
        (groupId: string, ruleId: string, updates: Partial<ConditionRule>) => {
            if (readonly) return

            setConditionGroups((prev) =>
                prev.map((group) =>
                    group.id === groupId
                        ? {
                              ...group,
                              rules: group.rules.map((rule) => (rule.id === ruleId ? { ...rule, ...updates } : rule)),
                          }
                        : group
                )
            )
        },
        [readonly]
    )

    const addGroup = useCallback(() => {
        if (readonly) return

        setConditionGroups((prev) => [
            ...prev,
            {
                id: `group_${Date.now()}`,
                logic: 'AND',
                rules: [],
            },
        ])
    }, [readonly])

    const removeGroup = useCallback(
        (groupId: string) => {
            if (readonly) return

            if (conditionGroups.length <= 1) return // Keep at least one group

            setConditionGroups((prev) => prev.filter((group) => group.id !== groupId))
        },
        [readonly, conditionGroups.length]
    )

    const clearCondition = useCallback(() => {
        if (readonly) return

        onConditionChange(undefined)
        setConditionGroups([
            {
                id: 'group_1',
                logic: 'AND',
                rules: [],
            },
        ])
    }, [readonly, onConditionChange])

    return (
        <div className="condition-builder vis:border vis:border-gray-200 vis:rounded-lg vis:p-4 vis:space-y-4">
            {/* Header */}
            <div className="vis:flex vis:items-center vis:justify-between">
                <h4 className="vis:font-medium vis:text-gray-900">Condition</h4>
                <div className="vis:flex vis:items-center vis:gap-2">
                    <button
                        onClick={() => setIsVisualMode(!isVisualMode)}
                        className="vis:p-1 vis:text-gray-500 hover:vis:text-gray-700 vis:transition-colors"
                        title={isVisualMode ? 'Switch to Code Mode' : 'Switch to Visual Mode'}
                    >
                        {isVisualMode ? <CodeIcon className="vis:size-4" /> : <EyeIcon className="vis:w-4 vis:h-4" />}
                    </button>
                    {!readonly && (
                        <button
                            onClick={clearCondition}
                            className="vis:p-1 vis:text-red-500 hover:vis:text-red-700 vis:transition-colors"
                            title="Clear Condition"
                        >
                            <TrashIcon className="vis:w-4 vis:h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Visual Mode */}
            {isVisualMode ? (
                <div className="space-y-3">
                    {conditionGroups.map((group, groupIndex) => (
                        <div
                            key={group.id}
                            className="vis:border vis:border-gray-100 vis:rounded-md vis:p-3 vis:bg-gray-50"
                        >
                            {/* Group Header */}
                            <div className="vis:flex vis:items-center vis:justify-between vis:mb-3">
                                <div className="vis:flex vis:items-center vis:gap-2">
                                    <span className="vis:text-sm vis:font-medium vis:text-gray-700">
                                        Group {groupIndex + 1}
                                    </span>
                                    {!readonly && (
                                        <select
                                            value={group.logic}
                                            onChange={(e) => {
                                                setConditionGroups((prev) =>
                                                    prev.map((g) =>
                                                        g.id === group.id
                                                            ? { ...g, logic: e.target.value as 'AND' | 'OR' }
                                                            : g
                                                    )
                                                )
                                            }}
                                            className="vis:text-xs vis:px-2 vis:py-1 vis:border vis:border-gray-300 vis:rounded"
                                        >
                                            <option value="AND">AND</option>
                                            <option value="OR">OR</option>
                                        </select>
                                    )}
                                </div>
                                {!readonly && conditionGroups.length > 1 && (
                                    <button
                                        onClick={() => removeGroup(group.id)}
                                        className="vis:p-1 vis:text-red-500 hover:vis:text-red-700 vis:transition-colors"
                                    >
                                        <TrashIcon className="vis:w-3 vis:h-3" />
                                    </button>
                                )}
                            </div>

                            {/* Rules */}
                            <div className="vis:space-y-2">
                                {group.rules.map((rule, ruleIndex) => (
                                    <div key={rule.id} className="vis:flex vis:flex-col vis:gap-2 vis:text-sm">
                                        {ruleIndex > 0 && (
                                            <span className="vis:text-gray-500 vis:text-xs">{group.logic}</span>
                                        )}

                                        {/* Field */}
                                        <input
                                            type="text"
                                            placeholder="field"
                                            value={rule.field}
                                            onChange={(e) => updateRule(group.id, rule.id, { field: e.target.value })}
                                            disabled={readonly}
                                            className="vis:flex-1 vis:px-2 vis:py-1 vis:border vis:border-gray-300 vis:rounded vis:text-xs vis:disabled:bg-gray-100"
                                        />

                                        {/* Operator */}
                                        <select
                                            value={rule.operator}
                                            onChange={(e) =>
                                                updateRule(group.id, rule.id, { operator: e.target.value as any })
                                            }
                                            disabled={readonly}
                                            className="vis:px-2 vis:py-1 vis:border vis:border-gray-300 vis:rounded vis:text-xs vis:disabled:bg-gray-100"
                                        >
                                            <option value="equals">equals</option>
                                            <option value="not_equals">not equals</option>
                                            <option value="contains">contains</option>
                                            <option value="not_contains">not contains</option>
                                            <option value="greater_than">greater than</option>
                                            <option value="less_than">less than</option>
                                            <option value="exists">exists</option>
                                            <option value="not_exists">not exists</option>
                                        </select>

                                        {/* Value (if operator needs it) */}
                                        {!['exists', 'not_exists'].includes(rule.operator) && (
                                            <>
                                                <input
                                                    type="text"
                                                    placeholder="value"
                                                    value={rule.value}
                                                    onChange={(e) =>
                                                        updateRule(group.id, rule.id, { value: e.target.value })
                                                    }
                                                    disabled={readonly}
                                                    className="vis:flex-1 vis:px-2 vis:py-1 vis:border vis:border-gray-300 vis:rounded vis:text-xs vis:disabled:bg-gray-100"
                                                />
                                                <select
                                                    value={rule.valueType}
                                                    onChange={(e) =>
                                                        updateRule(group.id, rule.id, {
                                                            valueType: e.target.value as any,
                                                        })
                                                    }
                                                    disabled={readonly}
                                                    className="vis:px-2 vis:py-1 vis:border vis:border-gray-300 vis:rounded vis:text-xs vis:disabled:bg-gray-100"
                                                >
                                                    <option value="string">string</option>
                                                    <option value="number">number</option>
                                                    <option value="boolean">boolean</option>
                                                </select>
                                            </>
                                        )}

                                        {/* Remove Rule */}
                                        {!readonly && (
                                            <button
                                                onClick={() => removeRule(group.id, rule.id)}
                                                className="vis:p-1 vis:text-red-500 hover:vis:text-red-700 vis:transition-colors"
                                            >
                                                <TrashIcon className="vis:w-3 vis:h-3" />
                                            </button>
                                        )}
                                    </div>
                                ))}

                                {/* Add Rule */}
                                {!readonly && (
                                    <button
                                        onClick={() => addRule(group.id)}
                                        className="vis:flex vis:items-center vis:gap-1 vis:text-xs vis:text-blue-600 hover:vis:text-blue-800 vis:transition-colors"
                                    >
                                        <PlusIcon className="vis:w-3 vis:h-3" />
                                        Add Rule
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Add Group */}
                    {!readonly && (
                        <button
                            onClick={addGroup}
                            className="vis:flex vis:items-center vis:gap-1 vis:text-sm vis:text-blue-600 hover:vis:text-blue-800 vis:transition-colors"
                        >
                            <PlusIcon className="vis:w-4 vis:h-4" />
                            Add Group
                        </button>
                    )}

                    {/* Apply Button */}
                    {!readonly && (
                        <button
                            onClick={() => onConditionChange(conditionGroups)}
                            className="vis:w-full vis:px-3 vis:py-2 vis:bg-blue-500 vis:text-white vis:rounded-md hover:vis:bg-blue-600 vis:transition-colors vis:text-sm"
                        >
                            Apply Condition
                        </button>
                    )}
                </div>
            ) : (
                /* Code Mode */
                <div className="vis:space-y-3">
                    <textarea
                        readOnly
                        value={conditionCode}
                        disabled={readonly}
                        placeholder="(context) => context.flowData?.userRole === 'admin'"
                        rows={6}
                        className="vis:w-full vis:px-3 vis:py-2 vis:border vis:border-gray-300 vis:rounded-md vis:text-sm vis:font-mono vis:disabled:bg-gray-100"
                    />
                </div>
            )}

            {/* Current Condition Display */}
            {condition && (
                <div className="vis:mt-3 p-3 vis:bg-blue-50 border vis:border-blue-200 rounded-md">
                    <label className="vis:block vis:text-md vis:font-medium vis:text-blue-700 vis:mb-1">
                        Current Condition:
                    </label>
                    <pre className="vis:text-xs vis:text-blue-800 vis:whitespace-pre-wrap vis:font-mono vis:overflow-x-auto">
                        <code>{conditionCode}</code>
                    </pre>
                </div>
            )}
        </div>
    )
}
