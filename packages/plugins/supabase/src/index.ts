import {
  BasePlugin,
  OnboardingContext,
  PluginConfig,
  LoadedData,
  OnboardingEngine,
} from "@onboardjs/core";
import { PostgrestError, SupabaseClient, User } from "@supabase/supabase-js";

type SupabaseOperation = "load" | "persist" | "clear";

// Define the configuration options for our plugin
export interface SupabasePersistencePluginConfig extends PluginConfig {
  /** The Supabase client instance provided by the user. */
  client: SupabaseClient;
  /** The name of the table to store onboarding state. Defaults to 'onboarding_state'. */
  tableName?: string;
  /** The name of the column to use as the user id for lookup. Defaults to 'user_id'. */
  userIdColumn?: string;
  /** The key in the OnboardingContext where the user id's value can be found (e.g., 'currentUser.id'). */
  contextKeyForId?: string;
  /** The name of the column where the JSON state will be stored. Defaults to 'state_data'. */
  stateDataColumn?: string;

  /**
   * If true, the plugin will automatically use the authenticated Supabase user's ID.
   * The loaded user object will be available in the context at `context.currentUser`.
   * Defaults to `false`.
   */
  useSupabaseAuth?: boolean;

  /**
   * Optional callback to handle persistence errors.
   * If provided, this function is called before the error is passed to the engine's global error handler.
   */
  onError?: (error: PostgrestError, operation: SupabaseOperation) => void;
}

export class SupabasePersistencePlugin<
  TContext extends OnboardingContext<User>,
> extends BasePlugin<TContext> {
  // Adhere to the OnboardingPlugin interface
  public readonly name = "onboardjs-supabase-plugin";
  public readonly version = "0.1.0"; // Should match package.json

  config: SupabasePersistencePluginConfig;
  private tableName: string;
  private userIdColumn: string;
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
    this.userIdColumn = config.userIdColumn ?? "user_id";
    this.stateDataColumn = config.stateDataColumn ?? "state_data";
  }

  /**
   * Installs the Supabase persistence plugin into the OnboardingEngine.
   * @param engine The OnboardingEngine instance to install the plugin into.
   * @returns A cleanup function to remove the plugin's handlers.
   */
  async install(engine: OnboardingEngine<TContext>) {
    super.install(engine); // Call base install

    const getUserIdFromContext = (): string | undefined => {
      const context = engine.getState().context;
      const key = this.config.useSupabaseAuth
        ? "currentUser.id" // The key we use when we auto-inject the user
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

    engine.setDataLoadHandler(
      async (): Promise<LoadedData<TContext> | null> => {
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
          .eq(this.userIdColumn, userId)
          .maybeSingle();

        if (error) {
          this._handleError(error, "load");
          return null;
        }

        const loadedState =
          (stateData && typeof stateData === "object"
            ? ((stateData as Record<string, unknown>)[
                this.stateDataColumn
              ] as LoadedData<TContext>)
            : ({} as LoadedData<TContext>)) || ({} as LoadedData<TContext>);

        // Add the user to the loaded state if using Supabase Auth.
        if (this.config.useSupabaseAuth && user) {
          loadedState.currentUser = user;
        }

        return loadedState;
      },
    );

    engine.setDataPersistHandler(async (context, currentStepId) => {
      // This now reliably gets the ID from the hydrated context.
      const userId = getUserIdFromContext();
      if (!userId) return;

      const stateToPersist = {
        ...context,
        currentStepId, // Include the current step ID in the persisted state
      };

      const { error } = await this.config.client.from(this.tableName).upsert(
        {
          [this.userIdColumn]: userId,
          [this.stateDataColumn]: stateToPersist,
        },
        { onConflict: this.userIdColumn },
      );

      if (error) {
        this._handleError(error, "persist");
      }
    });

    engine.setClearPersistedDataHandler(async () => {
      const userId = getUserIdFromContext();
      if (!userId) return;

      const { error } = await this.config.client
        .from(this.tableName)
        .update({
          [this.stateDataColumn]: null,
        })
        .eq(this.userIdColumn, userId);

      if (error) {
        this._handleError(error, "clear");
      }
    });

    // Return a cleanup function (optional but good practice)
    return async () => {
      engine.setDataLoadHandler(undefined);
      engine.setDataPersistHandler(undefined);
      engine.setClearPersistedDataHandler(undefined);
    };
  }

  private _handleError(error: PostgrestError, operation: SupabaseOperation) {
    if (this.config.onError) {
      this.config.onError(error, operation);
    }

    if (this.engine) {
      const wrappedError = new Error(
        `[Supabase Plugin] Operation '${operation}' failed: ${error.message}`,
      );
      (wrappedError as any).cause = error;

      this.engine.reportError(wrappedError, `SupabasePlugin.${operation}`);
    } else {
      console.error(
        `[Supabase Plugin] Operation '${operation}' failed:`,
        error,
      );
    }
  }
}

/**
 * A helper function to create an instance of the SupabasePersistencePlugin.
 * This is the recommended way to instantiate the plugin.
 *
 * @param config The configuration options for the plugin.
 * @returns An instance of SupabasePersistencePlugin.
 */
export function createSupabasePlugin<TContext extends OnboardingContext<User>>(
  config: SupabasePersistencePluginConfig,
): SupabasePersistencePlugin<TContext> {
  return new SupabasePersistencePlugin<TContext>(config);
}
