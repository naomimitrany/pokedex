export type SortField =
  | "number"
  | "name"
  | "total"
  | "hit_points"
  | "attack"
  | "defense"
  | "special_attack"
  | "special_defense"
  | "speed"
  | "generation";

export type SortOrder = "asc" | "desc";

export type Pokemon = {
  number: number;
  name: string;
  type_one: string;
  type_two: string;
  total: number;
  hit_points: number;
  attack: number;
  defense: number;
  special_attack: number;
  special_defense: number;
  speed: number;
  generation: number;
  legendary: boolean;
};

export type PokemonPage = {
  items: Pokemon[];
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
};

export type Identity = {
  username: string | null;
  captured: string[];
};

export type PokemonQuery = {
  page: number;
  pageSize: number;
  sortBy: SortField;
  order: SortOrder;
  type?: string | null;
  q?: string;
};
