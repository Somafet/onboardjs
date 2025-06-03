// src/engine/services/PersistenceManager.ts

import { OnboardingContext } from "../types";
import { ErrorHandler } from "./ErrorHandler";
import { DataLoadFn, DataPersistFn, LoadedData } from "./types";

export class PersistenceManager<TContext extends OnboardingContext> {
  private loadData?: DataLoadFn<TContext>;
  private persistData?: DataPersistFn<TContext>;
  private clearPersistedData?: () => Promise<void> | void;

  constructor(
    loadData?: DataLoadFn<TContext>,
    persistData?: DataPersistFn<TContext>,
    clearPersistedData?: () => Promise<void> | void,
    private errorHandler?: ErrorHandler<TContext>,
  ) {
    this.loadData = loadData;
    this.persistData = persistData;
    this.clearPersistedData = clearPersistedData;
  }

  async loadPersistedData(): Promise<{
    data: LoadedData<TContext> | null;
    error: Error | null;
  }> {
    if (!this.loadData) {
      return { data: null, error: null };
    }

    try {
      console.log("[PersistenceManager] Attempting to load persisted data...");
      const loadedData = await this.loadData();
      console.log("[PersistenceManager] Data loaded successfully:", {
        hasFlowData: !!loadedData?.flowData,
        currentStepId: loadedData?.currentStepId,
        otherKeys: loadedData
          ? Object.keys(loadedData).filter(
              (k) => k !== "flowData" && k !== "currentStepId",
            )
          : [],
      });
      return { data: loadedData ?? null, error: null };
    } catch (error) {
      console.error("[PersistenceManager] Error during loadData:", error);
      const processedError =
        error instanceof Error ? error : new Error(String(error));
      const finalError = new Error(
        `Failed to load onboarding state: ${processedError.message}`,
      );
      return { data: null, error: finalError };
    }
  }

  async persistDataIfNeeded(
    context: TContext,
    currentStepId: string | number | null,
    isHydrating: boolean,
  ): Promise<void> {
    if (isHydrating || !this.persistData) {
      return;
    }

    try {
      console.log(
        "[PersistenceManager] Persisting data for step:",
        currentStepId,
      );
      await this.persistData(context, currentStepId);
      console.log("[PersistenceManager] Data persisted successfully");
    } catch (error) {
      console.error("[PersistenceManager] Error during persistData:", error);
      if (this.errorHandler) {
        this.errorHandler.handleError(error, "persistData", context);
      }
      // Don't throw - persistence errors shouldn't block core functionality
    }
  }

  async clearData(): Promise<void> {
    if (!this.clearPersistedData) {
      console.log(
        "[PersistenceManager] No clearPersistedData handler configured",
      );
      return;
    }

    try {
      console.log("[PersistenceManager] Clearing persisted data...");
      await this.clearPersistedData();
      console.log("[PersistenceManager] Persisted data cleared successfully");
    } catch (error) {
      console.error(
        "[PersistenceManager] Error during clearPersistedData:",
        error,
      );
      throw error;
    }
  }

  // Setters for updating handlers (used by plugins)
  setDataLoadHandler(handler: DataLoadFn<TContext> | undefined): void {
    this.loadData = handler;
  }

  setDataPersistHandler(handler: DataPersistFn<TContext> | undefined): void {
    this.persistData = handler;
  }

  setClearPersistedDataHandler(
    handler: (() => Promise<void> | void) | undefined,
  ): void {
    this.clearPersistedData = handler;
  }

  // Getters for current handlers
  getDataLoadHandler(): DataLoadFn<TContext> | undefined {
    return this.loadData;
  }

  getDataPersistHandler(): DataPersistFn<TContext> | undefined {
    return this.persistData;
  }

  getClearPersistedDataHandler(): (() => Promise<void> | void) | undefined {
    return this.clearPersistedData;
  }
}
