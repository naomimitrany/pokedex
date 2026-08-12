import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "../api/accounts";
import type { Identity } from "../types";

export const ME_QUERY_KEY = ["me"] as const;

const LOGGED_OUT: Identity = { username: null, captured: [] };

export const useIdentity = (): Identity => {
  // staleTime: Infinity avoids a refetch every time a component mounts a new
  // observer for this query (e.g. navigating list <-> detail page) -- the
  // capture mutation already keeps this cache in sync via setQueryData.
  const { data } = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: fetchMe,
    staleTime: Infinity,
  });
  return data ?? LOGGED_OUT;
};
