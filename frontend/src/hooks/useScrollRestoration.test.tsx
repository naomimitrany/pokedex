import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSavedPages, useScrollRestoration } from "./useScrollRestoration";

describe("useScrollRestoration", () => {
  let main: HTMLElement;

  beforeEach(() => {
    sessionStorage.clear();
    main = document.createElement("main");
    Object.defineProperty(main, "scrollTop", { value: 0, writable: true });
    main.scrollTo = vi.fn((opts?: ScrollToOptions) => {
      if (opts && typeof opts.top === "number") main.scrollTop = opts.top;
    }) as unknown as typeof main.scrollTo;
    document.body.appendChild(main);
  });

  afterEach(() => {
    document.body.removeChild(main);
  });

  it("restores a previously saved scroll position once ready", () => {
    sessionStorage.setItem("pokedex:scroll:test", "240");

    const { result, rerender } = renderHook(
      ({ ready }: { ready: boolean }) =>
        useScrollRestoration("pokedex:scroll:test", ready, 1),
      { initialProps: { ready: false } },
    );
    expect(result.current).toBe(false);

    rerender({ ready: true });
    expect(result.current).toBe(true);
    expect(main.scrollTo).toHaveBeenCalledWith({ top: 240 });
  });

  it("does not wait to restore when nothing was saved for this key", () => {
    const { result } = renderHook(() =>
      useScrollRestoration("pokedex:scroll:unused", true, 1),
    );
    expect(result.current).toBe(true);
  });

  it("restores the saved position for a new key switched to after the first key was already restored", () => {
    sessionStorage.setItem("pokedex:scroll:a", "0");
    sessionStorage.setItem("pokedex:scroll:b", "500");

    const { result, rerender } = renderHook(
      ({ key }: { key: string }) => useScrollRestoration(key, true, 1),
      { initialProps: { key: "pokedex:scroll:a" } },
    );
    expect(result.current).toBe(true); // nothing to restore for "a"

    rerender({ key: "pokedex:scroll:b" });

    expect(result.current).toBe(true);
    expect(main.scrollTo).toHaveBeenCalledWith({ top: 500 });
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
          useScrollRestoration(key, true, 1),
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

  it("saves the loaded-pages count alongside scrollTop, readable via getSavedPages", () => {
    vi.useFakeTimers();
    try {
      renderHook(() => useScrollRestoration("pokedex:scroll:test", true, 7));
      main.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(150);

      expect(getSavedPages("pokedex:scroll:test")).toBe(7);
    } finally {
      vi.useRealTimers();
    }
  });

  it("getSavedPages defaults to 1 when nothing was saved for the key", () => {
    expect(getSavedPages("pokedex:scroll:never-visited")).toBe(1);
  });

  it("evicting a scroll key also removes its saved pages count", () => {
    vi.useFakeTimers();
    try {
      const keys = Array.from(
        { length: 21 },
        (_, i) => `pokedex:scroll:key${i}`,
      );

      keys.forEach((key) => {
        const { unmount } = renderHook(() =>
          useScrollRestoration(key, true, 3),
        );
        main.dispatchEvent(new Event("scroll"));
        vi.advanceTimersByTime(150);
        unmount();
      });

      expect(getSavedPages(keys[0])).toBe(1); // evicted -> back to default
      expect(getSavedPages(keys[20])).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
