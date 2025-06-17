import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SupabasePersistencePlugin,
  SupabasePersistencePluginConfig,
} from "./index";
import { OnboardingEngine, OnboardingContext } from "@onboardjs/core";
import { SupabaseClient, User } from "@supabase/supabase-js";

// --- Mocks ---

// A factory to create a deeply mocked Supabase client for chaining
const createMockSupabaseClient = () => {
  const mockEq = vi.fn().mockReturnThis();
  const mockMaybeSingle = vi.fn();
  const mockSelect = vi
    .fn()
    .mockReturnValue({ eq: mockEq, maybeSingle: mockMaybeSingle });
  // const mockEq = vi.fn().mockResolvedValue({ error: null });
  const mockUpsert = vi.fn().mockResolvedValue({ error: null });
  const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
    upsert: mockUpsert,
    delete: mockDelete,
  });
  const mockGetUser = vi.fn();

  return {
    from: mockFrom,
    auth: {
      getUser: mockGetUser,
    },
    // Add spies for easy access in tests
    _spies: {
      from: mockFrom,
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
      upsert: mockUpsert,
      delete: mockDelete,
      getUser: mockGetUser,
    },
  };
};

// A factory to create a mock OnboardingEngine
const createMockEngine = (
  initialContext: OnboardingContext = { flowData: {} },
) => {
  let context = initialContext;
  return {
    setDataLoadHandler: vi.fn(),
    setDataPersistHandler: vi.fn(),
    setClearPersistedDataHandler: vi.fn(),
    // Use mockImplementation to dynamically return the current context
    getState: vi.fn().mockImplementation(() => ({ context })),
    // This helper will now work as expected
    _setContext(newContext: OnboardingContext) {
      context = newContext;
    },
  };
};

type MockSupabaseClient = ReturnType<typeof createMockSupabaseClient>;
type MockEngine = ReturnType<typeof createMockEngine>;

