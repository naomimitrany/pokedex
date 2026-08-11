# Frontend Pokédex — Design

Date: 2026-08-11
Status: Approved, pending implementation plan

## Context

The backend (`backend/app.py`, `backend/pokemon_service.py`, `backend/accounts.py`) is
already fully built (uncommitted, from a prior session in this repo) and exposes:

- `GET /pokemon?page=&page_size=&sort_by=&order=&type=&q=` →
  `{ items, page, page_size, total_count, total_pages }`, each item annotated with
  `captured: bool` for the current session.
- `GET /types` → list of type strings.
- `GET /icon/<name>` → 302 redirect to a sprite image.
- `POST /login { username }` / `POST /logout` / `GET /me` → cookie-session identity,
  no password (claims a name).
- `POST /captures { name }` / `DELETE /captures/<name>` → capture/release, requires
  login.
- Server-side pagination, sorting (by any of a fixed field set), type filtering, and a
  fuzzy text filter (`q`, matches across all fields) already exist server-side.

`backend/db.py` is off-limits and simulates 2s latency on every `db.get()` call.
`PokemonService` TTL-caches the raw DB snapshot for 90s, so repeated queries within
that window skip the 2s cost — this matters for the infinite-scroll refetch strategy
below.

None of the frontend Pokédex UI exists yet (`frontend/src/App.tsx` is still the Vite
scaffold).

## Goals

Build the frontend against the existing backend to satisfy CLAUDE.md's assignment
requirements: list view with sprites, pagination (infinite scroll, bonus), sorting by
number, type filtering (+ bonus fuzzy text filter), capture/release, light/dark
theming with manual override, and mindful performance (no full-DB refetches, bounded
client state).

## Architecture

- **Vite + React + TypeScript** (existing scaffold, kept).
- **React Router** (`BrowserRouter`, single `/` route) — owns URL query-param state
  via `useSearchParams`. Chosen over plain History API per explicit preference, even
  though the app has only one screen.
- **MUI** (`@mui/material`, `@emotion/react`, `@emotion/styled`, `@mui/icons-material`)
  is the component library **and** the single source of truth for theming.
  `ThemeProvider` supplies light/dark palettes; all color/typography comes from the
  MUI theme, not Tailwind. Tailwind is installed only for minor layout utilities where
  MUI's `Box`/`Grid`/`Stack` (`sx` prop) don't conveniently cover a case — it must not
  drive theming.
- **Plain `fetch` + custom hooks** for data — no query library. The app has one list
  endpoint and two mutations; a query library is more machinery than the scope
  justifies.
- **Vitest + React Testing Library** for tests, mocking at the `fetch` boundary.

### Component map

- `App.tsx` — top-level layout: header (`AppBar` with title + `ThemeToggle`),
  `FilterBar`, `PokemonGrid`.
- `components/PokemonCard.tsx` — MUI `Card` / `CardMedia` (sprite via `/icon/<name>`)
  / `CardContent` (stats) / `Chip` (type badges) / `IconButton` (Pokéball capture
  toggle).
- `components/FilterBar.tsx` — `TextField` (search/`q`), `Select` (type, sort field,
  page size), `ToggleButtonGroup` (asc/desc order).
- `components/LoginPrompt.tsx` — `Popover`/`Dialog` + `TextField`, triggered by the
  first capture attempt while logged out.
- `components/ThemeToggle.tsx` — `IconButton` toggling MUI palette mode
  (light/dark/system), persisted to `localStorage`, defaulting to
  `prefers-color-scheme`.
- `components/PokemonCardSkeleton.tsx` — MUI `Skeleton`-based placeholder matching
  `PokemonCard`'s layout, used for every loading state (initial load and "load more").

### Hooks / lib

- `hooks/useUrlState.ts` — reads/writes `page_size`, `sort_by`, `order`, `type`, `q`,
  `pages` via `useSearchParams`. Sanitizes invalid values back to defaults on read
  (bad `sort_by`, out-of-range `page_size`, etc.) and corrects the URL via `replace`.
- `hooks/usePokemonList.ts` — infinite-scroll fetch/accumulate/reset (see Data Flow).
- `hooks/useAuth.ts` — wraps `/me`, `/login`, `/logout`, optimistic capture/release
  with rollback on failure.
- `hooks/useThemeMode.ts` — wraps MUI palette mode state + `localStorage` + media
  query default.
- `lib/api.ts` — typed `fetch` wrappers for every backend endpoint.

