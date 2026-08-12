# Captured Pokémon Deck Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/captured` page where a logged-in user browses their captured Pokémon one at a time in a "hand of cards" deck, reachable via a floating bag button, where releasing the centered card removes it immediately and slides the next one into place.

**Architecture:** A new `GET /captures` backend endpoint returns full Pokémon objects for the session's captured names. On the frontend, a `useCapturedPokemon` query hook fetches that list; `useCaptureMutation` is extended to optimistically keep both the `/me` names cache and this new captures-list cache in sync on every capture/release, anywhere in the app. `CapturedPage` derives which card is centered from a `?card=<name>` URL param (self-healing via an effect, mirroring the existing `useUrlState` canonicalization pattern) and renders `CapturedDeck`, a presentational component doing the fan layout and arrow navigation. A `BagFab` floating button (hidden when logged out or already on `/captured`) is the entry point.

**Tech Stack:** Flask + pytest (backend), React 19 + TypeScript + MUI + TanStack Query + React Router + Vitest/Testing Library (frontend) — no new dependencies.

## Global Constraints

- `backend/db.py` must NOT be modified (assignment constraint) — this plan only touches `pokemon_service.py` and `app.py`.
- Frontend must be React + TypeScript.
- Backend format: `black` (`backend/pyproject.toml`). Frontend format: `prettier` (`frontend/.prettierrc.json`). Frontend lint: `oxlint` (`npm run lint`).
- Backend tests: `cd backend && pytest`. Frontend tests: `cd frontend && npm run test` (or `npx vitest run <file>` for a single file).
- Follow existing patterns in the codebase (file layout, hook shape, test style) rather than introducing new conventions.

---

### Task 1: Backend — `GET /captures`

**Files:**
- Modify: `backend/pokemon_service.py`
- Modify: `backend/app.py`
- Test: `backend/tests/test_captures.py`

**Interfaces:**
- Produces: `PokemonService.pokemon_for_names(names: Iterable[str]) -> list[dict]` — full Pokémon dicts (same shape as `/pokemon` items) matching `names` (case-insensitive), sorted by `number` ascending.
- Produces: `GET /captures` — 401 (`{"error": "login required"}`) if not logged in; otherwise 200 with a JSON array of full Pokémon objects for the current session's captured names.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_captures.py`:

```python
class TestCapturesEndpoint:
    def test_requires_login(self, client):
        assert client.get("/captures").status_code == 401

    def test_returns_full_pokemon_objects_for_captured_names(self, ash):
        ash.post("/captures", json={"name": "Charmander"})
        ash.post("/captures", json={"name": "Squirtle"})

        response = ash.get("/captures")

        assert response.status_code == 200
        body = response.get_json()
        assert [p["name"] for p in body] == ["Charmander", "Squirtle"]
        assert body[0] == {
            "number": 4,
            "name": "Charmander",
            "type_one": "Fire",
            "type_two": "",
            "total": 309,
            "hit_points": 50,
            "attack": 50,
            "defense": 50,
            "special_attack": 50,
            "special_defense": 50,
            "speed": 50,
            "generation": 1,
            "legendary": False,
        }

    def test_sorted_by_number_regardless_of_capture_order(self, ash):
        ash.post("/captures", json={"name": "Squirtle"})
        ash.post("/captures", json={"name": "Bulbasaur"})

        body = ash.get("/captures").get_json()

        assert [p["name"] for p in body] == ["Bulbasaur", "Squirtle"]

    def test_empty_when_nothing_captured(self, ash):
        assert ash.get("/captures").get_json() == []

    def test_only_returns_this_users_captures(self, ash, make_client):
        misty = make_client("misty")
        ash.post("/captures", json={"name": "Squirtle"})
        misty.post("/captures", json={"name": "Bulbasaur"})

        assert [p["name"] for p in ash.get("/captures").get_json()] == ["Squirtle"]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && pytest tests/test_captures.py -v -k TestCapturesEndpoint`
Expected: FAIL — `GET /captures` doesn't exist yet, so `test_requires_login` gets a 404 instead of 401 and the rest error out similarly.

- [ ] **Step 3: Implement `pokemon_for_names` in `pokemon_service.py`**

Add this method to the `PokemonService` class in `backend/pokemon_service.py`, right after `find_by_name`:

```python
    def pokemon_for_names(self, names):
        wanted = {n.lower() for n in names}
        matches = [p for p in self._snapshot()["pokemon"] if p["name"].lower() in wanted]
        return self.sort_pokemon(matches, "number", descending=False)
```

- [ ] **Step 4: Implement the route in `app.py`**

Add this route in `backend/app.py`, right after `release_pokemon`:

```python
@app.get("/captures")
def list_captures():
    username = _require_username()
    return jsonify(pokemon_service.pokemon_for_names(accounts.captured_names(username)))
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && pytest tests/test_captures.py -v -k TestCapturesEndpoint`
Expected: PASS (all 5 tests)

- [ ] **Step 6: Run the full backend suite and format**

