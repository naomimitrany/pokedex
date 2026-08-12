import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilterBar } from "./FilterBar";

const baseFilters = {
  type: null as string | null,
  q: "",
  sortBy: "number" as const,
  order: "asc" as const,
  pageSize: 20,
};

describe("FilterBar", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("debounces search input before calling onChange", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
    render(<FilterBar types={["Fire", "Water"]} filters={baseFilters} onChange={onChange} />);

    await user.type(screen.getByLabelText(/search/i), "char");
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onChange).toHaveBeenCalledWith({ q: "char" });
  });

  it("changing the type select calls onChange with the selected type", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
    render(<FilterBar types={["Fire", "Water"]} filters={baseFilters} onChange={onChange} />);

    await user.click(screen.getByLabelText(/type/i));
    await user.click(await screen.findByRole("option", { name: "Fire" }));
    expect(onChange).toHaveBeenCalledWith({ type: "Fire" });
  });

  it('selecting "All types" clears the filter', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
    render(
      <FilterBar
        types={["Fire", "Water"]}
        filters={{ ...baseFilters, type: "Fire" }}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByLabelText(/type/i));
    await user.click(await screen.findByRole("option", { name: /all types/i }));
    expect(onChange).toHaveBeenCalledWith({ type: null });
  });

  it("toggling order calls onChange with the new order", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
    render(<FilterBar types={[]} filters={baseFilters} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /^sort$/i }));
    await user.click(await screen.findByRole("button", { name: /descending/i }));
    expect(onChange).toHaveBeenCalledWith({ order: "desc" });
  });

  it("selecting a sort field calls onChange with the new field", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
    render(<FilterBar types={[]} filters={baseFilters} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /^sort$/i }));
    await user.click(await screen.findByText("Name"));
    expect(onChange).toHaveBeenCalledWith({ sortBy: "name" });
  });

  it("doesn't stomp newly typed characters when the parent echoes back a stale committed value", async () => {
    // Regression: typing "char", pausing long enough for the debounce to
    // commit, then immediately continuing to type "izard" used to race
    // against the parent re-rendering with the just-committed filters.q="char"
    // prop. The sync-back effect blindly applied that prop, snapping the
    // field back to "char" and silently erasing "izard".
    const onChange = vi.fn();
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
    const { rerender } = render(
      <FilterBar types={["Fire", "Water"]} filters={baseFilters} onChange={onChange} />,
    );

    await user.type(screen.getByLabelText(/search/i), "char");
    vi.advanceTimersByTime(300);
    expect(onChange).toHaveBeenCalledWith({ q: "char" });

    await user.type(screen.getByLabelText(/search/i), "izard");

    // Simulate the parent's round-trip finally landing with the committed value.
    rerender(
      <FilterBar
        types={["Fire", "Water"]}
        filters={{ ...baseFilters, q: "char" }}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText(/search/i)).toHaveValue("charizard");
  });

  it("changing page size calls onChange with the new size", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
    render(<FilterBar types={[]} filters={baseFilters} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /more options/i }));
    await user.click(await screen.findByLabelText(/per page/i));
    await user.click(await screen.findByRole("option", { name: "10" }));
    expect(onChange).toHaveBeenCalledWith({ pageSize: 10 });
  });
});
