import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { NavBar } from "./NavBar";
import { theme } from "../../theme";

describe("NavBar", () => {
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
});
