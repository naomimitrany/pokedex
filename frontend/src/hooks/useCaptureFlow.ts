import { useCallback, useEffect, useMemo, useState } from "react";
import { useCaptureMutation } from "./useCaptureMutation";
import { useIdentity } from "./useIdentity";
import { useLoginMutation } from "./useLoginMutation";
import type { Pokemon } from "../types";

export const useCaptureFlow = () => {
  const identity = useIdentity();
  const captureMutation = useCaptureMutation();
  const loginMutation = useLoginMutation();

  const [pendingCapture, setPendingCapture] = useState<Pokemon | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  useEffect(() => {
    if (captureMutation.isError) {
      setSnackbarMessage("Couldn't update capture. Try again.");
    }
  }, [captureMutation.isError]);

  const capturedNames = useMemo(
    () => new Set(identity.captured),
    [identity.captured],
  );

  const capturingName = captureMutation.isPending
    ? captureMutation.variables?.name
    : undefined;

  const captureMutate = captureMutation.mutate;
  const handleToggleCapture = useCallback(
    (pokemon: Pokemon, captured: boolean) => {
      if (!identity.username) {
        setPendingCapture(pokemon);
        return;
      }
      captureMutate({ name: pokemon.name, captured });
    },
    [identity.username, captureMutate],
  );

  const handleLoginSubmit = useCallback(
    async (username: string) => {
      await loginMutation.login(username);
      setPendingCapture((current) => {
        if (current) {
          // pendingCapture only ever arises from a capture click on an
          // anonymous (therefore always-uncaptured) card.
          captureMutation.mutate({ name: current.name, captured: false });
        }
        return null;
      });
    },
    [loginMutation, captureMutation],
  );

  return {
    capturedNames,
    capturingName,
    handleToggleCapture,
    pendingCapture,
    closePendingCapture: () => setPendingCapture(null),
    handleLoginSubmit,
    loginError: loginMutation.error,
    snackbarMessage,
    dismissSnackbar: () => setSnackbarMessage(null),
  };
};