describe("SupabasePersistencePlugin", () => {
  let mockSupabaseClient: MockSupabaseClient;
  let mockEngine: MockEngine;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockSupabaseClient = createMockSupabaseClient();
    mockEngine = createMockEngine();
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Constructor", () => {
    it("should throw an error if no client is provided", () => {
      expect(() => new SupabasePersistencePlugin({} as any)).toThrow(
        "[Supabase Plugin] Supabase client instance is required.",
      );
    });

    it("should throw an error if no identification method is provided", () => {
      expect(
        () =>
          new SupabasePersistencePlugin({
            client: mockSupabaseClient as unknown as SupabaseClient,
          }),
      ).toThrow(
        "[Supabase Plugin] Either `useSupabaseAuth` must be true or `contextKeyForId` must be provided.",
      );
    });

    it("should use default table and column names if not provided", () => {
      const plugin = new SupabasePersistencePlugin({
        client: mockSupabaseClient as unknown as SupabaseClient,
        contextKeyForId: "user.id",
      });
      expect(plugin["tableName"]).toBe("onboarding_state");
      expect(plugin["primaryKeyColumn"]).toBe("id");
      expect(plugin["stateDataColumn"]).toBe("state_data");
    });

    it("should use custom table and column names when provided", () => {
      const plugin = new SupabasePersistencePlugin({
        client: mockSupabaseClient as unknown as SupabaseClient,
        contextKeyForId: "user.id",
        tableName: "custom_table",
        primaryKeyColumn: "user_uuid",
        stateDataColumn: "flow_json",
      });
      expect(plugin["tableName"]).toBe("custom_table");
      expect(plugin["primaryKeyColumn"]).toBe("user_uuid");
      expect(plugin["stateDataColumn"]).toBe("flow_json");
    });
  });

  describe("Installation and Handlers", () => {
    it("should set all persistence handlers on the engine", async () => {
      const plugin = new SupabasePersistencePlugin({
        client: mockSupabaseClient as unknown as SupabaseClient,
        contextKeyForId: "user.id",
      });
      await plugin.install(mockEngine as unknown as OnboardingEngine);

      expect(mockEngine.setDataLoadHandler).toHaveBeenCalledWith(
        expect.any(Function),
      );
      expect(mockEngine.setDataPersistHandler).toHaveBeenCalledWith(
        expect.any(Function),
      );
      expect(mockEngine.setClearPersistedDataHandler).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it("should return a cleanup function that removes all handlers", async () => {
      const plugin = new SupabasePersistencePlugin({
        client: mockSupabaseClient as unknown as SupabaseClient,
        contextKeyForId: "user.id",
      });
      const cleanup = await plugin.install(
        mockEngine as unknown as OnboardingEngine,
      );

      await cleanup();

      expect(mockEngine.setDataLoadHandler).toHaveBeenCalledWith(undefined);
      expect(mockEngine.setDataPersistHandler).toHaveBeenCalledWith(undefined);
      expect(mockEngine.setClearPersistedDataHandler).toHaveBeenCalledWith(
        undefined,
      );
    });
  });

  describe("Data Loading (`setDataLoadHandler`)", () => {
    const mockUser = { id: "user-abc-123" } as User;
    const mockState = {
      flowData: { key: "value" },
      currentStepId: "step2",
    };

    it("mode `useSupabaseAuth`: should load data for an authenticated user", async () => {
      mockSupabaseClient._spies.getUser.mockResolvedValue({
        data: { user: mockUser },
      });
      mockSupabaseClient._spies.maybeSingle.mockResolvedValue({
        data: { state_data: mockState },
        error: null,
      });

      const plugin = new SupabasePersistencePlugin({
        client: mockSupabaseClient as unknown as SupabaseClient,
        useSupabaseAuth: true,
      });
      await plugin.install(mockEngine as unknown as OnboardingEngine);

      const loadHandler = vi.mocked(mockEngine.setDataLoadHandler).mock
        .calls[0][0];
      const result = await loadHandler();

      expect(mockSupabaseClient._spies.getUser).toHaveBeenCalled();
      expect(mockSupabaseClient._spies.eq).toHaveBeenCalledWith(
        "id",
        mockUser.id,
      );
      expect(result).toEqual({ ...mockState, supabaseUser: mockUser });
    });

    it("mode `useSupabaseAuth`: should return null if no user is authenticated", async () => {
      mockSupabaseClient._spies.getUser.mockResolvedValue({
        data: { user: null },
      });
      const plugin = new SupabasePersistencePlugin({
        client: mockSupabaseClient as unknown as SupabaseClient,
        useSupabaseAuth: true,
      });
      await plugin.install(mockEngine as unknown as OnboardingEngine);

      const loadHandler = vi.mocked(mockEngine.setDataLoadHandler).mock
        .calls[0][0];
      const result = await loadHandler();

      expect(mockSupabaseClient._spies.from).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("mode `contextKeyForId`: should load data using a nested context key", async () => {
      mockEngine._setContext({
        flowData: {},
        currentUser: { details: { id: "user-xyz-789" } },
      });
      mockSupabaseClient._spies.maybeSingle.mockResolvedValue({
        data: { state_data: mockState },
        error: null,
      });

      const plugin = new SupabasePersistencePlugin({
        client: mockSupabaseClient as unknown as SupabaseClient,
        contextKeyForId: "currentUser.details.id",
      });
      await plugin.install(mockEngine as unknown as OnboardingEngine);

      const loadHandler = vi.mocked(mockEngine.setDataLoadHandler).mock
        .calls[0][0];
      const result = await loadHandler();

      expect(mockSupabaseClient._spies.eq).toHaveBeenCalledWith(
        "id",
        "user-xyz-789",
      );
      expect(result).toEqual(mockState);
    });

    it("mode `contextKeyForId`: should return null if context key is invalid", async () => {
      mockEngine._setContext({ flowData: {}, user: {} });
      const plugin = new SupabasePersistencePlugin({
        client: mockSupabaseClient as unknown as SupabaseClient,
        contextKeyForId: "user.nonexistent.id",
      });
      await plugin.install(mockEngine as unknown as OnboardingEngine);

      const loadHandler = vi.mocked(mockEngine.setDataLoadHandler).mock
        .calls[0][0];
      const result = await loadHandler();

      expect(mockSupabaseClient._spies.from).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("should return an empty object if no state is found in DB", async () => {
      mockSupabaseClient._spies.getUser.mockResolvedValue({
        data: { user: mockUser },
      });
      mockSupabaseClient._spies.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const plugin = new SupabasePersistencePlugin({
        client: mockSupabaseClient as unknown as SupabaseClient,
        useSupabaseAuth: true,
      });
      await plugin.install(mockEngine as unknown as OnboardingEngine);

      const loadHandler = vi.mocked(mockEngine.setDataLoadHandler).mock
        .calls[0][0];
      const result = await loadHandler();

      expect(result).toEqual({ supabaseUser: mockUser });
    });

    it("should log an error and return null on Supabase fetch error", async () => {
      const dbError = { message: "DB connection failed", code: "500" };
      mockSupabaseClient._spies.getUser.mockResolvedValue({
        data: { user: mockUser },
      });
      mockSupabaseClient._spies.maybeSingle.mockResolvedValue({
        data: null,
        error: dbError,
      });

      const plugin = new SupabasePersistencePlugin({
        client: mockSupabaseClient as unknown as SupabaseClient,
        useSupabaseAuth: true,
      });
      await plugin.install(mockEngine as unknown as OnboardingEngine);

      const loadHandler = vi.mocked(mockEngine.setDataLoadHandler).mock
        .calls[0][0];
      const result = await loadHandler();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Supabase Plugin] Error loading state:",
        dbError,
      );
      expect(result).toBeNull();
    });
  });

  describe("Data Persisting (`setDataPersistHandler`)", () => {
    it("should upsert the correct state structure to Supabase", async () => {
      const contextToSave: OnboardingContext = {
        flowData: { name: "Soma" },
        supabaseUser: { id: "user-abc-123" },
      };
      const currentStepId = "step3";

      const plugin = new SupabasePersistencePlugin({
        client: mockSupabaseClient as unknown as SupabaseClient,
        useSupabaseAuth: true,
      });
      await plugin.install(mockEngine as unknown as OnboardingEngine);

      mockEngine._setContext(contextToSave);

      const persistHandler = vi.mocked(mockEngine.setDataPersistHandler).mock
        .calls[0][0];
      await persistHandler(contextToSave, currentStepId);

      expect(mockSupabaseClient._spies.upsert).toHaveBeenCalledWith({
        id: "user-abc-123",
        state_data: {
          flowData: { name: "Soma" },
          currentStepId: "step3",
        },
      });
    });

    it("should not attempt to persist if no user ID can be found", async () => {
      const plugin = new SupabasePersistencePlugin({
        client: mockSupabaseClient as unknown as SupabaseClient,
        contextKeyForId: "user.id", // Context is empty, so this will fail
      });
      await plugin.install(mockEngine as unknown as OnboardingEngine);

      const persistHandler = vi.mocked(mockEngine.setDataPersistHandler).mock
        .calls[0][0];
      await persistHandler({ flowData: {} }, "step1");

      expect(mockSupabaseClient._spies.upsert).not.toHaveBeenCalled();
    });
  });

  describe("Data Clearing (`setClearPersistedDataHandler`)", () => {
    it("should delete the correct row from Supabase", async () => {
      // --- THE FIX: Set the context BEFORE installing the plugin ---

      // 1. ARRANGE: Set up the mock engine with the desired context first.
      mockEngine._setContext({
        flowData: {},
        user: { id: "user-to-delete" },
      });

      // 2. ARRANGE: Create the plugin instance.
      const plugin = new SupabasePersistencePlugin({
        client: mockSupabaseClient as unknown as SupabaseClient,
        contextKeyForId: "user.id",
      });

      // 3. ARRANGE: Now, install the plugin. The handlers will close over the correct context.
      await plugin.install(mockEngine as unknown as OnboardingEngine);

      // 4. ACT: Get the handler and execute it.
      const clearHandler = vi.mocked(mockEngine.setClearPersistedDataHandler)
        .mock.calls[0][0];
      await clearHandler();

      // 5. ASSERT: The test will now pass.
      expect(mockSupabaseClient._spies.delete).toHaveBeenCalled();
      expect(mockSupabaseClient._spies.eq).toHaveBeenCalledWith(
        "id",
        "user-to-delete",
      );
    });

    it("should not attempt to delete if no user ID can be found", async () => {
      const plugin = new SupabasePersistencePlugin({
        client: mockSupabaseClient as unknown as SupabaseClient,
        contextKeyForId: "user.id",
      });
      await plugin.install(mockEngine as unknown as OnboardingEngine);

      const clearHandler = vi.mocked(mockEngine.setClearPersistedDataHandler)
        .mock.calls[0][0];
      await clearHandler();

      expect(mockSupabaseClient._spies.delete).not.toHaveBeenCalled();
    });
  });
});
