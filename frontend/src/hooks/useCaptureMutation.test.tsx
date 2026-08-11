import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/renderWithProviders";
import { useCaptureMutation } from "./useCaptureMutation";
import { useIdentity } from "./useIdentity";
import * as accountsApi from "../api/accounts";

describe("useCaptureMutation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("optimistically adds the name, then keeps it after the server confirms", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: "ash", captured: [] });
    vi.spyOn(accountsApi, "capturePokemon").mockResolvedValue({ name: "Pikachu", captured: true });

    const { result } = renderHookWithProviders(() => ({
      identity: useIdentity(),
      captureMutation: useCaptureMutation(),
    }));
    await waitFor(() => expect(result.current.identity.username).toBe("ash"));

    act(() => {
      result.current.captureMutation.mutate({ name: "Pikachu", captured: false });
    });
    await waitFor(() => expect(result.current.identity.captured).toContain("Pikachu"));
    await waitFor(() => expect(result.current.captureMutation.isSuccess).toBe(true));
    expect(result.current.identity.captured).toContain("Pikachu");
  });

  it("rolls back the optimistic update when the request fails", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: "ash", captured: [] });
    vi.spyOn(accountsApi, "capturePokemon").mockRejectedValue(new Error("network error"));

    const { result } = renderHookWithProviders(() => ({
      identity: useIdentity(),
      captureMutation: useCaptureMutation(),
    }));
    await waitFor(() => expect(result.current.identity.username).toBe("ash"));

    act(() => {
      result.current.captureMutation.mutate({ name: "Pikachu", captured: false });
    });
    await waitFor(() => expect(result.current.captureMutation.isError).toBe(true));
    expect(result.current.identity.captured).not.toContain("Pikachu");
  });
});
