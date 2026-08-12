import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import { PokemonDetailPage } from "./PokemonDetailPage";
import * as pokemonApi from "../api/pokemon";
import * as accountsApi from "../api/accounts";
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

const renderPage = (path: string) => {
  vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({
    username: null,
    captured: [],
  });
  return renderWithProviders(
    <Routes>
      <Route path="/pokemon/:name" element={<PokemonDetailPage />} />
    </Routes>,
    { initialEntries: [path] },
  );
};

describe("PokemonDetailPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading skeleton while fetching", () => {
    vi.spyOn(pokemonApi, "fetchPokemonDetail").mockReturnValue(
      new Promise(() => {}),
    );

    renderPage("/pokemon/Bulbasaur");

    expect(screen.getByTestId("pokemon-detail-skeleton")).toBeInTheDocument();
  });

  it("renders every field once loaded, including total and generation", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonDetail").mockResolvedValue(bulbasaur);

    renderPage("/pokemon/Bulbasaur");

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Bulbasaur" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("#001")).toBeInTheDocument();
    expect(screen.getByText("Grass")).toBeInTheDocument();
    expect(screen.getByText("Poison")).toBeInTheDocument();
    expect(screen.getByText("318")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows a not-found message for an unknown pokemon", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonDetail").mockRejectedValue(
      Object.assign(new Error("no Pokémon named 'Missingno'"), {
        isAxiosError: true,
        response: {
          status: 404,
          data: { error: "no Pokémon named 'Missingno'" },
        },
      }),
    );

    renderPage("/pokemon/Missingno");

    await waitFor(() =>
      expect(screen.getByText(/no pokémon named/i)).toBeInTheDocument(),
    );
  });

  it("keeps the loaded page visible when a background refetch fails", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({
      username: null,
      captured: [],
    });
    const fetchDetail = vi
      .spyOn(pokemonApi, "fetchPokemonDetail")
      .mockRejectedValue(
        Object.assign(new Error("network error"), { isAxiosError: true }),
      );

    renderWithProviders(
      <Routes>
        <Route path="/pokemon/:name" element={<PokemonDetailPage />} />
      </Routes>,
      {
        initialEntries: [
          { pathname: "/pokemon/Bulbasaur", state: { pokemon: bulbasaur } },
        ],
      },
    );

    // initialData renders the loaded page instantly, before the background
    // refetch (simulated here as a rejection) has a chance to settle.
    expect(
      screen.getByRole("heading", { name: "Bulbasaur" }),
    ).toBeInTheDocument();

    await waitFor(() => expect(fetchDetail).toHaveBeenCalled());

    expect(
      screen.getByRole("heading", { name: "Bulbasaur" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no pokémon named/i)).not.toBeInTheDocument();
  });

  it("opens the login prompt when capturing while logged out", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonDetail").mockResolvedValue(bulbasaur);
    const user = userEvent.setup();

    renderPage("/pokemon/Bulbasaur");
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Bulbasaur" }),
      ).toBeInTheDocument(),
    );

    await user.click(
      screen.getByRole("button", { name: /capture bulbasaur/i }),
    );

    expect(
      screen.getByRole("heading", { name: /name your trainer/i }),
    ).toBeInTheDocument();
  });
});
