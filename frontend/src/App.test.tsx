import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { renderWithProviders } from "./test/renderWithProviders";
import * as accountsApi from "./api/accounts";
import * as pokemonApi from "./api/pokemon";
import type { Pokemon, PokemonPage } from "./types";

function pokemon(number: number, overrides: Partial<Pokemon> = {}): Pokemon {
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
    ...overrides,
  };
}

function page(items: Pokemon[], totalCount: number): PokemonPage {
  return { items, page: 1, page_size: 20, total_count: totalCount, total_pages: 1 };
}

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: null, captured: [] });
    vi.spyOn(pokemonApi, "fetchTypes").mockResolvedValue(["Fire", "Water"]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads and renders the first page of Pokémon", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonPage").mockResolvedValue(page([pokemon(1), pokemon(2)], 2));
    renderWithProviders(<App />);
    await waitFor(() => expect(screen.getByText("Mon1")).toBeInTheDocument());
    expect(screen.getByText("Mon2")).toBeInTheDocument();
  });

  it("prompts for a trainer name on first capture, then captures after login", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonPage").mockResolvedValue(page([pokemon(1)], 1));
    vi.spyOn(accountsApi, "login").mockResolvedValue({ username: "ash", captured: [] });
    vi.spyOn(accountsApi, "capturePokemon").mockResolvedValue({ name: "Mon1", captured: true });
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await waitFor(() => expect(screen.getByText("Mon1")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /capture mon1/i }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/trainer name/i), "Ash");
    await user.click(within(dialog).getByRole("button", { name: /start capturing/i }));

    await waitFor(() => expect(accountsApi.capturePokemon).toHaveBeenCalledWith("Mon1"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /release mon1/i })).toBeInTheDocument(),
    );
  });

  it("self-heals an unknown type from a stale URL instead of retry-looping a 400", async () => {
    const spy = vi.spyOn(pokemonApi, "fetchPokemonPage").mockImplementation((q) =>
      q.type
        ? Promise.reject(new Error("must be one of ['Fire', 'Water'], got 'Bogus'"))
        : Promise.resolve(page([pokemon(1)], 1)),
    );
    renderWithProviders(<App />, { initialEntries: ["/?type=Bogus"] });

    await waitFor(() => expect(screen.getByText("Mon1")).toBeInTheDocument());
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ type: null }));
  });

  it("re-fetches with the selected type when the filter changes", async () => {
    const spy = vi
      .spyOn(pokemonApi, "fetchPokemonPage")
      .mockResolvedValue(page([pokemon(1, { type_one: "Fire" })], 1));
    const user = userEvent.setup();
    renderWithProviders(<App />);
    await waitFor(() => expect(screen.getByText("Mon1")).toBeInTheDocument());

    await user.click(screen.getByLabelText(/^type$/i));
    await user.click(await screen.findByRole("option", { name: "Fire" }));

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ type: "Fire", page: 1 })),
    );
  });
});
