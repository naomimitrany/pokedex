import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders the title and optional description", () => {
    render(<EmptyState title="No Pokémon match your filters." description="Try clearing a filter." />);
    expect(screen.getByText("No Pokémon match your filters.")).toBeInTheDocument();
    expect(screen.getByText("Try clearing a filter.")).toBeInTheDocument();
  });

  it("omits the description when not provided", () => {
    render(<EmptyState title="No Pokémon match your filters." />);
    expect(screen.getByText("No Pokémon match your filters.")).toBeInTheDocument();
  });
});