## Data flow

- **URL as source of truth.** Query params: `page_size`, `sort_by`, `order`, `type`,
  `q`, `pages` (count of pages loaded so far via infinite scroll — this is how "a
  refresh keeps the user on the same page" is satisfied for an infinite-scroll UI).
- **Infinite scroll.** `usePokemonList` fetches page by page and accumulates `items`.
  Changing any filter/sort/page-size param resets `pages=1` and clears the
  accumulated list before refetching. An `IntersectionObserver` on a sentinel element
  at the bottom of the grid triggers fetching `pages+1` and bumps the URL's `pages`
  (history `replace`, not `push`, so back/forward isn't spammed).
- **Refresh/direct-load behavior.** On mount, the hook refetches pages `1..pages` in
  parallel and concatenates in order. Only the first request pays the 2s
  `db.get()` cost — `PokemonService`'s 90s TTL cache means the rest resolve fast, so
  reconstructing a multi-page scroll position on refresh is cheap.
- **Bounded client state.** The dataset is small (~1000 rows including alternate
  formes), so infinite-scroll accumulation stays bounded by the dataset itself rather
  than growing without limit — an accepted tradeoff, not a virtualization
  requirement, per CLAUDE.md's "don't hold unbounded state client-side" note.
- **Capture/login flow.** `useAuth` calls `GET /me` on load; the Flask session cookie
  survives a page refresh (browser session cookie), so no re-login is needed within a
  browser session. Clicking a card's Pokéball while logged out opens `LoginPrompt`
  (trainer name → `POST /login`, then the capture proceeds automatically). While
  logged in, capture/release is optimistic (`POST`/`DELETE /captures`) with rollback
  + a `Snackbar` on failure. Browsing and viewing the list never requires login.

## Error handling & edge cases

- **Empty results** (filter/search combo matches nothing): centered empty state with
  a "clear filters" action.
- **End of list**: once loaded items reach `total_count`, the scroll sentinel stops
  firing and an end-of-list message replaces the loader.
- **Network/API errors**: inline `Alert` with a retry action, for both initial load
  and a failed "load more."
- **Capture failures**: optimistic toggle rolls back, with a `Snackbar` explaining why
  (not logged in, network error, etc.).
- **Loading states**: every loading card — initial load and "load more" — renders as
  a `PokemonCardSkeleton`, never a generic spinner-only state, so the grid layout
  stays stable while data streams in.
- **Invalid URL params on direct load**: sanitized to defaults (see `useUrlState`)
  rather than erroring.

## Filtering & sorting scope

- Type filter: single-select (dropdown or chip row), matching either `type_one` or
  `type_two` server-side. Multi-select is out of scope (would need a backend change
  to accept multiple `type` values).
- Text search: free-text box wired to the backend's existing `q` param (fuzzy match
  across all fields) — bonus requirement, already supported server-side.
- Sort: by `number`, ascending/descending, user-selectable (other sortable fields
  exist server-side but the requirement only calls out `number`; the sort `Select`
  can still expose the other `SORTABLE_FIELDS` since the backend already supports
  them, at low added cost).
- Captured-only filter: explicitly out of scope for this pass.

## Theming

- MUI `ThemeProvider` with light and dark palettes. Precedence: if `localStorage` has
  a stored manual override, use it; otherwise default to the OS preference via
  `useMediaQuery('(prefers-color-scheme: dark)')`. This means a first-ever visit (no
  stored override) always renders in the user's OS light/dark setting, and the manual
  `ThemeToggle` is what writes an override to `localStorage`, which then wins on every
  subsequent load regardless of OS setting changes.

## Login/accounts scope note

The backend's username-claim login (no password) goes beyond CLAUDE.md's stated
requirement ("persist captures in server memory for the server's lifetime" — no
accounts implied). Treating it as an assumption: the frontend defers login until the
user's first capture attempt, rather than gating the whole app behind it, so browsing
never requires an identity.

## Testing

Vitest + React Testing Library, focused on logic-heavy units:

- `useUrlState` — parsing/sanitizing params, URL correction.
- `usePokemonList` — accumulation, reset-on-filter-change, end-of-list detection,
  parallel refetch-on-mount behavior.
- `useAuth` — optimistic capture/release + rollback.
- Component tests: `PokemonCard` capture toggle, `FilterBar` emitting correct param
  changes.

All backend calls mocked at the `fetch` boundary — no real network/backend needed for
these tests.
