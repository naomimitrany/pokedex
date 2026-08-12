# Scroll Restoration Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the frontend's flaky scroll-restoration system with one that reliably lands the user back at the exact pixel they scrolled to before a refresh, for an infinite-scroll Pokémon list.

**Architecture:** One atomic `{ scrollTop, pages }` entry per filter/sort/search combination ("scroll key"), written to `sessionStorage` by a debounced scroll listener and read once on mount to decide both how many pages to preload and where to jump. The URL no longer carries any restore-depth state. Cards that were part of the initial restore batch are permanently (not temporarily) exempted from `content-visibility` so a later re-estimate can't knock the restored position off target.

**Tech Stack:** React 19 + TypeScript, Vite, `@tanstack/react-query` v5, MUI v9, Vitest + Testing Library.

**Design doc:** `docs/superpowers/specs/2026-08-12-scroll-restoration-rewrite-design.md`

## Global Constraints

- The `pages` query parameter is removed from the URL entirely — sessionStorage is the sole source of restore depth (per-tab; a fresh tab/shared link always starts at page 1).
- A saved scroll entry is one JSON blob per key: `{ scrollTop: number; pages: number }`. Never split across two sessionStorage keys.
- `pages` read from a saved entry is clamped to `MAX_AUTO_RESTORE_PAGES` (currently `15`, defined in `frontend/src/constants.ts`) at read time, in `getSavedScrollEntry`.
- No polling/re-snap loop after the scroll jump. The jump is one `scrollTo` call in a `useLayoutEffect`.
- `backend/` is out of scope — nothing here changes backend behavior or contracts.

---

### Task 1: Rewrite `useScrollRestoration.ts` around a single atomic entry

**Files:**
- Modify: `frontend/src/hooks/useScrollRestoration.ts` (full rewrite, currently 158 lines)
- Modify: `frontend/src/hooks/useScrollRestoration.test.tsx` (full rewrite, currently 131 lines)
- Modify: `frontend/src/constants.ts:6-9` (comment only)

**Interfaces:**
- Consumes: `getScrollContainer()` from `frontend/src/utils/scrollContainer.ts` (unchanged: `() => HTMLElement | null`); `MAX_AUTO_RESTORE_PAGES` from `frontend/src/constants.ts` (unchanged: `number`, currently `15`).
- Produces: `getSavedScrollEntry(scrollKey: string): { scrollTop: number; pages: number } | null` (new export, replaces the old `getSavedPages`). `useScrollRestoration(scrollKey: string, ready: boolean, loadedPages: number): boolean` (same signature as before — `PokedexPage.tsx` in Task 5 calls both).

- [ ] **Step 1: Replace the test file with the new atomic-entry test suite**

Write `frontend/src/hooks/useScrollRestoration.test.tsx`:

```tsx
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
});
```

- [ ] **Step 2: Run the test file to confirm it fails against the old implementation**

Run: `cd frontend && npx vitest run src/hooks/useScrollRestoration.test.tsx`
Expected: FAIL — `getSavedScrollEntry` is not exported yet (the old file exports `getSavedPages` instead), so most tests error out at the import or assertion stage.

- [ ] **Step 3: Rewrite the implementation**

Write `frontend/src/hooks/useScrollRestoration.ts`:

