import { ChecklistItemDefinition } from '@onboardjs/core'
import { PlusIcon, TrashIcon } from 'lucide-react'

export function ChecklistItemsEditor({
    items,
    onChange,
    readonly,
}: {
    items: ChecklistItemDefinition[]
    onChange: (newItems: ChecklistItemDefinition[]) => void
    readonly: boolean
}) {
    const handleItemChange = (index: number, field: keyof ChecklistItemDefinition, value: string | boolean) => {
        const newItems = [...items]
        newItems[index] = { ...newItems[index], [field]: value }
        onChange(newItems)
    }

    const addItem = () => {
        const newId = `item_${Date.now()}`
        onChange([...items, { id: newId, label: 'New Item', isMandatory: false }])
    }

    const deleteItem = (index: number) => {
        onChange(items.filter((_, i) => i !== index))
    }

    return (
        <div className="vis:space-y-3">
            <label className="vis:block vis:text-sm vis:font-medium vis:text-gray-700">Items ({items.length})</label>
            <div className="vis:space-y-2">
                {items.map((item, index) => (
                    <div key={item.id} className="vis:p-2 vis:border vis:border-gray-200 vis:rounded-md vis:space-y-2">
                        <div className="vis:flex vis:items-center vis:gap-2">
                            <input
                                type="text"
                                placeholder="Label"
                                value={item.label}
                                onChange={(e) => handleItemChange(index, 'label', e.target.value)}
                                disabled={readonly}
                                className="vis:flex-1 vis:px-2 vis:py-1 vis:border vis:border-gray-300 vis:rounded-md vis:text-sm vis:disabled:bg-gray-50"
                            />
                            <button
                                onClick={() => deleteItem(index)}
                                disabled={readonly}
                                className="vis:p-1 vis:text-red-500 hover:vis:bg-red-100 vis:rounded-md vis:disabled:opacity-50"
                            >
                                <TrashIcon className="vis:size-4" />
                            </button>
                        </div>
                        <label className="vis:flex vis:items-center vis:gap-2 vis:text-sm vis:text-gray-600">
                            <input
                                type="checkbox"
                                checked={item.isMandatory}
                                onChange={(e) => handleItemChange(index, 'isMandatory', e.target.checked)}
                                disabled={readonly}
                            />
                            Mandatory
                        </label>
                    </div>
                ))}
            </div>
            {!readonly && (
                <button
                    onClick={addItem}
                    className="vis:w-full vis:flex vis:items-center vis:justify-center vis:gap-2 vis:px-3 vis:py-2 vis:text-sm vis:text-blue-600 vis:border vis:border-dashed vis:border-gray-300 vis:rounded-md hover:vis:bg-blue-50"
                >
                    <PlusIcon className="vis:size-4" />
                    Add Item
                </button>
            )}
        </div>
    )
}