Run: `cd backend && pytest && black .`
Expected: all tests pass; `black` reports no changes needed (or applies formatting — re-run pytest after if it does).

- [ ] **Step 7: Commit**

```bash
git add backend/pokemon_service.py backend/app.py backend/tests/test_captures.py
git commit -m "feat(backend): add GET /captures endpoint for the logged-in user's collection"
```

---

### Task 2: Frontend — `fetchCaptures` API call and `useCapturedPokemon` hook

**Files:**
- Modify: `frontend/src/api/accounts.ts`
- Create: `frontend/src/hooks/useCapturedPokemon.ts`
- Test: `frontend/src/hooks/useCapturedPokemon.test.tsx`

**Interfaces:**
- Consumes: `apiClient` from `frontend/src/api/client.ts`; `getErrorMessage(error: unknown): string` from the same file; `useIdentity(): Identity` from `frontend/src/hooks/useIdentity.ts`.
- Produces: `fetchCaptures(): Promise<Pokemon[]>` (in `api/accounts.ts`).
- Produces: `CAPTURES_QUERY_KEY = ["captures"] as const` and `useCapturedPokemon(): { data: Pokemon[] | undefined, isLoading: boolean, error: string | null, retry: () => void }` (in `hooks/useCapturedPokemon.ts`) — Task 3 and `CapturedPage` (Task 5) both depend on this exact key and shape.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/hooks/useCapturedPokemon.test.tsx`:

```tsx
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/renderWithProviders";
import { useCapturedPokemon } from "./useCapturedPokemon";
import * as accountsApi from "../api/accounts";
import type { Pokemon } from "../types";

function pokemon(number: number, name: string): Pokemon {
  return {
    number,
    name,
    type_one: "Fire",
    type_two: "",
    total: 300,
    hit_points: 50,
    attack: 50,
    defense: 50,
    special_attack: 50,
    special_defense: 50,
    speed: 50,
    generation: 1,
    legendary: false,
  };
}

describe("useCapturedPokemon", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not fetch when logged out", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: null, captured: [] });
    const spy = vi.spyOn(accountsApi, "fetchCaptures").mockResolvedValue([]);

    renderHookWithProviders(() => useCapturedPokemon());
    await waitFor(() => expect(accountsApi.fetchMe).toHaveBeenCalled());

    expect(spy).not.toHaveBeenCalled();
  });

  it("fetches and returns captured Pokémon when logged in", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: "ash", captured: ["Charmander"] });
    vi.spyOn(accountsApi, "fetchCaptures").mockResolvedValue([pokemon(4, "Charmander")]);

    const { result } = renderHookWithProviders(() => useCapturedPokemon());

    await waitFor(() => expect(result.current.data).toEqual([pokemon(4, "Charmander")]));
  });

  it("surfaces a readable error message on failure", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: "ash", captured: [] });
    vi.spyOn(accountsApi, "fetchCaptures").mockRejectedValue(new Error("network error"));

    const { result } = renderHookWithProviders(() => useCapturedPokemon());

    await waitFor(() => expect(result.current.error).toBe("network error"));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/hooks/useCapturedPokemon.test.tsx`
Expected: FAIL — `fetchCaptures` and `useCapturedPokemon` don't exist yet.

- [ ] **Step 3: Add `fetchCaptures` to `api/accounts.ts`**

Change the top import line and add the function. In `frontend/src/api/accounts.ts`:

```ts
import { apiClient } from "./client";
import type { Identity, Pokemon } from "../types";
```

Add at the end of the file:

```ts
export const fetchCaptures = async (): Promise<Pokemon[]> => {
  const response = await apiClient.get<Pokemon[]>("/captures");
  return response.data;
};
```

- [ ] **Step 4: Create `hooks/useCapturedPokemon.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchCaptures } from "../api/accounts";
import { getErrorMessage } from "../api/client";
import { useIdentity } from "./useIdentity";
import type { Pokemon } from "../types";

export const CAPTURES_QUERY_KEY = ["captures"] as const;