```ts
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MAX_AUTO_RESTORE_PAGES } from "../constants";
import { getScrollContainer } from "../utils/scrollContainer";

const INDEX_KEY = "pokedex:scroll:index";
const MAX_TRACKED_KEYS = 20;

type ScrollEntry = { scrollTop: number; pages: number };

const readEntry = (scrollKey: string): ScrollEntry | null => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(scrollKey) ?? "null");
    if (
      !parsed ||
      typeof parsed.scrollTop !== "number" ||
      typeof parsed.pages !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeEntry = (scrollKey: string, entry: ScrollEntry) => {
  sessionStorage.setItem(scrollKey, JSON.stringify(entry));
};

const readIndex = (): string[] => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(INDEX_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Marks `key` as the most recently used scroll key, evicting the oldest
// entries once more than MAX_TRACKED_KEYS distinct keys have been written.
// Without this, every filter/search combination visited in a session would
// leave its own sessionStorage entry behind for the life of the tab.
const touchScrollKey = (key: string) => {
  const index = readIndex().filter((k) => k !== key);
  index.push(key);
  while (index.length > MAX_TRACKED_KEYS) {
    const evicted = index.shift();
    if (evicted) sessionStorage.removeItem(evicted);
  }
  sessionStorage.setItem(INDEX_KEY, JSON.stringify(index));
};

const isAlreadyRestored = (scrollKey: string) => {
  const entry = readEntry(scrollKey);
  return !entry || entry.scrollTop <= 0;
};

// The single read path for a saved scroll position: the pixel offset and
// how many pages were on screen when it was saved, written together so they
// can never disagree with each other (the old design tracked page count in
// a second place -- the URL -- and the two could drift). `pages` is clamped
// here, at read time, so a stale/tampered entry from a previous session
// can't force an oversized collapsed restore fetch.
export const getSavedScrollEntry = (
  scrollKey: string,
): ScrollEntry | null => {
  const entry = readEntry(scrollKey);
  if (!entry) return null;
  return {
    scrollTop: entry.scrollTop,
    pages: Math.min(
      Math.max(Math.trunc(entry.pages), 1),
      MAX_AUTO_RESTORE_PAGES,
    ),
  };
};

export const useScrollRestoration = (
  scrollKey: string,
  ready: boolean,
  loadedPages: number,
): boolean => {
  // Read by the scroll listener's debounced handler without making it a
  // dependency of the effect below (which would tear down and rebuild the
  // listener, and drop in-flight debounce timers, on every page load).
  const loadedPagesRef = useRef(loadedPages);
  useEffect(() => {
    loadedPagesRef.current = loadedPages;
  }, [loadedPages]);

  useEffect(() => {
    const main = getScrollContainer();
    if (!main) return;
    let timeout: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        writeEntry(scrollKey, {
          scrollTop: main.scrollTop,
          pages: loadedPagesRef.current,
        });
        touchScrollKey(scrollKey);
      }, 150);
    };
    main.addEventListener("scroll", handleScroll);
    return () => {
      clearTimeout(timeout);
      main.removeEventListener("scroll", handleScroll);
    };
  }, [scrollKey]);

  // Kept false until the saved scroll offset (if any) is applied, so a
  // restore never renders at the top before jumping down.
  const [trackedKey, setTrackedKey] = useState(scrollKey);
  const [scrollRestored, setScrollRestored] = useState(() =>
    isAlreadyRestored(scrollKey),
  );

  // Re-derive during render (not an effect) whenever scrollKey changes, so a
  // switch to a key with its own saved offset re-arms the restore instead of
  // staying latched `true` from a previous key. Doing this in render rather
  // than an effect means the caller's "hidden until restored" gate never
  // gets a chance to flash the new key's content at the old scroll offset.
  if (scrollKey !== trackedKey) {
    setTrackedKey(scrollKey);
    setScrollRestored(isAlreadyRestored(scrollKey));
  }

  // One jump, before paint, once the restore-target content has rendered.
  // Cards that were part of that initial render stay exempt from
  // content-visibility for the life of this mount (see PokemonGrid's
  // `restoredCount` prop) specifically so this scrollTo can't get knocked
  // off target by a later content-visibility re-estimate -- no re-snap
  // loop needed here as a result.
  useLayoutEffect(() => {
    if (scrollRestored || !ready) return;
    const entry = readEntry(scrollKey);
    getScrollContainer()?.scrollTo({ top: entry?.scrollTop ?? 0 });
    setScrollRestored(true);
  }, [scrollRestored, ready, scrollKey]);

  return scrollRestored;
};
```

- [ ] **Step 4: Update the `MAX_AUTO_RESTORE_PAGES` comment in `constants.ts`**

In `frontend/src/constants.ts`, replace lines 6-9:

```ts
// Restoring N pages on mount is a single collapsed request (`to_page`), so
// this is no longer a latency cap -- it just bounds how many cards a
// stale/huge/tampered-with `pages` value can force onto the page at once.
export const MAX_AUTO_RESTORE_PAGES = 15;
```

with:

```ts
// Restoring N pages on mount is a single collapsed request (`to_page`), so
// this isn't a latency cap -- it bounds how many cards a stale/huge/
// tampered-with saved sessionStorage entry can force onto the page at once
// (see getSavedScrollEntry in useScrollRestoration.ts).
export const MAX_AUTO_RESTORE_PAGES = 15;
```

- [ ] **Step 5: Run the test file to confirm it passes**

Run: `cd frontend && npx vitest run src/hooks/useScrollRestoration.test.tsx`
Expected: PASS — all 8 tests green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/useScrollRestoration.ts frontend/src/hooks/useScrollRestoration.test.tsx frontend/src/constants.ts
git commit -m "refactor(frontend): rewrite scroll restoration around one atomic sessionStorage entry"
```

---

### Task 2: Simplify `usePokemonList.ts` — drop the URL-feedback plumbing

**Files:**
- Modify: `frontend/src/hooks/usePokemonList.ts` (full rewrite, currently 109 lines)
- Modify: `frontend/src/hooks/usePokemonList.test.tsx` (full rewrite, currently 241 lines)

**Interfaces:**
- Consumes: `fetchPokemonPage` from `frontend/src/api/pokemon.ts` (unchanged); `getErrorMessage` from `frontend/src/api/client.ts` (unchanged).
- Produces: `usePokemonList({ filters: PokemonListFilters; restoreToPage: number }): { items, isLoading, isFetchingNextPage, isRestoring, loadedPages: number, error, hasMore, loadMore, retry }`. `onPagesChange` is removed from the args; `loadedPages` is a new field on the result, consumed directly by `PokedexPage.tsx` in Task 5 (in place of the old `onPagesChange` callback).

- [ ] **Step 1: Replace the test file**

Write `frontend/src/hooks/usePokemonList.test.tsx`:

```tsx
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/renderWithProviders";
import { usePokemonList, type PokemonListFilters } from "./usePokemonList";
import * as pokemonApi from "../api/pokemon";
import type { Pokemon, PokemonPage } from "../types";

function pokemon(number: number): Pokemon {
  return {
    number,
    name: `Mon${number}`,
    type_one: "Normal",
    type_two: "",
    total: 300,
    hit_points: 50,
    attack: 50,
    defense: 50,
    special_attack: 50,
    special_defense: 50,
    speed: 50,
    generation: 1,
    legendary: false,
  };
}

