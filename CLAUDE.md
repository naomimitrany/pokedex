# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Pokédex web app: a Flask API backend serving Pokémon data, plus a React/TypeScript frontend. This is a take-home assignment (Guardio Fullstack Developer exercise) — see Assignment Requirements below for the graded scope. The functional/requirements reference (which fields, pages, and features to support — not visual design) is https://pokemon.fandom.com/wiki/Pok%C3%A9dex.

## Structure

- `backend/` — Flask API (Python).
- `frontend/` — Vite + React + TypeScript app.

## Backend

- Run: `cd backend && .venv/Scripts/python.exe app.py` (serves on port 8080).
- Deps: `backend/requirements.txt` (runtime), `backend/requirements-dev.txt` (dev tools, e.g. black).
- Format: `black` (config in `backend/pyproject.toml`).
- `backend/db.py`: `QUERY_EXECUTION_TIME` sleeps 2s on every read. This is intentional (simulates real-world latency for loading-state UI work) — do not remove it.
- `backend/db.py` is the DB abstraction and must NOT be modified (assignment constraint). Every other file is fair game.
- `db.get()` returns the entire Pokémon list on every call (2s latency included) — treat the DB as live/mutable during the server's lifetime (data can change between calls), and don't assume you can cache it forever.
- Pokémon fields (see `backend/pokemon_db.json`): `number`, `name`, `type_one`, `type_two`, `total`, `hit_points`, `attack`, `defense`, `special_attack`, `special_defense`, `speed`, `generation`, `legendary`.
- Pokémon sprite images: `GET /icon/<name>` redirects (302) to the PokeAPI official-artwork CDN for that Pokémon's `number`.
- `app.py` endpoints: `GET /pokemon` (paginated/sorted/filtered list, query params validated in `request_args.py`), `GET /pokemon/<name>`, `GET /types`, `GET /icon/<name>`, `POST /login`, `POST /logout`, `GET /me`, `POST /captures`, `DELETE /captures/<name>`. Capture endpoints require a logged-in session (`accounts.py`); see the login/accounts note under Assignment Requirements.
- `pokemon_service.py` wraps `db.get()` in a short-TTL cache with a single-flight guard so concurrent requests don't each pay the 2s latency, while still refreshing periodically since the DB is treated as live.

## Frontend

- Run: `cd frontend && npm run dev`.
- Lint: `npm run lint` (oxlint).
- Format: `prettier` (config in `frontend/.prettierrc.json`).
- The Pokédex UI is built out: `src/App.tsx` renders `NavBar` + `PokedexPage`; list/grid, filtering, sorting, page-size, capture, and theming all live under `src/components/pokedex/` and `src/components/navbar/`, backed by hooks in `src/hooks/` (`usePokemonList`, `useUrlState`, `useCaptureMutation`, etc.).
- Frontend must be React + TypeScript (hard requirement, not a suggestion to swap frameworks).

## Assignment Requirements

Implement a working Pokédex on top of the provided backend. Where a requirement is ambiguous, it's fine to make a reasonable assumption — just note the assumption (e.g. in the PR description) rather than silently guessing.

- **List view**: show all Pokémon with their attributes and sprite image (use the `/icon/<name>` endpoint).
- **Pagination**: paginate server-side and client-side as needed; page size selectable by the user (5/10/20/etc.); a browser refresh must keep the user on the same page (persist page state, e.g. in the URL query string). Bonus: infinite scroll instead of prev/next buttons. Consider client-vs-server trade-offs (payload size, latency from the 2s `db.get()` cost, re-fetch frequency) when deciding where pagination logic lives.
- **Sorting**: sort by `number`, ascending or descending, user-selectable; implement on backend and client as needed.
- **Filtering**: filter by `type` (matching either `type_one` or `type_two`, e.g. "only fire-type"). Bonus: fuzzy-text filter across all properties.
- **Saving/capturing**: let users mark a Pokémon as "captured"; persist the selection in server memory for the server's lifetime (in-memory server state is fine, no DB/file persistence required). Implemented via a lightweight name-only login (`accounts.py`) so captures persist per-user rather than globally — this login system is an addition beyond the literal assignment text, not a stated requirement; noted here (and in the README) so it's not mistaken for scope creep.
- **Theming**: default to the user's OS light/dark preference (`prefers-color-scheme`), plus a manual toggle to override it.
- **Performance**: be mindful of RAM/CPU/network — e.g. avoid re-fetching or re-transferring the full DB on every interaction given the 2s simulated latency, and don't hold unbounded state client-side.
- Cover edge cases (empty results, last page, invalid query params, filter+sort+paginate combined, etc.).

## Conventions

- Work on feature branches off `dev`, merged via PR.