export const useCapturedPokemon = () => {
  const identity = useIdentity();
  const query = useQuery({
    queryKey: CAPTURES_QUERY_KEY,
    queryFn: fetchCaptures,
    enabled: !!identity.username,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.isError ? getErrorMessage(query.error) : null,
    retry: () => {
      void query.refetch();
    },
  };
};
```

`query.isLoading` (not `query.isPending`) is deliberate: `isPending` stays `true` forever for a disabled query (logged-out users, since `enabled: !!identity.username`) even though nothing is fetching, while `isLoading` is TanStack's own fetch-status-aware flag (`isPending && isFetching`) and correctly reads `false` when disabled.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/hooks/useCapturedPokemon.test.tsx`
Expected: PASS (all 3 tests)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/accounts.ts frontend/src/hooks/useCapturedPokemon.ts frontend/src/hooks/useCapturedPokemon.test.tsx
git commit -m "feat(frontend): add GET /captures client and useCapturedPokemon hook"
```

---

### Task 3: Frontend — keep the captures list in sync from `useCaptureMutation`

**Files:**
- Modify: `frontend/src/hooks/useCaptureMutation.ts`
- Modify: `frontend/src/hooks/useCaptureMutation.test.tsx`
- Modify: `frontend/src/pages/PokedexPage.tsx`

**Interfaces:**
- Consumes: `CAPTURES_QUERY_KEY` and `useCapturedPokemon` from Task 2.
- Produces: `useCaptureMutation()` mutate variables change from `{ name: string, captured: boolean }` to `{ pokemon: Pokemon, captured: boolean }` — this is a breaking change to every call site, all updated in this task.

- [ ] **Step 1: Rewrite the failing test**

Replace the contents of `frontend/src/hooks/useCaptureMutation.test.tsx`:

```tsx
import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/renderWithProviders";
import { useCaptureMutation } from "./useCaptureMutation";
import { useCapturedPokemon } from "./useCapturedPokemon";
import { useIdentity } from "./useIdentity";
import * as accountsApi from "../api/accounts";
import type { Pokemon } from "../types";

const PIKACHU: Pokemon = {
  number: 25,
  name: "Pikachu",
  type_one: "Electric",
  type_two: "",
  total: 320,
  hit_points: 35,
  attack: 55,
  defense: 40,
  special_attack: 50,
  special_defense: 50,
  speed: 90,
  generation: 1,
  legendary: false,
};

describe("useCaptureMutation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("optimistically adds the name and the full Pokémon, then keeps both after the server confirms", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: "ash", captured: [] });
    vi.spyOn(accountsApi, "fetchCaptures").mockResolvedValue([]);
    vi.spyOn(accountsApi, "capturePokemon").mockResolvedValue({ name: "Pikachu", captured: true });

    const { result } = renderHookWithProviders(() => ({
      identity: useIdentity(),
      captured: useCapturedPokemon(),
      captureMutation: useCaptureMutation(),
    }));
    await waitFor(() => expect(result.current.identity.username).toBe("ash"));
    await waitFor(() => expect(result.current.captured.data).toEqual([]));

    act(() => {
      result.current.captureMutation.mutate({ pokemon: PIKACHU, captured: false });
    });

    await waitFor(() => expect(result.current.identity.captured).toContain("Pikachu"));
    expect(result.current.captured.data).toEqual([PIKACHU]);
    await waitFor(() => expect(result.current.captureMutation.isSuccess).toBe(true));
    expect(result.current.identity.captured).toContain("Pikachu");
    expect(result.current.captured.data).toEqual([PIKACHU]);
  });

  it("rolls back both the name and the full Pokémon when the request fails", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: "ash", captured: [] });
    vi.spyOn(accountsApi, "fetchCaptures").mockResolvedValue([]);
    vi.spyOn(accountsApi, "capturePokemon").mockRejectedValue(new Error("network error"));

    const { result } = renderHookWithProviders(() => ({
      identity: useIdentity(),
      captured: useCapturedPokemon(),
      captureMutation: useCaptureMutation(),
    }));
    await waitFor(() => expect(result.current.identity.username).toBe("ash"));
    await waitFor(() => expect(result.current.captured.data).toEqual([]));

    act(() => {
      result.current.captureMutation.mutate({ pokemon: PIKACHU, captured: false });
    });

    await waitFor(() => expect(result.current.captureMutation.isError).toBe(true));
    expect(result.current.identity.captured).not.toContain("Pikachu");
    expect(result.current.captured.data).toEqual([]);
  });

  it("removes a Pokémon from the captured list immediately on release", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: "ash", captured: ["Pikachu"] });
    vi.spyOn(accountsApi, "fetchCaptures").mockResolvedValue([PIKACHU]);
    vi.spyOn(accountsApi, "releasePokemon").mockResolvedValue({ name: "Pikachu", captured: false });

    const { result } = renderHookWithProviders(() => ({
      captured: useCapturedPokemon(),
      captureMutation: useCaptureMutation(),
    }));
    await waitFor(() => expect(result.current.captured.data).toEqual([PIKACHU]));

    act(() => {
      result.current.captureMutation.mutate({ pokemon: PIKACHU, captured: true });
    });

    await waitFor(() => expect(result.current.captured.data).toEqual([]));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/hooks/useCaptureMutation.test.tsx`
Expected: FAIL — `useCaptureMutation` still expects `{ name, captured }` and never touches the captures cache.

- [ ] **Step 3: Rewrite `useCaptureMutation.ts`**

Replace the contents of `frontend/src/hooks/useCaptureMutation.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { capturePokemon, releasePokemon } from "../api/accounts";
import { ME_QUERY_KEY } from "./useIdentity";
import { CAPTURES_QUERY_KEY } from "./useCapturedPokemon";
import type { Identity, Pokemon } from "../types";

type CaptureVariables = { pokemon: Pokemon; captured: boolean };

