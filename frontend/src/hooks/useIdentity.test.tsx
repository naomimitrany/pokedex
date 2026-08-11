import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/renderWithProviders";
import { useIdentity } from "./useIdentity";
import * as accountsApi from "../api/accounts";

describe("useIdentity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the logged-out identity before the query resolves", () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: "ash", captured: ["Pikachu"] });
    const { result } = renderHookWithProviders(() => useIdentity());
    expect(result.current).toEqual({ username: null, captured: [] });
  });

  it("returns the loaded identity once the query resolves", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: "ash", captured: ["Pikachu"] });
    const { result } = renderHookWithProviders(() => useIdentity());
    await waitFor(() => expect(result.current.username).toBe("ash"));
    expect(result.current.captured).toEqual(["Pikachu"]);
  });
});
