import { useQuery } from "@tanstack/react-query";
import { fetchCaptures } from "../api/accounts";
import { getErrorMessage } from "../api/client";
import { useIdentity } from "./useIdentity";

export const CAPTURES_QUERY_KEY = ["captures"] as const;

export const useCapturedPokemon = () => {
  const identity = useIdentity();
  const query = useQuery({
    queryKey: CAPTURES_QUERY_KEY,
    queryFn: fetchCaptures,
    enabled: !!identity.username,
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
