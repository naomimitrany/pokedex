import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "../api/accounts";
import type { Identity } from "../types";

export const ME_QUERY_KEY = ["me"] as const;

const LOGGED_OUT: Identity = { username: null, captured: [] };

export const useIdentity = (): Identity => {
  const { data } = useQuery({ queryKey: ME_QUERY_KEY, queryFn: fetchMe });
  return data ?? LOGGED_OUT;
};
