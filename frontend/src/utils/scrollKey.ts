import type { SortField, SortOrder } from "../types";

export type ScrollKeyFilters = {
  pageSize: number;
  sortBy: SortField;
  order: SortOrder;
  type: string | null;
  q: string;
};

export const buildScrollKey = (filters: ScrollKeyFilters): string =>
  `pokedex:scroll:${filters.pageSize}:${filters.sortBy}:${filters.order}:${filters.type ?? ""}:${filters.q}`;
