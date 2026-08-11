import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CatchingPokemonIcon from "@mui/icons-material/CatchingPokemon";
import CatchingPokemonOutlinedIcon from "@mui/icons-material/CatchingPokemonOutlined";
import { iconUrl } from "../../api/pokemon";
import type { Pokemon } from "../../types";
import { typeColor } from "../../utils/typeColors";

export interface PokemonCardProps {
  pokemon: Pokemon;
  onToggleCapture: (pokemon: Pokemon) => void;
  captureLoading?: boolean;
}

export function PokemonCard({ pokemon, onToggleCapture, captureLoading }: PokemonCardProps) {
  const types = [pokemon.type_one, pokemon.type_two].filter(Boolean);

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardMedia
        component="img"
        src={iconUrl(pokemon.name)}
        alt={pokemon.name}
        sx={{ height: 140, objectFit: "contain", bgcolor: "background.default", p: 1 }}
      />
      <CardContent sx={{ flexGrow: 1 }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6" component="h3">
            {pokemon.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            #{String(pokemon.number).padStart(3, "0")}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ my: 1 }}>
          {types.map((type) => (
            <Chip
              key={type}
              label={type}
              size="small"
              sx={{ bgcolor: typeColor(type), color: "#fff", fontWeight: 600 }}
            />
          ))}
          {pokemon.legendary && <Chip label="Legendary" size="small" color="secondary" />}
        </Stack>
        <Typography variant="body2" color="text.secondary">
          HP {pokemon.hit_points} · Atk {pokemon.attack} · Def {pokemon.defense}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Sp.Atk {pokemon.special_attack} · Sp.Def {pokemon.special_defense} · Spd {pokemon.speed}
        </Typography>
        <Stack direction="row" sx={{ justifyContent: "flex-end", mt: 1 }}>
          <IconButton
            aria-label={`${pokemon.captured ? "Release" : "Capture"} ${pokemon.name}`}
            color={pokemon.captured ? "secondary" : "default"}
            disabled={captureLoading}
            onClick={() => onToggleCapture(pokemon)}
          >
            {pokemon.captured ? <CatchingPokemonIcon /> : <CatchingPokemonOutlinedIcon />}
          </IconButton>
        </Stack>
      </CardContent>
    </Card>
  );
}
