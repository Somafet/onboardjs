import type { SingleChoiceStepPayload } from "@onboardjs/core";
import { useOnboarding, type StepComponentProps } from "@onboardjs/react";
import clsx from "clsx";
import { Code2Icon, RocketIcon, ServerIcon } from "lucide-react";
const devTypeOptions: Record<
  string,
  { icon: React.ElementType; colors: { icon: string; iconBg: string } }
> = {
  frontend: {
    icon: Code2Icon,
    colors: {
      icon: "text-blue-600",
      iconBg: "bg-blue-100",
    },
  },
  backend: {
    icon: ServerIcon,
    colors: {
      icon: "text-orange-600",
      iconBg: "bg-orange-100",
    },
  },
  fullstack: {
    icon: RocketIcon,
    colors: {
      icon: "text-green-600",
      iconBg: "bg-green-100",
    },
  },
};

const devTypeTextMap: Record<string, string> = {
  frontend: "Awesome! You’ll love our React integration.",
  backend: "Great! Easily connect your data to our flexible flow engine.",
  fullstack: "Perfect! Build end-to-end with full control.",
};

export default function DevTypeSelector(
  props: StepComponentProps<SingleChoiceStepPayload>,
) {
  const { updateContext, next, previous, state } = useOnboarding();

  const handleSelect = (id: string) => {
    updateContext({ flowData: { devType: id } });
  };

  const { options } = props.payload;

  return (
    <>
      <fieldset aria-label="Developer Role type">
        <div className="space-y-4">
          {options.map((option) => {
            const devType = devTypeOptions[option.id]!;
            return (
              <label
                key={option.id}
                aria-label={option.label}
                aria-description="Select your developer role type"
                className="group relative block rounded-lg border border-gray-300 bg-white px-6 py-4 hover:cursor-pointer hover:border-gray-400 has-checked:outline-2 has-checked:-outline-offset-2 has-checked:outline-blue-600 has-focus-visible:outline-3 has-focus-visible:-outline-offset-1 sm:flex sm:justify-between"
              >
                <input
                  onChange={() => handleSelect(option.id)}
                  defaultValue={option.id}
                  name="onboarding-type"
                  type="radio"
                  className="sr-only absolute inset-0 appearance-none focus:outline-none"
                />
                <span className="flex items-center gap-4 text-sm">
                  <div
                    className={clsx("rounded-sm p-2", devType.colors.iconBg)}
                  >
                    <devType.icon
                      className={clsx("size-4", devType.colors.icon)}
                    />
                  </div>
                  <span className="font-medium text-gray-900">
                    {option.label}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {state && state.context?.flowData?.devType ? (
        <p className="mt-4 text-sm text-gray-600">
          {devTypeTextMap[state!.context.flowData.devType]}
        </p>
      ) : null}

      <div className="mt-6 flex w-full justify-end">
        <button
          onClick={() => previous()}
          className="mr-2 rounded-md bg-gray-200 px-4 py-2 text-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Back
        </button>
        <button
          onClick={() => next()}
          disabled={!state || !state.context?.flowData?.devType}
          className="rounded-md bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Next
        </button>
      </div>
    </>
  );
}
