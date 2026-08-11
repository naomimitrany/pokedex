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
      pages: 1,
    });
  });

  it("parses valid values", () => {
    const params = new URLSearchParams(
      "page_size=10&sort_by=attack&order=desc&type=Fire&q=char&pages=3",
    );
    expect(parseFilterState(params)).toEqual({
      pageSize: 10,
      sortBy: "attack",
      order: "desc",
      type: "Fire",
      q: "char",
      pages: 3,
    });
  });

  it("sanitizes an invalid page_size, sort_by, order, and pages back to defaults", () => {
    const params = new URLSearchParams("page_size=999&sort_by=nonsense&order=sideways&pages=-2");
    expect(parseFilterState(params)).toEqual({
      pageSize: 20,
      sortBy: "number",
      order: "asc",
      type: null,
      q: "",
      pages: 1,
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
      pages: 2,
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
      pages: 1,
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

  it("setFilters updates the given fields and resets pages to 1", () => {
    const { result } = renderHookWithProviders(() => useUrlState());
    act(() => {
      result.current.setPages(4);
    });
    expect(result.current.state.pages).toBe(4);
    act(() => {
      result.current.setFilters({ type: "Fire" });
    });
    expect(result.current.state.type).toBe("Fire");
    expect(result.current.state.pages).toBe(1);
  });

  it("setPages only changes pages", () => {
    const { result } = renderHookWithProviders(() => useUrlState());
    act(() => {
      result.current.setFilters({ q: "char" });
    });
    act(() => {
      result.current.setPages(3);
    });
    expect(result.current.state.pages).toBe(3);
    expect(result.current.state.q).toBe("char");
  });
});
