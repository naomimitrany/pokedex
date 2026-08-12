import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/renderWithProviders";
import { useCaptureMutation } from "./useCaptureMutation";
import { useCapturedPokemon } from "./useCapturedPokemon";
import { useIdentity } from "./useIdentity";
import * as accountsApi from "../api/accounts";
import type { Pokemon } from "../types";

const PIKACHU: Pokemon = {
  number: 25,
  name: "Pikachu",
  type_one: "Electric",
  type_two: "",
  total: 320,
  hit_points: 35,
  attack: 55,
  defense: 40,
  special_attack: 50,
  special_defense: 50,
  speed: 90,
  generation: 1,
  legendary: false,
};

describe("useCaptureMutation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("optimistically adds the name and the full Pokémon, then keeps both after the server confirms", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: "ash", captured: [] });
    vi.spyOn(accountsApi, "fetchCaptures").mockResolvedValue([]);
    vi.spyOn(accountsApi, "capturePokemon").mockResolvedValue({ name: "Pikachu", captured: true });

    const { result } = renderHookWithProviders(() => ({
      identity: useIdentity(),
      captured: useCapturedPokemon(),
      captureMutation: useCaptureMutation(),
    }));
    await waitFor(() => expect(result.current.identity.username).toBe("ash"));
    await waitFor(() => expect(result.current.captured.data).toEqual([]));

    act(() => {
      result.current.captureMutation.mutate({ pokemon: PIKACHU, captured: false });
    });

    await waitFor(() => expect(result.current.identity.captured).toContain("Pikachu"));
    expect(result.current.captured.data).toEqual([PIKACHU]);
    await waitFor(() => expect(result.current.captureMutation.isSuccess).toBe(true));
    expect(result.current.identity.captured).toContain("Pikachu");
    expect(result.current.captured.data).toEqual([PIKACHU]);
  });

  it("rolls back both the name and the full Pokémon when the request fails", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: "ash", captured: [] });
    vi.spyOn(accountsApi, "fetchCaptures").mockResolvedValue([]);
    vi.spyOn(accountsApi, "capturePokemon").mockRejectedValue(new Error("network error"));

    const { result } = renderHookWithProviders(() => ({
      identity: useIdentity(),
      captured: useCapturedPokemon(),
      captureMutation: useCaptureMutation(),
    }));
    await waitFor(() => expect(result.current.identity.username).toBe("ash"));
    await waitFor(() => expect(result.current.captured.data).toEqual([]));

    act(() => {
      result.current.captureMutation.mutate({ pokemon: PIKACHU, captured: false });
    });

    await waitFor(() => expect(result.current.captureMutation.isError).toBe(true));
    expect(result.current.identity.captured).not.toContain("Pikachu");
    expect(result.current.captured.data).toEqual([]);
  });

  it("removes a Pokémon from the captured list immediately on release", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: "ash", captured: ["Pikachu"] });
    vi.spyOn(accountsApi, "fetchCaptures").mockResolvedValue([PIKACHU]);
    vi.spyOn(accountsApi, "releasePokemon").mockResolvedValue({ name: "Pikachu", captured: false });

    const { result } = renderHookWithProviders(() => ({
      captured: useCapturedPokemon(),
      captureMutation: useCaptureMutation(),
    }));
    await waitFor(() => expect(result.current.captured.data).toEqual([PIKACHU]));

    act(() => {
      result.current.captureMutation.mutate({ pokemon: PIKACHU, captured: true });
    });

    await waitFor(() => expect(result.current.captured.data).toEqual([]));
  });
});
