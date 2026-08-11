import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import { capturePokemon, fetchMe, login, logout, releasePokemon } from "./accounts";

describe("api/accounts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchMe, login, logout return identity payloads", async () => {
    const identity = { username: "ash", captured: ["Pikachu"] };
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: identity });
    const postSpy = vi.spyOn(apiClient, "post").mockResolvedValue({ data: identity });

    await expect(fetchMe()).resolves.toEqual(identity);
    await expect(login("ash")).resolves.toEqual(identity);
    await expect(logout()).resolves.toEqual(identity);

    expect(postSpy).toHaveBeenNthCalledWith(1, "/login", { username: "ash" });
    expect(postSpy).toHaveBeenNthCalledWith(2, "/logout");
  });

  it("capturePokemon posts the name and releasePokemon deletes by name", async () => {
    const postSpy = vi
      .spyOn(apiClient, "post")
      .mockResolvedValue({ data: { name: "Pikachu", captured: true } });
    const deleteSpy = vi
      .spyOn(apiClient, "delete")
      .mockResolvedValue({ data: { name: "Pikachu", captured: false } });

    await capturePokemon("Pikachu");
    expect(postSpy).toHaveBeenCalledWith("/captures", { name: "Pikachu" });

    await releasePokemon("Pikachu");
    expect(deleteSpy).toHaveBeenCalledWith("/captures/Pikachu");
  });
});
