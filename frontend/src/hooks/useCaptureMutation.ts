import { useMutation, useQueryClient } from "@tanstack/react-query";
import { capturePokemon, releasePokemon } from "../api/accounts";
import { ME_QUERY_KEY } from "./useIdentity";
import type { Identity } from "../types";

export const useCaptureMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, captured }: { name: string; captured: boolean }) =>
      captured ? releasePokemon(name) : capturePokemon(name),
    onMutate: async ({ name, captured }) => {
      await queryClient.cancelQueries({ queryKey: ME_QUERY_KEY });
      const previous = queryClient.getQueryData<Identity>(ME_QUERY_KEY);
      queryClient.setQueryData<Identity>(ME_QUERY_KEY, (current) => {
        const base = current ?? { username: null, captured: [] };
        return {
          ...base,
          captured: captured
            ? base.captured.filter((n) => n !== name)
            : [...base.captured, name],
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(ME_QUERY_KEY, context.previous);
    },
    onSuccess: (result) => {
      queryClient.setQueryData<Identity>(ME_QUERY_KEY, (current) => {
        const base = current ?? { username: null, captured: [] };
        const withoutName = base.captured.filter((n) => n !== result.name);
        return { ...base, captured: result.captured ? [...withoutName, result.name] : withoutName };
      });
    },
  });
};
