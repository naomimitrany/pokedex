import { useMemo } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { PokemonCard } from "./PokemonCard";
import { iconUrl } from "../../api/pokemon";
import type { Pokemon } from "../../types";

// Fan step per distance-from-center, capped at 3 neighbors each side --
// beyond that a card would be almost entirely transparent/off to the side
// anyway. Index 0 here is unused (the center card has its own styling
// below); indices 1-3 describe the 1st/2nd/3rd peeking neighbor.
const FAN_STEPS = [
  { rotate: 0, dy: -20, scale: 1.06, opacity: 1 },
  { rotate: 9, dy: 4, scale: 0.92, opacity: 0.8 },
  { rotate: 18, dy: 14, scale: 0.8, opacity: 0.55 },
  { rotate: 28, dy: 30, scale: 0.68, opacity: 0.35 },
];
const FAN_SPACING = 73;
const MAX_PEEK = FAN_STEPS.length - 1;

const PeekCard = ({ pokemon, offset }: { pokemon: Pokemon; offset: number }) => {
  const magnitude = Math.min(Math.abs(offset), MAX_PEEK);
  const step = FAN_STEPS[magnitude];
  const sign = Math.sign(offset);
  return (
    <Card
      sx={{
        position: "absolute",
        left: "50%",
        top: 20,
        width: 150,
        height: 210,
        borderRadius: "17px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.5,
        transition: "transform 0.2s ease, opacity 0.2s ease",
        transform: `translateX(calc(-50% + ${sign * magnitude * FAN_SPACING}px)) translateY(${step.dy}px) rotate(${sign * step.rotate}deg) scale(${step.scale})`,
        opacity: step.opacity,
        zIndex: 10 - magnitude,
      }}
    >
      <Box component="img" src={iconUrl(pokemon.name)} alt="" sx={{ width: 88, height: 88, objectFit: "contain" }} />
      <Typography variant="subtitle2" noWrap sx={{ maxWidth: "90%" }}>
        {pokemon.name}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        #{String(pokemon.number).padStart(3, "0")}
      </Typography>
    </Card>
  );
};

export const CapturedDeck = ({
  items,
  centerIndex,
  onNavigate,
  onRelease,
  releasingName,
}: {
  items: Pokemon[];
  centerIndex: number;
  onNavigate: (direction: -1 | 1) => void;
  onRelease: (pokemon: Pokemon) => void;
  releasingName?: string;
}) => {
  const center = items[centerIndex];
  const peeks = useMemo(() => {
    const result: { pokemon: Pokemon; offset: number }[] = [];
    for (let offset = -MAX_PEEK; offset <= MAX_PEEK; offset++) {
      if (offset === 0) continue;
      const pokemon = items[centerIndex + offset];
      if (pokemon) result.push({ pokemon, offset });
    }
    return result;
  }, [items, centerIndex]);

  if (!center) return null;

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ textAlign: "center", fontWeight: 600, mb: 1 }}>
        {items.length} captured
      </Typography>
      <Box sx={{ position: "relative", height: 460 }}>
        {peeks.map(({ pokemon, offset }) => (
          <PeekCard key={pokemon.name} pokemon={pokemon} offset={offset} />
        ))}
        <Box
          sx={{
            position: "absolute",
            left: "50%",
            top: 0,
            width: 260,
            height: 420,
            transition: "transform 0.2s ease",
            transform: "translateX(-50%)",
            zIndex: 10,
          }}
        >
          <PokemonCard
            pokemon={center}
            captured
            captureLoading={releasingName === center.name}
            onToggleCapture={() => onRelease(center)}
          />
        </Box>
        <IconButton
          aria-label="Previous captured Pokémon"
          disabled={centerIndex === 0}
          onClick={() => onNavigate(-1)}
          sx={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", zIndex: 20 }}
        >
          <ChevronLeftIcon />
        </IconButton>
        <IconButton
          aria-label="Next captured Pokémon"
          disabled={centerIndex === items.length - 1}
          onClick={() => onNavigate(1)}
          sx={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", zIndex: 20 }}
        >
          <ChevronRightIcon />
        </IconButton>
      </Box>
    </Box>
  );
};
