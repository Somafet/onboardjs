import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock ResizeObserver for tests
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  // Uncomment these lines to hide console output during tests
  // log: vi.fn(),
  // warn: vi.fn(),
  // error: vi.fn(),
};
