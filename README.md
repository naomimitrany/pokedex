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

5. **Persisted page/scroll position in `sessionStorage`, not the URL.** The requirement asks for a refresh to keep the user on the same page; a URL query param would do that but would also make every scroll tick a candidate for a URL update (or otherwise decouple "page in the URL" from "what's actually scrolled into view"). Keying a saved scroll depth off the current filters in `sessionStorage` gets the same refresh-survives behavior per tab without either problem, at the cost of not being a shareable/bookmarkable link back to a specific page.

6. **Added a "captured Pokémon" page beyond the literal assignment text.** The assignment only asks for capture/release to work from the main list; the `/captured` page (opened via the bag button, bottom-right, once logged in) is an addition for browsing just your own collection. It persists which card is centered via a `?card=<name>` URL param rather than `sessionStorage` — unlike the main list's scroll position, there's no sub-pixel value to get right here, just an index, so the simpler URL-based approach was enough.
