import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import type { SortField, SortOrder } from "../types";
import {
  ALLOWED_PAGE_SIZES,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT_FIELD,
  SORT_FIELDS,
} from "../constants";

export type FilterState = {
  pageSize: number;
  sortBy: SortField;
  order: SortOrder;
  type: string | null;
  q: string;
};

const SORT_FIELD_SET = new Set(SORT_FIELDS.map((f) => f.value));

const parsePageSize = (raw: string | null): number => {
  const n = Number(raw);
  return (ALLOWED_PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
};

const parseSortBy = (raw: string | null): SortField =>
  raw && SORT_FIELD_SET.has(raw as SortField) ? (raw as SortField) : DEFAULT_SORT_FIELD;

const parseOrder = (raw: string | null): SortOrder => (raw === "desc" ? "desc" : "asc");

export const parseFilterState = (params: URLSearchParams): FilterState => ({
  pageSize: parsePageSize(params.get("page_size")),
  sortBy: parseSortBy(params.get("sort_by")),
  order: parseOrder(params.get("order")),
  type: params.get("type") || null,
  q: params.get("q") || "",
});

export const filterStateToParams = (state: FilterState): URLSearchParams => {
  const params = new URLSearchParams();
  params.set("page_size", String(state.pageSize));
  params.set("sort_by", state.sortBy);
  params.set("order", state.order);
  if (state.type) params.set("type", state.type);
  if (state.q) params.set("q", state.q);
  return params;
};

export const useUrlState = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(() => parseFilterState(searchParams), [searchParams]);

  // Mirrors the latest FilterState, updated synchronously inside
  // setFilters (not just via the effect below). react-router's
  // setSearchParams closes over the params from the last *render*, so two
  // calls issued back-to-back before a re-render would otherwise each
  // build on the same stale snapshot and the second call's navigate()
  // would silently overwrite the first's change.
  const latestRef = useRef(state);
  useEffect(() => {
    latestRef.current = state;
  }, [state]);

  useEffect(() => {
    const canonical = filterStateToParams(state).toString();
    if (canonical !== searchParams.toString()) {
      setSearchParams(filterStateToParams(state), { replace: true });
    }
  }, [state, searchParams, setSearchParams]);

  const setFilters = useCallback(
    (partial: Partial<FilterState>) => {
      const next: FilterState = { ...latestRef.current, ...partial };
      latestRef.current = next;
      setSearchParams(filterStateToParams(next), { replace: false });
    },
    [setSearchParams],
  );

  return { state, setFilters };
};
