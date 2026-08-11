import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/renderWithProviders";
import { useTypes } from "./useTypes";
import * as pokemonApi from "../api/pokemon";

describe("useTypes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the type list on mount", async () => {
    vi.spyOn(pokemonApi, "fetchTypes").mockResolvedValue(["Fire", "Water"]);
    const { result } = renderHookWithProviders(() => useTypes());
    expect(result.current).toEqual([]);
    await waitFor(() => expect(result.current).toEqual(["Fire", "Water"]));
  });

  it("falls back to an empty list while the query is failing", async () => {
    vi.spyOn(pokemonApi, "fetchTypes").mockRejectedValue(new Error("down"));
    const { result } = renderHookWithProviders(() => useTypes());
    await waitFor(() => expect(pokemonApi.fetchTypes).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });
});
