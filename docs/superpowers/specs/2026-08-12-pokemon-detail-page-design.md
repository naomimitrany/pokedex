# Pokémon Detail Page — Design

## Problem

The grid (`PokemonCard`) already surfaces almost every field the DB has (name,
number, sprite, both types, legendary badge, and all six base stats). There's
no way to see a single Pokémon on its own page, and two DB fields
(`total`, `generation`) aren't shown anywhere. We're adding a detail page at
`/pokemon/:name`, reachable by clicking a card, that presents all fields
(including the two currently-missing ones) in a roomier layout.

## Backend

Add one endpoint to `backend/app.py`, reusing the existing `_require_pokemon`
helper (already used by `/icon/<name>` and the capture endpoints), so 404
handling (`UnknownPokemon`) comes for free:

```python
@app.get("/pokemon/<name>")
def get_pokemon(name):
    return jsonify(_require_pokemon(name))
```

This reads through `pokemon_service`'s existing snapshot cache — no new
cache, no `db.py` change, no new validation module. A lookup for a name that
isn't in the DB returns the existing `404 {"error": "no Pokémon named ..."}`
shape.

## Frontend

### Routing

- New page component: `frontend/src/pages/PokemonDetailPage.tsx`.
- New route in `frontend/src/App.tsx`: `<Route path="/pokemon/:name" element={<PokemonDetailPage />} />`, alongside the existing `/` route.
- URL uses the Pokémon's `name` (URL-encoded), matching the existing `/icon/<name>` convention — not `number`.

### Data flow (fast path + slow path)

Two ways a user lands on the detail page:

1. **From the grid** — `PokemonCard` already has the full `Pokemon` row in
   memory. It becomes a `Link` (react-router) to
   `/pokemon/${encodeURIComponent(pokemon.name)}` with
   `state: { pokemon }`. No network round-trip, no cache lookup — the data
   just travels with the navigation.
2. **Direct visit / refresh / no state** (bookmark, typed URL, browser
   refresh on the detail page) — there's no `location.state` to read, so the
   page fetches from the new endpoint.

Both paths are unified in one hook, `frontend/src/hooks/usePokemonDetail.ts`:

```ts
export const usePokemonDetail = (name: string) => {
  const location = useLocation();
  const stateData = location.state?.pokemon as Pokemon | undefined;
  const initialData =
    stateData && stateData.name.toLowerCase() === name.toLowerCase()
      ? stateData
      : undefined;

  return useQuery({
    queryKey: ["pokemon", name],
    queryFn: () => fetchPokemonDetail(name),
    initialData,
  });
};
```

`initialData` only short-circuits the *initial* render — React Query's
default `staleTime` of 0 means it still revalidates in the background right
after mount, consistent with the rest of the app treating the DB as
live/mutable. So the fast path shows data instantly but still picks up a
change server-side; the slow path shows a loading skeleton for the length of
the request (2s simulated latency, same as everywhere else in this app).

`frontend/src/api/pokemon.ts` gains:

```ts
export const fetchPokemonDetail = async (name: string): Promise<Pokemon> => {
  const response = await apiClient.get<Pokemon>(
    `/pokemon/${encodeURIComponent(name)}`,
  );
  return response.data;
};
```

### Capture flow extraction

`PokedexPage` currently owns the login-gate-on-capture logic inline:
`pendingCapture` state, the `LoginPrompt` dialog, capture mutation wiring,
and an error snackbar. The detail page needs the exact same behavior for its
own capture button, so this logic moves into a shared hook,
`frontend/src/hooks/useCaptureFlow.ts`:

```ts
export const useCaptureFlow = () => {
  // identity, captureMutation, loginMutation, pendingCapture state,
  // handleToggleCapture, handleLoginSubmit, snackbarMessage — as currently
  // implemented inline in PokedexPage, moved verbatim.
  return {
    capturedNames,
    capturingName,
    handleToggleCapture,
    pendingCapture,
    closePendingCapture,
    handleLoginSubmit,
    snackbarMessage,
    dismissSnackbar,
  };
};
```

`PokedexPage` and `PokemonDetailPage` both call this hook and render
`<LoginPrompt>` + the error `<Snackbar>` off its return value. `PokedexPage`'s
behavior is unchanged — this is a pure extraction, not a behavior change.

### Card becomes a link

`PokemonCard`'s outer `Box` gets `component={Link}` (same pattern already
used for the title in `NavBar`), `to`, and `state`. The nested
`CaptureButton`'s `onClick` gets `e.preventDefault(); e.stopPropagation();`
added alongside its existing `e.currentTarget.blur()` so capturing/releasing
from the grid doesn't also navigate.

### Detail page layout

- Back link/button: `navigate(-1)`. Because the grid's page, sort, filter,
  and scroll position all already live in the URL query string +
  sessionStorage (existing `useUrlState` / `useScrollRestoration`), going
  back via history — rather than linking to `/` — lands the user exactly
  where they left the grid.
- Header: large `PokemonSprite`, name, zero-padded number (`#001` style,
  matching the card), type chips, legendary badge, and a `CaptureButton`
  wired through `useCaptureFlow`.
- Stats: the existing `PokemonStats` component (already full-width), plus two
  new rows for **Total** and **Generation** — both are plain DB fields
  (`pokemon.total`, `pokemon.generation`), not computed client-side.
- Loading state: a skeleton, shown only when there's no `initialData` (slow
  path).
- Error state: 404 (`UnknownPokemon`) renders a "no such Pokémon" message
  with a link back to `/`; other errors reuse the existing `ErrorState` +
  retry component.

## Out of scope

- No new data beyond what `backend/pokemon_db.json` already has — `total`
  and `generation` are the only "new" fields, both already present in the DB
  today, per `CLAUDE.md`.
- No prev/next-Pokémon navigation within the detail page.
- No change to `db.py`, `pokemon_service.py`'s caching strategy, or
  `request_args.py`.

## Testing

Following existing conventions (`*.test.tsx` for frontend, pytest for
backend):

- `usePokemonDetail.test.tsx` — covers: `initialData` used when
  `location.state` matches, ignored/refetched when the route name doesn't
  match state, and the plain-fetch path when there's no state at all.
- `PokemonDetailPage.test.tsx` — renders with mocked query data; covers
  loading skeleton, loaded content (all fields incl. Total/Generation),
  404/not-found, capture toggle (logged in and logged out → login prompt).
- `useCaptureFlow.test.tsx` — new tests for the extracted hook (login gate,
  optimistic toggle, mutation error → snackbar). There's no existing
  `PokedexPage.test.tsx` to migrate cases from, so this is net-new coverage
  rather than a migration.
- Update `PokemonCard.test.tsx` for the `Link` wrapper and the
  stop-propagation behavior on the capture button.
- Backend: `GET /pokemon/<name>` — found (200, full record) and not-found
  (404) cases, added to `backend/tests/test_api.py` alongside the other
  route tests.
