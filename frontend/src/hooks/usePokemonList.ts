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
  onPagesChange: (pages: number) => void;
};

export type UsePokemonListResult = {
  items: Pokemon[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  isRestoring: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  retry: () => void;
};

export const usePokemonList = ({
  filters,
  restoreToPage,
  onPagesChange,
}: UsePokemonListArgs): UsePokemonListResult => {
  const filtersKey = JSON.stringify(filters);
  // Frozen per query (reset only when `filtersKey` changes), so our own
  // onPagesChange calls below don't feed back into how far we "should" restore.
  const targetRef = useRef(restoreToPage);
  const reportedRef = useRef(false);

  const query = useInfiniteQuery({
    queryKey: ["pokemon", filters],
    queryFn: ({ pageParam }) => fetchPokemonPage({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,
  });

  const loadedPages = query.data?.pages.length ?? 0;
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, refetch } = query;

  useEffect(() => {
    targetRef.current = restoreToPage;
    reportedRef.current = false;
    // Deliberately scoped to filtersKey only: restoreToPage grows because of
    // our own onPagesChange calls and must not re-arm the restore target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  useEffect(() => {
    if (loadedPages === 0) return;
    // A failed restore fetch must not be retried on every render (mirrors how
    // the scroll-triggered fetch in PokemonGrid bails out on `error` instead
    // of looping). Leave the target untouched — a later successful retry()
    // should resume the restore, not treat the failure as the new target.
    if (isFetchNextPageError) return;
    if (loadedPages < targetRef.current && hasNextPage) {
      if (!isFetchingNextPage) void fetchNextPage();
      return;
    }
    if (!reportedRef.current || loadedPages > targetRef.current) {
      reportedRef.current = true;
      targetRef.current = loadedPages;
      onPagesChange(loadedPages);
    }
  }, [
    loadedPages,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
    onPagesChange,
  ]);

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
    isFetchingNextPage: query.isFetchingNextPage,
    isRestoring: loadedPages > 0 && loadedPages < targetRef.current && !isFetchNextPageError,
    error: query.isError ? getErrorMessage(query.error) : null,
    hasMore: query.hasNextPage ?? false,
    loadMore,
    retry,
  };
};
