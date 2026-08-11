import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { SortField, SortOrder } from "../types";
import { ALLOWED_PAGE_SIZES, DEFAULT_PAGE_SIZE, DEFAULT_SORT_FIELD, SORT_FIELDS } from "../constants";

export type FilterState = {
  pageSize: number;
  sortBy: SortField;
  order: SortOrder;
  type: string | null;
  q: string;
  pages: number;
};

const SORT_FIELD_SET = new Set(SORT_FIELDS.map((f) => f.value));

const parsePageSize = (raw: string | null): number => {
  const n = Number(raw);
  return (ALLOWED_PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
};

const parseSortBy = (raw: string | null): SortField =>
  raw && SORT_FIELD_SET.has(raw as SortField) ? (raw as SortField) : DEFAULT_SORT_FIELD;

const parseOrder = (raw: string | null): SortOrder => (raw === "desc" ? "desc" : "asc");

const parsePages = (raw: string | null): number => {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
};

export const parseFilterState = (params: URLSearchParams): FilterState => ({
  pageSize: parsePageSize(params.get("page_size")),
  sortBy: parseSortBy(params.get("sort_by")),
  order: parseOrder(params.get("order")),
  type: params.get("type") || null,
  q: params.get("q") || "",
  pages: parsePages(params.get("pages")),
});

export const filterStateToParams = (state: FilterState): URLSearchParams => {
  const params = new URLSearchParams();
  params.set("page_size", String(state.pageSize));
  params.set("sort_by", state.sortBy);
  params.set("order", state.order);
  if (state.type) params.set("type", state.type);
  if (state.q) params.set("q", state.q);
  params.set("pages", String(state.pages));
  return params;
};

export const useUrlState = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(() => parseFilterState(searchParams), [searchParams]);

  useEffect(() => {
    const canonical = filterStateToParams(state).toString();
    if (canonical !== searchParams.toString()) {
      setSearchParams(filterStateToParams(state), { replace: true });
    }
  }, [state, searchParams, setSearchParams]);

  const setFilters = useCallback(
    (partial: Partial<Omit<FilterState, "pages">>) => {
      const next: FilterState = { ...state, ...partial, pages: 1 };
      setSearchParams(filterStateToParams(next), { replace: false });
    },
    [state, setSearchParams],
  );

  const setPages = useCallback(
    (pages: number) => {
      const next: FilterState = { ...state, pages };
      setSearchParams(filterStateToParams(next), { replace: true });
    },
    [state, setSearchParams],
  );

  return { state, setFilters, setPages };
};
