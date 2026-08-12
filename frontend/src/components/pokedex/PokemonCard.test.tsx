import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { PokemonCard } from "./PokemonCard";
import { renderWithProviders } from "../../test/renderWithProviders";
import type { Pokemon } from "../../types";

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

describe("PokemonCard", () => {
  it("renders the name, number, and both type chips", () => {
    renderWithProviders(
      <PokemonCard
        pokemon={bulbasaur}
        captured={false}
        onToggleCapture={vi.fn()}
      />,
    );
    expect(screen.getByText("Bulbasaur")).toBeInTheDocument();
    expect(screen.getByText("#001")).toBeInTheDocument();
    expect(screen.getByText("Grass")).toBeInTheDocument();
    expect(screen.getByText("Poison")).toBeInTheDocument();
  });

  it("omits the second chip when type_two is empty", () => {
    renderWithProviders(
      <PokemonCard
        pokemon={{ ...bulbasaur, type_two: "" }}
        captured={false}
        onToggleCapture={vi.fn()}
      />,
    );
    expect(screen.queryByText("Poison")).not.toBeInTheDocument();
  });

  it("shows an uncaptured affordance and captures on click", async () => {
    const onToggleCapture = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <PokemonCard
        pokemon={bulbasaur}
        captured={false}
        onToggleCapture={onToggleCapture}
      />,
    );
    const button = screen.getByRole("button", { name: /capture bulbasaur/i });
    await user.click(button);
    expect(onToggleCapture).toHaveBeenCalledWith(bulbasaur, false);
  });

  it("shows a captured affordance when already captured", () => {
    renderWithProviders(
      <PokemonCard pokemon={bulbasaur} captured onToggleCapture={vi.fn()} />,
    );
    expect(
      screen.getByRole("button", { name: /release bulbasaur/i }),
    ).toBeInTheDocument();
  });

  it("uses the icon endpoint for the sprite", () => {
    renderWithProviders(
      <PokemonCard
        pokemon={bulbasaur}
        captured={false}
        onToggleCapture={vi.fn()}
      />,
    );
    expect(screen.getByRole("img", { name: "Bulbasaur" })).toHaveAttribute(
      "src",
      "http://localhost:8080/icon/Bulbasaur",
    );
  });

  it("shows a skeleton over the sprite until the image loads, then hides it", () => {
    renderWithProviders(
      <PokemonCard
        pokemon={bulbasaur}
        captured={false}
        onToggleCapture={vi.fn()}
      />,
    );
    const image = screen.getByRole("img", { name: "Bulbasaur" });
    expect(document.querySelector(".MuiSkeleton-circular")).toBeInTheDocument();
    expect(image).toHaveStyle({ opacity: 0 });

    fireEvent.load(image);

    expect(
      document.querySelector(".MuiSkeleton-circular"),
    ).not.toBeInTheDocument();
    expect(image).toHaveStyle({ opacity: 1 });
  });

  it("hides the sprite skeleton even if the image fails to load", () => {
    renderWithProviders(
      <PokemonCard
        pokemon={bulbasaur}
        captured={false}
        onToggleCapture={vi.fn()}
      />,
    );
    const image = screen.getByRole("img", { name: "Bulbasaur" });

    fireEvent.error(image);

    expect(
      document.querySelector(".MuiSkeleton-circular"),
    ).not.toBeInTheDocument();
  });

  it("links to the pokemon's detail page", () => {
    renderWithProviders(
      <PokemonCard
        pokemon={bulbasaur}
        captured={false}
        onToggleCapture={vi.fn()}
      />,
    );
    expect(screen.getByRole("link", { name: /bulbasaur/i })).toHaveAttribute(
      "href",
      "/pokemon/Bulbasaur",
    );
  });

  it("clicking the capture button does not navigate to the detail page", async () => {
    const onToggleCapture = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route
          path="/"
          element={
            <PokemonCard
              pokemon={bulbasaur}
              captured={false}
              onToggleCapture={onToggleCapture}
            />
          }
        />
        <Route path="/pokemon/:name" element={<div>detail page</div>} />
      </Routes>,
    );

    const button = screen.getByRole("button", { name: /capture bulbasaur/i });
    await user.click(button);

    expect(onToggleCapture).toHaveBeenCalledWith(bulbasaur, false);
    expect(screen.queryByText("detail page")).not.toBeInTheDocument();
  });
});
