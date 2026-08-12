import { useEffect, useMemo } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Snackbar from "@mui/material/Snackbar";
import { FilterBar } from "../components/pokedex/FilterBar";
import { LoginPrompt } from "../components/pokedex/LoginPrompt";
import { PokemonCardSkeleton } from "../components/pokedex/PokemonCardSkeleton";
import { PokemonGrid } from "../components/pokedex/PokemonGrid";
import { useCaptureFlow } from "../hooks/useCaptureFlow";
import { usePokemonList } from "../hooks/usePokemonList";
import {
  getSavedScrollEntry,
  useScrollRestoration,
} from "../hooks/useScrollRestoration";
import { useTypes } from "../hooks/useTypes";
import { useUrlState } from "../hooks/useUrlState";
import { buildScrollKey } from "../utils/scrollKey";

export const PokedexPage = () => {
  const { state: filters, setFilters } = useUrlState();
  const types = useTypes();
  const captureFlow = useCaptureFlow();

  const scrollKey = useMemo(
    () => buildScrollKey(filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters.pageSize, filters.sortBy, filters.order, filters.type, filters.q],
  );

  // sessionStorage is the only source of restore depth now -- a fresh tab
  // with nothing saved for this key just starts at page 1.
  const restoreToPage = useMemo(
    () => getSavedScrollEntry(scrollKey)?.pages ?? 1,
    [scrollKey],
  );

  const list = usePokemonList({
    filters: {
      pageSize: filters.pageSize,
      sortBy: filters.sortBy,
      order: filters.order,
      type: filters.type,
      q: filters.q,
    },
    restoreToPage,
  });

  useEffect(() => {
    // Unlike page_size/sort_by/order, `type` can't be sanitized in
    // useUrlState alone — the set of valid values only exists once /types
    // has loaded. A stale bookmark or hand-edited URL naming an unknown type
    // would otherwise 400 forever: it's not a network flake, so the existing
    // "Retry" button would just resend the same bad request.
    if (!filters.type || types.length === 0) return;
    const isKnownType = types.some(
      (t) => t.toLowerCase() === filters.type!.toLowerCase(),
    );
    if (!isKnownType) setFilters({ type: null });
  }, [filters.type, types, setFilters]);

  const scrollRestored = useScrollRestoration(
    scrollKey,
    // A failed fetch also clears isLoading/isRestoring, but there's nothing
    // to scroll to yet -- gate on `!error` too so a failed restore doesn't
    // consume the one-shot restore against an empty error view, leaving a
    // later successful retry with no saved position left to apply.
    !list.isLoading && !list.isRestoring && !list.error,
    list.loadedPages,
    filters.pageSize,
  );

  // How many cards from the initial restore fetch should stay exempt from
  // content-visibility -- see the comment on PokemonGrid's `restoredCount`
  // prop. 0 when there was nothing to restore, so an ordinary load (no
  // saved position) is unaffected.
  const restoredCount =
    restoreToPage > 1 ? restoreToPage * filters.pageSize : 0;

  return (
    <>
      <Container
        maxWidth="lg"
        sx={{
          py: 3,
          minHeight: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <FilterBar types={types} filters={filters} onChange={setFilters} />
        {list.isRestoring && !scrollRestored ? (
          <Grid container spacing={2}>
            {Array.from({ length: filters.pageSize }, (_, i) => (
              <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <PokemonCardSkeleton />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              // An error has no saved position to jump to, so it's exempt
              // from the "stay hidden until scroll is restored" gate --
              // otherwise the error message (and its Retry button) would be
              // invisible for as long as `ready` withholds the restore.
              visibility: scrollRestored || list.error ? "visible" : "hidden",
            }}
          >
            <PokemonGrid
              items={list.items}
              capturedNames={captureFlow.capturedNames}
              capturingName={captureFlow.capturingName}
              isLoading={list.isLoading}
              isFetchingNextPage={list.isFetchingNextPage}
              error={list.error}
              hasMore={list.hasMore}
              onLoadMore={list.loadMore}
              onRetry={list.retry}
              onToggleCapture={captureFlow.handleToggleCapture}
              pageSize={filters.pageSize}
              restoredCount={restoredCount}
            />
          </Box>
        )}
      </Container>
      <LoginPrompt
        open={captureFlow.pendingCapture !== null}
        onClose={captureFlow.closePendingCapture}
        onSubmit={captureFlow.handleLoginSubmit}
        error={captureFlow.loginError}
      />
      <Snackbar
        open={captureFlow.snackbarMessage !== null}
        autoHideDuration={4000}
        onClose={captureFlow.dismissSnackbar}
      >
        <Alert severity="error" onClose={captureFlow.dismissSnackbar}>
          {captureFlow.snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
};
