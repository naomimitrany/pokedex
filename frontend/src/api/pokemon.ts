import { apiClient } from "./client";
import { BASE_URL } from "../config";
import type { PokemonPage, PokemonQuery } from "../types";

export const fetchPokemonPage = async (query: PokemonQuery): Promise<PokemonPage> => {
  const response = await apiClient.get<PokemonPage>("/pokemon", {
    params: {
      page: query.page,
      page_size: query.pageSize,
      sort_by: query.sortBy,
      order: query.order,
      ...(query.type ? { type: query.type } : {}),
      ...(query.q ? { q: query.q } : {}),
    },
  });
  return response.data;
};

export const fetchTypes = async (): Promise<string[]> => {
  const response = await apiClient.get<string[]>("/types");
  return response.data;
};

export const iconUrl = (name: string): string => `${BASE_URL}/icon/${encodeURIComponent(name)}`;
