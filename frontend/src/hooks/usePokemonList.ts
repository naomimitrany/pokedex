import { useCallback, useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchPokemonPage } from "../api/pokemon";
import { getErrorMessage } from "../api/client";
import type { Pokemon, SortField, SortOrder } from "../types";

export type PokemonListFilters = {
  pageSize: number;
  sortBy: SortField;
  order: SortOrder;
  type: string | null;
  q: string;
};

export type UsePokemonListArgs = {
  filters: PokemonListFilters;
  restoreToPage: number;
};

export type UsePokemonListResult = {
  items: Pokemon[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  isRestoring: boolean;
  loadedPages: number;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  retry: () => void;
};

export const usePokemonList = ({
  filters,
  restoreToPage,
}: UsePokemonListArgs): UsePokemonListResult => {
  const filtersKey = JSON.stringify(filters);
  // Frozen per query (reset only when `filtersKey` changes) so it reflects
  // whatever was true when this query started rather than whatever
  // `restoreToPage` happens to evaluate to on some later, unrelated
  // re-render. Only consulted by the very first (pageParam 1) fetch of a
  // query, which asks the backend for pages 1..restoreToPage in a single
  // request instead of walking fetchNextPage restoreToPage times.
  const targetRef = useRef(restoreToPage);

  useEffect(() => {
    targetRef.current = restoreToPage;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  const query = useInfiniteQuery({
    queryKey: ["pokemon", filters],
    queryFn: ({ pageParam }) =>
      fetchPokemonPage({
        ...filters,
        page: pageParam,
        toPage:
          pageParam === 1 && targetRef.current > 1
            ? targetRef.current
            : undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,
    // Matches the backend's snapshot cache TTL (pokemon_service.py's
    // ttl_seconds=500) -- the server can't return different data any sooner
    // than that, so treating cached pages as fresh for less time than this
    // only buys pointless refetches (e.g. every list<->detail navigation
    // re-fetching every already-loaded page) with no chance of new data.
    staleTime: 500_000,
  });

  // The last page's own `page` field, not the pages-array length: a
  // collapsed restore fetch is one array entry but represents several pages.
  const loadedPages = query.data?.pages.at(-1)?.page ?? 0;
  const { isFetchingNextPage, fetchNextPage, refetch } = query;

  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  const loadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    items,
    isLoading: query.isPending,
    isFetchingNextPage,
    // isPending only holds during a query's very first fetch, which is
    // exactly the (now single) restore request when targeting page > 1.
    isRestoring: query.isPending && targetRef.current > 1,
    loadedPages,
    error: query.isError ? getErrorMessage(query.error) : null,
    hasMore: query.hasNextPage ?? false,
    loadMore,
    retry,
  };
};
