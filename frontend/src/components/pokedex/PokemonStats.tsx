import { memo } from "react";
import { alpha } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Pokemon } from "../../types";

const STATS: { key: keyof Pokemon; label: string; color: string }[] = [
  { key: "hit_points", label: "HP", color: "#FF5959" },
  { key: "attack", label: "ATK", color: "#F5AC78" },
  { key: "defense", label: "DEF", color: "#FAE078" },
  { key: "special_attack", label: "SPA", color: "#9DB7F5" },
  { key: "special_defense", label: "SPD", color: "#A7DB8D" },
  { key: "speed", label: "SPE", color: "#FA92B2" },
];

const STAT_MAX: Record<string, number> = {
  hit_points: 300,
  attack: 200,
  defense: 300,
  special_attack: 200,
  special_defense: 300,
  speed: 200,
};

const StatBar = memo(
  ({
    label,
    value,
    color,
    max,
  }: {
    label: string;
    value: number;
    color: string;
    max: number;
  }) => {
    const pct = Math.min(100, (value / max) * 100);
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Typography
          variant="caption"
          sx={{
            width: 30,
            flexShrink: 0,
            fontWeight: 700,
            color: "text.secondary",
          }}
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
  },
);

export const PokemonStats = memo(({ pokemon }: { pokemon: Pokemon }) => (
  <Stack spacing={0.5} sx={{ mt: 0.5 }}>
    {STATS.map(({ key, label, color }) => (
      <StatBar
        key={label}
        label={label}
        value={pokemon[key] as number}
        color={color}
        max={STAT_MAX[key]}
      />
    ))}
  </Stack>
));
