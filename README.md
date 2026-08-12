# Pokédex

A Pokédex web app built as a take-home exercise: a Flask API backend serving Pokémon data, and a React/TypeScript frontend for browsing, searching, and "capturing" them.

Browse the full Pokémon list with sprites and stats, filter by type or free-text search, sort by any stat, page through results with infinite scroll, and mark Pokémon as captured under a trainer name — all with light/dark theming that follows your OS preference (with a manual override).

## Tech stack

- **Backend**: Flask, Pydantic (query validation), cachetools (in-memory TTL cache), Flask-CORS, session-cookie auth.
- **Frontend**: Vite, React 19 + TypeScript, MUI, TanStack Query, React Router, Axios.
- **Tests**: pytest (backend), Vitest + Testing Library (frontend).

## Project structure

```
backend/    Flask API (app.py, pokemon_service.py, accounts.py, request_args.py, ...)
frontend/   Vite + React + TypeScript app (src/components, src/hooks, src/pages, ...)
```

## Running locally

You'll need two terminals — one for the backend, one for the frontend.

### Backend (port 8080)

```bash
cd backend
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
.venv/Scripts/python.exe app.py
```

The API is now at `http://localhost:8080`.

Optional environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `SECRET_KEY` | random per process start | Flask session signing key. Since it's randomized by default, restarting the backend invalidates all logged-in sessions. |
| `FRONTEND_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated list of allowed CORS origins. |
| `SESSION_COOKIE_SAMESITE` | `None` | Cookie `SameSite` attribute. |
| `SESSION_COOKIE_SECURE` | `1` (secure) | Cookie `Secure` attribute; set to `0` for plain-HTTP local setups if your browser rejects the cookie. |

With the default `SESSION_COOKIE_SECURE=1`, open the frontend via `http://localhost:5173`, not `http://127.0.0.1:5173` — most browsers treat `localhost` as secure-cookie-eligible for local dev, but don't extend the same exception to `127.0.0.1`, so login can silently fail to persist there.

### Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The frontend talks to the backend at `http://localhost:8080` by default; override with a `VITE_API_BASE_URL` env var (e.g. in a `frontend/.env.local` file) if the backend runs elsewhere.

### Tests / lint

```bash
# backend
cd backend && pip install -r requirements-dev.txt && pytest

# frontend
cd frontend && npm run test
cd frontend && npm run lint
```

## Assumptions & design decisions

Since some requirements were open to interpretation, here's what I assumed and why:

1. **Changed the sprite icon URL.** The original source was missing images for a number of Pokémon, so I pointed `/icon/<name>` at a different sprite source with full coverage.

2. **Simplified user management to a name only.** Captures need to be tied to a user, but full username/password authentication with tokens felt like overkill for state that only lives in server memory for the process's lifetime. Instead, "logging in" just means choosing a trainer name.

3. **Kept page size selectable, but moved it out of the main filter bar.** It's a stated requirement, so the control still exists, but it's less central to navigation now that infinite scroll handles pagination, so I tucked it into a secondary menu instead.

4. **Cached the full Pokémon list on the server for 500 seconds** to avoid paying the simulated 2-second `db.get()` latency on every request.
