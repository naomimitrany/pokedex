import { useQuery } from "@tanstack/react-query";
import { fetchCaptures } from "../api/accounts";
import { getErrorMessage } from "../api/client";
import { POKEMON_CACHE_STALE_TIME_MS } from "../config";
import { useIdentity } from "./useIdentity";

export const CAPTURES_QUERY_KEY = ["captures"] as const;

export const useCapturedPokemon = () => {
  const identity = useIdentity();
  const query = useQuery({
    queryKey: CAPTURES_QUERY_KEY,
    queryFn: fetchCaptures,
    enabled: !!identity.username,
    // The capture mutation already keeps this cache in sync via
    // setQueryData, so a mount transition (e.g. back from a detail page)
    // shouldn't refetch it on its own -- same reasoning as usePokemonList.
    staleTime: POKEMON_CACHE_STALE_TIME_MS,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.isError ? getErrorMessage(query.error) : null,
    retry: () => {
      void query.refetch();
    },
  };
};
