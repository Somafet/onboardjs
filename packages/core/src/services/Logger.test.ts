import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Logger, LoggerConfig } from "./Logger"; // Assuming your logger.ts is in src/

describe("Logger", () => {
  // Use vi.spyOn to mock console methods, similar to Jest's jest.spyOn
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleInfo: ReturnType<typeof vi.spyOn>;
  let mockConsoleWarn: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;

  // Clear mocks before each test to ensure fresh state
  beforeEach(() => {
    // Before each test, ensure we have a fresh spy
    // This makes sure console methods are always mocked for every test
    mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    mockConsoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    mockConsoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    // Clear any call history from previous tests
    mockConsoleLog.mockClear();
    mockConsoleInfo.mockClear();
    mockConsoleWarn.mockClear();
    mockConsoleError.mockClear();
  });

  // Restore original console methods after each test is done
  // Vitest's vi.restoreAllMocks() is generally preferred over individual mockRestore() calls
  // when you have multiple spies/mocks in a file.
  afterEach(() => {
    vi.restoreAllMocks();
    // Re-spy on console methods after restoring all mocks if you need them for subsequent tests
    // or if you want to ensure they are mocked across all tests.
    // However, it's often better to spy within `beforeEach` or `beforeAll` for clarity.
    // For this setup, spied once globally and then cleared/restored is fine.
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("Initialization", () => {
    it("should initialize with debugMode false and no prefix by default", () => {
      const logger = new Logger();
      logger.debug("Test message");
      expect(mockConsoleLog).not.toHaveBeenCalled(); // Debug should be off by default
      logger.info("Info message");
      expect(mockConsoleInfo).toHaveBeenCalledWith("[INFO]", "Info message"); // Info always on
    });

    it("should initialize with debugMode true when configured", () => {
      const config: LoggerConfig = { debugMode: true };
      const logger = new Logger(config);
      logger.debug("Test message");
      expect(mockConsoleLog).toHaveBeenCalledWith("[DEBUG]", "Test message");
    });

    it("should initialize with a custom prefix", () => {
      const config: LoggerConfig = { prefix: "MY_LIB" };
      const logger = new Logger(config);
      logger.info("Important info");
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        "MY_LIB [INFO]",
        "Important info",
      );
    });

    it("should initialize with debugMode true and a custom prefix", () => {
      const config: LoggerConfig = { debugMode: true, prefix: "API_SERVICE" };
      const logger = new Logger(config);
      logger.debug("API call started");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "API_SERVICE [DEBUG]",
        "API call started",
      );
    });

    it("should handle an empty string prefix correctly", () => {
      const config: LoggerConfig = { prefix: "" };
      const logger = new Logger(config);
      logger.info("No prefix here");
      expect(mockConsoleInfo).toHaveBeenCalledWith("[INFO]", "No prefix here");
    });

    it("should handle undefined config object", () => {
      const logger = new Logger(undefined);
      logger.info("Hello");
      expect(mockConsoleInfo).toHaveBeenCalledWith("[INFO]", "Hello");
      logger.debug("Should not log");
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it("should handle null config object", () => {
      // @ts-expect-error: Intentionally testing null config for robustness, Vitest equivalent of @ts-ignore
      const logger = new Logger(null);
      logger.info("Hello");
      expect(mockConsoleInfo).toHaveBeenCalledWith("[INFO]", "Hello");
      logger.debug("Should not log");
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });
  });

  describe("Log Levels", () => {
    let logger: Logger;

    beforeEach(() => {
      // Set up logger with debugMode true for comprehensive testing of all levels
      const config: LoggerConfig = { debugMode: true, prefix: "TEST_LIB" };
      logger = new Logger(config);
    });

    describe("debug()", () => {
      it("should log debug messages when debugMode is true", () => {
        logger.debug("Debugging an issue");
        expect(mockConsoleLog).toHaveBeenCalledWith(
          "TEST_LIB [DEBUG]",
          "Debugging an issue",
        );
      });

      it("should not log debug messages when debugMode is false", () => {
        const prodLogger = new Logger({ debugMode: false });
        prodLogger.debug("This should not appear");
        expect(mockConsoleLog).not.toHaveBeenCalled();
      });

      it("should handle multiple arguments", () => {
        const obj = { id: 1, name: "test" };
        logger.debug("Processing", obj, "done.");
        expect(mockConsoleLog).toHaveBeenCalledWith(
          "TEST_LIB [DEBUG]",
          "Processing",
          obj,
          "done.",
        );
      });
    });

    describe("info()", () => {
      it("should log info messages", () => {
        logger.info("Application started");
        expect(mockConsoleInfo).toHaveBeenCalledWith(
          "TEST_LIB [INFO]",
          "Application started",
        );
      });

      it("should handle multiple arguments", () => {
        const arr = [1, 2, 3];
        logger.info("Array content:", arr, "size:", arr.length);
        expect(mockConsoleInfo).toHaveBeenCalledWith(
          "TEST_LIB [INFO]",
          "Array content:",
          arr,
          "size:",
          3,
        );
      });
    });

    describe("warn()", () => {
      it("should log warning messages", () => {
        logger.warn("Deprecated feature used");
        expect(mockConsoleWarn).toHaveBeenCalledWith(
          "TEST_LIB [WARN]",
          "Deprecated feature used",
        );
      });

      it("should handle multiple arguments", () => {
        const errorMsg = "Resource not found";
        logger.warn("Warning:", errorMsg, 404);
        expect(mockConsoleWarn).toHaveBeenCalledWith(
          "TEST_LIB [WARN]",
          "Warning:",
          errorMsg,
          404,
        );
      });
    });

    describe("error()", () => {
      it("should log error messages", () => {
        const error = new Error("Something went wrong!");
        logger.error("Critical error:", error);
        expect(mockConsoleError).toHaveBeenCalledWith(
          "TEST_LIB [ERROR]",
          "Critical error:",
          error,
        );
      });

      it("should handle multiple arguments", () => {
        logger.error("Failed to connect", "retrying in", 5, "seconds.");
        expect(mockConsoleError).toHaveBeenCalledWith(
          "TEST_LIB [ERROR]",
          "Failed to connect",
          "retrying in",
          5,
          "seconds.",
        );
      });
    });
  });
});
