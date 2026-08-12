import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { BagFab } from "./BagFab";
import * as accountsApi from "../../api/accounts";

describe("BagFab", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when logged out", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: null, captured: [] });
    renderWithProviders(<BagFab />);

    await waitFor(() => expect(accountsApi.fetchMe).toHaveBeenCalled());
    expect(screen.queryByRole("link", { name: /view captured pok/i })).not.toBeInTheDocument();
  });

  it("renders a link to /captured when logged in", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: "ash", captured: [] });
    renderWithProviders(<BagFab />);

    const link = await screen.findByRole("link", { name: /view captured pok/i });
    expect(link).toHaveAttribute("href", "/captured");
  });

  it("renders nothing while already on the captured page", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: "ash", captured: [] });
    renderWithProviders(<BagFab />, { initialEntries: ["/captured"] });

    await waitFor(() => expect(accountsApi.fetchMe).toHaveBeenCalled());
    expect(screen.queryByRole("link", { name: /view captured pok/i })).not.toBeInTheDocument();
  });
});
