import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { NavBar } from "./NavBar";
import { DEFAULT_PAGE_SIZE, DEFAULT_SORT_FIELD } from "../../constants";
import { theme } from "../../theme";
import { buildScrollKey } from "../../utils/scrollKey";

describe("NavBar", () => {
  beforeEach(() => sessionStorage.clear());

  it("renders the title and a theme toggle button", () => {
    render(
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <NavBar />
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: /pokédex/i })).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("links the title to the root path to reset filters and page state", () => {
    render(
      <MemoryRouter initialEntries={["/?q=pikachu&type=fire&pages=3"]}>
        <ThemeProvider theme={theme}>
          <NavBar />
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /pokédex/i })).toHaveAttribute("href", "/");
  });

  it("clears the saved scroll position for the default view when the title is clicked", async () => {
    const key = buildScrollKey({
      pageSize: DEFAULT_PAGE_SIZE,
      sortBy: DEFAULT_SORT_FIELD,
      order: "asc",
      type: null,
      q: "",
    });
    sessionStorage.setItem(key, JSON.stringify({ scrollTop: 900, pages: 4 }));

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/?type=fire"]}>
        <ThemeProvider theme={theme}>
          <NavBar />
        </ThemeProvider>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("link", { name: /pokédex/i }));

    expect(sessionStorage.getItem(key)).toBeNull();
  });
});
