import type { Meta, StoryObj } from "@storybook/react";
import { Stepper } from "@onboardjs/shadcn";

const meta = {
  title: "Example/Stepper",
  component: Stepper,
  tags: ["autodocs"],
} satisfies Meta<typeof Stepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
