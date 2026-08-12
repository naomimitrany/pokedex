import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PokemonSprite } from "./PokemonSprite";

describe("PokemonSprite", () => {
  it("renders the sprite image using the icon endpoint", () => {
    render(<PokemonSprite name="Bulbasaur" glow="#7AC74C" />);
    expect(screen.getByRole("img", { name: "Bulbasaur" })).toHaveAttribute(
      "src",
      "http://localhost:8080/icon/Bulbasaur",
    );
  });

  it("lazy-loads the sprite image so offscreen cards don't eagerly fetch", () => {
    render(<PokemonSprite name="Bulbasaur" glow="#7AC74C" />);
    const image = screen.getByRole("img", { name: "Bulbasaur" });
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("decoding", "async");
  });

  it("swaps in the placeholder pokeball when the sprite fails to load", () => {
    render(<PokemonSprite name="Missingno" glow="#777777" />);
    const image = screen.getByRole("img", { name: "Missingno" });

    fireEvent.error(image);

    expect(
      screen.queryByRole("img", { name: "Missingno" }),
    ).not.toBeInTheDocument();
    const fallback = document.querySelector('img[alt=""]');
    expect(fallback).toBeInTheDocument();
    expect(fallback?.getAttribute("src")).toContain("empty-pokeball");
  });
});
