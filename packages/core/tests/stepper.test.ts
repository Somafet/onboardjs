import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useStepper } from "../src";

describe("useStepper", () => {
  it("should initialize at the initial step", () => {
    const { result } = renderHook(() =>
      useStepper({ steps: 3, initialStep: 1 })
    );
    expect(result.current.currentStep).toBe(1);
  });

  it("should go to next and previous steps", () => {
    const { result } = renderHook(() => useStepper({ steps: 3 }));
    act(() => result.current.next());
    expect(result.current.currentStep).toBe(1);
    act(() => result.current.prev());
    expect(result.current.currentStep).toBe(0);
  });

  it("should not go below 0 or above steps - 1", () => {
    const { result } = renderHook(() => useStepper({ steps: 2 }));
    act(() => result.current.prev());
    expect(result.current.currentStep).toBe(0);
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.currentStep).toBe(1);
  });

  it("should call onStepChange when step changes", () => {
    const onStepChange = vi.fn();
    const { result } = renderHook(() => useStepper({ steps: 3, onStepChange }));
    act(() => result.current.next());
    expect(onStepChange).toHaveBeenCalledWith(1);
    act(() => result.current.prev());
    expect(onStepChange).toHaveBeenCalledWith(0);
  });
});
