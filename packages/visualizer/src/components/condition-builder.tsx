'use client'

import { useState, useCallback, useMemo } from 'react'
import { OnboardingContext } from '@onboardjs/core'
import { PlusIcon, TrashIcon, CodeIcon, EyeIcon, EyeOffIcon } from 'lucide-react'
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
        <div className="condition-builder border border-gray-200 rounded-lg p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">Condition</h4>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsVisualMode(!isVisualMode)}
                        className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                        title={isVisualMode ? 'Switch to Code Mode' : 'Switch to Visual Mode'}
                    >
                        {isVisualMode ? <CodeIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    </button>
                    {!readonly && (
                        <button
                            onClick={clearCondition}
                            className="p-1 text-red-500 hover:text-red-700 transition-colors"
                            title="Clear Condition"
                        >
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Visual Mode */}
            {isVisualMode ? (
                <div className="space-y-3">
                    {conditionGroups.map((group, groupIndex) => (
                        <div key={group.id} className="border border-gray-100 rounded-md p-3 bg-gray-50">
                            {/* Group Header */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-700">Group {groupIndex + 1}</span>
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
                                            className="text-xs px-2 py-1 border border-gray-300 rounded"
                                        >
                                            <option value="AND">AND</option>
                                            <option value="OR">OR</option>
                                        </select>
                                    )}
                                </div>
                                {!readonly && conditionGroups.length > 1 && (
                                    <button
                                        onClick={() => removeGroup(group.id)}
                                        className="p-1 text-red-500 hover:text-red-700 transition-colors"
                                    >
                                        <TrashIcon className="w-3 h-3" />
                                    </button>
                                )}
                            </div>

                            {/* Rules */}
                            <div className="space-y-2">
                                {group.rules.map((rule, ruleIndex) => (
                                    <div key={rule.id} className="flex flex-col gap-2 text-sm">
                                        {ruleIndex > 0 && <span className="text-gray-500 text-xs">{group.logic}</span>}

                                        {/* Field */}
                                        <input
                                            type="text"
                                            placeholder="field"
                                            value={rule.field}
                                            onChange={(e) => updateRule(group.id, rule.id, { field: e.target.value })}
                                            disabled={readonly}
                                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs disabled:bg-gray-100"
                                        />

                                        {/* Operator */}
                                        <select
                                            value={rule.operator}
                                            onChange={(e) =>
                                                updateRule(group.id, rule.id, { operator: e.target.value as any })
                                            }
                                            disabled={readonly}
                                            className="px-2 py-1 border border-gray-300 rounded text-xs disabled:bg-gray-100"
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
                                                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs disabled:bg-gray-100"
                                                />
                                                <select
                                                    value={rule.valueType}
                                                    onChange={(e) =>
                                                        updateRule(group.id, rule.id, {
                                                            valueType: e.target.value as any,
                                                        })
                                                    }
                                                    disabled={readonly}
                                                    className="px-2 py-1 border border-gray-300 rounded text-xs disabled:bg-gray-100"
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
                                                className="p-1 text-red-500 hover:text-red-700 transition-colors"
                                            >
                                                <TrashIcon className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                ))}

                                {/* Add Rule */}
                                {!readonly && (
                                    <button
                                        onClick={() => addRule(group.id)}
                                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                                    >
                                        <PlusIcon className="w-3 h-3" />
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
                            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                        >
                            <PlusIcon className="w-4 h-4" />
                            Add Group
                        </button>
                    )}

                    {/* Apply Button */}
                    {!readonly && (
                        <button
                            onClick={() => onConditionChange(conditionGroups)}
                            className="w-full px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm"
                        >
                            Apply Condition
                        </button>
                    )}
                </div>
            ) : (
                /* Code Mode */
                <div className="space-y-3">
                    <textarea
                        readOnly
                        value={conditionCode}
                        disabled={readonly}
                        placeholder="(context) => context.flowData?.userRole === 'admin'"
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono disabled:bg-gray-100"
                    />
                </div>
            )}

            {/* Current Condition Display */}
            {condition && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <label className="block text-md font-medium text-blue-700 mb-1">Current Condition:</label>
                    <pre className="text-xs text-blue-800 whitespace-pre-wrap font-mono overflow-x-auto">
                        <code>{conditionCode}</code>
                    </pre>
                </div>
            )}
        </div>
    )
}