function page(pageNum: number, totalCount: number, pageSize = 2): PokemonPage {
  const start = (pageNum - 1) * pageSize;
  const items = Array.from(
    { length: Math.max(0, Math.min(pageSize, totalCount - start)) },
    (_, i) => pokemon(start + i + 1),
  );
  return {
    items,
    page: pageNum,
    page_size: pageSize,
    total_count: totalCount,
    total_pages: Math.ceil(totalCount / pageSize),
  };
}

// Mirrors the backend's `to_page` collapsing: one response spanning
// pages `pageNum..toPage`, with `page` clamped to the real last page.
function pageRange(
  pageNum: number,
  toPage: number,
  totalCount: number,
  pageSize = 2,
): PokemonPage {
  const totalPages = Math.ceil(totalCount / pageSize);
  const start = (pageNum - 1) * pageSize;
  const end = Math.min(toPage * pageSize, totalCount);
  const items = Array.from({ length: Math.max(0, end - start) }, (_, i) =>
    pokemon(start + i + 1),
  );
  return {
    items,
    page: totalPages ? Math.min(toPage, totalPages) : 1,
    page_size: pageSize,
    total_count: totalCount,
    total_pages: totalPages,
  };
}

const baseFilters: PokemonListFilters = {
  pageSize: 2,
  sortBy: "number",
  order: "asc",
  type: null,
  q: "",
};

describe("usePokemonList", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads page 1 on mount", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonPage").mockResolvedValue(page(1, 6));
    const { result } = renderHookWithProviders(() =>
      usePokemonList({ filters: baseFilters, restoreToPage: 1 }),
    );
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.map((p) => p.number)).toEqual([1, 2]);
    expect(result.current.hasMore).toBe(true);
  });

  it("loadMore appends the next page and grows loadedPages", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonPage").mockImplementation((q) =>
      Promise.resolve(page(q.page, 6)),
    );
    const { result } = renderHookWithProviders(() =>
      usePokemonList({ filters: baseFilters, restoreToPage: 1 }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.loadedPages).toBe(1);

    result.current.loadMore();
    await waitFor(() => expect(result.current.items).toHaveLength(4));
    expect(result.current.loadedPages).toBe(2);
  });

  it("stops reporting hasMore once every item is loaded", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonPage").mockImplementation((q) =>
      Promise.resolve(page(q.page, 2)),
    );
    const { result } = renderHookWithProviders(() =>
      usePokemonList({ filters: baseFilters, restoreToPage: 1 }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasMore).toBe(false);
  });

  it("collapses a multi-page restore into a single request", async () => {
    const spy = vi
      .spyOn(pokemonApi, "fetchPokemonPage")
      .mockImplementation((q) =>
        Promise.resolve(
          q.toPage ? pageRange(q.page, q.toPage, 6) : page(q.page, 6),
        ),
      );
    const { result } = renderHookWithProviders(() =>
      usePokemonList({ filters: baseFilters, restoreToPage: 3 }),
    );
    await waitFor(() => expect(result.current.items).toHaveLength(6));
    expect(result.current.loadedPages).toBe(3);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, toPage: 3 }),
    );
  });

  it("reports isRestoring while the collapsed restore fetch is in flight, then clears it", async () => {
    let resolveFetch!: (value: PokemonPage) => void;
    vi.spyOn(pokemonApi, "fetchPokemonPage").mockImplementation(
      () => new Promise((resolve) => (resolveFetch = resolve)),
    );
    const { result } = renderHookWithProviders(() =>
      usePokemonList({ filters: baseFilters, restoreToPage: 3 }),
    );
    await waitFor(() => expect(result.current.isRestoring).toBe(true));
    expect(result.current.items).toEqual([]);

    resolveFetch(pageRange(1, 3, 6));
    await waitFor(() => expect(result.current.items).toHaveLength(6));
    expect(result.current.isRestoring).toBe(false);
  });

  it("does not report isRestoring when restoreToPage is 1", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonPage").mockResolvedValue(page(1, 6));
    const { result } = renderHookWithProviders(() =>
      usePokemonList({ filters: baseFilters, restoreToPage: 1 }),
    );
    expect(result.current.isRestoring).toBe(false);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isRestoring).toBe(false);
  });

  it("surfaces an error if the restore fetch fails, and retry recovers without partial state", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonPage").mockRejectedValueOnce(
      new Error("network down"),
    );
    const { result } = renderHookWithProviders(() =>
      usePokemonList({ filters: baseFilters, restoreToPage: 3 }),
    );

    await waitFor(() => expect(result.current.error).toBe("network down"));
    expect(result.current.items).toEqual([]);
    expect(result.current.isRestoring).toBe(false);
    expect(result.current.loadedPages).toBe(0);

    vi.spyOn(pokemonApi, "fetchPokemonPage").mockImplementation((q) =>
      Promise.resolve(
        q.toPage ? pageRange(q.page, q.toPage, 6) : page(q.page, 6),
      ),
    );
    result.current.retry();
    await waitFor(() => expect(result.current.items).toHaveLength(6));
    expect(result.current.error).toBeNull();
    expect(result.current.loadedPages).toBe(3);
  });

  it("resets to page 1 when filters change", async () => {
    const spy = vi
      .spyOn(pokemonApi, "fetchPokemonPage")
      .mockImplementation((q) => Promise.resolve(page(q.page, 6)));
    const { result, rerender } = renderHookWithProviders(
      ({ filters }: { filters: PokemonListFilters }) =>
        usePokemonList({ filters, restoreToPage: 1 }),
      { initialProps: { filters: baseFilters } },
    );
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    result.current.loadMore();
    await waitFor(() => expect(result.current.items).toHaveLength(4));

    rerender({ filters: { ...baseFilters, type: "Fire" } });
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.items.map((p) => p.number)).toEqual([1, 2]);
    expect(spy).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, type: "Fire" }),
    );
  });

  it("sets an error message when the fetch rejects, and retry recovers", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonPage")
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(page(1, 2));
    const { result } = renderHookWithProviders(() =>
      usePokemonList({ filters: baseFilters, restoreToPage: 1 }),
    );
    await waitFor(() => expect(result.current.error).toBe("network down"));
    expect(result.current.items).toEqual([]);

    result.current.retry();
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.items).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the test file to confirm it fails**

