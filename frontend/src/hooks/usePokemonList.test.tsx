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
    captured: false,
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
      usePokemonList({ filters: baseFilters, restoreToPage: 1, onPagesChange: vi.fn() }),
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
      usePokemonList({ filters: baseFilters, restoreToPage: 1, onPagesChange: vi.fn() }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasMore).toBe(false);
  });

  it("restores multiple pages on mount when restoreToPage > 1", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonPage").mockImplementation((q) =>
      Promise.resolve(page(q.page, 6)),
    );
    const onPagesChange = vi.fn();
    const { result } = renderHookWithProviders(() =>
      usePokemonList({ filters: baseFilters, restoreToPage: 2, onPagesChange }),
    );
    await waitFor(() => expect(result.current.items).toHaveLength(4));
    expect(onPagesChange).toHaveBeenCalledWith(2);
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
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, type: "Fire" }));
  });

  it("sets an error message when the fetch rejects, and retry recovers", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonPage")
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(page(1, 2));
    const { result } = renderHookWithProviders(() =>
      usePokemonList({ filters: baseFilters, restoreToPage: 1, onPagesChange: vi.fn() }),
    );
    await waitFor(() => expect(result.current.error).toBe("network down"));
    expect(result.current.items).toEqual([]);

    result.current.retry();
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.items).toHaveLength(2);
  });
});
