import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/renderWithProviders";
import { useCapturedPokemon } from "./useCapturedPokemon";
import * as accountsApi from "../api/accounts";
import type { Pokemon } from "../types";

function pokemon(number: number, name: string): Pokemon {
  return {
    number,
    name,
    type_one: "Fire",
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

describe("useCapturedPokemon", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not fetch when logged out", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: null, captured: [] });
    const spy = vi.spyOn(accountsApi, "fetchCaptures").mockResolvedValue([]);

    renderHookWithProviders(() => useCapturedPokemon());
    await waitFor(() => expect(accountsApi.fetchMe).toHaveBeenCalled());

    expect(spy).not.toHaveBeenCalled();
  });

  it("fetches and returns captured Pokémon when logged in", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: "ash", captured: ["Charmander"] });
    vi.spyOn(accountsApi, "fetchCaptures").mockResolvedValue([pokemon(4, "Charmander")]);

    const { result } = renderHookWithProviders(() => useCapturedPokemon());

    await waitFor(() => expect(result.current.data).toEqual([pokemon(4, "Charmander")]));
  });

  it("surfaces a readable error message on failure", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: "ash", captured: [] });
    vi.spyOn(accountsApi, "fetchCaptures").mockRejectedValue(new Error("network error"));

    const { result } = renderHookWithProviders(() => useCapturedPokemon());

    await waitFor(() => expect(result.current.error).toBe("network error"));
  });
});
