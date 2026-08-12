import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Snackbar from "@mui/material/Snackbar";
import { BackButton } from "../components/general/BackButton";
import { CapturedDeck } from "../components/pokedex/CapturedDeck";
import { EmptyState } from "../components/general/EmptyState";
import { ErrorState } from "../components/general/ErrorState";
import { PokemonCardSkeleton } from "../components/pokedex/PokemonCardSkeleton";
import { fetchMe } from "../api/accounts";
import { useCaptureMutation } from "../hooks/useCaptureMutation";
import { useCapturedPokemon } from "../hooks/useCapturedPokemon";
import { useIdentity, ME_QUERY_KEY } from "../hooks/useIdentity";
import type { Pokemon } from "../types";

export const CapturedPage = () => {
  const identity = useIdentity();
  // useIdentity() collapses "still loading" and "confirmed logged out" into
  // the same { username: null } shape, which isn't enough to gate the
  // redirect below: firing <Navigate> while /me is still in flight would
  // replace the URL (wiping ?card=) before we actually know the user is
  // logged in. Reading the same ["me"] query directly (single-flight with
  // useIdentity's own subscription, no extra request) lets us tell "unknown
  // yet" apart from "logged out" and hold off the redirect until it settles.
  // staleTime here must match useIdentity's own (Infinity) -- it's the same
  // cache entry, and without it this second observer would refetch on every
  // mount regardless of that hook's own setting.
  const identityQuery = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: fetchMe,
    staleTime: Infinity,
  });
  const captured = useCapturedPokemon();
  const captureMutation = useCaptureMutation();
  const [searchParams, setSearchParams] = useSearchParams();
  const lastIndexRef = useRef(0);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  useEffect(() => {
    if (captureMutation.isError) {
      setSnackbarMessage("Couldn't update capture. Try again.");
    }
  }, [captureMutation.isError]);

  const items = captured.data ?? [];
  const requestedName = searchParams.get("card");
  const requestedIndex = requestedName
    ? items.findIndex((p) => p.name === requestedName)
    : -1;
  const centerIndex =
    requestedIndex >= 0
      ? requestedIndex
      : Math.min(lastIndexRef.current, Math.max(items.length - 1, 0));

  useEffect(() => {
    lastIndexRef.current = centerIndex;
  }, [centerIndex]);

  // Keeps the URL naming the actually-centered card: covers the very first
  // visit (no `?card` yet), a stale/foreign name, and -- since releasing
  // shifts `items` under the same numeric index -- the "next card slides
  // into center" behavior after a release, all through one self-healing
  // effect. Mirrors the canonicalization effect in useUrlState.ts.
  useEffect(() => {
    const current = items[centerIndex];
    if (current && searchParams.get("card") !== current.name) {
      setSearchParams({ card: current.name }, { replace: true });
    }
  }, [items, centerIndex, searchParams, setSearchParams]);

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, items.length - 1));
      const pokemon = items[clamped];
      if (pokemon) setSearchParams({ card: pokemon.name }, { replace: false });
    },
    [items, setSearchParams],
  );

  const handleNavigate = (direction: -1 | 1) => goTo(centerIndex + direction);
  const handleRelease = (pokemon: Pokemon) =>
    captureMutation.mutate({ pokemon, captured: true });

  if (identityQuery.isLoading) return null;
  if (!identity.username) return <Navigate to="/" replace />;

  return (
    <>
      <BackButton to="/" />
      <Container maxWidth="md" sx={{ py: 3 }}>
        {captured.isLoading ? (
          <Grid container spacing={2} sx={{ justifyContent: "center" }}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <PokemonCardSkeleton />
            </Grid>
          </Grid>
        ) : captured.error ? (
          <ErrorState message={captured.error} onRetry={captured.retry} />
        ) : items.length === 0 ? (
          <Box sx={{ textAlign: "center" }}>
            <EmptyState
              title="Your bag is empty"
              description="Capture some Pokémon to see them here."
            />
          </Box>
        ) : (
          <CapturedDeck
            items={items}
            centerIndex={centerIndex}
            onNavigate={handleNavigate}
            onRelease={handleRelease}
            releasingName={
              captureMutation.isPending
                ? captureMutation.variables?.pokemon.name
                : undefined
            }
          />
        )}
      </Container>
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
