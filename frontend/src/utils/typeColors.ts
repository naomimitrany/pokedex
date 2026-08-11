const TYPE_COLORS: Record<string, string> = {
  normal: "#A8A77A",
  fire: "#EE8130",
  water: "#6390F0",
  electric: "#F7D02C",
  grass: "#7AC74C",
  ice: "#96D9D6",
  fighting: "#C22E28",
  poison: "#A33EA1",
  ground: "#E2BF65",
  flying: "#A98FF3",
  psychic: "#F95587",
  bug: "#A6B91A",
  rock: "#B6A136",
  ghost: "#735797",
  dragon: "#6F35FC",
  dark: "#705746",
  steel: "#B7B7CE",
  fairy: "#D685AD",
};

const FALLBACK_COLOR = "#777777";

export function typeColor(type: string): string {
  return TYPE_COLORS[type.toLowerCase()] ?? FALLBACK_COLOR;
}

export function typeGradient(types: (string | undefined | null)[]): string {
  const colors = types.filter((t): t is string => Boolean(t)).map(typeColor);
  if (colors.length === 0) return FALLBACK_COLOR;
  if (colors.length === 1) return colors[0];
  return `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;
}
