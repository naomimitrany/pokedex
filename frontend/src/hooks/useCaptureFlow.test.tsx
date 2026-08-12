import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/renderWithProviders";
import { useCaptureFlow } from "./useCaptureFlow";
import { useIdentity } from "./useIdentity";
import * as accountsApi from "../api/accounts";
import type { Pokemon } from "../types";

const pikachu: Pokemon = {
  number: 25,
  name: "Pikachu",
  type_one: "Electric",
  type_two: "",
  total: 320,
  hit_points: 35,
  attack: 55,
  defense: 40,
  special_attack: 50,
  special_defense: 50,
  speed: 90,
  generation: 1,
  legendary: false,
};

describe("useCaptureFlow", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens the login prompt instead of capturing when logged out", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({
      username: null,
      captured: [],
    });
    const capturePokemon = vi.spyOn(accountsApi, "capturePokemon");

    const { result } = renderHookWithProviders(() => useCaptureFlow());
    await waitFor(() => expect(result.current.pendingCapture).toBeNull());

    act(() => {
      result.current.handleToggleCapture(pikachu, false);
    });

    expect(result.current.pendingCapture).toEqual(pikachu);
    expect(capturePokemon).not.toHaveBeenCalled();
  });

  it("captures immediately when already logged in", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({
      username: "ash",
      captured: [],
    });
    vi.spyOn(accountsApi, "capturePokemon").mockResolvedValue({
      name: "Pikachu",
      captured: true,
    });

    // capturedNames is empty both before identity loads (LOGGED_OUT default)
    // and once it resolves as "ash" with no captures yet, so it can't signal
    // "identity has loaded" -- wait on identity.username instead, which is
    // only "ash" once the mocked fetchMe has actually resolved.
    const { result } = renderHookWithProviders(() => ({
      identity: useIdentity(),
      captureFlow: useCaptureFlow(),
    }));
    await waitFor(() => expect(result.current.identity.username).toBe("ash"));

    act(() => {
      result.current.captureFlow.handleToggleCapture(pikachu, false);
    });

    await waitFor(() =>
      expect(result.current.captureFlow.capturedNames.has("Pikachu")).toBe(
        true,
      ),
    );
    expect(result.current.captureFlow.pendingCapture).toBeNull();
  });

  it("captures the pending pokemon after a successful login", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({
      username: null,
      captured: [],
    });
    vi.spyOn(accountsApi, "login").mockResolvedValue({
      username: "misty",
      captured: [],
    });
    vi.spyOn(accountsApi, "capturePokemon").mockResolvedValue({
      name: "Pikachu",
      captured: true,
    });

    const { result } = renderHookWithProviders(() => useCaptureFlow());
    await waitFor(() => expect(result.current.pendingCapture).toBeNull());

    act(() => {
      result.current.handleToggleCapture(pikachu, false);
    });
    expect(result.current.pendingCapture).toEqual(pikachu);

    await act(async () => {
      await result.current.handleLoginSubmit("misty");
    });

    expect(result.current.pendingCapture).toBeNull();
    await waitFor(() =>
      expect(result.current.capturedNames.has("Pikachu")).toBe(true),
    );
  });

  it("shows a snackbar message when the capture mutation fails", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({
      username: "ash",
      captured: [],
    });
    vi.spyOn(accountsApi, "capturePokemon").mockRejectedValue(
      new Error("network error"),
    );

    // Same rationale as above: wait on identity.username, not capturedNames,
    // so the toggle fires after the mocked "ash" identity has actually loaded.
    const { result } = renderHookWithProviders(() => ({
      identity: useIdentity(),
      captureFlow: useCaptureFlow(),
    }));
    await waitFor(() => expect(result.current.identity.username).toBe("ash"));

    act(() => {
      result.current.captureFlow.handleToggleCapture(pikachu, false);
    });

    await waitFor(() =>
      expect(result.current.captureFlow.snackbarMessage).toBe(
        "Couldn't update capture. Try again.",
      ),
    );
  });
});
