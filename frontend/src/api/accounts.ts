import { apiClient } from "./client";
import type { Identity } from "../types";

export const fetchMe = async (): Promise<Identity> => {
  const response = await apiClient.get<Identity>("/me");
  return response.data;
};

export const login = async (username: string): Promise<Identity> => {
  const response = await apiClient.post<Identity>("/login", { username });
  return response.data;
};

export const logout = async (): Promise<Identity> => {
  const response = await apiClient.post<Identity>("/logout");
  return response.data;
};

export const capturePokemon = async (name: string): Promise<{ name: string; captured: boolean }> => {
  const response = await apiClient.post("/captures", { name });
  return response.data;
};

export const releasePokemon = async (name: string): Promise<{ name: string; captured: boolean }> => {
  const response = await apiClient.delete(`/captures/${encodeURIComponent(name)}`);
  return response.data;
};
