import { memo, useState } from "react";
import { keyframes } from "@emotion/react";
import { alpha } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardMedia from "@mui/material/CardMedia";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CatchingPokemonIcon from "@mui/icons-material/CatchingPokemon";
import CatchingPokemonOutlinedIcon from "@mui/icons-material/CatchingPokemonOutlined";
import { iconUrl } from "../../api/pokemon";
import type { Pokemon } from "../../types";
import { typeColor, typeGradient } from "../../utils/typeColors";

export interface PokemonCardProps {
  pokemon: Pokemon;
  onToggleCapture: (pokemon: Pokemon) => void;
  captureLoading?: boolean;
}

const STATS: { key: keyof Pokemon; label: string; color: string }[] = [
  { key: "hit_points", label: "HP", color: "#FF5959" },
  { key: "attack", label: "ATK", color: "#F5AC78" },
  { key: "defense", label: "DEF", color: "#FAE078" },
  { key: "special_attack", label: "SPA", color: "#9DB7F5" },
  { key: "special_defense", label: "SPD", color: "#A7DB8D" },
  { key: "speed", label: "SPE", color: "#FA92B2" },
];

const STAT_MAX = 200;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min(100, (value / STAT_MAX) * 100);
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Typography
        variant="caption"
        sx={{ width: 30, flexShrink: 0, fontWeight: 700, color: "text.secondary" }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          flexGrow: 1,
          height: 7,
          borderRadius: 4,
          bgcolor: alpha(color, 0.18),
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 4,
            bgcolor: color,
            transition: "width 0.6s ease",
          }}
        />
      </Box>
      <Typography
        variant="caption"
        sx={{
          width: 26,
          flexShrink: 0,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          color: "text.secondary",
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

export const PokemonCard = memo(function PokemonCard({
  pokemon,
  onToggleCapture,
  captureLoading,
}: PokemonCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageErrored, setImageErrored] = useState(false);
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
          animation: pokemon.legendary ? `${spin} 3.5s linear infinite` : undefined,
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

        <Box
          sx={{
            position: "relative",
            height: 140,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `radial-gradient(circle at 50% 38%, ${alpha(glow, 0.3)} 0%, transparent 68%)`,
            bgcolor: "background.default",
          }}
        >
          {imageLoaded && (
            <Box
              sx={{
                position: "absolute",
                bottom: 16,
                width: "46%",
                height: 8,
                borderRadius: "50%",
                bgcolor: "rgba(120,120,120,0.35)",
              }}
            />
          )}
          <Box sx={{ position: "relative", height: 108, width: 108 }}>
            {!imageLoaded && !imageErrored && (
              <Skeleton
                variant="circular"
                width={108}
                height={108}
                sx={{ position: "absolute", inset: 0 }}
              />
            )}
            <CardMedia
              component="img"
              src={iconUrl(pokemon.name)}
              alt={pokemon.name}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageErrored(true)}
              sx={{
                position: "relative",
                height: 108,
                width: "auto",
                maxWidth: 108,
                mx: "auto",
                objectFit: "contain",
                filter: "drop-shadow(0 6px 6px rgba(0,0,0,0.25))",
                opacity: imageLoaded || imageErrored ? 1 : 0,
                transition: "opacity 0.3s ease",
              }}
            />
          </Box>
          <Tooltip title={pokemon.captured ? "Release" : "Capture"} arrow>
            <IconButton
              aria-label={`${pokemon.captured ? "Release" : "Capture"} ${pokemon.name}`}
              disabled={captureLoading}
              onClick={() => onToggleCapture(pokemon)}
              sx={{
                position: "absolute",
                top: 6,
                right: 6,
                bgcolor: "background.paper",
                boxShadow: 2,
                border: "2px solid",
                borderColor: pokemon.captured ? "#EE1515" : "divider",
                "&:hover": { bgcolor: "background.paper" },
              }}
              size="small"
            >
              {pokemon.captured ? (
                <CatchingPokemonIcon fontSize="small" sx={{ color: "#EE1515" }} />
              ) : (
                <CatchingPokemonOutlinedIcon fontSize="small" sx={{ color: "text.disabled" }} />
              )}
            </IconButton>
          </Tooltip>
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

          <Stack spacing={0.5} sx={{ mt: 0.5 }}>
            {STATS.map(({ key, label, color }) => (
              <StatBar key={label} label={label} value={pokemon[key] as number} color={color} />
            ))}
          </Stack>
        </Stack>
      </Card>
    </Box>
  );
});
