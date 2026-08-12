import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/renderWithProviders";
import { usePokemonDetail } from "./usePokemonDetail";
import * as pokemonApi from "../api/pokemon";
import type { Pokemon } from "../types";

const bulbasaur: Pokemon = {
  number: 1,
  name: "Bulbasaur",
  type_one: "Grass",
  type_two: "Poison",
  total: 318,
  hit_points: 45,
  attack: 49,
  defense: 49,
  special_attack: 65,
  special_defense: 65,
  speed: 45,
  generation: 1,
  legendary: false,
};

describe("usePokemonDetail", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the router-state pokemon immediately, and still revalidates in the background", async () => {
    const fetchSpy = vi
      .spyOn(pokemonApi, "fetchPokemonDetail")
      .mockResolvedValue(bulbasaur);

    const { result } = renderHookWithProviders(
      () => usePokemonDetail("Bulbasaur"),
      {
        initialEntries: [
          { pathname: "/pokemon/Bulbasaur", state: { pokemon: bulbasaur } },
        ],
      },
    );

    expect(result.current.pokemon).toEqual(bulbasaur);
    expect(result.current.isLoading).toBe(false);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith("Bulbasaur"));
  });

  it("fetches from the API when there's no router state", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonDetail").mockResolvedValue(bulbasaur);

    const { result } = renderHookWithProviders(
      () => usePokemonDetail("Bulbasaur"),
      { initialEntries: ["/pokemon/Bulbasaur"] },
    );

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.pokemon).toEqual(bulbasaur));
  });

  it("ignores router state for a different pokemon than the URL asks for", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonDetail").mockResolvedValue(bulbasaur);

    const { result } = renderHookWithProviders(
      () => usePokemonDetail("Bulbasaur"),
      {
        initialEntries: [
          {
            pathname: "/pokemon/Bulbasaur",
            state: { pokemon: { ...bulbasaur, name: "Ivysaur" } },
          },
        ],
      },
    );

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.pokemon).toEqual(bulbasaur));
  });

  it("flags a 404 as not found rather than a generic error", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonDetail").mockRejectedValue(
      Object.assign(new Error("no Pokémon named 'Missingno'"), {
        isAxiosError: true,
        response: {
          status: 404,
          data: { error: "no Pokémon named 'Missingno'" },
        },
      }),
    );

    const { result } = renderHookWithProviders(
      () => usePokemonDetail("Missingno"),
      { initialEntries: ["/pokemon/Missingno"] },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.notFound).toBe(true);
  });
});
