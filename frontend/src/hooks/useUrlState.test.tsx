import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderHookWithProviders } from "../test/renderWithProviders";
import { filterStateToParams, parseFilterState, useUrlState } from "./useUrlState";

describe("parseFilterState", () => {
  it("fills in defaults for an empty query string", () => {
    expect(parseFilterState(new URLSearchParams(""))).toEqual({
      pageSize: 20,
      sortBy: "number",
      order: "asc",
      type: null,
      q: "",
    });
  });

  it("parses valid values", () => {
    const params = new URLSearchParams(
      "page_size=10&sort_by=attack&order=desc&type=Fire&q=char",
    );
    expect(parseFilterState(params)).toEqual({
      pageSize: 10,
      sortBy: "attack",
      order: "desc",
      type: "Fire",
      q: "char",
    });
  });

  it("sanitizes an invalid page_size, sort_by, and order back to defaults", () => {
    const params = new URLSearchParams("page_size=999&sort_by=nonsense&order=sideways");
    expect(parseFilterState(params)).toEqual({
      pageSize: 20,
      sortBy: "number",
      order: "asc",
      type: null,
      q: "",
    });
  });
});

describe("filterStateToParams", () => {
  it("round-trips through parseFilterState", () => {
    const state = {
      pageSize: 5,
      sortBy: "speed" as const,
      order: "desc" as const,
      type: "Water",
      q: "saur",
    };
    expect(parseFilterState(filterStateToParams(state))).toEqual(state);
  });

  it("omits type and q when empty", () => {
    const params = filterStateToParams({
      pageSize: 20,
      sortBy: "number",
      order: "asc",
      type: null,
      q: "",
    });
    expect(params.has("type")).toBe(false);
    expect(params.has("q")).toBe(false);
  });
});

describe("useUrlState", () => {
  it("corrects an invalid URL param without user action", () => {
    const { result } = renderHookWithProviders(() => useUrlState(), {
      initialEntries: ["/?sort_by=bogus"],
    });
    expect(result.current.state.sortBy).toBe("number");
  });

  it("setFilters updates the given fields without touching the others", () => {
    const { result } = renderHookWithProviders(() => useUrlState());
    act(() => {
      result.current.setFilters({ q: "char" });
    });
    act(() => {
      result.current.setFilters({ type: "Fire" });
    });
    expect(result.current.state.type).toBe("Fire");
    expect(result.current.state.q).toBe("char");
  });

  it("doesn't drop a setFilters call when two calls land in the same tick", () => {
    // Regression: two setFilters callers (e.g. a debounced search box and a
    // type dropdown) can both fire before either has re-rendered. Both used
    // to build their patch from the same stale `state` snapshot, so
    // whichever call reached setSearchParams second clobbered the other's
    // update instead of merging with it.
    const { result } = renderHookWithProviders(() => useUrlState());
    act(() => {
      result.current.setFilters({ q: "pi" });
      result.current.setFilters({ type: "Fire" });
    });
    expect(result.current.state.q).toBe("pi");
    expect(result.current.state.type).toBe("Fire");
  });
});
