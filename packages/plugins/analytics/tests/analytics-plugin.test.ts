import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  Mocked,
  MockInstance,
} from "vitest";
import { AnalyticsPlugin } from "../src/analytics-plugin";
import { createAnalyticsPlugin } from "../src/index";
import { AnalyticsDBManager } from "../src/analytics-db-manager";
import type { AnalyticsEvent, AnalyticsPluginConfig } from "../src/types";
import type { OnboardingEngine } from "@onboardjs/core";

// Mock the DB Manager dependency
vi.mock("../src/analytics-db-manager");

// Mock the OnboardingEngine to control context
const mockEngine = {
  getContext: vi.fn().mockReturnValue({
    flowData: { some: "data" },
    currentUser: { id: "user-123" },
  }),
  addEventListener: vi.fn().mockReturnValue(() => {}), // Return unsubscribe function
  addBeforeStepChangeListener: vi.fn().mockReturnValue(() => {}),
  addAfterStepChangeListener: vi.fn().mockReturnValue(() => {}),
  addStepActiveListener: vi.fn().mockReturnValue(() => {}),
  addStepCompletedListener: vi.fn().mockReturnValue(() => {}),
  addFlowCompletedListener: vi.fn().mockReturnValue(() => {}),
  addContextUpdateListener: vi.fn().mockReturnValue(() => {}),
  addErrorListener: vi.fn().mockReturnValue(() => {}),
  reportError: vi.fn(),
} as unknown as OnboardingEngine;

