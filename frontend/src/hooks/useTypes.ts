import { useQuery } from "@tanstack/react-query";
import { fetchTypes } from "../api/pokemon";

export const useTypes = (): string[] => {
  const { data } = useQuery({ queryKey: ["types"], queryFn: fetchTypes, staleTime: Infinity });
  return data ?? [];
};