export const useCaptureMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ pokemon, captured }: CaptureVariables) =>
      captured ? releasePokemon(pokemon.name) : capturePokemon(pokemon.name),
    onMutate: async ({ pokemon, captured }: CaptureVariables) => {
      await queryClient.cancelQueries({ queryKey: ME_QUERY_KEY });
      await queryClient.cancelQueries({ queryKey: CAPTURES_QUERY_KEY });

      const previousMe = queryClient.getQueryData<Identity>(ME_QUERY_KEY);
      queryClient.setQueryData<Identity>(ME_QUERY_KEY, (current) => {
        const base = current ?? { username: null, captured: [] };
        return {
          ...base,
          captured: captured
            ? base.captured.filter((n) => n !== pokemon.name)
            : [...base.captured, pokemon.name],
        };
      });

      const previousCaptures = queryClient.getQueryData<Pokemon[]>(CAPTURES_QUERY_KEY);
      queryClient.setQueryData<Pokemon[]>(CAPTURES_QUERY_KEY, (current) => {
        const base = current ?? [];
        if (captured) return base.filter((p) => p.name !== pokemon.name);
        if (base.some((p) => p.name === pokemon.name)) return base;
        return [...base, pokemon].sort((a, b) => a.number - b.number);
      });

      return { previousMe, previousCaptures };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousMe) queryClient.setQueryData(ME_QUERY_KEY, context.previousMe);
      if (context?.previousCaptures) {
        queryClient.setQueryData(CAPTURES_QUERY_KEY, context.previousCaptures);
      }
    },
    onSuccess: (result) => {
      queryClient.setQueryData<Identity>(ME_QUERY_KEY, (current) => {
        const base = current ?? { username: null, captured: [] };
        const withoutName = base.captured.filter((n) => n !== result.name);
        return { ...base, captured: result.captured ? [...withoutName, result.name] : withoutName };
      });
      queryClient.setQueryData<Pokemon[]>(CAPTURES_QUERY_KEY, (current) => {
        if (!current) return current;
        return result.captured ? current : current.filter((p) => p.name !== result.name);
      });
    },
  });
};
```

- [ ] **Step 4: Update `PokedexPage.tsx` call sites**

In `frontend/src/pages/PokedexPage.tsx`, change:

```ts
  const capturingName = captureMutation.isPending
    ? captureMutation.variables?.name
    : undefined;
```

to:

```ts
  const capturingName = captureMutation.isPending
    ? captureMutation.variables?.pokemon.name
    : undefined;
```

Change:

```ts
      captureMutate({ name: pokemon.name, captured });
```

to:

```ts
      captureMutate({ pokemon, captured });
```

Change (inside `handleLoginSubmit`):

```ts
        captureMutation.mutate({ name: current.name, captured: false });
```

to:

```ts
        captureMutation.mutate({ pokemon: current, captured: false });
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/hooks/useCaptureMutation.test.tsx`
Expected: PASS (all 3 tests)

- [ ] **Step 6: Run the full frontend suite**

Run: `cd frontend && npm run test`
Expected: all tests pass, including `App.test.tsx` and `PokedexPage`-adjacent tests (they exercise capture/release through the UI, not the mutation's variable shape directly, so they should be unaffected).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/useCaptureMutation.ts frontend/src/hooks/useCaptureMutation.test.tsx frontend/src/pages/PokedexPage.tsx
git commit -m "feat(frontend): keep the captures list cache in sync with every capture/release"
```

---

### Task 4: Frontend — `CapturedDeck` component

**Files:**
- Create: `frontend/src/components/pokedex/CapturedDeck.tsx`
- Test: `frontend/src/components/pokedex/CapturedDeck.test.tsx`

**Interfaces:**
- Consumes: `PokemonCard` from `./PokemonCard.tsx`; `iconUrl(name: string): string` from `../../api/pokemon.ts`; `Pokemon` from `../../types.ts`.
- Produces: `CapturedDeck({ items: Pokemon[], centerIndex: number, onNavigate: (direction: -1 | 1) => void, onRelease: (pokemon: Pokemon) => void, releasingName?: string })` — a presentational component with no data fetching of its own. `CapturedPage` (Task 5) renders this directly.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/pokedex/CapturedDeck.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { CapturedDeck } from "./CapturedDeck";
import type { Pokemon } from "../../types";

function pokemon(number: number, name: string): Pokemon {
  return {
    number,
    name,
    type_one: "Normal",
    type_two: "",
    total: 300,
    hit_points: 50,
    attack: 50,
    defense: 50,
    special_attack: 50,
    special_defense: 50,
    speed: 50,
    generation: 1,
    legendary: false,
  };
}

const ITEMS = [pokemon(1, "Bulbasaur"), pokemon(4, "Charmander"), pokemon(7, "Squirtle")];

