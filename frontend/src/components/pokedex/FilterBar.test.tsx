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
    await user.click(screen.getByRole("button", { name: /descending/i }));
    expect(onChange).toHaveBeenCalledWith({ order: "desc" });
  });

  it("changing page size calls onChange with the new size", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
    render(<FilterBar types={[]} filters={baseFilters} onChange={onChange} />);
    await user.click(screen.getByLabelText(/per page/i));
    await user.click(await screen.findByRole("option", { name: "10" }));
    expect(onChange).toHaveBeenCalledWith({ pageSize: 10 });
  });
});
