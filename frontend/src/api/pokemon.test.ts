import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import { fetchPokemonPage, fetchTypes, iconUrl } from "./pokemon";

describe("api/pokemon", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchPokemonPage sends the required params, omitting empty type/q", async () => {
    const page = { items: [], page: 1, page_size: 20, total_count: 0, total_pages: 0 };
    const spy = vi.spyOn(apiClient, "get").mockResolvedValue({ data: page });

    const result = await fetchPokemonPage({ page: 2, pageSize: 10, sortBy: "number", order: "desc" });

    expect(result).toEqual(page);
    expect(spy).toHaveBeenCalledWith("/pokemon", {
      params: { page: 2, page_size: 10, sort_by: "number", order: "desc" },
    });
  });

  it("fetchPokemonPage includes type and q when provided", async () => {
    const spy = vi.spyOn(apiClient, "get").mockResolvedValue({
      data: { items: [], page: 1, page_size: 20, total_count: 0, total_pages: 0 },
    });

    await fetchPokemonPage({
      page: 1,
      pageSize: 20,
      sortBy: "attack",
      order: "asc",
      type: "Fire",
      q: "char",
    });

    expect(spy).toHaveBeenCalledWith("/pokemon", {
      params: {
        page: 1,
        page_size: 20,
        sort_by: "attack",
        order: "asc",
        type: "Fire",
        q: "char",
      },
    });
  });

  it("fetchTypes returns the parsed list", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: ["Fire", "Water"] });
    await expect(fetchTypes()).resolves.toEqual(["Fire", "Water"]);
  });

  it("iconUrl points at the backend icon endpoint", () => {
    expect(iconUrl("Mr. Mime")).toBe("http://localhost:8080/icon/Mr.%20Mime");
  });
});
