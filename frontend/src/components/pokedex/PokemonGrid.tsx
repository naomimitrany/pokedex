import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import { EmptyState } from "../general/EmptyState";
import { ErrorState } from "../general/ErrorState";
import { PokemonCard } from "./PokemonCard";
import { PokemonCardSkeleton } from "./PokemonCardSkeleton";
import type { Pokemon } from "../../types";

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
}) => {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isLoading || isFetchingNextPage || error || !hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
    });
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
        {items.map((pokemon) => (
          <Grid key={pokemon.name} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
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
