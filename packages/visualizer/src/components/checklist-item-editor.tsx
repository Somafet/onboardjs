import { ChecklistItemDefinition } from "@onboardjs/core";
import { PlusIcon, TrashIcon } from "lucide-react";

export function ChecklistItemsEditor({
  items,
  onChange,
  readonly,
}: {
  items: ChecklistItemDefinition[];
  onChange: (newItems: ChecklistItemDefinition[]) => void;
  readonly: boolean;
}) {
  const handleItemChange = (
    index: number,
    field: keyof ChecklistItemDefinition,
    value: string | boolean,
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange(newItems);
  };

  const addItem = () => {
    const newId = `item_${Date.now()}`;
    onChange([...items, { id: newId, label: "New Item", isMandatory: false }]);
  };

  const deleteItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Items ({items.length})
      </label>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="p-2 border border-gray-200 rounded-md space-y-2"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Label"
                value={item.label}
                onChange={(e) =>
                  handleItemChange(index, "label", e.target.value)
                }
                disabled={readonly}
                className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm disabled:bg-gray-50"
              />
              <button
                onClick={() => deleteItem(index)}
                disabled={readonly}
                className="p-1 text-red-500 hover:bg-red-100 rounded-md disabled:opacity-50"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={item.isMandatory}
                onChange={(e) =>
                  handleItemChange(index, "isMandatory", e.target.checked)
                }
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
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-600 border border-dashed border-gray-300 rounded-md hover:bg-blue-50"
        >
          <PlusIcon className="w-4 h-4" />
          Add Item
        </button>
      )}
    </div>
  );
}