describe("CapturedDeck", () => {
  it("shows the captured count and the centered card's full details", () => {
    renderWithProviders(
      <CapturedDeck items={ITEMS} centerIndex={1} onNavigate={vi.fn()} onRelease={vi.fn()} />,
    );

    expect(screen.getByText("3 captured")).toBeInTheDocument();
    expect(screen.getByText("Charmander")).toBeInTheDocument();
  });

  it("shows peeking neighbors by name", () => {
    renderWithProviders(
      <CapturedDeck items={ITEMS} centerIndex={1} onNavigate={vi.fn()} onRelease={vi.fn()} />,
    );

    expect(screen.getByText("Bulbasaur")).toBeInTheDocument();
    expect(screen.getByText("Squirtle")).toBeInTheDocument();
  });

  it("disables the left arrow at the first card and the right arrow at the last", () => {
    renderWithProviders(
      <CapturedDeck items={ITEMS} centerIndex={0} onNavigate={vi.fn()} onRelease={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).toBeEnabled();
  });

  it("calls onNavigate with the step direction when an arrow is clicked", async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <CapturedDeck items={ITEMS} centerIndex={1} onNavigate={onNavigate} onRelease={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(onNavigate).toHaveBeenCalledWith(1);

    await user.click(screen.getByRole("button", { name: /previous/i }));
    expect(onNavigate).toHaveBeenCalledWith(-1);
  });

  it("calls onRelease with the centered Pokémon when its release button is clicked", async () => {
    const onRelease = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <CapturedDeck items={ITEMS} centerIndex={1} onNavigate={vi.fn()} onRelease={onRelease} />,
    );

    await user.click(screen.getByRole("button", { name: /release charmander/i }));
    expect(onRelease).toHaveBeenCalledWith(ITEMS[1]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/components/pokedex/CapturedDeck.test.tsx`
Expected: FAIL — `CapturedDeck` doesn't exist yet.

- [ ] **Step 3: Implement `CapturedDeck.tsx`**

Create `frontend/src/components/pokedex/CapturedDeck.tsx`:

```tsx
import { useMemo } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { PokemonCard } from "./PokemonCard";
import { iconUrl } from "../../api/pokemon";
import type { Pokemon } from "../../types";

// Fan step per distance-from-center, capped at 3 neighbors each side --
// beyond that a card would be almost entirely transparent/off to the side
// anyway. Index 0 here is unused (the center card has its own styling
// below); indices 1-3 describe the 1st/2nd/3rd peeking neighbor.
const FAN_STEPS = [
  { rotate: 0, dy: -20, scale: 1.06, opacity: 1 },
  { rotate: 9, dy: 4, scale: 0.92, opacity: 0.8 },
  { rotate: 18, dy: 14, scale: 0.8, opacity: 0.55 },
  { rotate: 28, dy: 30, scale: 0.68, opacity: 0.35 },
];
const FAN_SPACING = 73;
const MAX_PEEK = FAN_STEPS.length - 1;

const PeekCard = ({ pokemon, offset }: { pokemon: Pokemon; offset: number }) => {
  const magnitude = Math.min(Math.abs(offset), MAX_PEEK);
  const step = FAN_STEPS[magnitude];
  const sign = Math.sign(offset);
  return (
    <Card
      sx={{
        position: "absolute",
        left: "50%",
        top: 20,
        width: 150,
        height: 210,
        borderRadius: "17px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.5,
        transition: "transform 0.2s ease, opacity 0.2s ease",
        transform: `translateX(calc(-50% + ${sign * magnitude * FAN_SPACING}px)) translateY(${step.dy}px) rotate(${sign * step.rotate}deg) scale(${step.scale})`,
        opacity: step.opacity,
        zIndex: 10 - magnitude,
      }}
    >
      <Box component="img" src={iconUrl(pokemon.name)} alt="" sx={{ width: 88, height: 88, objectFit: "contain" }} />
      <Typography variant="subtitle2" noWrap sx={{ maxWidth: "90%" }}>
        {pokemon.name}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        #{String(pokemon.number).padStart(3, "0")}
      </Typography>
    </Card>
  );
};

export const CapturedDeck = ({
  items,
  centerIndex,
  onNavigate,
  onRelease,
  releasingName,
}: {
  items: Pokemon[];
  centerIndex: number;
  onNavigate: (direction: -1 | 1) => void;
  onRelease: (pokemon: Pokemon) => void;
  releasingName?: string;
}) => {
  const center = items[centerIndex];
  const peeks = useMemo(() => {
    const result: { pokemon: Pokemon; offset: number }[] = [];
    for (let offset = -MAX_PEEK; offset <= MAX_PEEK; offset++) {
      if (offset === 0) continue;
      const pokemon = items[centerIndex + offset];
      if (pokemon) result.push({ pokemon, offset });
    }
    return result;
  }, [items, centerIndex]);

  if (!center) return null;

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ textAlign: "center", fontWeight: 600, mb: 1 }}>
        {items.length} captured
      </Typography>
      <Box sx={{ position: "relative", height: 460 }}>
        {peeks.map(({ pokemon, offset }) => (
          <PeekCard key={pokemon.name} pokemon={pokemon} offset={offset} />
        ))}
        <Box
          sx={{
            position: "absolute",
            left: "50%",
            top: 0,
            width: 260,
            height: 420,
            transition: "transform 0.2s ease",
            transform: "translateX(-50%)",
            zIndex: 10,
          }}
        >
          <PokemonCard
            pokemon={center}
            captured
            captureLoading={releasingName === center.name}
            onToggleCapture={() => onRelease(center)}
          />
        </Box>
        <IconButton
          aria-label="Previous captured Pokémon"
          disabled={centerIndex === 0}
          onClick={() => onNavigate(-1)}
          sx={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", zIndex: 20 }}
        >
          <ChevronLeftIcon />
        </IconButton>
        <IconButton
          aria-label="Next captured Pokémon"
          disabled={centerIndex === items.length - 1}
          onClick={() => onNavigate(1)}
          sx={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", zIndex: 20 }}
        >
          <ChevronRightIcon />
        </IconButton>
      </Box>
    </Box>
  );
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/components/pokedex/CapturedDeck.test.tsx`
Expected: PASS (all 5 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/pokedex/CapturedDeck.tsx frontend/src/components/pokedex/CapturedDeck.test.tsx
git commit -m "feat(frontend): add CapturedDeck fan-of-cards component"
```

---

### Task 5: Frontend — `CapturedPage`

**Files:**
- Create: `frontend/src/pages/CapturedPage.tsx`
- Test: `frontend/src/pages/CapturedPage.test.tsx`

**Interfaces:**
- Consumes: `useCapturedPokemon` (Task 2), `useCaptureMutation` (Task 3), `CapturedDeck` (Task 4), `useIdentity`, `EmptyState`, `ErrorState`, `PokemonCardSkeleton`.
- Produces: `CapturedPage` — a route element with no props, rendered at `/captured` (wired in Task 6).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pages/CapturedPage.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import { CapturedPage } from "./CapturedPage";
import * as accountsApi from "../api/accounts";
import type { Pokemon } from "../types";

function pokemon(number: number, name: string): Pokemon {
  return {
    number,
    name,
    type_one: "Fire",
    type_two: "",
    total: 300,
    hit_points: 50,
    attack: 50,
    defense: 50,
    special_attack: 50,
    special_defense: 50,
    speed: 50,
    generation: 1,
    legendary: false,
  };
}

const BULBASAUR = pokemon(1, "Bulbasaur");
const CHARMANDER = pokemon(4, "Charmander");
const SQUIRTLE = pokemon(7, "Squirtle");

describe("CapturedPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects away when logged out", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: null, captured: [] });
    renderWithProviders(<CapturedPage />, { initialEntries: ["/captured"] });

    await waitFor(() => expect(accountsApi.fetchMe).toHaveBeenCalled());
    expect(screen.queryByText("Your bag is empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pokemon-card-skeleton")).not.toBeInTheDocument();
  });

  it("shows the empty state with a link back when nothing is captured", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: "ash", captured: [] });
    vi.spyOn(accountsApi, "fetchCaptures").mockResolvedValue([]);
    renderWithProviders(<CapturedPage />, { initialEntries: ["/captured"] });

    await waitFor(() => expect(screen.getByText("Your bag is empty")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /back to the pokédex/i })).toHaveAttribute("href", "/");
  });

  it("centers the card named in ?card= on load", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({
      username: "ash",
      captured: ["Bulbasaur", "Charmander", "Squirtle"],
    });
    vi.spyOn(accountsApi, "fetchCaptures").mockResolvedValue([BULBASAUR, CHARMANDER, SQUIRTLE]);
    renderWithProviders(<CapturedPage />, { initialEntries: ["/captured?card=Squirtle"] });

    await waitFor(() => expect(screen.getByText("Squirtle")).toBeInTheDocument());
  });

  it("releasing the centered Pokémon removes it immediately and centers the next one", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({
      username: "ash",
      captured: ["Bulbasaur", "Charmander", "Squirtle"],
    });
    vi.spyOn(accountsApi, "fetchCaptures").mockResolvedValue([BULBASAUR, CHARMANDER, SQUIRTLE]);
    vi.spyOn(accountsApi, "releasePokemon").mockResolvedValue({ name: "Charmander", captured: false });
    const user = userEvent.setup();
    renderWithProviders(<CapturedPage />, { initialEntries: ["/captured?card=Charmander"] });

    await waitFor(() => expect(screen.getByText("Charmander")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /release charmander/i }));

    await waitFor(() => expect(screen.queryByText("Charmander")).not.toBeInTheDocument());
    expect(screen.getByText("Squirtle")).toBeInTheDocument();
    expect(screen.getByText("2 captured")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/CapturedPage.test.tsx`
Expected: FAIL — `CapturedPage` doesn't exist yet.

- [ ] **Step 3: Implement `CapturedPage.tsx`**

Create `frontend/src/pages/CapturedPage.tsx`:

```tsx
import { useCallback, useEffect, useRef } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import { CapturedDeck } from "../components/pokedex/CapturedDeck";
import { EmptyState } from "../components/general/EmptyState";
import { ErrorState } from "../components/general/ErrorState";
import { PokemonCardSkeleton } from "../components/pokedex/PokemonCardSkeleton";
import { useCaptureMutation } from "../hooks/useCaptureMutation";
import { useCapturedPokemon } from "../hooks/useCapturedPokemon";
import { useIdentity } from "../hooks/useIdentity";
import type { Pokemon } from "../types";

export const CapturedPage = () => {
  const identity = useIdentity();
  const captured = useCapturedPokemon();
  const captureMutation = useCaptureMutation();
  const [searchParams, setSearchParams] = useSearchParams();
  const lastIndexRef = useRef(0);

  const items = captured.data ?? [];
  const requestedName = searchParams.get("card");
  const requestedIndex = requestedName ? items.findIndex((p) => p.name === requestedName) : -1;
  const centerIndex =
    requestedIndex >= 0 ? requestedIndex : Math.min(lastIndexRef.current, Math.max(items.length - 1, 0));

  useEffect(() => {
    lastIndexRef.current = centerIndex;
  }, [centerIndex]);

  // Keeps the URL naming the actually-centered card: covers the very first
  // visit (no `?card` yet), a stale/foreign name, and -- since releasing
  // shifts `items` under the same numeric index -- the "next card slides
  // into center" behavior after a release, all through one self-healing
  // effect. Mirrors the canonicalization effect in useUrlState.ts.
  useEffect(() => {
    const current = items[centerIndex];
    if (current && searchParams.get("card") !== current.name) {
      setSearchParams({ card: current.name }, { replace: true });
    }
  }, [items, centerIndex, searchParams, setSearchParams]);

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, items.length - 1));
      const pokemon = items[clamped];
      if (pokemon) setSearchParams({ card: pokemon.name }, { replace: false });
    },
    [items, setSearchParams],
  );

  const handleNavigate = (direction: -1 | 1) => goTo(centerIndex + direction);
  const handleRelease = (pokemon: Pokemon) => captureMutation.mutate({ pokemon, captured: true });

  if (!identity.username) return <Navigate to="/" replace />;

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      {captured.isLoading ? (
        <Grid container spacing={2} justifyContent="center">
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <PokemonCardSkeleton />
          </Grid>
        </Grid>
      ) : captured.error ? (
        <ErrorState message={captured.error} onRetry={captured.retry} />
      ) : items.length === 0 ? (
        <Box sx={{ textAlign: "center" }}>
          <EmptyState title="Your bag is empty" description="Capture some Pokémon to see them here." />
          <Button component={Link} to="/" variant="contained" sx={{ mt: 1 }}>
            Back to the Pokédex
          </Button>
        </Box>
      ) : (
        <CapturedDeck
          items={items}
          centerIndex={centerIndex}
          onNavigate={handleNavigate}
          onRelease={handleRelease}
          releasingName={captureMutation.isPending ? captureMutation.variables?.pokemon.name : undefined}
        />
      )}
    </Container>
  );
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/CapturedPage.test.tsx`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/CapturedPage.tsx frontend/src/pages/CapturedPage.test.tsx
git commit -m "feat(frontend): add CapturedPage with ?card= position persistence"
```

