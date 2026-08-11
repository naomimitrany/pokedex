import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/renderWithProviders";
import { useIdentity } from "./useIdentity";
import { useLoginMutation } from "./useLoginMutation";
import * as accountsApi from "../api/accounts";

describe("useLoginMutation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates the shared identity cache on success", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: null, captured: [] });
    vi.spyOn(accountsApi, "login").mockResolvedValue({ username: "misty", captured: [] });

    const { result } = renderHookWithProviders(() => ({
      identity: useIdentity(),
      loginMutation: useLoginMutation(),
    }));
    await waitFor(() => expect(result.current.identity.username).toBeNull());

    await act(async () => {
      await result.current.loginMutation.login("misty");
    });

    await waitFor(() => expect(result.current.identity.username).toBe("misty"));
  });

  it("exposes the backend's error message on failure", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: null, captured: [] });
    vi.spyOn(accountsApi, "login").mockRejectedValue(new Error("name taken"));

    const { result } = renderHookWithProviders(() => useLoginMutation());
    await expect(act(() => result.current.login("misty"))).rejects.toThrow("name taken");
    await waitFor(() => expect(result.current.error).toBe("name taken"));
  });
});
