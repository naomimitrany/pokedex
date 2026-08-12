import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PokemonGrid } from "./PokemonGrid";
import { renderWithProviders } from "../../test/renderWithProviders";
import type { Pokemon } from "../../types";

function pokemon(number: number): Pokemon {
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
  };
}

type IOCallback = (
  entries: Pick<IntersectionObserverEntry, "isIntersecting">[],
) => void;
let ioCallback: IOCallback | null = null;

let ioOptions: IntersectionObserverInit | undefined;

class IntersectionObserverMock {
  constructor(callback: IOCallback, options?: IntersectionObserverInit) {
    ioCallback = callback;
    ioOptions = options;
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

const baseProps = {
  capturedNames: new Set<string>(),
  isLoading: false,
  isFetchingNextPage: false,
  error: null as string | null,
  hasMore: true,
  onLoadMore: vi.fn(),
  onRetry: vi.fn(),
  onToggleCapture: vi.fn(),
  pageSize: 20,
};

describe("PokemonGrid", () => {
  beforeEach(() => {
    ioCallback = null;
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("shows pageSize skeleton cards while loading initially", () => {
    renderWithProviders(
      <PokemonGrid {...baseProps} items={[]} isLoading pageSize={4} />,
    );
    expect(screen.getAllByTestId("pokemon-card-skeleton")).toHaveLength(4);
  });

  it("shows an error alert with retry when the initial load fails", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <PokemonGrid
        {...baseProps}
        items={[]}
        error="network down"
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText("network down")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("shows an empty state when there is no error and no items", () => {
    renderWithProviders(<PokemonGrid {...baseProps} items={[]} />);
    expect(screen.getByText(/nothing here/i)).toBeInTheDocument();
  });

  it("renders a card per item and forwards capture toggles", async () => {
    const onToggleCapture = vi.fn();
    const user = userEvent.setup();
    const mon1 = pokemon(1);
    renderWithProviders(
      <PokemonGrid
        {...baseProps}
        items={[mon1, pokemon(2)]}
        onToggleCapture={onToggleCapture}
      />,
    );
    expect(screen.getByText("Mon1")).toBeInTheDocument();
    expect(screen.getByText("Mon2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /capture mon1/i }));
    expect(onToggleCapture).toHaveBeenCalledWith(mon1, false);
  });

  it("triggers onLoadMore when the sentinel intersects and hasMore is true", () => {
    const onLoadMore = vi.fn();
    renderWithProviders(
      <PokemonGrid
        {...baseProps}
        items={[pokemon(1)]}
        hasMore
        onLoadMore={onLoadMore}
      />,
    );
    expect(ioCallback).not.toBeNull();
    ioCallback?.([{ isIntersecting: true }]);
    expect(onLoadMore).toHaveBeenCalled();
  });

  it("observes the sentinel with a positive rootMargin so the next page starts loading before it's reached", () => {
    renderWithProviders(
      <PokemonGrid
        {...baseProps}
        items={[pokemon(1)]}
        hasMore
        onLoadMore={vi.fn()}
      />,
    );
    expect(ioOptions?.rootMargin).toBe("800px");
  });

  it("shows an end-of-list message and no sentinel when hasMore is false", () => {
    renderWithProviders(
      <PokemonGrid {...baseProps} items={[pokemon(1)]} hasMore={false} />,
    );
    expect(screen.getByText(/gotta catch 'em all/i)).toBeInTheDocument();
  });

  it("shows trailing skeletons while fetching the next page", () => {
    renderWithProviders(
      <PokemonGrid
        {...baseProps}
        items={[pokemon(1)]}
        isFetchingNextPage
        pageSize={3}
      />,
    );
    expect(screen.getAllByTestId("pokemon-card-skeleton")).toHaveLength(3);
  });

  it("only disables the capture button for the card matching capturingName", () => {
    renderWithProviders(
      <PokemonGrid
        {...baseProps}
        items={[pokemon(1), pokemon(2)]}
        capturingName="Mon1"
      />,
    );
    expect(
      screen.getByRole("button", { name: /capture mon1/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /capture mon2/i }),
    ).not.toBeDisabled();
  });
});