---

### Task 6: Frontend — `BagFab` entry point, routing, and the asset

**Files:**
- Create: `frontend/src/assets/bag.png` (copied from the user-supplied file)
- Create: `frontend/src/components/pokedex/BagFab.tsx`
- Test: `frontend/src/components/pokedex/BagFab.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: `useIdentity` from `../../hooks/useIdentity.ts`; `CapturedPage` (Task 5).
- Produces: `BagFab` — no props, renders `null` when logged out or when `location.pathname === "/captured"`, otherwise a `Fab` linking to `/captured`.

- [ ] **Step 1: Copy the bag image into the project**

```bash
cp "/c/Users/naomi/Downloads/bag.png" "/c/Projects/pokedex/.claude/worktrees/pokemon-collection-page-b222a2/frontend/src/assets/bag.png"
```

- [ ] **Step 2: Write the failing test**

Create `frontend/src/components/pokedex/BagFab.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { BagFab } from "./BagFab";
import * as accountsApi from "../../api/accounts";

describe("BagFab", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when logged out", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: null, captured: [] });
    renderWithProviders(<BagFab />);

    await waitFor(() => expect(accountsApi.fetchMe).toHaveBeenCalled());
    expect(screen.queryByRole("link", { name: /view captured pok/i })).not.toBeInTheDocument();
  });

  it("renders a link to /captured when logged in", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: "ash", captured: [] });
    renderWithProviders(<BagFab />);

    const link = await screen.findByRole("link", { name: /view captured pok/i });
    expect(link).toHaveAttribute("href", "/captured");
  });

  it("renders nothing while already on the captured page", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: "ash", captured: [] });
    renderWithProviders(<BagFab />, { initialEntries: ["/captured"] });

    await waitFor(() => expect(accountsApi.fetchMe).toHaveBeenCalled());
    expect(screen.queryByRole("link", { name: /view captured pok/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/components/pokedex/BagFab.test.tsx`
Expected: FAIL — `BagFab` doesn't exist yet.

- [ ] **Step 4: Implement `BagFab.tsx`**

Create `frontend/src/components/pokedex/BagFab.tsx`:

```tsx
import Box from "@mui/material/Box";
import Fab from "@mui/material/Fab";
import { Link, useLocation } from "react-router-dom";
import bagIcon from "../../assets/bag.png";
import { useIdentity } from "../../hooks/useIdentity";

export const BagFab = () => {
  const identity = useIdentity();
  const location = useLocation();

  if (!identity.username || location.pathname === "/captured") return null;

  return (
    <Fab
      component={Link}
      to="/captured"
      aria-label="View captured Pokémon"
      sx={{
        position: "fixed",
        right: 24,
        bottom: 24,
        bgcolor: "background.paper",
        "&:hover": { bgcolor: "background.paper" },
      }}
    >
      <Box component="img" src={bagIcon} alt="" sx={{ width: 34, height: 34 }} />
    </Fab>
  );
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/components/pokedex/BagFab.test.tsx`
Expected: PASS (all 3 tests)

- [ ] **Step 6: Wire the route and the FAB into `App.tsx`**

Replace the contents of `frontend/src/App.tsx`:

```tsx
import { Route, Routes } from "react-router-dom";
import Box from "@mui/material/Box";
import { alpha } from "@mui/material/styles";
import { BagFab } from "./components/pokedex/BagFab";
import { NavBar } from "./components/navbar/NavBar";
import { CapturedPage } from "./pages/CapturedPage";
import { PokedexPage } from "./pages/PokedexPage";

const App = () => (
  <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
    <NavBar />
    <Box
      component="main"
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        scrollbarGutter: "stable",
        scrollbarWidth: "thin",
        scrollbarColor: (theme) =>
          `${alpha(theme.palette.primary.main, 0.5)} transparent`,
        "&::-webkit-scrollbar": { width: 10 },
        "&::-webkit-scrollbar-track": { backgroundColor: "transparent" },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.4),
          borderRadius: 8,
          border: "2px solid transparent",
          backgroundClip: "padding-box",
        },
        "&::-webkit-scrollbar-thumb:hover": {
          backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.65),
        },
      }}
    >
      <Routes>
        <Route path="/" element={<PokedexPage />} />
        <Route path="/captured" element={<CapturedPage />} />
      </Routes>
    </Box>
    <BagFab />
  </Box>
);

