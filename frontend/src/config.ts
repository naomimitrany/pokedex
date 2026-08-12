export const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8080";

// Matches the backend's snapshot cache TTL (pokemon_service.py's
// ttl_seconds=500): the server can't return different data any sooner than
// that, so treating client-cached queries as fresh for less time than this
// only buys pointless refetches -- e.g. every list<->detail navigation --
// with no chance of new data.
export const POKEMON_CACHE_STALE_TIME_MS = 500_000;
