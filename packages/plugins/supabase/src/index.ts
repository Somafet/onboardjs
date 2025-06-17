import {
  BasePlugin,
  OnboardingContext,
  PluginConfig,
  LoadedData,
  OnboardingEngine,
} from "@onboardjs/core";
import { SupabaseClient, User } from "@supabase/supabase-js";

// Define the shape of the data we'll store in Supabase
interface SupabaseState {
  flowData: Record<string, any>;
  currentStepId: string | number | null;
}

// Define the configuration options for our plugin
export interface SupabasePersistencePluginConfig extends PluginConfig {
  /** The Supabase client instance provided by the user. */
  client: SupabaseClient;
  /** The name of the table to store onboarding state. Defaults to 'onboarding_state'. */
  tableName?: string;
  /** The name of the column to use as the primary key for lookup. Defaults to 'id'. */
  primaryKeyColumn?: string;
  /** The key in the OnboardingContext where the primary key's value can be found (e.g., 'currentUser.id'). */
  contextKeyForId?: string;
  /** The name of the column where the JSON state will be stored. Defaults to 'state_data'. */
  stateDataColumn?: string;

  /**
   * If true, the plugin will automatically use the authenticated Supabase user's ID.
   * The loaded user object will be available in the context at `context.supabaseUser`.
   * Defaults to `false`.
   */
  useSupabaseAuth?: boolean;
}

export class SupabasePersistencePlugin extends BasePlugin<OnboardingContext> {
  // Adhere to the OnboardingPlugin interface
  public readonly name = "onboardjs-supabase-plugin";
  public readonly version = "0.1.0-alpha.0"; // Should match package.json

  config: SupabasePersistencePluginConfig;
  private tableName: string;
  private primaryKeyColumn: string;
  private stateDataColumn: string;

  constructor(config: SupabasePersistencePluginConfig) {
    super(config);
    // Validate required config
    if (!config.client) {
      throw new Error(
        "[Supabase Plugin] Supabase client instance is required.",
      );
    }

    // Validate that one identification method is provided
    if (!config.useSupabaseAuth && !config.contextKeyForId) {
      throw new Error(
        "[Supabase Plugin] Either `useSupabaseAuth` must be true or `contextKeyForId` must be provided.",
      );
    }

    this.config = config;
    this.tableName = config.tableName ?? "onboarding_state";
    this.primaryKeyColumn = config.primaryKeyColumn ?? "id";
    this.stateDataColumn = config.stateDataColumn ?? "state_data";
  }

  /**
   * Installs the Supabase persistence plugin into the OnboardingEngine.
   * @param engine The OnboardingEngine instance to install the plugin into.
   * @returns A cleanup function to remove the plugin's handlers.
   */
  async install(engine: OnboardingEngine<OnboardingContext>) {
    super.install(engine); // Call base install

    const getUserIdFromContext = (): string | undefined => {
      const context = engine.getState().context;
      const key = this.config.useSupabaseAuth
        ? "supabaseUser.id" // The key we use when we auto-inject the user
        : this.config.contextKeyForId;

      if (!key) return undefined;

      const result = key
        .split(".")
        .reduce((obj, keyPart) => (obj ? obj[keyPart] : undefined), context);

      // Final safety check: ensure the retrieved value is actually a string before returning.
      if (typeof result === "string") {
        return result;
      }

      if (result !== undefined) {
        console.warn(
          `[Supabase Plugin] Expected a string at context key '${key}', but found type '${typeof result}'.`,
        );
      }

      return undefined;
    };

    // --- Wire up the persistence handlers ---

    engine.setDataLoadHandler(async (): Promise<LoadedData | null> => {
      let userId: string | undefined;
      let user: User | null = null;

      // If using Supabase Auth, fetch the user first.
      if (this.config.useSupabaseAuth) {
        const { data } = await this.config.client.auth.getUser();
        user = data.user;
        userId = user?.id;
      } else {
        // Otherwise, get the ID from the initial context provided to the engine.
        userId = getUserIdFromContext();
      }

      if (!userId) return null;

      const { data: stateData, error } = await this.config.client
        .from(this.tableName)
        .select(this.stateDataColumn)
        .eq(this.primaryKeyColumn, userId)
        .maybeSingle();

      if (error) {
        if (error && error.code !== "PGRST116") {
          // PGRST116 = Row not found
          console.error("[Supabase Plugin] Error loading state:", error);
        }
        return null;
      }

      const loadedState =
        (stateData && typeof stateData === "object"
          ? ((stateData as Record<string, unknown>)[
              this.stateDataColumn
            ] as LoadedData)
          : {}) || {};

      return {
        ...loadedState,
        // This ensures `context.supabaseUser` is available for subsequent operations.
        ...(this.config.useSupabaseAuth && user ? { supabaseUser: user } : {}),
      };
    });

    engine.setDataPersistHandler(async (context, currentStepId) => {
      // This now reliably gets the ID from the hydrated context.
      const userId = getUserIdFromContext();
      if (!userId) return;

      const stateToPersist: SupabaseState = {
        flowData: context.flowData,
        currentStepId,
      };

      const { error } = await this.config.client.from(this.tableName).upsert({
        [this.primaryKeyColumn]: userId,
        [this.stateDataColumn]: stateToPersist,
      });

      if (error) {
        console.error("[Supabase Plugin] Error persisting state:", error);
      }
    });

    engine.setClearPersistedDataHandler(async () => {
      const userId = getUserIdFromContext();
      if (!userId) return;

      const { error } = await this.config.client
        .from(this.tableName)
        .delete()
        .eq(this.primaryKeyColumn, userId);

      if (error) {
        console.error("[Supabase Plugin] Error clearing state:", error);
      }
    });

    // Return a cleanup function (optional but good practice)
    return async () => {
      engine.setDataLoadHandler(undefined);
      engine.setDataPersistHandler(undefined);
      engine.setClearPersistedDataHandler(undefined);
    };
  }
}