describe("AnalyticsPlugin", () => {
  let mockDbManager: Mocked<AnalyticsDBManager>;
  let fetchSpy: MockInstance;
  let randomUUIDSpy: MockInstance;
  let consoleWarnSpy: MockInstance;
  let consoleErrorSpy: MockInstance;

  // Helper to create a plugin instance
  const createPlugin = (config: Partial<AnalyticsPluginConfig> = {}) => {
    const plugin = new AnalyticsPlugin({
      endpoint: "https://api.test.com/events",
      ...config,
    });
    return plugin;
  };

  beforeEach(() => {
    // Re-setup mock engine return values after restoreAllMocks
    (mockEngine.getContext as any).mockReturnValue({
      flowData: { some: "data" },
      currentUser: { id: "user-123" },
    });

    // Use fake timers to control setInterval and setTimeout
    vi.useFakeTimers();

    // Mock timer functions
    vi.spyOn(global, "setInterval");
    vi.spyOn(global, "clearInterval");

    // Mock DB Manager instance and its methods
    mockDbManager = new AnalyticsDBManager() as Mocked<AnalyticsDBManager>;
    vi.mocked(AnalyticsDBManager).mockImplementation(() => mockDbManager);
    mockDbManager.init = vi.fn().mockResolvedValue(undefined);
    mockDbManager.addEvents = vi.fn().mockResolvedValue(undefined);
    mockDbManager.getEvents = vi.fn().mockResolvedValue([]);
    mockDbManager.deleteEvents = vi.fn().mockResolvedValue(undefined);

    // Spy on global fetch
    fetchSpy = vi.spyOn(global, "fetch");

    // Spy on crypto.randomUUID for predictable IDs
    let eventCounter = 0;
    randomUUIDSpy = vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
      return `event-id-${++eventCounter}-0000-0000-0000-000000000000` as `${string}-${string}-${string}-${string}-${string}`;
    });

    // Spy on console to check for warnings/errors without polluting test output
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Mock window/navigator
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    // Restore all mocks and timers after each test
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("Initialization and Configuration", () => {
    it("should initialize with default configuration", () => {
      const plugin = createPlugin();
      expect(plugin.name).toBe("AnalyticsPlugin");
      expect((plugin as any).config.batchSize).toBe(10);
      expect((plugin as any).config.flushInterval).toBe(5000);
      expect((plugin as any).config.maxRetries).toBe(5);
    });

    it("should override default configuration with provided values", () => {
      const plugin = createPlugin({
        batchSize: 20,
        flushInterval: 10000,
        maxRetries: 3,
      });
      expect((plugin as any).config.batchSize).toBe(20);
      expect((plugin as any).config.flushInterval).toBe(10000);
      expect((plugin as any).config.maxRetries).toBe(3);
    });

    it("should initialize DB, set up listeners, and trigger initial flush onInstall", async () => {
      const plugin = createPlugin();

      // @ts-expect-error: Accessing protected for test purposes
      await plugin.onInstall();

      expect(mockDbManager.init).toHaveBeenCalledOnce();
      expect(window.addEventListener).toHaveBeenCalledWith(
        "online",
        expect.any(Function),
      );
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 5000);
      expect(mockDbManager.getEvents).toHaveBeenCalledOnce(); // From initial flush
    });
  });

  describe("Event Handling and Queueing", () => {
    it("should add events to the in-memory queue", async () => {
      const plugin = createPlugin();
      await plugin.install(mockEngine);
      // @ts-expect-error: Accessing protected for test purposes
      const hooks = plugin.getHooks();
      hooks.onFlowStarted!({} as any);

      const inMemoryQueue = (plugin as any).inMemoryQueue;
      expect(inMemoryQueue).toHaveLength(1);
      expect(inMemoryQueue[0]).toMatchObject({
        id: "event-id-1-0000-0000-0000-000000000000",
        type: "flowStarted",
      });
    });

    it("should persist queue to DB when batch size is reached", async () => {
      const plugin = createPlugin({ batchSize: 2 });
      await plugin.install(mockEngine);
      // @ts-expect-error: Accessing protected for test purposes
      const hooks = plugin.getHooks();

      hooks.onFlowStarted!({} as any);
      expect(mockDbManager.addEvents).not.toHaveBeenCalled();

      // @ts-expect-error: Accessing protected for test purposes
      hooks.onStepChange!({} as any);
      expect(mockDbManager.addEvents).toHaveBeenCalledOnce();
      expect(mockDbManager.addEvents).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: "event-id-1-0000-0000-0000-000000000000" }),
          expect.objectContaining({ id: "event-id-2-0000-0000-0000-000000000000" }),
        ]),
      );
      expect((plugin as any).inMemoryQueue).toHaveLength(0);
    });

    it("should persist queue to DB when flush interval is met", async () => {
      const plugin = createPlugin({ flushInterval: 3000 });
      await plugin.install(mockEngine);

      // @ts-expect-error: Accessing protected for test purposes
      const hooks = plugin.getHooks();
      hooks.onFlowStarted!({} as any);

      expect(mockDbManager.addEvents).not.toHaveBeenCalled();

      // Advance time to trigger the interval
      vi.advanceTimersByTime(3000);

      await vi.waitFor(() => {
        expect(mockDbManager.addEvents).toHaveBeenCalledOnce();
      });
      expect(mockDbManager.addEvents).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: "event-id-1-0000-0000-0000-000000000000" })]),
      );
    });
  });

  describe("API Flushing and Success", () => {
    it("should send events to the endpoint and delete them from DB on success", async () => {
      const mockEvents: AnalyticsEvent[] = [
        { id: "event-id-1", type: "flowStarted" } as any,
      ];
      mockDbManager.getEvents.mockResolvedValue(mockEvents);
      fetchSpy.mockResolvedValue({ ok: true });

      const plugin = createPlugin();
      await plugin.install(mockEngine); // Use proper install

      await vi.waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledOnce();
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.test.com/events",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(mockEvents),
        }),
      );
      expect(mockDbManager.deleteEvents).toHaveBeenCalledWith(["event-id-1"]);
    });

    it("should use payloadTransformer if provided", async () => {
      const mockEvents: AnalyticsEvent[] = [
        { id: "event-id-1", type: "flowStarted", payload: { a: 1 } } as any,
      ];
      mockDbManager.getEvents.mockResolvedValue(mockEvents);
      fetchSpy.mockResolvedValue({ ok: true });

      const payloadTransformer = vi.fn((event) => ({
        ...event,
        transformed: true,
      }));

      const plugin = createPlugin({ payloadTransformer });
      await plugin.install(mockEngine); // Use proper install

      await vi.waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledOnce();
      });

      expect(payloadTransformer).toHaveBeenCalledOnce();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify([{ ...mockEvents[0], transformed: true }]),
        }),
      );
    });
  });

  describe("API Failure and Retry Logic", () => {
    it("should retry sending a batch on fetch failure with exponential backoff", async () => {
      const mockEvents: AnalyticsEvent[] = [
        { id: "event-id-1", type: "flowStarted" } as any,
      ];
      mockDbManager.getEvents.mockResolvedValue(mockEvents);
      // Fail the first time, succeed the second
      fetchSpy
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ ok: true });

      const plugin = createPlugin();
      await plugin.install(mockEngine); // Use proper install

      // Wait for the first failed attempt
      await vi.waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send batch"),
        expect.any(Error),
        "Retry attempt 1.",
      );
      expect(mockDbManager.deleteEvents).not.toHaveBeenCalled();

      // Advance timer for the first retry (2^1 * 1000ms + jitter)
      vi.advanceTimersByTime(2100);

      // Wait for the second, successful attempt
      await vi.waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(2);
      });
      expect(mockDbManager.deleteEvents).toHaveBeenCalledWith(["event-id-1"]);
    });

    it("should discard batch after max retries are exceeded", async () => {
      const mockEvents: AnalyticsEvent[] = [
        { id: "event-id-1", type: "flowStarted" } as any,
      ];
      mockDbManager.getEvents.mockResolvedValue(mockEvents);
      fetchSpy.mockResolvedValue({ ok: false, status: 500 }); // Always fail

      const plugin = createPlugin({ maxRetries: 2 });
      await plugin.install(mockEngine); // Use proper install

      // Attempt 1
      await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
      vi.advanceTimersByTime(2100); // Retry 1

      // Attempt 2
      await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
      vi.advanceTimersByTime(4100); // Retry 2

      // Attempt 3 (final)
      await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3));

      // After the final attempt, it should not schedule another retry
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Batch failed after max retries. Discarding 1 events.",
        ),
      );
      expect(mockDbManager.deleteEvents).toHaveBeenCalledWith(["event-id-1"]);
      expect(mockEngine.reportError).toHaveBeenCalled();
    });
  });

  describe("Offline/Online Behavior", () => {
    it("should not attempt to flush when offline", async () => {
      vi.stubGlobal("navigator", { onLine: false });
      const plugin = createPlugin();
      await plugin.install(mockEngine); // Use proper install

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should trigger a flush when coming back online", async () => {
      const onlineListener = () => (window as any).eventListeners.online();
      vi.stubGlobal("window", {
        eventListeners: {} as Record<string, Function>,
        addEventListener: (event: string, cb: Function) => {
          (window as any).eventListeners[event] = cb;
        },
        removeEventListener: vi.fn(),
      });

      const plugin = createPlugin();
      await plugin.install(mockEngine); // Use proper install

      // Go offline
      vi.stubGlobal("navigator", { onLine: false });
      // Come back online
      vi.stubGlobal("navigator", { onLine: true });
      onlineListener(); // Manually trigger the listener

      await vi.waitFor(() => {
        expect(mockDbManager.getEvents).toHaveBeenCalled();
      });
    });
  });

  describe("Cleanup", () => {
    it("should clear interval, remove listener, and perform a final flush onUninstall", async () => {
      const plugin = createPlugin();
      const cleanupFn = await plugin.install(mockEngine);

      // Add an event to the in-memory queue
      // @ts-expect-error: Accessing protected for test purposes
      const hooks = plugin.getHooks();
      hooks.onFlowStarted!({} as any);

      await cleanupFn();

      expect(clearInterval).toHaveBeenCalledOnce();
      expect(window.removeEventListener).toHaveBeenCalledWith(
        "online",
        expect.any(Function),
      );
      // The final flush should have persisted the event
      expect(mockDbManager.addEvents).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: "event-id-1-0000-0000-0000-000000000000" })]),
      );
    });
  });

  describe("createAnalyticsPlugin helper", () => {
    it("should return an instance of AnalyticsPlugin", () => {
      const plugin = createAnalyticsPlugin({
        endpoint: "https://api.test.com",
      });
      expect(plugin).toBeInstanceOf(AnalyticsPlugin);
    });
  });
});