export default App;
```

- [ ] **Step 7: Add an end-to-end test to `App.test.tsx`**

Add this test inside the existing `describe("App", ...)` block in `frontend/src/App.test.tsx` (it can use the same `pokemon`/`page` helpers already defined at the top of the file):

```tsx
  it("navigates to the captured page via the bag FAB", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: "ash", captured: [] });
    vi.spyOn(accountsApi, "fetchCaptures").mockResolvedValue([]);
    vi.spyOn(pokemonApi, "fetchPokemonPage").mockResolvedValue(page([pokemon(1)], 1));
    const user = userEvent.setup();
    renderWithProviders(<App />);
    await waitFor(() => expect(screen.getByText("Mon1")).toBeInTheDocument());

    await user.click(screen.getByRole("link", { name: /view captured pok/i }));

    await waitFor(() => expect(screen.getByText("Your bag is empty")).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /view captured pok/i })).not.toBeInTheDocument();
  });
```

- [ ] **Step 8: Run the full frontend suite**

Run: `cd frontend && npm run test`
Expected: all tests pass, including the new `App.test.tsx` case.

- [ ] **Step 9: Lint and format**

Run: `cd frontend && npm run lint && npx prettier --check src/`
Expected: no errors. If prettier reports formatting issues, run `npx prettier --write src/` and re-run the test suite.

- [ ] **Step 10: Document the addition in the README**

Append a 6th item to the "Assumptions & design decisions" list in `README.md`:

```markdown

