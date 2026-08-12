import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import { EmptyState } from "../general/EmptyState";
import { ErrorState } from "../general/ErrorState";
import { PokemonCard } from "./PokemonCard";
import { PokemonCardSkeleton } from "./PokemonCardSkeleton";
import type { Pokemon } from "../../types";

const getScrollParent = (el: HTMLElement): HTMLElement | null => {
  let node = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
};

export const PokemonGrid = ({
  items,
  capturedNames,
  capturingName,
  isLoading,
  isFetchingNextPage,
  error,
  hasMore,
  onLoadMore,
  onRetry,
  onToggleCapture,
  pageSize,
  restoredCount = 0,
}: {
  items: Pokemon[];
  capturedNames: Set<string>;
  capturingName?: string;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onToggleCapture: (pokemon: Pokemon, captured: boolean) => void;
  pageSize: number;
  restoredCount?: number;
}) => {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isLoading || isFetchingNextPage || error || !hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    // rootMargin only expands the *root's* bounds, and the root defaults to the
    // window viewport — but the grid scrolls inside `main` (overflowY: auto), which
    // clips the sentinel before it ever reaches the window edge. Rooting the
    // observer at that scroll container is what lets the margin have any effect.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { root: getScrollParent(node), rootMargin: "800px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isLoading, isFetchingNextPage, error, hasMore, onLoadMore]);

  if (isLoading) {
    return (
      <Grid container spacing={2}>
        {Array.from({ length: pageSize }, (_, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <PokemonCardSkeleton />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (error && items.length === 0) {
    return (
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ErrorState message={error} onRetry={onRetry} />
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <EmptyState title="Nothing here..." />
      </Box>
    );
  }

  return (
    <Box>
      <Grid container spacing={2}>
        {items.map((pokemon, index) => (
          <Grid
            key={pokemon.name}
            size={{ xs: 12, sm: 6, md: 4, lg: 3 }}
            // The first `restoredCount` cards were part of the initial
            // collapsed restore fetch (see PokedexPage's `restoredCount`
            // prop, derived from useScrollRestoration's saved page count).
            // They stay exempt from content-visibility for the life of this
            // mount -- not just until the scroll position is restored --
            // because toggling content-visibility back on right after the
            // jump lets off-screen cards *above* the restored viewport
            // collapse to their containIntrinsicSize estimate, which can
            // shift everything below them (including the viewport we just
            // landed on) by however far that estimate is from their real
            // height. Paying full layout cost once for a bounded batch
            // (capped by MAX_AUTO_RESTORE_PAGES) avoids ever fighting that
            // shift. Cards loaded afterward via ordinary infinite scroll
            // get the normal content-visibility treatment.
            sx={
              index < restoredCount
                ? undefined
                : {
                    contentVisibility: "auto",
                    containIntrinsicSize: "420px",
                  }
            }
          >
            <PokemonCard
              pokemon={pokemon}
              captured={capturedNames.has(pokemon.name)}
              onToggleCapture={onToggleCapture}
              captureLoading={pokemon.name === capturingName}
            />
          </Grid>
        ))}
        {isFetchingNextPage &&
          Array.from({ length: pageSize }, (_, i) => (
            <Grid key={`skeleton-${i}`} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <PokemonCardSkeleton />
            </Grid>
          ))}
      </Grid>

      {error && (
        <Box sx={{ mt: 2 }}>
          <ErrorState message={error} onRetry={onRetry} />
        </Box>
      )}

      {hasMore ? (
        <div
          ref={sentinelRef}
          data-testid="scroll-sentinel"
          style={{ height: 1 }}
        />
      ) : (
        <Box sx={{ textAlign: "center", py: 4 }}>
          <Typography variant="caption" color="text.secondary">
            Gotta catch 'em all!
          </Typography>
        </Box>
      )}
    </Box>
  );
};
