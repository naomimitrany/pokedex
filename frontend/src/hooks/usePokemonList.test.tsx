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
      usePokemonList({
        filters: baseFilters,
        restoreToPage: 1,
        onPagesChange: vi.fn(),
      }),
    );
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.map((p) => p.number)).toEqual([1, 2]);
    expect(result.current.hasMore).toBe(true);
  });

  it("loadMore appends the next page and reports the new page count", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonPage").mockImplementation((q) =>
      Promise.resolve(page(q.page, 6)),
    );
    const onPagesChange = vi.fn();
    const { result } = renderHookWithProviders(() =>
      usePokemonList({ filters: baseFilters, restoreToPage: 1, onPagesChange }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(onPagesChange).toHaveBeenCalledWith(1));

    result.current.loadMore();
    await waitFor(() => expect(result.current.items).toHaveLength(4));
    expect(onPagesChange).toHaveBeenCalledWith(2);
  });

  it("stops reporting hasMore once every item is loaded", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonPage").mockImplementation((q) =>
      Promise.resolve(page(q.page, 2)),
    );
    const { result } = renderHookWithProviders(() =>
      usePokemonList({
        filters: baseFilters,
        restoreToPage: 1,
        onPagesChange: vi.fn(),
      }),
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
    const onPagesChange = vi.fn();
    const { result } = renderHookWithProviders(() =>
      usePokemonList({ filters: baseFilters, restoreToPage: 3, onPagesChange }),
    );
    await waitFor(() => expect(result.current.items).toHaveLength(6));
    expect(onPagesChange).toHaveBeenCalledWith(3);
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
      usePokemonList({
        filters: baseFilters,
        restoreToPage: 3,
        onPagesChange: vi.fn(),
      }),
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
      usePokemonList({
        filters: baseFilters,
        restoreToPage: 1,
        onPagesChange: vi.fn(),
      }),
    );
    expect(result.current.isRestoring).toBe(false);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isRestoring).toBe(false);
  });

  it("surfaces an error if the restore fetch fails, and retry recovers without partial state", async () => {
    const onPagesChange = vi.fn();
    vi.spyOn(pokemonApi, "fetchPokemonPage").mockRejectedValueOnce(
      new Error("network down"),
    );
    const { result } = renderHookWithProviders(() =>
      usePokemonList({ filters: baseFilters, restoreToPage: 3, onPagesChange }),
    );

    await waitFor(() => expect(result.current.error).toBe("network down"));
    expect(result.current.items).toEqual([]);
    expect(result.current.isRestoring).toBe(false);
    expect(onPagesChange).not.toHaveBeenCalled();

    vi.spyOn(pokemonApi, "fetchPokemonPage").mockImplementation((q) =>
      Promise.resolve(
        q.toPage ? pageRange(q.page, q.toPage, 6) : page(q.page, 6),
      ),
    );
    result.current.retry();
    await waitFor(() => expect(result.current.items).toHaveLength(6));
    expect(result.current.error).toBeNull();
    expect(onPagesChange).toHaveBeenCalledWith(3);
  });

  it("resets to page 1 when filters change", async () => {
    const spy = vi
      .spyOn(pokemonApi, "fetchPokemonPage")
      .mockImplementation((q) => Promise.resolve(page(q.page, 6)));
    const { result, rerender } = renderHookWithProviders(
      ({ filters }: { filters: PokemonListFilters }) =>
        usePokemonList({ filters, restoreToPage: 1, onPagesChange: vi.fn() }),
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
      usePokemonList({
        filters: baseFilters,
        restoreToPage: 1,
        onPagesChange: vi.fn(),
      }),
    );
    await waitFor(() => expect(result.current.error).toBe("network down"));
    expect(result.current.items).toEqual([]);

    result.current.retry();
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.items).toHaveLength(2);
  });
});
