import { ChoiceOption } from '@onboardjs/core'
import { TrashIcon, PlusIcon } from 'lucide-react'

export function OptionsListEditor({
    options,
    onChange,
    readonly,
}: {
    options: ChoiceOption[]
    onChange: (newOptions: ChoiceOption[]) => void
    readonly: boolean
}) {
    const handleOptionChange = (index: number, field: keyof ChoiceOption, value: string) => {
        const newOptions = [...options]
        newOptions[index] = { ...newOptions[index], [field]: value }
        onChange(newOptions)
    }

    const addOption = () => {
        const newId = `opt_${Date.now()}`
        onChange([...options, { id: newId, label: 'New Option', value: newId }])
    }

    const deleteOption = (index: number) => {
        onChange(options.filter((_, i) => i !== index))
    }

    return (
        <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Options ({options.length})</label>
            <div className="space-y-2">
                {options.map((opt, index) => (
                    <div key={opt.id} className="p-2 border border-gray-200 rounded-md space-y-2">
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Label"
                                value={opt.label}
                                onChange={(e) => handleOptionChange(index, 'label', e.target.value)}
                                disabled={readonly}
                                className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm disabled:bg-gray-50"
                            />
                            <button
                                onClick={() => deleteOption(index)}
                                disabled={readonly}
                                className="p-1 text-red-500 hover:bg-red-100 rounded-md disabled:opacity-50"
                            >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </div>
                        <input
                            type="text"
                            placeholder="Value"
                            value={String(opt.value)}
                            onChange={(e) => handleOptionChange(index, 'value', e.target.value)}
                            disabled={readonly}
                            className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm disabled:bg-gray-50"
                        />
                    </div>
                ))}
            </div>
            {!readonly && (
                <button
                    onClick={addOption}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-600 border border-dashed border-gray-300 rounded-md hover:bg-blue-50"
                >
                    <PlusIcon className="w-4 h-4" />
                    Add Option
                </button>
            )}
        </div>
    )
}