Run: `cd frontend && npx vitest run src/hooks/usePokemonList.test.tsx`
Expected: FAIL — `usePokemonList` still requires `onPagesChange` and has no `loadedPages` field on its result, so the new assertions and the (now-missing) required prop mismatch cause failures/type errors.

- [ ] **Step 3: Rewrite the implementation**

Write `frontend/src/hooks/usePokemonList.ts`:

```ts
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchPokemonPage } from "../api/pokemon";
import { getErrorMessage } from "../api/client";
import type { Pokemon, SortField, SortOrder } from "../types";

export type PokemonListFilters = {
  pageSize: number;
  sortBy: SortField;
  order: SortOrder;
  type: string | null;
  q: string;
};

export type UsePokemonListArgs = {
  filters: PokemonListFilters;
  restoreToPage: number;
};

export type UsePokemonListResult = {
  items: Pokemon[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  isRestoring: boolean;
  loadedPages: number;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  retry: () => void;
};

export const usePokemonList = ({
  filters,
  restoreToPage,
}: UsePokemonListArgs): UsePokemonListResult => {
  const filtersKey = JSON.stringify(filters);
  // Frozen per query (reset only when `filtersKey` changes) so it reflects
  // whatever was true when this query started rather than whatever
  // `restoreToPage` happens to evaluate to on some later, unrelated
  // re-render. Only consulted by the very first (pageParam 1) fetch of a
  // query, which asks the backend for pages 1..restoreToPage in a single
  // request instead of walking fetchNextPage restoreToPage times.
  const targetRef = useRef(restoreToPage);

  useEffect(() => {
    targetRef.current = restoreToPage;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  const query = useInfiniteQuery({
    queryKey: ["pokemon", filters],
    queryFn: ({ pageParam }) =>
      fetchPokemonPage({
        ...filters,
        page: pageParam,
        toPage:
          pageParam === 1 && targetRef.current > 1
            ? targetRef.current
            : undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,
  });

  // The last page's own `page` field, not the pages-array length: a
  // collapsed restore fetch is one array entry but represents several pages.
  const loadedPages = query.data?.pages.at(-1)?.page ?? 0;
  const { isFetchingNextPage, fetchNextPage, refetch } = query;

  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  const loadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    items,
    isLoading: query.isPending,
    isFetchingNextPage,
    // isPending only holds during a query's very first fetch, which is
    // exactly the (now single) restore request when targeting page > 1.
    isRestoring: query.isPending && targetRef.current > 1,
    loadedPages,
    error: query.isError ? getErrorMessage(query.error) : null,
    hasMore: query.hasNextPage ?? false,
    loadMore,
    retry,
  };
};
```

- [ ] **Step 4: Run the test file to confirm it passes**

Run: `cd frontend && npx vitest run src/hooks/usePokemonList.test.tsx`
Expected: PASS — all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/usePokemonList.ts frontend/src/hooks/usePokemonList.test.tsx
git commit -m "refactor(frontend): drop onPagesChange/URL-feedback plumbing from usePokemonList"
```

---

### Task 3: Drop `pages` from `useUrlState.ts`

**Files:**
- Modify: `frontend/src/hooks/useUrlState.ts` (full rewrite, currently 108 lines)
- Modify: `frontend/src/hooks/useUrlState.test.tsx` (full rewrite, currently 127 lines)

**Interfaces:**
- Consumes: `ALLOWED_PAGE_SIZES`, `DEFAULT_PAGE_SIZE`, `DEFAULT_SORT_FIELD`, `SORT_FIELDS` from `frontend/src/constants.ts` (unchanged). No longer imports `MAX_AUTO_RESTORE_PAGES`.
- Produces: `FilterState = { pageSize, sortBy, order, type, q }` (drops `pages`). `useUrlState(): { state: FilterState; setFilters: (partial: Partial<FilterState>) => void }` — `setPages` is removed from the return value. `PokedexPage.tsx` in Task 5 must stop destructuring `setPages`.

- [ ] **Step 1: Replace the test file**

Write `frontend/src/hooks/useUrlState.test.tsx`:

```tsx
import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderHookWithProviders } from "../test/renderWithProviders";
import { filterStateToParams, parseFilterState, useUrlState } from "./useUrlState";