6. **Added a "captured Pokémon" page beyond the literal assignment text.** The assignment only asks for capture/release to work from the main list; the `/captured` page (opened via the bag button, bottom-right, once logged in) is an addition for browsing just your own collection. It persists which card is centered via a `?card=<name>` URL param rather than `sessionStorage` — unlike the main list's scroll position, there's no sub-pixel value to get right here, just an index, so the simpler URL-based approach was enough.
```

- [ ] **Step 11: Manual browser verification**

Run the backend (`cd backend && .venv/Scripts/python.exe app.py`) and frontend (`cd frontend && npm run dev`), then in a browser:
1. Log in and capture 4-5 Pokémon from the main list.
2. Confirm the bag FAB appears bottom-right; click it.
3. Confirm the fan layout, arrow navigation (bounds disable correctly), and the "N captured" counter.
4. Release the centered Pokémon; confirm it disappears immediately and the next one slides into center, with the counter decrementing.
5. Refresh the page; confirm the same card is still centered.
6. Release Pokémon down to zero; confirm the empty state and the link back to `/`.
7. Confirm the FAB is absent on `/captured` itself and absent entirely when logged out.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/assets/bag.png frontend/src/components/pokedex/BagFab.tsx frontend/src/components/pokedex/BagFab.test.tsx frontend/src/App.tsx frontend/src/App.test.tsx README.md
git commit -m "feat(frontend): add bag FAB entry point and wire up the /captured route"
```
