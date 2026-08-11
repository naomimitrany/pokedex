import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NavBar } from "./NavBar";
import { theme } from "../../theme";

describe("NavBar", () => {
  it("renders the title and a theme toggle button", () => {
    render(
      <ThemeProvider theme={theme}>
        <NavBar />
      </ThemeProvider>,
    );
    expect(screen.getByRole("heading", { name: /pokédex/i })).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
