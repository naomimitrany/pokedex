import { Link, useNavigate, useParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Skeleton from "@mui/material/Skeleton";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { CaptureButton } from "../components/pokedex/CaptureButton";
import { LoginPrompt } from "../components/pokedex/LoginPrompt";
import { PokemonSprite } from "../components/pokedex/PokemonSprite";
import { PokemonStats } from "../components/pokedex/PokemonStats";
import { ErrorState } from "../components/general/ErrorState";
import { useCaptureFlow } from "../hooks/useCaptureFlow";
import { usePokemonDetail } from "../hooks/usePokemonDetail";
import { typeColor, typeGradient } from "../utils/typeColors";

export const PokemonDetailPage = () => {
  const { name = "" } = useParams();
  const navigate = useNavigate();
  const detail = usePokemonDetail(name);
  const captureFlow = useCaptureFlow();

  if (detail.isLoading) {
    return (
      <Container
        maxWidth="sm"
        sx={{ py: 3 }}
        data-testid="pokemon-detail-skeleton"
      >
        <Skeleton variant="text" width={80} height={32} sx={{ mb: 2 }} />
        <Skeleton
          variant="rounded"
          height={260}
          sx={{ borderRadius: "24px", mb: 3 }}
        />
        <Skeleton variant="rounded" height={180} sx={{ borderRadius: 2 }} />
      </Container>
    );
  }

  if (detail.notFound) {
    return (
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Alert severity="warning">No Pokémon named "{name}".</Alert>
        <Button component={Link} to="/" sx={{ mt: 2 }}>
          Back to Pokédex
        </Button>
      </Container>
    );
  }

  if (detail.isError || !detail.pokemon) {
    return (
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <ErrorState
          message={detail.errorMessage ?? "Something went wrong"}
          onRetry={detail.retry}
        />
      </Container>
    );
  }

  const pokemon = detail.pokemon;
  const types = [pokemon.type_one, pokemon.type_two].filter(Boolean);
  const captured = captureFlow.capturedNames.has(pokemon.name);

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(-1)}
        sx={{ mb: 2, textTransform: "none" }}
      >
        Back
      </Button>

      <Box
        sx={{
          position: "relative",
          borderRadius: "24px",
          overflow: "hidden",
          background: typeGradient(types),
          p: 3,
          textAlign: "center",
        }}
      >
        <CaptureButton
          name={pokemon.name}
          captured={captured}
          loading={pokemon.name === captureFlow.capturingName}
          onToggle={() => captureFlow.handleToggleCapture(pokemon, captured)}
        />
        <PokemonSprite name={pokemon.name} glow={typeColor(types[0] ?? "")} />
        <Typography
          component="h1"
          sx={{
            fontFamily: "'Baloo 2', sans-serif",
            fontWeight: 700,
            fontSize: "2rem",
            color: "#fff",
            textShadow: "0 1px 3px rgba(0,0,0,0.45)",
          }}
        >
          {pokemon.name}
        </Typography>
        <Typography
          variant="subtitle1"
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
              sx={{ bgcolor: typeColor(type), color: "#fff", fontWeight: 700 }}
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

      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Base stats
        </Typography>
        <PokemonStats pokemon={pokemon} />
      </Box>

      <Stack direction="row" spacing={4} sx={{ mt: 3 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Total
          </Typography>
          <Typography variant="h6">{pokemon.total}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Generation
          </Typography>
          <Typography variant="h6">{pokemon.generation}</Typography>
        </Box>
      </Stack>

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
    </Container>
  );
};
