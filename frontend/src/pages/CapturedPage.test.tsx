import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import { CapturedPage } from "./CapturedPage";
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

const BULBASAUR = pokemon(1, "Bulbasaur");
const CHARMANDER = pokemon(4, "Charmander");
const SQUIRTLE = pokemon(7, "Squirtle");

describe("CapturedPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects away when logged out", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({
      username: null,
      captured: [],
    });
    renderWithProviders(<CapturedPage />, { initialEntries: ["/captured"] });

    await waitFor(() => expect(accountsApi.fetchMe).toHaveBeenCalled());
    expect(screen.queryByText("Your bag is empty")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("pokemon-card-skeleton"),
    ).not.toBeInTheDocument();
  });

  it("shows the empty state with a link back when nothing is captured", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({
      username: "ash",
      captured: [],
    });
    vi.spyOn(accountsApi, "fetchCaptures").mockResolvedValue([]);
    renderWithProviders(<CapturedPage />, { initialEntries: ["/captured"] });

    await waitFor(() =>
      expect(screen.getByText("Your bag is empty")).toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: /^back$/i })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("centers the card named in ?card= on load", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({
      username: "ash",
      captured: ["Bulbasaur", "Charmander", "Squirtle"],
    });
    vi.spyOn(accountsApi, "fetchCaptures").mockResolvedValue([
      BULBASAUR,
      CHARMANDER,
      SQUIRTLE,
    ]);
    renderWithProviders(<CapturedPage />, {
      initialEntries: ["/captured?card=Squirtle"],
    });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /release squirtle/i }),
      ).toBeInTheDocument(),
    );
  });

  it("releasing the centered Pokémon removes it immediately and centers the next one", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({
      username: "ash",
      captured: ["Bulbasaur", "Charmander", "Squirtle"],
    });
    vi.spyOn(accountsApi, "fetchCaptures").mockResolvedValue([
      BULBASAUR,
      CHARMANDER,
      SQUIRTLE,
    ]);
    vi.spyOn(accountsApi, "releasePokemon").mockResolvedValue({
      name: "Charmander",
      captured: false,
    });
    const user = userEvent.setup();
    renderWithProviders(<CapturedPage />, {
      initialEntries: ["/captured?card=Charmander"],
    });

    await waitFor(() =>
      expect(screen.getByText("Charmander")).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", { name: /release charmander/i }),
    );

    await waitFor(() =>
      expect(screen.queryByText("Charmander")).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: /release squirtle/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 captured!")).toBeInTheDocument();
  });

  it("shows an error message when releasing fails", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({
      username: "ash",
      captured: ["Bulbasaur", "Charmander", "Squirtle"],
    });
    vi.spyOn(accountsApi, "fetchCaptures").mockResolvedValue([
      BULBASAUR,
      CHARMANDER,
      SQUIRTLE,
    ]);
    vi.spyOn(accountsApi, "releasePokemon").mockRejectedValue(
      new Error("network error"),
    );
    const user = userEvent.setup();
    renderWithProviders(<CapturedPage />, {
      initialEntries: ["/captured?card=Charmander"],
    });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /release charmander/i }),
      ).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", { name: /release charmander/i }),
    );

    await waitFor(() =>
      expect(
        screen.getByText("Couldn't update capture. Try again."),
      ).toBeInTheDocument(),
    );
  });
});
