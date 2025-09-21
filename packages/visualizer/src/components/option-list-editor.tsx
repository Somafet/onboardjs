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
        <div className="vis:space-y-3">
            <label className="vis:block vis:text-sm vis:font-medium vis:text-gray-700">
                Options ({options.length})
            </label>
            <div className="vis:space-y-2">
                {options.map((opt, index) => (
                    <div key={opt.id} className="vis:p-2 vis:border vis:border-gray-200 vis:rounded-md vis:space-y-2">
                        <div className="vis:flex vis:items-center vis:gap-2">
                            <input
                                type="text"
                                placeholder="Label"
                                value={opt.label}
                                onChange={(e) => handleOptionChange(index, 'label', e.target.value)}
                                disabled={readonly}
                                className="vis:flex-1 vis:px-2 vis:py-1 vis:border vis:border-gray-300 vis:rounded-md vis:text-sm vis:disabled:bg-gray-50"
                            />
                            <button
                                onClick={() => deleteOption(index)}
                                disabled={readonly}
                                className="vis:p-1 vis:text-red-500 vis:hover:bg-red-100 vis:rounded-md vis:disabled:opacity-50"
                            >
                                <TrashIcon className="vis:size-4" />
                            </button>
                        </div>
                        <input
                            type="text"
                            placeholder="Value"
                            value={String(opt.value)}
                            onChange={(e) => handleOptionChange(index, 'value', e.target.value)}
                            disabled={readonly}
                            className="vis:w-full vis:px-2 vis:py-1 vis:border vis:border-gray-300 vis:rounded-md vis:text-sm vis:disabled:bg-gray-50"
                        />
                    </div>
                ))}
            </div>
            {!readonly && (
                <button
                    onClick={addOption}
                    className="vis:w-full vis:flex vis:items-center vis:justify-center vis:gap-2 vis:px-3 vis:py-2 vis:text-sm vis:text-blue-600 vis:border vis:border-dashed vis:border-gray-300 vis:rounded-md vis:hover:bg-blue-50"
                >
                    <PlusIcon className="vis:w-4 vis:h-4" />
                    Add Option
                </button>
            )}
        </div>
    )
}
