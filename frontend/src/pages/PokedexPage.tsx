import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Snackbar from "@mui/material/Snackbar";
import { FilterBar } from "../components/pokedex/FilterBar";
import { LoginPrompt } from "../components/pokedex/LoginPrompt";
import { PokemonGrid } from "../components/pokedex/PokemonGrid";
import { useCaptureMutation } from "../hooks/useCaptureMutation";
import { useIdentity } from "../hooks/useIdentity";
import { useLoginMutation } from "../hooks/useLoginMutation";
import { usePokemonList } from "../hooks/usePokemonList";
import { useScrollRestoration } from "../hooks/useScrollRestoration";
import { useTypes } from "../hooks/useTypes";
import { useUrlState } from "../hooks/useUrlState";
import type { Pokemon } from "../types";

export const PokedexPage = () => {
  const { state: filters, setFilters, setPages } = useUrlState();
  const types = useTypes();
  const identity = useIdentity();
  const captureMutation = useCaptureMutation();
  const loginMutation = useLoginMutation();

  const list = usePokemonList({
    filters: {
      pageSize: filters.pageSize,
      sortBy: filters.sortBy,
      order: filters.order,
      type: filters.type,
      q: filters.q,
    },
    restoreToPage: filters.pages,
    onPagesChange: setPages,
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

  const scrollKey = useMemo(
    () =>
      `pokedex:scroll:${filters.pageSize}:${filters.sortBy}:${filters.order}:${filters.type ?? ""}:${filters.q}`,
    [filters.pageSize, filters.sortBy, filters.order, filters.type, filters.q],
  );

  const scrollRestored = useScrollRestoration(
    scrollKey,
    !list.isLoading && !list.isRestoring,
  );

  const [pendingCapture, setPendingCapture] = useState<Pokemon | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  useEffect(() => {
    if (captureMutation.isError) {
      setSnackbarMessage("Couldn't update capture. Try again.");
    }
  }, [captureMutation.isError]);

  const capturedNames = useMemo(
    () => new Set(identity.captured),
    [identity.captured],
  );

  const capturingName = captureMutation.isPending
    ? captureMutation.variables?.name
    : undefined;

  const captureMutate = captureMutation.mutate;
  const handleToggleCapture = useCallback(
    (pokemon: Pokemon, captured: boolean) => {
      if (!identity.username) {
        setPendingCapture(pokemon);
        return;
      }
      captureMutate({ name: pokemon.name, captured });
    },
    [identity.username, captureMutate],
  );

  const handleLoginSubmit = async (username: string) => {
    await loginMutation.login(username);
    setPendingCapture((current) => {
      if (current) {
        // pendingCapture only ever arises from a capture click on an
        // anonymous (therefore always-uncaptured) card.
        captureMutation.mutate({ name: current.name, captured: false });
      }
      return null;
    });
  };

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
          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              visibility: scrollRestored ? "visible" : "hidden",
            }}
          >
            <PokemonGrid
              items={list.items}
              capturedNames={capturedNames}
              capturingName={capturingName}
              isLoading={list.isLoading}
              isFetchingNextPage={list.isFetchingNextPage}
              error={list.error}
              hasMore={list.hasMore}
              onLoadMore={list.loadMore}
              onRetry={list.retry}
              onToggleCapture={handleToggleCapture}
              pageSize={filters.pageSize}
            />
          </Box>
        )}
      </Container>
      <LoginPrompt
        open={pendingCapture !== null}
        onClose={() => setPendingCapture(null)}
        onSubmit={handleLoginSubmit}
        error={loginMutation.error}
      />
      <Snackbar
        open={snackbarMessage !== null}
        autoHideDuration={4000}
        onClose={() => setSnackbarMessage(null)}
      >
        <Alert severity="error" onClose={() => setSnackbarMessage(null)}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
};
