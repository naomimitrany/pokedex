import { useLayoutEffect, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { keyframes } from "@emotion/react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Skeleton from "@mui/material/Skeleton";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { BackButton } from "../components/general/BackButton";
import { CaptureButton } from "../components/pokedex/CaptureButton";
import { LoginPrompt } from "../components/pokedex/LoginPrompt";
import { PokemonSprite } from "../components/pokedex/PokemonSprite";
import { PokemonStats } from "../components/pokedex/PokemonStats";
import { ErrorState } from "../components/general/ErrorState";
import { useCaptureFlow } from "../hooks/useCaptureFlow";
import { usePokemonDetail } from "../hooks/usePokemonDetail";
import { getScrollContainer } from "../utils/scrollContainer";
import { typeColor, typeGradient } from "../utils/typeColors";

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const PageShell = ({ children }: { children: ReactNode }) => (
  <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
    {children}
  </Box>
);

const ContentWrap = ({ children }: { children: ReactNode }) => (
  <Box
    sx={{
      flex: 1,
      minHeight: 0,
      width: "100%",
      maxWidth: 1100,
      mx: "auto",
      px: { xs: 2, sm: 3 },
      pb: { xs: 2, sm: 3 },
      pt: 1,
      display: "flex",
      flexDirection: "column",
      gap: 2,
    }}
  >
    {children}
  </Box>
);

const StatTile = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <Box
    sx={{
      flex: 1,
      borderRadius: "16px",
      bgcolor: (theme) =>
        theme.palette.mode === "dark"
          ? "rgba(255,255,255,0.06)"
          : "rgba(0,0,0,0.03)",
      px: 2,
      py: 1.25,
    }}
  >
    <Typography
      variant="caption"
      sx={{ color: "text.secondary", fontWeight: 600 }}
    >
      {label}
    </Typography>
    <Typography variant="h6" component="p" sx={{ fontWeight: 700 }}>
      {value}
    </Typography>
  </Box>
);

