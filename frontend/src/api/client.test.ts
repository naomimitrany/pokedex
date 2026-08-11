import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { apiClient, getErrorMessage } from "./client";

describe("apiClient", () => {
  it("is configured with credentials for the cookie-session backend", () => {
    expect(apiClient.defaults.withCredentials).toBe(true);
    expect(apiClient.defaults.baseURL).toBe("http://localhost:8080");
  });
});

describe("getErrorMessage", () => {
  it("unwraps the backend's error message from an Axios error", () => {
    const error = new AxiosError(
      "Request failed with status code 401",
      "ERR_BAD_REQUEST",
      undefined,
      undefined,
      // @ts-expect-error minimal shape for the test
      { data: { error: "login required" } },
    );
    expect(getErrorMessage(error)).toBe("login required");
  });

  it("falls back to a generic message for non-Error values", () => {
    expect(getErrorMessage("boom")).toBe("Something went wrong");
  });
});
