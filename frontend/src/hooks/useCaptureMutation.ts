import { useMutation, useQueryClient } from "@tanstack/react-query";
import { capturePokemon, releasePokemon } from "../api/accounts";
import { ME_QUERY_KEY } from "./useIdentity";
import { CAPTURES_QUERY_KEY } from "./useCapturedPokemon";
import type { Identity, Pokemon } from "../types";

type CaptureVariables = { pokemon: Pokemon; captured: boolean };

export const useCaptureMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ pokemon, captured }: CaptureVariables) =>
      captured ? releasePokemon(pokemon.name) : capturePokemon(pokemon.name),
    onMutate: async ({ pokemon, captured }: CaptureVariables) => {
      await queryClient.cancelQueries({ queryKey: ME_QUERY_KEY });
      await queryClient.cancelQueries({ queryKey: CAPTURES_QUERY_KEY });

      const previousMe = queryClient.getQueryData<Identity>(ME_QUERY_KEY);
      queryClient.setQueryData<Identity>(ME_QUERY_KEY, (current) => {
        const base = current ?? { username: null, captured: [] };
        return {
          ...base,
          captured: captured
            ? base.captured.filter((n) => n !== pokemon.name)
            : [...base.captured, pokemon.name],
        };
      });

      const previousCaptures = queryClient.getQueryData<Pokemon[]>(CAPTURES_QUERY_KEY);
      queryClient.setQueryData<Pokemon[]>(CAPTURES_QUERY_KEY, (current) => {
        const base = current ?? [];
        if (captured) return base.filter((p) => p.name !== pokemon.name);
        if (base.some((p) => p.name === pokemon.name)) return base;
        return [...base, pokemon].sort((a, b) => a.number - b.number);
      });

      return { previousMe, previousCaptures };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousMe) queryClient.setQueryData(ME_QUERY_KEY, context.previousMe);
      if (context?.previousCaptures) {
        queryClient.setQueryData(CAPTURES_QUERY_KEY, context.previousCaptures);
      }
    },
    onSuccess: (result) => {
      queryClient.setQueryData<Identity>(ME_QUERY_KEY, (current) => {
        const base = current ?? { username: null, captured: [] };
        const withoutName = base.captured.filter((n) => n !== result.name);
        return { ...base, captured: result.captured ? [...withoutName, result.name] : withoutName };
      });
      queryClient.setQueryData<Pokemon[]>(CAPTURES_QUERY_KEY, (current) => {
        if (!current) return current;
        return result.captured ? current : current.filter((p) => p.name !== result.name);
      });
    },
  });
};
