// src/engine/services/ChecklistManager.ts

import {
  OnboardingContext,
  OnboardingStep,
  ChecklistItemState,
  ChecklistStepPayload,
} from "../types";
import { ErrorHandler } from "./ErrorHandler";
import { EventManager } from "./EventManager";

export class ChecklistManager<TContext extends OnboardingContext> {
  constructor(
    private eventManager: EventManager<TContext>,
    private errorHandler: ErrorHandler<TContext>,
  ) {}

  getChecklistItemsState(
    step: OnboardingStep<TContext> & { type: "CHECKLIST" },
    context: TContext,
  ): ChecklistItemState[] {
    const { dataKey, items: itemDefinitions } = step.payload;
    let currentItemStates = context.flowData[dataKey] as
      | ChecklistItemState[]
      | undefined;

    if (
      !currentItemStates ||
      currentItemStates.length !== itemDefinitions.length
    ) {
      // Initialize or re-initialize if structure mismatch
      currentItemStates = itemDefinitions.map((def) => ({
        id: def.id,
        isCompleted: false,
      }));

      // Persist this initial state
      context.flowData = {
        ...context.flowData,
        [dataKey]: [...currentItemStates],
      };
    }

    return currentItemStates;
  }

  isChecklistStepComplete(
    step: OnboardingStep<TContext> & { type: "CHECKLIST" },
    context: TContext,
  ): boolean {
    const itemStates = this.getChecklistItemsState(step, context);
    const { items: itemDefinitions, minItemsToComplete } = step.payload;
    let completedCount = 0;
    let mandatoryPending = 0;

    for (const def of itemDefinitions) {
      if (def.condition && !def.condition(context)) {
        continue;
      }

      const state = itemStates.find((s) => s.id === def.id);
      const isMandatory = def.isMandatory !== false;

      if (state?.isCompleted) {
        completedCount++;
      } else if (isMandatory) {
        mandatoryPending++;
      }
    }

    if (typeof minItemsToComplete === "number") {
      return completedCount >= minItemsToComplete;
    } else {
      return mandatoryPending === 0;
    }
  }

  async updateChecklistItem(
    itemId: string,
    isCompleted: boolean,
    step: OnboardingStep<TContext> & { type: "CHECKLIST" },
    context: TContext,
    persistCallback?: () => Promise<void>,
  ): Promise<void> {
    const payload = step.payload as ChecklistStepPayload;
    const { dataKey } = payload;

    let itemStates =
      (context.flowData[dataKey] as ChecklistItemState[] | undefined) || [];
    const itemIndex = itemStates.findIndex((item) => item.id === itemId);

    // Ensure item definitions exist to avoid adding arbitrary items
    const itemDefExists = payload.items.some((def) => def.id === itemId);
    if (!itemDefExists) {
      console.warn(
        `[ChecklistManager] Attempted to update non-existent checklist item '${itemId}' for step '${step.id}'.`,
      );
      return;
    }

    if (itemIndex !== -1) {
      // Create a new array for immutability
      const newItemStates = [...itemStates];
      newItemStates[itemIndex] = { ...newItemStates[itemIndex], isCompleted };
      itemStates = newItemStates;
    } else {
      // Item state doesn't exist, create it
      itemStates = [...itemStates, { id: itemId, isCompleted }];
    }

    // Update flowData
    const oldFlowDataJSON = JSON.stringify(context.flowData);
    context.flowData = {
      ...context.flowData,
      [dataKey]: itemStates,
    };

    if (
      JSON.stringify(context.flowData) !== oldFlowDataJSON &&
      persistCallback
    ) {
      try {
        await persistCallback();
      } catch (error) {
        this.errorHandler.handleError(
          error,
          "updateChecklistItem persistence",
          context,
        );
      }
    }
  }

  getChecklistProgress(
    step: OnboardingStep<TContext> & { type: "CHECKLIST" },
    context: TContext,
  ): {
    completed: number;
    total: number;
    percentage: number;
    isComplete: boolean;
  } {
    const itemStates = this.getChecklistItemsState(step, context);
    const { items: itemDefinitions } = step.payload;

    let totalItems = 0;
    let completedItems = 0;

    for (const def of itemDefinitions) {
      if (def.condition && !def.condition(context)) {
        continue;
      }

      totalItems++;
      const state = itemStates.find((s) => s.id === def.id);
      if (state?.isCompleted) {
        completedItems++;
      }
    }

    const percentage = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
    const isComplete = this.isChecklistStepComplete(step, context);

    return {
      completed: completedItems,
      total: totalItems,
      percentage: Math.round(percentage),
      isComplete,
    };
  }
}
