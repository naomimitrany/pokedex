import { describe, expect, it } from "vitest";
import { buildScrollKey } from "./scrollKey";

describe("buildScrollKey", () => {
  it("builds a stable key from the filter fields that affect list content", () => {
    expect(
      buildScrollKey({
        pageSize: 20,
        sortBy: "number",
        order: "asc",
        type: null,
        q: "",
      }),
    ).toBe("pokedex:scroll:20:number:asc::");
  });

  it("differentiates keys by type and q", () => {
    const base = { pageSize: 20, sortBy: "number" as const, order: "asc" as const };
    expect(buildScrollKey({ ...base, type: "Fire", q: "" })).not.toBe(
      buildScrollKey({ ...base, type: null, q: "" }),
    );
    expect(buildScrollKey({ ...base, type: null, q: "char" })).not.toBe(
      buildScrollKey({ ...base, type: null, q: "" }),
    );
  });
});
