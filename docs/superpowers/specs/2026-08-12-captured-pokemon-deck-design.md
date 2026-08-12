# Captured Pokémon deck page

## Problem

There's currently no way to view just the Pokémon a user has captured — the
main list ([PokedexPage.tsx](../../../frontend/src/pages/PokedexPage.tsx))
only shows the full paginated/filtered catalog with capture state overlaid on
each card. This adds a dedicated page for browsing your own collection one
card at a time, with an entry point that only appears when logged in, and
where releasing the Pokémon currently in view makes it disappear immediately.

## Decisions

- **Entry point:** a floating action button showing the bag image
  (`bag.png`, supplied by the user), fixed bottom-right, rendered only when
  `identity.username` is set and hidden while already on the captured page.
- **New backend endpoint, `GET /captures`:** returns full Pokémon objects
  (same shape as `/pokemon` items) for the logged-in user's captured names,
  sorted by `number` ascending. Chosen over reusing `GET /pokemon`
  client-side because captures can be scattered across the ~800-entry DB;
  filtering them out of paginated `/pokemon` results would mean looping
  requests against a route that already carries the 2s simulated latency the
  rest of the app goes out of its way to minimize. `db.py` is untouched —
  this only adds a lookup over the existing cached snapshot in
  `pokemon_service.py`.
- **Presentation: a "hand of cards" deck**, not a grid. One Pokémon centered
  and interactive at a time; up to 3 neighboring cards peek on each side,
  scaled down, rotated outward, and faded with distance from center (see the
  approved mockup, `hand-fan.html`, saved under `.superpowers/brainstorm/`
  for this session). A header shows "N captured".
- **Navigation: arrow buttons only, for now.** Clicking a peeking card,
  keyboard arrows, swipe, and cursor-position-based auto-advance are
  explicitly out of scope for this iteration (see below).
- **Deck order:** by `number` ascending — consistent with the main list's
  default sort and the backend's existing sort behavior.
- **Release behavior:** releasing the centered card removes it immediately
  and the next card (by number) slides into center. Releasing the only
  remaining card drops to the empty state.
- **Position persistence:** which card is centered survives a refresh via a
  `?card=<name>` URL query param, not sessionStorage. This is simpler than
  the pixel-precision scroll-restoration machinery in
  [useScrollRestoration.ts](../../../frontend/src/hooks/useScrollRestoration.ts) —
  there's no sub-pixel problem to solve here, just "which index." On load,
  the deck centers the card matching `?card`; if that name is missing (e.g.
  released from the main list in another tab) or absent, it falls back to
  index 0.
- **Empty state (0 captured):** reuse the existing `EmptyState` component
  with a message and a link back to `/`.

## Design

### Backend

**`pokemon_service.py`** — add a method alongside `find_by_name`:

```python
def pokemon_for_names(self, names):
    wanted = {n.lower() for n in names}
    matches = [p for p in self._snapshot()["pokemon"] if p["name"].lower() in wanted]
    return self.sort_pokemon(matches, "number", descending=False)
```

**`app.py`** — new route, following the existing `_require_username` /
`_require_pokemon` pattern used by the capture endpoints:

```python
@app.get("/captures")
def list_captures():
    username = _require_username()
    return jsonify(pokemon_service.pokemon_for_names(accounts.captured_names(username)))
```

401s via the existing `NotLoggedIn` handler if not logged in.

### Frontend

**`api/accounts.ts`** — add `fetchCaptures(): Promise<Pokemon[]>` calling
`GET /captures`.

**`hooks/useCapturedPokemon.ts`** (new) — React Query hook,
`queryKey: ["captures"]`, `enabled: !!identity.username`.

**`hooks/useCaptureMutation.ts`** (modified) — currently takes
`{ name, captured }` and only patches the `/me` cache (names only). Extend
the mutate variables to `{ pokemon: Pokemon, captured: boolean }` (every
call site already has the full `Pokemon` object in hand — see
`PokedexPage.tsx`'s `handleToggleCapture`) so `onMutate`/`onSuccess` can
optimistically patch *both* the `["me"]` cache (as today) and the
`["captures"]` list cache: append the full object on capture, filter it out
by name on release. This is what makes "release while viewing the captured
page" disappear immediately without a refetch, and keeps the two caches
from disagreeing if a capture/release happens from the main list while the
captured page's data is stale in the background.

**`pages/CapturedPage.tsx`** (new) — mirrors `PokedexPage.tsx`'s shape:
reads `?card=` via `useSearchParams`, calls `useCapturedPokemon()` and
`useCaptureMutation()`, computes `centerIndex` from the URL param (falling
back to 0), and renders one of: loading skeleton, `ErrorState`, `EmptyState`,
or the deck.

**`components/pokedex/CapturedDeck.tsx`** (new) — takes `items: Pokemon[]`,
`centerIndex`, `onNavigate(direction)`, `onRelease(pokemon)`. Renders:
- the center card via the existing `PokemonCard` (`captured` always `true`,
  its capture toggle wired to `onRelease`),
- up to 3 cards on each side as simplified peek previews (sprite + name +
  number badge, not the full stat card — unreadable at that scale anyway,
  and cheaper to mount many of), positioned/rotated/faded via inline
  transforms per the approved mockup,
- two `IconButton` arrows, each disabled at its respective end of `items`,
- a "N captured" header using `items.length`.

Transitions on transform/opacity (~200ms) when `centerIndex` changes, so
stepping and releasing both read as a slide rather than a hard cut.

**`components/pokedex/BagFab.tsx`** (new) — MUI `Fab` with the bag image
(moved into `frontend/src/assets/bag.png`), `position: fixed`,
bottom/right-anchored. Rendered from `App.tsx` (needs `identity.username`
via `useIdentity()` and the current path via `useLocation()` to hide on
`/captured`), alongside the existing `<NavBar />`/`<Routes>` structure.

**`App.tsx`** — add the `/captured` route and render `<BagFab />`.

## Testing

- Backend: new test(s) for `GET /captures` mirroring the existing capture
  endpoint tests — 401 when logged out, correct subset/order when logged in
  with a mix of captured/uncaptured names.
- Frontend: `useCaptureMutation.test.tsx` updated for the dual-cache
  patching; new `CapturedDeck.test.tsx` covering navigation bounds (arrows
  disabled at ends), release-removes-and-advances, and the empty/loading/
  error states; `CapturedPage.test.tsx` for the `?card=` restore/fallback
  behavior.
- Manual browser verification: capture a handful of Pokémon, open the bag,
  confirm the fan/arrow navigation and counter, release the centered card
  and confirm immediate removal + slide, refresh mid-deck and confirm the
  same card is still centered, release down to zero and confirm the empty
  state, confirm the FAB is absent when logged out and on `/captured`
  itself.

## Out of scope (this iteration)

- Clicking a peeking side card, keyboard arrow navigation, and touch swipe.
- Cursor-position-based auto-advance (moving the pointer toward an edge of
  the deck to step and center a card) — noted as a likely future
  enhancement per the user, not built now.
- Any sort/filter/search within the captured deck itself.
- Capturing new Pokémon from this page (capture only happens from the main
  list; this page only displays and releases).
