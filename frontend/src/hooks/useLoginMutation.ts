import { useMutation, useQueryClient } from "@tanstack/react-query";
import { login } from "../api/accounts";
import { getErrorMessage } from "../api/client";
import { ME_QUERY_KEY } from "./useIdentity";

export const useLoginMutation = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (identity) => {
      queryClient.setQueryData(ME_QUERY_KEY, identity);
    },
  });

  return {
    login: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error ? getErrorMessage(mutation.error) : null,
  };
};
