import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { getErrorMessage } from "../api/client";
import { fetchPokemonDetail } from "../api/pokemon";
import type { Pokemon } from "../types";

export const usePokemonDetail = (name: string) => {
  const location = useLocation();
  const stateData = (location.state as { pokemon?: Pokemon } | null)?.pokemon;
  // Only trust router state when it's actually for this route's name --
  // otherwise a stale Link click followed by editing the URL bar would show
  // the wrong Pokemon until the background refetch lands.
  const initialData =
    stateData && stateData.name.toLowerCase() === name.toLowerCase()
      ? stateData
      : undefined;

  const query = useQuery({
    queryKey: ["pokemonDetail", name.toLowerCase()],
    queryFn: () => fetchPokemonDetail(name),
    initialData,
    // Without a staleTime, initialData (the record we already have from the
    // list, passed via router state) is treated as stale the instant it's
    // set, so refetchOnMount fires anyway -- defeating the point of passing
    // it. Matches the list query's staleTime (usePokemonList.ts), which is
    // itself bounded by the backend's snapshot cache TTL.
    staleTime: 500_000,
  });

  const notFound =
    query.isError &&
    axios.isAxiosError(query.error) &&
    query.error.response?.status === 404;

  return {
    pokemon: query.data,
    isLoading: query.isPending,
    isError: query.isError,
    notFound,
    errorMessage: query.isError ? getErrorMessage(query.error) : null,
    retry: () => void query.refetch(),
  };
};
