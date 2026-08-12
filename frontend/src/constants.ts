import type { SortField } from "./types";

export const ALLOWED_PAGE_SIZES = [5, 10, 20, 50] as const;
export const DEFAULT_PAGE_SIZE = 20;

// Restoring N pages on mount is a single collapsed request (`to_page`), so
// this is no longer a latency cap -- it just bounds how many cards a
// stale/huge/tampered-with `pages` value can force onto the page at once.
export const MAX_AUTO_RESTORE_PAGES = 15;

export const SORT_FIELDS: { value: SortField; label: string }[] = [
  { value: "number", label: "Number" },
  { value: "name", label: "Name" },
  { value: "total", label: "Total" },
  { value: "hit_points", label: "HP" },
  { value: "attack", label: "Attack" },
  { value: "defense", label: "Defense" },
  { value: "special_attack", label: "Sp. Attack" },
  { value: "special_defense", label: "Sp. Defense" },
  { value: "speed", label: "Speed" },
  { value: "generation", label: "Generation" },
];

export const DEFAULT_SORT_FIELD: SortField = "number";
