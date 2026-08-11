import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PokemonCardSkeleton } from "./PokemonCardSkeleton";

describe("PokemonCardSkeleton", () => {
  it("renders a skeleton placeholder card", () => {
    render(<PokemonCardSkeleton />);
    expect(screen.getByTestId("pokemon-card-skeleton")).toBeInTheDocument();
  });
});
