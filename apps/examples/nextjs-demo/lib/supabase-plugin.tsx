// @onboardjs/plugins-supabase/src/SupabasePlugin.ts
import { BasePlugin, OnboardingContext, LoadedData } from "@onboardjs/core";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

interface SupabasePluginConfig {
  supabaseUrl: string;
  supabaseKey: string;
  tableName?: string;
  userIdField?: string;
  getUserId?: () => string | null; // Custom function to get user ID
}

export class SupabasePlugin extends BasePlugin<
  OnboardingContext,
  SupabasePluginConfig
> {
  readonly name = "supabase-persistence";
  readonly version = "1.0.0";
  readonly description = "Provides Supabase persistence for onboarding data";

  private supabase: SupabaseClient;

  constructor(config: SupabasePluginConfig) {
    super(config);
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
  }

  protected async onInstall(): Promise<void> {
    // Override the engine's persistence methods
    this.engine.setDataLoadHandler(this.loadFromSupabase.bind(this));
    this.engine.setDataPersistHandler(this.saveToSupabase.bind(this));
    this.engine.setClearPersistedDataHandler(this.clearFromSupabase.bind(this));

    console.log("[SupabasePlugin] Persistence handlers installed");
  }

  protected async onUninstall(): Promise<void> {
    // Reset to no persistence (or could restore previous handlers if needed)
    this.engine.setDataLoadHandler(undefined);
    this.engine.setDataPersistHandler(undefined);
    this.engine.setClearPersistedDataHandler(undefined);

    console.log("[SupabasePlugin] Persistence handlers removed");
  }

  private async loadFromSupabase(): Promise<LoadedData | null> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        console.log("[SupabasePlugin] No user ID available, skipping load");
        return null;
      }

      const { data, error } = await this.supabase
        .from(this.config.tableName || "onboarding_progress")
        .select("*")
        .eq(this.config.userIdField || "user_id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No rows found - this is normal for new users
          console.log("[SupabasePlugin] No existing progress found for user");
          return null;
        }
        throw error;
      }

      if (!data) return null;

      console.log("[SupabasePlugin] Loaded progress from Supabase:", data);

      return {
        flowData: data.flow_data || {},
        currentStepId: data.current_step_id,
        // Include any other context fields stored in Supabase
        ...(data.context_data || {}),
      };
    } catch (error) {
      console.error("[SupabasePlugin] Error loading data:", error);
      return null; // Fail gracefully
    }
  }

  private async saveToSupabase(
    context: OnboardingContext,
    currentStepId: string | number | null,
  ): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        console.log("[SupabasePlugin] No user ID available, skipping save");
        return;
      }

      const dataToSave = {
        [this.config.userIdField || "user_id"]: userId,
        flow_data: context.flowData,
        current_step_id: currentStepId,
        context_data: this.extractContextData(context),
        updated_at: new Date().toISOString(),
      };

      console.log("[SupabasePlugin] Saving progress to Supabase:", dataToSave);

      const hasExistingData = await this.supabase
        .from(this.config.tableName || "onboarding_progress")
        .select("*")
        .eq(this.config.userIdField || "user_id", userId)
        .maybeSingle();
      
      if (hasExistingData.data) {
        const { error } = await this.supabase
          .from(this.config.tableName || "onboarding_progress")
          .update(dataToSave)
          .eq(this.config.userIdField || "user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await this.supabase
          .from(this.config.tableName || "onboarding_progress")
          .upsert(dataToSave);
        if (error) throw error;
      }

      console.log("[SupabasePlugin] Progress saved to Supabase");
    } catch (error) {
      console.error("[SupabasePlugin] Error saving data:", error);
      throw error; // Re-throw so engine can handle the error
    }
  }

  private async clearFromSupabase(): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        console.log("[SupabasePlugin] No user ID available, skipping clear");
        return;
      }

      const { error } = await this.supabase
        .from(this.config.tableName || "onboarding_progress")
        .delete()
        .eq(this.config.userIdField || "user_id", userId);

      if (error) throw error;

      console.log("[SupabasePlugin] Progress cleared from Supabase");
    } catch (error) {
      console.error("[SupabasePlugin] Error clearing data:", error);
      throw error;
    }
  }

  private async getCurrentUserId(): Promise<string | null> {
    // return "a84d94de-2d2e-4861-a956-60d17393cf78"; // Demo user ID for testing
    // 1. Try custom getUserId function if provided
    if (this.config.getUserId) {
      return this.config.getUserId();
    }

    // 2. Try to get from engine context
    const context = this.engine.getState().context;
    if (context.currentUser?.id) {
      return context.currentUser.id;
    }

    // 3. Try to get from Supabase auth
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (user?.id) {
      return user.id;
    }

    return null;
  }

  private extractContextData(
    context: OnboardingContext,
  ): Record<string, unknown> {
    // Extract non-flowData context for storage
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { flowData: _, ...contextData } = context;
    return contextData;
  }
}

// Export factory function
export const createSupabasePlugin = (config: SupabasePluginConfig) =>
  new SupabasePlugin(config);