describe("parseFilterState", () => {
  it("fills in defaults for an empty query string", () => {
    expect(parseFilterState(new URLSearchParams(""))).toEqual({
      pageSize: 20,
      sortBy: "number",
      order: "asc",
      type: null,
      q: "",
    });
  });

  it("parses valid values", () => {
    const params = new URLSearchParams(
      "page_size=10&sort_by=attack&order=desc&type=Fire&q=char",
    );
    expect(parseFilterState(params)).toEqual({
      pageSize: 10,
      sortBy: "attack",
      order: "desc",
      type: "Fire",
      q: "char",
    });
  });

  it("sanitizes an invalid page_size, sort_by, and order back to defaults", () => {
    const params = new URLSearchParams("page_size=999&sort_by=nonsense&order=sideways");
    expect(parseFilterState(params)).toEqual({
      pageSize: 20,
      sortBy: "number",
      order: "asc",
      type: null,
      q: "",
    });
  });
});

describe("filterStateToParams", () => {
  it("round-trips through parseFilterState", () => {
    const state = {
      pageSize: 5,
      sortBy: "speed" as const,
      order: "desc" as const,
      type: "Water",
      q: "saur",
    };
    expect(parseFilterState(filterStateToParams(state))).toEqual(state);
  });

  it("omits type and q when empty", () => {
    const params = filterStateToParams({
      pageSize: 20,
      sortBy: "number",
      order: "asc",
      type: null,
      q: "",
    });
    expect(params.has("type")).toBe(false);
    expect(params.has("q")).toBe(false);
  });
});

describe("useUrlState", () => {
  it("corrects an invalid URL param without user action", () => {
    const { result } = renderHookWithProviders(() => useUrlState(), {
      initialEntries: ["/?sort_by=bogus"],
    });
    expect(result.current.state.sortBy).toBe("number");
  });

  it("setFilters updates the given fields without touching the others", () => {
    const { result } = renderHookWithProviders(() => useUrlState());
    act(() => {
      result.current.setFilters({ q: "char" });
    });
    act(() => {
      result.current.setFilters({ type: "Fire" });
    });
    expect(result.current.state.type).toBe("Fire");
    expect(result.current.state.q).toBe("char");
  });

  it("doesn't drop a setFilters call when two calls land in the same tick", () => {
    // Regression: two setFilters callers (e.g. a debounced search box and a
    // type dropdown) can both fire before either has re-rendered. Both used
    // to build their patch from the same stale `state` snapshot, so
    // whichever call reached setSearchParams second clobbered the other's
    // update instead of merging with it.
    const { result } = renderHookWithProviders(() => useUrlState());
    act(() => {
      result.current.setFilters({ q: "pi" });
      result.current.setFilters({ type: "Fire" });
    });
    expect(result.current.state.q).toBe("pi");
    expect(result.current.state.type).toBe("Fire");
  });
});
```

- [ ] **Step 2: Run the test file to confirm it fails**

Run: `cd frontend && npx vitest run src/hooks/useUrlState.test.tsx`
Expected: FAIL — the current implementation still includes `pages` in every parsed/serialized state, so the `toEqual` assertions (which no longer expect a `pages` field) fail.

- [ ] **Step 3: Rewrite the implementation**

Write `frontend/src/hooks/useUrlState.ts`:

```ts
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import type { SortField, SortOrder } from "../types";
import {
  ALLOWED_PAGE_SIZES,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT_FIELD,
  SORT_FIELDS,
} from "../constants";

export type FilterState = {
  pageSize: number;
  sortBy: SortField;
  order: SortOrder;
  type: string | null;
  q: string;
};

const SORT_FIELD_SET = new Set(SORT_FIELDS.map((f) => f.value));

const parsePageSize = (raw: string | null): number => {
  const n = Number(raw);
  return (ALLOWED_PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
};

const parseSortBy = (raw: string | null): SortField =>
  raw && SORT_FIELD_SET.has(raw as SortField) ? (raw as SortField) : DEFAULT_SORT_FIELD;

const parseOrder = (raw: string | null): SortOrder => (raw === "desc" ? "desc" : "asc");

export const parseFilterState = (params: URLSearchParams): FilterState => ({
  pageSize: parsePageSize(params.get("page_size")),
  sortBy: parseSortBy(params.get("sort_by")),
  order: parseOrder(params.get("order")),
  type: params.get("type") || null,
  q: params.get("q") || "",
});

export const filterStateToParams = (state: FilterState): URLSearchParams => {
  const params = new URLSearchParams();
  params.set("page_size", String(state.pageSize));
  params.set("sort_by", state.sortBy);
  params.set("order", state.order);
  if (state.type) params.set("type", state.type);
  if (state.q) params.set("q", state.q);
  return params;
};

export const useUrlState = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(() => parseFilterState(searchParams), [searchParams]);

  // Mirrors the latest FilterState, updated synchronously inside
  // setFilters (not just via the effect below). react-router's
  // setSearchParams closes over the params from the last *render*, so two
  // calls issued back-to-back before a re-render would otherwise each
  // build on the same stale snapshot and the second call's navigate()
  // would silently overwrite the first's change.
  const latestRef = useRef(state);
  useEffect(() => {
    latestRef.current = state;
  }, [state]);

  useEffect(() => {
    const canonical = filterStateToParams(state).toString();
    if (canonical !== searchParams.toString()) {
      setSearchParams(filterStateToParams(state), { replace: true });
    }
  }, [state, searchParams, setSearchParams]);

  const setFilters = useCallback(
    (partial: Partial<FilterState>) => {
      const next: FilterState = { ...latestRef.current, ...partial };
      latestRef.current = next;
      setSearchParams(filterStateToParams(next), { replace: false });
    },
    [setSearchParams],
  );

  return { state, setFilters };
};
```

- [ ] **Step 4: Run the test file to confirm it passes**

Run: `cd frontend && npx vitest run src/hooks/useUrlState.test.tsx`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useUrlState.ts frontend/src/hooks/useUrlState.test.tsx
git commit -m "refactor(frontend): drop pages from the URL, sessionStorage is now the sole restore-depth source"
```

