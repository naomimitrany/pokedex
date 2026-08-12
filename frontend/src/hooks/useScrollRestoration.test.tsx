import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_AUTO_RESTORE_PAGES } from "../constants";
import {
  getSavedScrollEntry,
  useScrollRestoration,
} from "./useScrollRestoration";

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

  const seed = (key: string, scrollTop: number, pages: number) => {
    sessionStorage.setItem(key, JSON.stringify({ scrollTop, pages }));
  };

  it("restores a previously saved scroll position once ready", () => {
    seed("pokedex:scroll:test", 240, 1);

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
    seed("pokedex:scroll:a", 0, 1);
    seed("pokedex:scroll:b", 500, 1);

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

  it("saves scrollTop and the loaded-pages count together, readable via getSavedScrollEntry", () => {
    vi.useFakeTimers();
    try {
      renderHook(() => useScrollRestoration("pokedex:scroll:test", true, 7));
      main.scrollTop = 900;
      main.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(150);

      expect(getSavedScrollEntry("pokedex:scroll:test")).toEqual({
        scrollTop: 900,
        pages: 7,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("getSavedScrollEntry returns null when nothing was saved for the key", () => {
    expect(getSavedScrollEntry("pokedex:scroll:never-visited")).toBeNull();
  });

  it("clamps an excessively large saved pages value to MAX_AUTO_RESTORE_PAGES", () => {
    // A stale/tampered sessionStorage entry shouldn't be able to force a
    // 500-page collapsed restore fetch.
    seed("pokedex:scroll:huge", 100, 500);
    expect(getSavedScrollEntry("pokedex:scroll:huge")).toEqual({
      scrollTop: 100,
      pages: MAX_AUTO_RESTORE_PAGES,
    });
  });

  it("evicting a scroll key removes its whole saved entry", () => {
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

      expect(getSavedScrollEntry(keys[0])).toBeNull(); // evicted
      expect(getSavedScrollEntry(keys[20])).toEqual({
        scrollTop: 0,
        pages: 3,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("re-applies the saved scrollTop once document.fonts.ready resolves, correcting drift from a late font swap", async () => {
    seed("pokedex:scroll:test", 500, 1);
    let resolveFontsReady!: () => void;
    const fontsReady = new Promise<void>((resolve) => {
      resolveFontsReady = resolve;
    });
    const originalFonts = document.fonts;
    Object.defineProperty(document, "fonts", {
      value: { ready: fontsReady },
      configurable: true,
    });

    try {
      const { result } = renderHook(() =>
        useScrollRestoration("pokedex:scroll:test", true, 1),
      );
      expect(result.current).toBe(true);
      expect(main.scrollTo).toHaveBeenCalledWith({ top: 500 });

      // Simulate a font-swap reflow nudging the container off target.
      main.scrollTop = 470;
      (main.scrollTo as ReturnType<typeof vi.fn>).mockClear();

      resolveFontsReady();
      await fontsReady;
      await Promise.resolve(); // flush the .then() microtask

      expect(main.scrollTo).toHaveBeenCalledWith({ top: 500 });
    } finally {
      Object.defineProperty(document, "fonts", {
        value: originalFonts,
        configurable: true,
      });
    }
  });
});
