import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchPokemonPage } from "../api/pokemon";
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
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  retry: () => void;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Something went wrong";

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
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  useEffect(() => {
    targetRef.current = restoreToPage;
    reportedRef.current = false;
    // Deliberately scoped to filtersKey only: restoreToPage grows because of
    // our own onPagesChange calls and must not re-arm the restore target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  useEffect(() => {
    if (loadedPages === 0) return;
    if (loadedPages < targetRef.current && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
      return;
    }
    if (!reportedRef.current || loadedPages > targetRef.current) {
      reportedRef.current = true;
      targetRef.current = loadedPages;
      onPagesChange(loadedPages);
    }
  }, [loadedPages, hasNextPage, isFetchingNextPage, fetchNextPage, onPagesChange]);

  return {
    items: query.data?.pages.flatMap((page) => page.items) ?? [],
    isLoading: query.isPending,
    isFetchingNextPage: query.isFetchingNextPage,
    error: query.isError ? errorMessage(query.error) : null,
    hasMore: query.hasNextPage ?? false,
    loadMore: () => {
      void query.fetchNextPage();
    },
    retry: () => {
      void query.refetch();
    },
  };
};
