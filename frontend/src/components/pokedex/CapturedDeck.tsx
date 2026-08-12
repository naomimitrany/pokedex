import { useMemo } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { PokemonCard } from "./PokemonCard";
import type { Pokemon } from "../../types";

// One fan step per distance from center (index 0 = the centered card
// itself). Every card in the deck -- center and peeks alike -- renders
// the same PokemonCard, keyed by name and positioned purely via
// transform/opacity, so stepping the deck slides an existing DOM node
// from one fan slot to the next (a real CSS transition) instead of
// unmounting a small "peek" element and mounting a differently-shaped
// "center" element in its place, which can't animate between them.
const FAN_STEPS = [
  { dx: 0, dy: -20, rotate: 0, scale: 1.06, opacity: 1 },
  { dx: 170, dy: 6, rotate: 9, scale: 0.6, opacity: 0.95 },
  { dx: 230, dy: 18, rotate: 18, scale: 0.48, opacity: 0.85 },
  { dx: 280, dy: 34, rotate: 27, scale: 0.38, opacity: 0.72 },
];
const MAX_PEEK = FAN_STEPS.length - 1;
const CARD_WIDTH = 260;
const CARD_HEIGHT = 420;
const TRANSITION = "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease";

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
  const cards = useMemo(() => {
    const result: { pokemon: Pokemon; offset: number }[] = [];
    for (let offset = -MAX_PEEK; offset <= MAX_PEEK; offset++) {
      const pokemon = items[centerIndex + offset];
      if (pokemon) result.push({ pokemon, offset });
    }
    return result;
  }, [items, centerIndex]);

  if (!center) return null;

  return (
    <Box>
      <Box sx={{ position: "relative", height: 460 }}>
        {cards.map(({ pokemon, offset }) => {
          const magnitude = Math.min(Math.abs(offset), MAX_PEEK);
          const step = FAN_STEPS[magnitude];
          const sign = Math.sign(offset);
          const isCenter = offset === 0;
          return (
            <Box
              key={pokemon.name}
              // Peeking cards are decorative -- arrow buttons are the only
              // navigation for this iteration -- so they're excluded from
              // the accessibility tree and can't steal focus/clicks even
              // though they render a real, otherwise-interactive PokemonCard.
              inert={!isCenter}
              sx={{
                position: "absolute",
                left: "50%",
                top: 0,
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                transition: TRANSITION,
                transform: `translateX(calc(-50% + ${sign * step.dx}px)) translateY(${step.dy}px) rotate(${sign * step.rotate}deg) scale(${step.scale})`,
                opacity: step.opacity,
                zIndex: 10 - magnitude,
                pointerEvents: isCenter ? "auto" : "none",
              }}
            >
              <PokemonCard
                pokemon={pokemon}
                captured
                captureLoading={releasingName === pokemon.name}
                onToggleCapture={() => onRelease(pokemon)}
              />
            </Box>
          );
        })}
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
      <Typography variant="subtitle1" sx={{ textAlign: "center", fontWeight: 600, mt: 1 }}>
        {items.length} captured!
      </Typography>
    </Box>
  );
};