---

### Task 4: Switch `PokemonGrid.tsx` to a positional content-visibility exemption

**Files:**
- Modify: `frontend/src/components/pokedex/PokemonGrid.tsx:21-149`

**Interfaces:**
- Consumes: nothing new.
- Produces: `PokemonGrid` prop `restoredCount?: number` (default `0`), replacing `restoringScroll?: boolean`. `PokedexPage.tsx` in Task 5 passes `restoredCount` instead of `restoringScroll`.

No test changes: `frontend/src/components/pokedex/PokemonGrid.test.tsx` never referenced `restoringScroll` (that mechanism had no direct coverage before this rewrite either), so none of its existing cases touch this prop and all should keep passing unmodified once the default (`0`) preserves today's behavior for callers that don't pass it. The positional-exemption behavior itself is covered by the manual browser check in Task 6 (verifying jsdom's CSS engine doesn't reliably resolve `content-visibility` from emotion-injected stylesheets makes a unit assertion on the computed style low-value/flaky here).

- [ ] **Step 1: Edit the props type and destructuring**

In `frontend/src/components/pokedex/PokemonGrid.tsx`, replace:

```tsx
export const PokemonGrid = ({
  items,
  capturedNames,
  capturingName,
  isLoading,
  isFetchingNextPage,
  error,
  hasMore,
  onLoadMore,
  onRetry,
  onToggleCapture,
  pageSize,
  restoringScroll,
}: {
  items: Pokemon[];
  capturedNames: Set<string>;
  capturingName?: string;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onToggleCapture: (pokemon: Pokemon, captured: boolean) => void;
  pageSize: number;
  restoringScroll?: boolean;
}) => {
```

with:

```tsx
export const PokemonGrid = ({
  items,
  capturedNames,
  capturingName,
  isLoading,
  isFetchingNextPage,
  error,
  hasMore,
  onLoadMore,
  onRetry,
  onToggleCapture,
  pageSize,
  restoredCount = 0,
}: {
  items: Pokemon[];
  capturedNames: Set<string>;
  capturingName?: string;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onToggleCapture: (pokemon: Pokemon, captured: boolean) => void;
  pageSize: number;
  restoredCount?: number;
}) => {
```

- [ ] **Step 2: Add the item index and switch the content-visibility condition**

Replace:

```tsx
        {items.map((pokemon) => (
          <Grid
            key={pokemon.name}
            size={{ xs: 12, sm: 6, md: 4, lg: 3 }}
            // Skipped while a saved scroll offset is being restored. A restore fetch
            // inserts every card for the target pages in one commit, and content-visibility
            // only settles which off-screen cards get skip-sized down to containIntrinsicSize
            // on a later paint -- with the old per-page walk that settling had already
            // happened (each page got its own paint, seconds apart, before the final jump).
            // Landing scrollTo() in that same pre-settle window means whichever cards land
            // above the target get (de)promoted right as/after the jump, nudging the
            // container's scrollHeight by however far their real height was from the
            // estimate. Rendering at full size for that one restore pass costs an extra
            // layout, but guarantees the jump lands where it was saved.
            sx={
              restoringScroll
                ? undefined
                : {
                    contentVisibility: "auto",
                    containIntrinsicSize: "420px",
                  }
            }
          >
```

with:

```tsx
        {items.map((pokemon, index) => (
          <Grid
            key={pokemon.name}
            size={{ xs: 12, sm: 6, md: 4, lg: 3 }}
            // The first `restoredCount` cards were part of the initial
            // collapsed restore fetch (see PokedexPage's `restoredCount`
            // prop, derived from useScrollRestoration's saved page count).
            // They stay exempt from content-visibility for the life of this
            // mount -- not just until the scroll position is restored --
            // because toggling content-visibility back on right after the
            // jump lets off-screen cards *above* the restored viewport
            // collapse to their containIntrinsicSize estimate, which can
            // shift everything below them (including the viewport we just
            // landed on) by however far that estimate is from their real
            // height. Paying full layout cost once for a bounded batch
            // (capped by MAX_AUTO_RESTORE_PAGES) avoids ever fighting that
            // shift. Cards loaded afterward via ordinary infinite scroll
            // get the normal content-visibility treatment.
            sx={
              index < restoredCount
                ? undefined
                : {
                    contentVisibility: "auto",
                    containIntrinsicSize: "420px",
                  }
            }
          >
```

