import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "./ThemeToggle";
import { theme } from "../../theme";

function renderToggle(defaultMode: "light" | "dark") {
  return render(
    <ThemeProvider theme={theme} defaultMode={defaultMode}>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows a control to switch to dark mode when currently light", () => {
    renderToggle("light");
    expect(screen.getByRole("button", { name: /switch to dark mode/i })).toBeInTheDocument();
  });

  it("shows a control to switch to light mode when currently dark", () => {
    renderToggle("dark");
    expect(screen.getByRole("button", { name: /switch to light mode/i })).toBeInTheDocument();
  });

  it("toggles the color scheme when clicked", async () => {
    const user = userEvent.setup();
    renderToggle("light");
    await user.click(screen.getByRole("button", { name: /switch to dark mode/i }));
    expect(await screen.findByRole("button", { name: /switch to light mode/i })).toBeInTheDocument();
  });
});
