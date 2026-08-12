# Scroll restoration rewrite

## Problem

After a browser refresh, the Pokédex should restore the user to the exact
scroll pixel they were at before — not the top of whatever page they were on.
The current implementation (`useScrollRestoration.ts` +
`usePokemonList.ts` + `useUrlState.ts` + `PokedexPage.tsx` +
`PokemonGrid.tsx`) attempts this but is unreliable in practice, despite
several prior fix attempts (see `bf63e78`, `b6663ff`). It is being rewritten
from scratch rather than patched further.

## Root cause analysis

Direct testing confirmed the restore mechanics work correctly when fed
consistent inputs: seeding sessionStorage with an exact `scrollTop` and
reloading landed within 0.13px of the target. The unreliability is
architectural, not a one-line bug:

1. **Two disagreeing sources of truth for "how much content to preload."**
   Scroll depth is tracked both in the URL's `pages` query param (written
   asynchronously, only after a fetch resolves and a re-render happens) and
   in sessionStorage's own page count (written synchronously by the
   debounced scroll listener, which can run before the URL catches up).
   These are reconciled with `Math.max(filters.pages, getSavedPages(...))`
   plus two extra refs (`targetRef`, `reportedRef`) in `usePokemonList` to
   avoid feedback loops. Any drift between the two signals under real
   scrolling causes the initial restore fetch to request too few pages, so
   the saved pixel offset gets clamped against whatever content actually
   loaded — visually indistinguishable from "landed at the edge of a page."

2. **A second, independent shift risk after the jump.** Cards get
   `content-visibility: auto` toggled *off* during the restore pass (so the
   layout used for the `scrollTo` is exact, not an intrinsic-size estimate),
   then toggled back *on* once `scrollRestored` flips true. Re-enabling it
   lets off-screen cards *above* the restored viewport collapse to their
   `containIntrinsicSize` estimate, which can shift everything below them —
   including the just-restored viewport — immediately after the jump. The
   existing 300ms rAF "re-snap" loop exists to fight this, but it's a
   symptom patch, doesn't cover keyboard/scrollbar-drag scrolling, and adds
   its own complexity/flakiness.

## Decisions

- **Drop `pages` from the URL entirely** (confirmed with the user). A
  shared/bookmarked link always starts at page 1; only sessionStorage
  (scoped to the tab) drives exact restoration. This still satisfies the
  assignment's literal requirement ("a browser refresh must keep the user on
  the same page") — refreshing the *same tab* is the only case that must
  work, and sessionStorage survives that.
- **One atomic sessionStorage entry per scroll key**, holding
  `{ scrollTop: number, pages: number }`, written together by the debounced
  scroll listener. No second key, no reconciliation with any other source.
- **Fix the content-visibility shift positionally, not temporally.** Instead
  of toggling `content-visibility` off then back on around the restore,
  permanently exempt only the cards that were part of the initial restore
  batch (`index < restoredPageCount * pageSize`) from `content-visibility`
  for the lifetime of that mount. Cards loaded afterward via normal
  infinite scroll keep the existing performance optimization. This removes
  the need for the 300ms re-snap loop.

## Design

### `useScrollRestoration.ts` (full rewrite)

- `getSavedScrollEntry(scrollKey): { scrollTop: number; pages: number } | null`
  — reads and parses the single JSON blob for a key, clamping `pages` to
  `MAX_AUTO_RESTORE_PAGES`. Replaces the old standalone `getSavedPages`.
- `useScrollRestoration(scrollKey, ready, loadedPages): boolean` — same
  external shape as today (returns `scrollRestored`), but internally:
  - debounced scroll listener writes `{ scrollTop, pages: loadedPages }` as
    one `sessionStorage.setItem` call per key, plus the existing LRU index
    bookkeeping (`touchScrollKey`, eviction at `MAX_TRACKED_KEYS`) — that
    part isn't broken and carries over unchanged in spirit.
  - the "re-arm when `scrollKey` changes" render-time derivation carries
    over unchanged (it already works correctly).
  - the restore jump stays a single `useLayoutEffect` that reads the saved
    entry once and calls `scrollTo({ top })` — no rAF re-snap loop.

### `usePokemonList.ts`

- Drop `onPagesChange`, `targetRef`, `reportedRef` entirely.
- Keep a single ref capturing the initial restore target for the query's
  lifetime (reset only when `filtersKey` changes, same as today) — just
  without the URL-feedback complication, since nothing writes back to the
  URL anymore.
- Add `loadedPages: number` to `UsePokemonListResult` (derived the same way:
  `query.data?.pages.at(-1)?.page ?? 0`) so callers read it directly instead
  of via a callback.

### `useUrlState.ts`

- Remove `pages` from `FilterState`, `parseFilterState`,
  `filterStateToParams`, and remove `setPages`/`parsePages` entirely.
- `MAX_AUTO_RESTORE_PAGES` import moves out of this file (no longer needed
  here).

### `PokedexPage.tsx`

- `restoreToPage` is now `useMemo(() => getSavedScrollEntry(scrollKey)?.pages ?? 1, [scrollKey])`
  — no `Math.max` with URL state.
- Drop `handlePagesChange`/`setPages` wiring; read `list.loadedPages`
  directly and pass it to `useScrollRestoration`.
- Pass a `restoredCount` prop down to `PokemonGrid`
  (`restoreToPage > 1 ? restoreToPage * filters.pageSize : 0`) for the
  positional content-visibility exemption.

### `PokemonGrid.tsx`

- Replace the `restoringScroll` boolean prop (temporal: on until restored,
  then off) with `restoredCount: number` (positional: cards at
  `index < restoredCount` never get `content-visibility`/
  `containIntrinsicSize`, regardless of restore state; all other cards keep
  today's behavior unchanged).

### `constants.ts`

- `MAX_AUTO_RESTORE_PAGES` stays, comment updated to reflect it now only
  bounds a sessionStorage-sourced restore (no URL angle anymore).

## Testing

- Rewrite `useScrollRestoration.test.tsx` for the atomic entry shape and the
  removal of the settle loop (no more fake-timer-driven re-snap assertions).
- Update `usePokemonList.test.tsx` for the dropped `onPagesChange` callback
  and the new `loadedPages` return value.
- Update `PokemonGrid.test.tsx` for `restoredCount` replacing
  `restoringScroll`.
- Trim the `pages`-related cases out of `useUrlState.test.tsx`.
- Manual browser verification: load the app, scroll to a position that
  isn't aligned to a page boundary, refresh, confirm the landing scrollTop
  matches (within a few px) what it was before refresh, across at least two
  different filter/sort combinations (to confirm per-key isolation still
  works).

## Out of scope

- No change to how pagination/sorting/filtering themselves work.
- No change to the LRU eviction policy for old scroll keys.
- No change to backend endpoints or `to_page` behavior.
