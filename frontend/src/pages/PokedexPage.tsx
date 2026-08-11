import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Container from "@mui/material/Container";
import Snackbar from "@mui/material/Snackbar";
import { FilterBar } from "../components/pokedex/FilterBar";
import { LoginPrompt } from "../components/pokedex/LoginPrompt";
import { PokemonGrid } from "../components/pokedex/PokemonGrid";
import { useCaptureMutation } from "../hooks/useCaptureMutation";
import { useIdentity } from "../hooks/useIdentity";
import { useLoginMutation } from "../hooks/useLoginMutation";
import { usePokemonList } from "../hooks/usePokemonList";
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

  const [pendingCapture, setPendingCapture] = useState<Pokemon | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  useEffect(() => {
    if (captureMutation.isError) {
      setSnackbarMessage("Couldn't update capture. Try again.");
    }
  }, [captureMutation.isError]);

  const mergedItems = list.items.map((pokemon) => ({
    ...pokemon,
    captured: identity.captured.includes(pokemon.name),
  }));

  const handleToggleCapture = (pokemon: Pokemon) => {
    if (!identity.username) {
      setPendingCapture(pokemon);
      return;
    }
    captureMutation.mutate({ name: pokemon.name, captured: pokemon.captured });
  };

  const handleLoginSubmit = async (username: string) => {
    await loginMutation.login(username);
    setPendingCapture((current) => {
      if (current) {
        captureMutation.mutate({ name: current.name, captured: current.captured });
      }
      return null;
    });
  };

  return (
    <>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <FilterBar types={types} filters={filters} onChange={setFilters} />
        <PokemonGrid
          items={mergedItems}
          isLoading={list.isLoading}
          isFetchingNextPage={list.isFetchingNextPage}
          error={list.error}
          hasMore={list.hasMore}
          onLoadMore={list.loadMore}
          onRetry={list.retry}
          onToggleCapture={handleToggleCapture}
          pageSize={filters.pageSize}
        />
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