- [ ] **Step 3: Run the existing test file to confirm nothing broke**

Run: `cd frontend && npx vitest run src/components/pokedex/PokemonGrid.test.tsx`
Expected: PASS — all existing cases green (none reference `restoringScroll`/`restoredCount`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/pokedex/PokemonGrid.tsx
git commit -m "refactor(frontend): make the restore content-visibility exemption positional, not temporal"
```

---

### Task 5: Rewire `PokedexPage.tsx` and run full verification

**Files:**
- Modify: `frontend/src/pages/PokedexPage.tsx:1-199`

**Interfaces:**
- Consumes: `getSavedScrollEntry`, `useScrollRestoration` from Task 1; `usePokemonList` from Task 2 (now returns `loadedPages`, no longer accepts `onPagesChange`); `useUrlState` from Task 3 (no longer returns `setPages`); `PokemonGrid`'s `restoredCount` prop from Task 4.
- Produces: no new exports — this is the integration point where the whole app wires back together.

- [ ] **Step 1: Rewrite the file**

Write `frontend/src/pages/PokedexPage.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Snackbar from "@mui/material/Snackbar";
import { FilterBar } from "../components/pokedex/FilterBar";
import { LoginPrompt } from "../components/pokedex/LoginPrompt";
import { PokemonCardSkeleton } from "../components/pokedex/PokemonCardSkeleton";
import { PokemonGrid } from "../components/pokedex/PokemonGrid";
import { useCaptureMutation } from "../hooks/useCaptureMutation";
import { useIdentity } from "../hooks/useIdentity";
import { useLoginMutation } from "../hooks/useLoginMutation";
import { usePokemonList } from "../hooks/usePokemonList";
import {
  getSavedScrollEntry,
  useScrollRestoration,
} from "../hooks/useScrollRestoration";
import { useTypes } from "../hooks/useTypes";
import { useUrlState } from "../hooks/useUrlState";
import type { Pokemon } from "../types";

export const PokedexPage = () => {
  const { state: filters, setFilters } = useUrlState();
  const types = useTypes();
  const identity = useIdentity();
  const captureMutation = useCaptureMutation();
  const loginMutation = useLoginMutation();

  const scrollKey = useMemo(
    () =>
      `pokedex:scroll:${filters.pageSize}:${filters.sortBy}:${filters.order}:${filters.type ?? ""}:${filters.q}`,
    [filters.pageSize, filters.sortBy, filters.order, filters.type, filters.q],
  );

  // sessionStorage is the only source of restore depth now -- a fresh tab
  // with nothing saved for this key just starts at page 1.
  const restoreToPage = useMemo(
    () => getSavedScrollEntry(scrollKey)?.pages ?? 1,
    [scrollKey],
  );

  const list = usePokemonList({
    filters: {
      pageSize: filters.pageSize,
      sortBy: filters.sortBy,
      order: filters.order,
      type: filters.type,
      q: filters.q,
    },
    restoreToPage,
  });

  useEffect(() => {
    // Unlike page_size/sort_by/order, `type` can't be sanitized in
    // useUrlState alone — the set of valid values only exists once /types
    // has loaded. A stale bookmark or hand-edited URL naming an unknown type
    // would otherwise 400 forever: it's not a network flake, so the existing
    // "Retry" button would just resend the same bad request.
    if (!filters.type || types.length === 0) return;
    const isKnownType = types.some(
      (t) => t.toLowerCase() === filters.type!.toLowerCase(),
    );
    if (!isKnownType) setFilters({ type: null });
  }, [filters.type, types, setFilters]);

  const scrollRestored = useScrollRestoration(
    scrollKey,
    // A failed fetch also clears isLoading/isRestoring, but there's nothing
    // to scroll to yet -- gate on `!error` too so a failed restore doesn't
    // consume the one-shot restore against an empty error view, leaving a
    // later successful retry with no saved position left to apply.
    !list.isLoading && !list.isRestoring && !list.error,
    list.loadedPages,
  );

  // How many cards from the initial restore fetch should stay exempt from
  // content-visibility -- see the comment on PokemonGrid's `restoredCount`
  // prop. 0 when there was nothing to restore, so an ordinary load (no
  // saved position) is unaffected.
  const restoredCount =
    restoreToPage > 1 ? restoreToPage * filters.pageSize : 0;

  const [pendingCapture, setPendingCapture] = useState<Pokemon | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  useEffect(() => {
    if (captureMutation.isError) {
      setSnackbarMessage("Couldn't update capture. Try again.");
    }
  }, [captureMutation.isError]);

  const capturedNames = useMemo(
    () => new Set(identity.captured),
    [identity.captured],
  );

  const capturingName = captureMutation.isPending
    ? captureMutation.variables?.name
    : undefined;

  const captureMutate = captureMutation.mutate;
  const handleToggleCapture = useCallback(
    (pokemon: Pokemon, captured: boolean) => {
      if (!identity.username) {
        setPendingCapture(pokemon);
        return;
      }
      captureMutate({ name: pokemon.name, captured });
    },
    [identity.username, captureMutate],
  );

  const handleLoginSubmit = async (username: string) => {
    await loginMutation.login(username);
    setPendingCapture((current) => {
      if (current) {
        // pendingCapture only ever arises from a capture click on an
        // anonymous (therefore always-uncaptured) card.
        captureMutation.mutate({ name: current.name, captured: false });
      }
      return null;
    });
  };

  return (
    <>
      <Container
        maxWidth="lg"
        sx={{
          py: 3,
          minHeight: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <FilterBar types={types} filters={filters} onChange={setFilters} />
        {list.isRestoring && !scrollRestored ? (
          <Grid container spacing={2}>
            {Array.from({ length: filters.pageSize }, (_, i) => (
              <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <PokemonCardSkeleton />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              // An error has no saved position to jump to, so it's exempt
              // from the "stay hidden until scroll is restored" gate --
              // otherwise the error message (and its Retry button) would be
              // invisible for as long as `ready` withholds the restore.
              visibility: scrollRestored || list.error ? "visible" : "hidden",
            }}
          >
            <PokemonGrid
              items={list.items}
              capturedNames={capturedNames}
              capturingName={capturingName}
              isLoading={list.isLoading}
              isFetchingNextPage={list.isFetchingNextPage}
              error={list.error}
              hasMore={list.hasMore}
              onLoadMore={list.loadMore}
              onRetry={list.retry}
              onToggleCapture={handleToggleCapture}
              pageSize={filters.pageSize}
              restoredCount={restoredCount}
            />
          </Box>
        )}
      </Container>
      <LoginPrompt
        open={pendingCapture !== null}
        onClose={() => setPendingCapture(null)}
        onSubmit={handleLoginSubmit}
        error={loginMutation.error}
      />
      <Snackbar
        open={snackbarMessage !== null}
        autoHideDuration={4000}
        onClose={() => setSnackbarMessage(null)}
      >
        <Alert severity="error" onClose={() => setSnackbarMessage(null)}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
};
```

- [ ] **Step 2: Run the full frontend test suite**

Run: `cd frontend && npm run test`
Expected: PASS — every test file in `frontend/src` green, including the four rewritten in Tasks 1-3 and the untouched `PokemonGrid.test.tsx` from Task 4.

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc -b`
Expected: no errors. This is the step that will catch any leftover reference to `restoringScroll`, `setPages`, `onPagesChange`, `getSavedPages`, or `filters.pages` that Steps 1-4 across all tasks missed.

- [ ] **Step 4: Lint**

Run: `cd frontend && npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/PokedexPage.tsx
git commit -m "refactor(frontend): rewire PokedexPage for the simplified scroll restoration"
```

---

### Task 6: Manual browser verification

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Start both dev servers**

Use the `pokedex-backend` and `pokedex-frontend` launch configs (or, if already running, reuse them) and open `http://localhost:5173` in the browser preview.

- [ ] **Step 2: Verify exact-pixel restore on the default view**

In the browser: scroll down to a position that is clearly *not* aligned to a page boundary (e.g. partway through the 2nd or 3rd loaded page, not right at the top of a newly-loaded batch). Note the exact pixel via devtools (`document.querySelector('main').scrollTop`). Refresh the page. Confirm `document.querySelector('main').scrollTop` after the page settles matches the noted value (within a few px is fine — MUI transitions/rounding can introduce sub-pixel drift, but it must not snap to a page boundary).

- [ ] **Step 3: Verify per-filter isolation**

Apply a type filter (e.g. "Fire"), scroll to a distinct position, refresh, confirm it restores correctly for that filtered view. Switch back to "All types" (no filter) and confirm the original unfiltered scroll position from Step 2 is still remembered and restores correctly — i.e. the two scroll keys don't clobber each other.

- [ ] **Step 4: Verify the empty/fresh-key case**

Change the sort order (a filter combination never scrolled before). Confirm the page loads at the top with no restore delay or visual jump (this exercises `isAlreadyRestored` returning `true` immediately for a key with nothing saved).

- [ ] **Step 5: Report results**

Summarize what was observed at each step (exact scrollTop before/after refresh for at least two filter combinations) back to the user as confirmation the rewrite works end-to-end, not just that the unit suite passes.

---

## Self-Review Notes

- **Spec coverage:** every design-doc item has a task — atomic sessionStorage entry (Task 1), dropped URL pages param (Tasks 2 & 3), positional content-visibility fix (Task 4), integration + manual verification (Tasks 5 & 6).
- **Placeholder scan:** no TBD/TODO markers; every step has literal code or an exact command.
- **Type consistency:** `getSavedScrollEntry` (Task 1) → consumed by `PokedexPage.tsx` (Task 5) with matching `{ scrollTop, pages } | null` shape. `usePokemonList`'s `loadedPages` (Task 2) → consumed by `useScrollRestoration` call in `PokedexPage.tsx` (Task 5) as its third argument, matching `useScrollRestoration`'s `loadedPages: number` parameter (Task 1). `PokemonGrid`'s `restoredCount` (Task 4) → passed from `PokedexPage.tsx` (Task 5) as `restoreToPage > 1 ? restoreToPage * filters.pageSize : 0`, a plain `number`, matching.
