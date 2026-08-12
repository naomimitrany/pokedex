import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScrollRestoration } from "./useScrollRestoration";

describe("useScrollRestoration", () => {
  let main: HTMLElement;

  beforeEach(() => {
    sessionStorage.clear();
    main = document.createElement("main");
    Object.defineProperty(main, "scrollTop", { value: 0, writable: true });
    main.scrollTo = vi.fn(
      (opts?: ScrollToOptions) => {
        if (opts && typeof opts.top === "number") main.scrollTop = opts.top;
      },
    ) as unknown as typeof main.scrollTo;
    document.body.appendChild(main);
  });

  afterEach(() => {
    document.body.removeChild(main);
  });

  it("restores a previously saved scroll position once ready", () => {
    sessionStorage.setItem("pokedex:scroll:test", "240");

    const { result, rerender } = renderHook(
      ({ ready }: { ready: boolean }) =>
        useScrollRestoration("pokedex:scroll:test", ready),
      { initialProps: { ready: false } },
    );
    expect(result.current).toBe(false);

    rerender({ ready: true });
    expect(result.current).toBe(true);
    expect(main.scrollTo).toHaveBeenCalledWith({ top: 240 });
  });

  it("does not wait to restore when nothing was saved for this key", () => {
    const { result } = renderHook(() =>
      useScrollRestoration("pokedex:scroll:unused", true),
    );
    expect(result.current).toBe(true);
  });

  it("evicts the oldest tracked scroll key once more than the cap has been used", () => {
    vi.useFakeTimers();
    try {
      const keys = Array.from(
        { length: 21 },
        (_, i) => `pokedex:scroll:key${i}`,
      );

      keys.forEach((key) => {
        const { unmount } = renderHook(() =>
          useScrollRestoration(key, true),
        );
        main.dispatchEvent(new Event("scroll"));
        vi.advanceTimersByTime(150);
        unmount();
      });

      // 21 distinct keys written against a cap of 20 -> the oldest is evicted.
      expect(sessionStorage.getItem(keys[0])).toBeNull();
      expect(sessionStorage.getItem(keys[20])).not.toBeNull();

      const index = JSON.parse(
        sessionStorage.getItem("pokedex:scroll:index") ?? "[]",
      );
      expect(index).toHaveLength(20);
      expect(index).not.toContain(keys[0]);
    } finally {
      vi.useRealTimers();
    }
  });
});
