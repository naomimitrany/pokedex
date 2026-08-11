import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginPrompt } from "./LoginPrompt";

describe("LoginPrompt", () => {
  it("is not rendered when closed", () => {
    render(<LoginPrompt open={false} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("submits the trimmed trainer name", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<LoginPrompt open onClose={vi.fn()} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/trainer name/i), "  Ash  ");
    await user.click(screen.getByRole("button", { name: /start capturing/i }));
    expect(onSubmit).toHaveBeenCalledWith("Ash");
  });

  it("does not submit an empty name", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<LoginPrompt open onClose={vi.fn()} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /start capturing/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/enter a trainer name/i)).toBeInTheDocument();
  });

  it("calls onClose from the cancel button", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<LoginPrompt open onClose={onClose} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows a passed-in error message", () => {
    render(<LoginPrompt open onClose={vi.fn()} onSubmit={vi.fn()} error="name taken" />);
    expect(screen.getByText("name taken")).toBeInTheDocument();
  });
});