export const PokemonDetailPage = () => {
  const { name = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const detail = usePokemonDetail(name);
  const captureFlow = useCaptureFlow();
  const goBack = () =>
    location.key === "default" ? navigate("/") : navigate(-1);

  useLayoutEffect(() => {
    getScrollContainer()?.scrollTo({ top: 0 });
  }, []);

  if (detail.isLoading) {
    return (
      <PageShell>
        <BackButton onClick={goBack} />
        <ContentWrap>
          <Box
            data-testid="pokemon-detail-skeleton"
            sx={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              gap: 3,
            }}
          >
            <Skeleton
              variant="rounded"
              sx={{
                borderRadius: "28px",
                flex: { xs: "0 0 auto", md: "0 0 42%" },
                height: { xs: 280, md: "100%" },
              }}
            />
            <Skeleton
              variant="rounded"
              sx={{
                borderRadius: "28px",
                flex: 1,
                height: { xs: 320, md: "100%" },
              }}
            />
          </Box>
        </ContentWrap>
      </PageShell>
    );
  }

  // Check for loaded data before the error/not-found branches: a background
  // revalidation (e.g. refetchOnWindowFocus) can fail while `pokemon` is
  // still populated from router-state initialData or a prior successful
  // fetch. Discarding a fully-rendered page for an error view in that case
  // would throw away data the user already has.
  if (!detail.pokemon) {
    return (
      <PageShell>
        <BackButton onClick={goBack} />
        <ContentWrap>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Box sx={{ width: "100%", maxWidth: 420 }}>
              {detail.notFound ? (
                <Alert severity="warning">No Pokémon named "{name}".</Alert>
              ) : (
                <ErrorState
                  message={detail.errorMessage ?? "Something went wrong"}
                  onRetry={detail.retry}
                />
              )}
            </Box>
          </Box>
        </ContentWrap>
      </PageShell>
    );
  }

  const pokemon = detail.pokemon;
  const types = [pokemon.type_one, pokemon.type_two].filter(Boolean);
  const captured = captureFlow.capturedNames.has(pokemon.name);
  const frame = pokemon.legendary
    ? "conic-gradient(from 0deg, #FFD700, #FFF8DC, #FFD700, #B8860B, #FFD700)"
    : typeGradient(types);

  return (
    <PageShell>
      <BackButton onClick={goBack} />
      <ContentWrap>
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 3,
            overflowY: { xs: "auto", md: "visible" },
          }}
        >
          <Box
            sx={{
              position: "relative",
              flex: { xs: "0 0 auto", md: "0 0 42%" },
              minHeight: { xs: 320, md: 0 },
              borderRadius: "28px",
              overflow: "hidden",
              boxShadow: 4,
            }}
          >
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background: frame,
                animation: pokemon.legendary
                  ? `${spin} 4s linear infinite`
                  : undefined,
              }}
            />
            <Box
              sx={{
                position: "relative",
                zIndex: 1,
                m: pokemon.legendary ? "4px" : 0,
                height: pokemon.legendary ? "calc(100% - 8px)" : "100%",
                borderRadius: pokemon.legendary ? "25px" : "28px",
                background: typeGradient(types),
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                p: 3,
                textAlign: "center",
              }}
            >
              <CaptureButton
                name={pokemon.name}
                captured={captured}
                loading={pokemon.name === captureFlow.capturingName}
                onToggle={() =>
                  captureFlow.handleToggleCapture(pokemon, captured)
                }
                inset={14}
              />
              <PokemonSprite
                name={pokemon.name}
                glow={typeColor(types[0] ?? "")}
                size={200}
                background="transparent"
              />
              <Typography
                component="h2"
                sx={{
                  fontFamily: "'Baloo 2', sans-serif",
                  fontWeight: 700,
                  fontSize: "2.25rem",
                  color: "#fff",
                  textShadow: "0 1px 3px rgba(0,0,0,0.45)",
                  mt: 1,
                }}
              >
                {pokemon.name}
              </Typography>
              <Typography
                variant="subtitle1"
                component="p"
                sx={{ color: "rgba(255,255,255,0.85)", fontWeight: 600 }}
              >
                #{String(pokemon.number).padStart(3, "0")}
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                sx={{ mt: 1.5, flexWrap: "wrap", justifyContent: "center" }}
              >
                {types.map((type) => (
                  <Chip
                    key={type}
                    label={type}
                    sx={{
                      bgcolor: typeColor(type),
                      color: "#fff",
                      fontWeight: 700,
                    }}
                  />
                ))}
                {pokemon.legendary && (
                  <Chip
                    label="Legendary"
                    sx={{ bgcolor: "#B8860B", color: "#fff", fontWeight: 700 }}
                  />
                )}
              </Stack>
            </Box>
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: { xs: "auto", md: 0 },
              borderRadius: "28px",
              bgcolor: "background.paper",
              boxShadow: 2,
              p: 3,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Base stats
            </Typography>
            <Box
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <PokemonStats pokemon={pokemon} size="lg" />
            </Box>
            <Divider />
            <Stack direction="row" spacing={2}>
              <StatTile label="Total" value={pokemon.total} />
              <StatTile label="Generation" value={pokemon.generation} />
            </Stack>
          </Box>
        </Box>
      </ContentWrap>

      <LoginPrompt
        open={captureFlow.pendingCapture !== null}
        onClose={captureFlow.closePendingCapture}
        onSubmit={captureFlow.handleLoginSubmit}
        error={captureFlow.loginError}
      />
      <Snackbar
        open={captureFlow.snackbarMessage !== null}
        autoHideDuration={4000}
        onClose={captureFlow.dismissSnackbar}
      >
        <Alert severity="error" onClose={captureFlow.dismissSnackbar}>
          {captureFlow.snackbarMessage}
        </Alert>
      </Snackbar>
    </PageShell>
  );
};
