import { memo } from "react";
import { keyframes } from "@emotion/react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { CaptureButton } from "./CaptureButton";
import { PokemonSprite } from "./PokemonSprite";
import { PokemonStats } from "./PokemonStats";
import type { Pokemon } from "../../types";
import { typeColor, typeGradient } from "../../utils/typeColors";

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

export const PokemonCard = memo(
  ({
    pokemon,
    captured,
    onToggleCapture,
    captureLoading,
  }: {
    pokemon: Pokemon;
    captured: boolean;
    onToggleCapture: (pokemon: Pokemon, captured: boolean) => void;
    captureLoading?: boolean;
  }) => {
    const types = [pokemon.type_one, pokemon.type_two].filter(Boolean);
    const frame = pokemon.legendary
      ? "conic-gradient(from 0deg, #FFD700, #FFF8DC, #FFD700, #B8860B, #FFD700)"
      : typeGradient(types);
    const glow = typeColor(types[0] ?? "");

    return (
      <Box
        sx={{
          position: "relative",
          height: "100%",
          borderRadius: "20px",
          overflow: "hidden",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
          "&:hover": {
            transform: "translateY(-3px)",
            boxShadow: "0 14px 12px -10px rgba(0,0,0,0.4)",
          },
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: pokemon.legendary ? "-60%" : 0,
            background: frame,
            animation: pokemon.legendary
              ? `${spin} 3.5s linear infinite`
              : undefined,
          }}
        />
        <Card
          sx={{
            position: "relative",
            zIndex: 1,
            m: "3px",
            height: "calc(100% - 6px)",
            borderRadius: "17px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 1.5,
              py: 0.75,
              background: typeGradient(types),
            }}
          >
            <Typography
              component="h3"
              sx={{
                fontFamily: "'Baloo 2', sans-serif",
                fontWeight: 700,
                fontSize: "1.05rem",
                color: "#fff",
                textShadow: "0 1px 3px rgba(0,0,0,0.45)",
                lineHeight: 1.2,
              }}
            >
              {pokemon.name}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontFamily: "'Baloo 2', sans-serif",
                fontWeight: 600,
                color: "#fff",
                bgcolor: "rgba(0,0,0,0.28)",
                px: 0.75,
                py: 0.25,
                borderRadius: "8px",
              }}
            >
              #{String(pokemon.number).padStart(3, "0")}
            </Typography>
          </Box>

          <Box sx={{ position: "relative" }}>
            <PokemonSprite name={pokemon.name} glow={glow} />
            <CaptureButton
              name={pokemon.name}
              captured={captured}
              loading={captureLoading}
              onToggle={() => onToggleCapture(pokemon, captured)}
            />
          </Box>

          <Stack sx={{ flexGrow: 1, px: 1.5, py: 1.25 }} spacing={1}>
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }}>
              {types.map((type) => (
                <Chip
                  key={type}
                  label={type}
                  size="small"
                  sx={{
                    bgcolor: typeColor(type),
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "0.7rem",
                    letterSpacing: 0.3,
                  }}
                />
              ))}
              {pokemon.legendary && (
                <Chip
                  label="Legendary"
                  size="small"
                  sx={{
                    bgcolor: "#B8860B",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "0.7rem",
                  }}
                />
              )}
            </Stack>

            <PokemonStats pokemon={pokemon} />
          </Stack>
        </Card>
      </Box>
    );
  },
);
