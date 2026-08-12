import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { CapturedDeck } from "./CapturedDeck";
import type { Pokemon } from "../../types";

function pokemon(number: number, name: string): Pokemon {
  return {
    number,
    name,
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

const ITEMS = [pokemon(1, "Bulbasaur"), pokemon(4, "Charmander"), pokemon(7, "Squirtle")];

describe("CapturedDeck", () => {
  it("shows the captured count and the centered card's full details", () => {
    renderWithProviders(
      <CapturedDeck items={ITEMS} centerIndex={1} onNavigate={vi.fn()} onRelease={vi.fn()} />,
    );

    expect(screen.getByText("3 captured")).toBeInTheDocument();
    expect(screen.getByText("Charmander")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /release charmander/i }),
    ).toBeInTheDocument();
  });

  it("shows peeking neighbors by name", () => {
    renderWithProviders(
      <CapturedDeck items={ITEMS} centerIndex={1} onNavigate={vi.fn()} onRelease={vi.fn()} />,
    );

    expect(screen.getByText("Bulbasaur")).toBeInTheDocument();
    expect(screen.getByText("Squirtle")).toBeInTheDocument();
  });

  it("disables the left arrow at the first card and the right arrow at the last", () => {
    renderWithProviders(
      <CapturedDeck items={ITEMS} centerIndex={0} onNavigate={vi.fn()} onRelease={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).toBeEnabled();
  });

  it("calls onNavigate with the step direction when an arrow is clicked", async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <CapturedDeck items={ITEMS} centerIndex={1} onNavigate={onNavigate} onRelease={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(onNavigate).toHaveBeenCalledWith(1);

    await user.click(screen.getByRole("button", { name: /previous/i }));
    expect(onNavigate).toHaveBeenCalledWith(-1);
  });

  it("calls onRelease with the centered Pokémon when its release button is clicked", async () => {
    const onRelease = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <CapturedDeck items={ITEMS} centerIndex={1} onNavigate={vi.fn()} onRelease={onRelease} />,
    );

    await user.click(screen.getByRole("button", { name: /release charmander/i }));
    expect(onRelease).toHaveBeenCalledWith(ITEMS[1]);
  });
});
