import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRefreshLoop } from "./live-refresh";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("live refresh scheduling", () => {
  it("does not overlap slow requests or repeated focus events", async () => {
    let finish!: () => void;
    const refresh = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const loop = createRefreshLoop(refresh, 1000, () => true);
    const pending = loop.trigger();
    void loop.trigger();
    void loop.trigger();
    await vi.advanceTimersByTimeAsync(5000);
    expect(refresh).toHaveBeenCalledTimes(1);
    finish();
    await pending;
    await vi.advanceTimersByTimeAsync(999);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(2);
    loop.stop();
    finish();
  });

  it("pauses offline or hidden and catches up on return", async () => {
    let available = true;
    const refresh = vi.fn();
    const loop = createRefreshLoop(refresh, 1000, () => available);
    available = false;
    await loop.trigger();
    await vi.advanceTimersByTimeAsync(5000);
    expect(refresh).not.toHaveBeenCalled();
    available = true;
    await loop.trigger();
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(refresh).toHaveBeenCalledTimes(2);
    loop.stop();
  });

  it("continues after a failure", async () => {
    const refresh = vi.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValue(undefined);
    const loop = createRefreshLoop(refresh, 1000, () => true);
    await loop.trigger();
    await vi.advanceTimersByTimeAsync(1000);
    expect(refresh).toHaveBeenCalledTimes(2);
    loop.stop();
  });

  it("does not restart after unmount with a request pending", async () => {
    let finish!: () => void;
    const refresh = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const loop = createRefreshLoop(refresh, 1000, () => true);
    const pending = loop.trigger();
    loop.stop();
    finish();
    await pending;
    await vi.advanceTimersByTimeAsync(5000);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
