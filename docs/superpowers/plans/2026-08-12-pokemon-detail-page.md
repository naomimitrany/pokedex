# Pokémon Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/pokemon/:name` detail page, reachable by clicking a card in the grid, showing every DB field (including `total` and `generation`, which the grid doesn't display today) plus a working capture button.

**Architecture:** One new backend endpoint (`GET /pokemon/<name>`) reusing existing lookup/caching. On the frontend: a `usePokemonDetail` hook that uses data handed along via router `state` when navigating from the grid (no network round trip) and falls back to a fetch for direct visits/refreshes; a `useCaptureFlow` hook extracted from `PokedexPage` so the grid and the new detail page share identical capture/login-gate behavior instead of duplicating it; `PokemonCard` becomes a router `Link`.

**Tech Stack:** Flask (backend), React + TypeScript + React Router 7 + TanStack Query + MUI (frontend), pytest (backend tests), Vitest + Testing Library (frontend tests).

## Global Constraints

- Do not modify `backend/db.py` (assignment constraint).
- Backend format: run `black` (config in `backend/pyproject.toml`) on any changed `.py` file.
- Frontend format/lint: `prettier` (`frontend/.prettierrc.json`) and `npm run lint` (oxlint) must stay clean.
- No new data sources — `total` and `generation` are already present on every record returned by `/pokemon` and `pokemon_service.find_by_name`; nothing new needs to be added to `backend/pokemon_db.json`.
- Backend tests run via `cd backend && .venv/Scripts/python.exe -m pytest tests/ -v`.
- Frontend tests run via `cd frontend && npx vitest run <path>` (or `npm run test` for the whole suite).

---

### Task 1: Backend — `GET /pokemon/<name>`

**Files:**
- Modify: `backend/app.py`
- Test: `backend/tests/test_api.py`

**Interfaces:**
- Produces: `GET /pokemon/<name>` → `200` with the full Pokémon record (same shape as one item of `/pokemon`'s `items` array) on success, `404 {"error": "no Pokémon named '<name>'"}` when unknown (via the existing `UnknownPokemon` → `_handle_unknown_pokemon` error handler).

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/test_api.py` (new class, alongside the existing `TestIcon` class):

```python
class TestPokemonDetail:
    def test_returns_the_full_record(self, client):
        response = client.get("/pokemon/Bulbasaur")

        assert response.status_code == 200
        assert response.get_json() == {
            "number": 1,
            "name": "Bulbasaur",
            "type_one": "Grass",
            "type_two": "Poison",
            "total": 318,
            "hit_points": 50,
            "attack": 50,
            "defense": 50,
            "special_attack": 50,
            "special_defense": 50,
            "speed": 50,
            "generation": 1,
            "legendary": False,
        }

    def test_is_case_insensitive(self, client):
        assert client.get("/pokemon/bulbasaur").status_code == 200

    def test_unknown_name_is_a_404(self, client):
        response = client.get("/pokemon/Missingno")

        assert response.status_code == 404
        assert "error" in response.get_json()
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_api.py -k TestPokemonDetail -v`
Expected: FAIL with 404 "not found" (no matching route) for all three, since the route doesn't exist yet.

- [ ] **Step 3: Add the route**

In `backend/app.py`, add this route directly below `list_pokemon` (after the `@app.get("/pokemon")` function, before `@app.get("/types")`):

```python
@app.get("/pokemon/<name>")
def get_pokemon(name):
    return jsonify(_require_pokemon(name))
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_api.py -v`
Expected: PASS, including all pre-existing tests in the file (no regressions).

- [ ] **Step 5: Format and commit**

```bash
cd backend
.venv/Scripts/python.exe -m black app.py
git add backend/app.py backend/tests/test_api.py
git commit -m "feat(backend): add GET /pokemon/<name> for the detail page"
```

---

### Task 2: Frontend — `fetchPokemonDetail` API function

**Files:**
- Modify: `frontend/src/api/pokemon.ts`
- Test: `frontend/src/api/pokemon.test.ts`

**Interfaces:**
- Consumes: `apiClient` from `frontend/src/api/client.ts` (existing).
- Produces: `fetchPokemonDetail(name: string): Promise<Pokemon>` — `GET /pokemon/<encoded name>`.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/api/pokemon.test.ts` (new `it`, alongside the existing `fetchTypes`/`iconUrl` tests):

```ts
  it("fetchPokemonDetail requests the encoded name", async () => {
    const pokemon = {
      number: 1,
      name: "Bulbasaur",
      type_one: "Grass",
      type_two: "Poison",
      total: 318,
      hit_points: 45,
      attack: 49,
      defense: 49,
      special_attack: 65,
      special_defense: 65,
      speed: 45,
      generation: 1,
      legendary: false,
    };
    const spy = vi.spyOn(apiClient, "get").mockResolvedValue({ data: pokemon });

    await expect(fetchPokemonDetail("Mr. Mime")).resolves.toEqual(pokemon);
    expect(spy).toHaveBeenCalledWith("/pokemon/Mr.%20Mime");
  });
```

And update the import line at the top of the file:

```ts
import { fetchPokemonDetail, fetchPokemonPage, fetchTypes, iconUrl } from "./pokemon";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/api/pokemon.test.ts`
Expected: FAIL — `fetchPokemonDetail is not a function` / import error.

- [ ] **Step 3: Implement `fetchPokemonDetail`**

In `frontend/src/api/pokemon.ts`, add (after `fetchTypes`, before `iconUrl`):

```ts
export const fetchPokemonDetail = async (name: string): Promise<Pokemon> => {
  const response = await apiClient.get<Pokemon>(
    `/pokemon/${encodeURIComponent(name)}`,
  );
  return response.data;
};
```

This needs the `Pokemon` type in scope — the existing import line already reads `import type { PokemonPage, PokemonQuery } from "../types";`; change it to:

```ts
import type { Pokemon, PokemonPage, PokemonQuery } from "../types";
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/api/pokemon.test.ts`
Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/api/pokemon.ts src/api/pokemon.test.ts
git commit -m "feat(frontend): add fetchPokemonDetail API function"
```

---

### Task 3: Frontend — `usePokemonDetail` hook

**Files:**
- Modify: `frontend/src/test/renderWithProviders.tsx` (broaden `initialEntries` typing)
- Create: `frontend/src/hooks/usePokemonDetail.ts`
- Test: `frontend/src/hooks/usePokemonDetail.test.tsx`

**Interfaces:**
- Consumes: `fetchPokemonDetail` (Task 2), `getErrorMessage` from `frontend/src/api/client.ts` (existing), `Pokemon` type from `frontend/src/types.ts` (existing).
- Produces: `usePokemonDetail(name: string): { pokemon: Pokemon | undefined; isLoading: boolean; isError: boolean; notFound: boolean; errorMessage: string | null; retry: () => void }`.

- [ ] **Step 1: Broaden `renderWithProviders`'s `initialEntries` type**

The tests in this task need to seed router `state` (not just a path), which `MemoryRouter` supports via entry objects, but the test helper currently only accepts `string[]`. Rather than guessing the exact exported type name for a single entry, derive it directly from `MemoryRouter`'s own props — this is guaranteed to match whatever react-router-dom actually accepts.

In `frontend/src/test/renderWithProviders.tsx`, change the import line:

```ts
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router-dom";
```

(`ComponentProps` joins the existing `import type { ReactElement, ReactNode } from "react";` line — combine them into one `import type { ComponentProps, ReactElement, ReactNode } from "react";`.)

Add a local type alias right after the imports:

```ts
type InitialEntries = ComponentProps<typeof MemoryRouter>["initialEntries"];
```

Change both occurrences of `initialEntries?: string[];` / `initialEntries: string[];` to `InitialEntries`:

```ts
type ProviderOptions = {
  initialEntries?: InitialEntries;
  queryClient?: QueryClient;
};

const AllProviders = ({
  children,
  queryClient,
  initialEntries,
}: {
  children: ReactNode;
  queryClient: QueryClient;
  initialEntries: InitialEntries;
}) => (
```

(The two functions' destructured `initialEntries = ["/"]` defaults are unchanged — a plain string is a valid `InitialEntry`.)

- [ ] **Step 2: Run the existing test suite to confirm this alone is a no-op change**

Run: `cd frontend && npx vitest run src/test`
Expected: PASS (no test file lives directly in `src/test` other than `smoke.test.ts`; this step just confirms the type change didn't break the helper). Also run the full suite once to be safe: `npx vitest run`. Expected: PASS, same as before this step (no behavior changed yet).

- [ ] **Step 3: Write the failing tests**

Create `frontend/src/hooks/usePokemonDetail.test.tsx`:

```tsx
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/renderWithProviders";
import { usePokemonDetail } from "./usePokemonDetail";
import * as pokemonApi from "../api/pokemon";
import type { Pokemon } from "../types";

const bulbasaur: Pokemon = {
  number: 1,
  name: "Bulbasaur",
  type_one: "Grass",
  type_two: "Poison",
  total: 318,
  hit_points: 45,
  attack: 49,
  defense: 49,
  special_attack: 65,
  special_defense: 65,
  speed: 45,
  generation: 1,
  legendary: false,
};

describe("usePokemonDetail", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the router-state pokemon immediately, and still revalidates in the background", async () => {
    const fetchSpy = vi
      .spyOn(pokemonApi, "fetchPokemonDetail")
      .mockResolvedValue(bulbasaur);

    const { result } = renderHookWithProviders(
      () => usePokemonDetail("Bulbasaur"),
      {
        initialEntries: [
          { pathname: "/pokemon/Bulbasaur", state: { pokemon: bulbasaur } },
        ],
      },
    );

    expect(result.current.pokemon).toEqual(bulbasaur);
    expect(result.current.isLoading).toBe(false);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith("Bulbasaur"));
  });

  it("fetches from the API when there's no router state", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonDetail").mockResolvedValue(bulbasaur);

    const { result } = renderHookWithProviders(
      () => usePokemonDetail("Bulbasaur"),
      { initialEntries: ["/pokemon/Bulbasaur"] },
    );

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.pokemon).toEqual(bulbasaur));
  });

  it("ignores router state for a different pokemon than the URL asks for", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonDetail").mockResolvedValue(bulbasaur);

    const { result } = renderHookWithProviders(
      () => usePokemonDetail("Bulbasaur"),
      {
        initialEntries: [
          {
            pathname: "/pokemon/Bulbasaur",
            state: { pokemon: { ...bulbasaur, name: "Ivysaur" } },
          },
        ],
      },
    );

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.pokemon).toEqual(bulbasaur));
  });

  it("flags a 404 as not found rather than a generic error", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonDetail").mockRejectedValue(
      Object.assign(new Error("no Pokémon named 'Missingno'"), {
        isAxiosError: true,
        response: {
          status: 404,
          data: { error: "no Pokémon named 'Missingno'" },
        },
      }),
    );

    const { result } = renderHookWithProviders(
      () => usePokemonDetail("Missingno"),
      { initialEntries: ["/pokemon/Missingno"] },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.notFound).toBe(true);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/hooks/usePokemonDetail.test.tsx`
Expected: FAIL — module `./usePokemonDetail` doesn't exist yet.

- [ ] **Step 5: Implement the hook**

Create `frontend/src/hooks/usePokemonDetail.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { getErrorMessage } from "../api/client";
import { fetchPokemonDetail } from "../api/pokemon";
import type { Pokemon } from "../types";

export const usePokemonDetail = (name: string) => {
  const location = useLocation();
  const stateData = (location.state as { pokemon?: Pokemon } | null)
    ?.pokemon;
  // Only trust router state when it's actually for this route's name --
  // otherwise a stale Link click followed by editing the URL bar would show
  // the wrong Pokemon until the background refetch lands.
  const initialData =
    stateData && stateData.name.toLowerCase() === name.toLowerCase()
      ? stateData
      : undefined;

  const query = useQuery({
    queryKey: ["pokemonDetail", name.toLowerCase()],
    queryFn: () => fetchPokemonDetail(name),
    initialData,
  });

  const notFound =
    query.isError &&
    axios.isAxiosError(query.error) &&
    query.error.response?.status === 404;

  return {
    pokemon: query.data,
    isLoading: query.isPending,
    isError: query.isError,
    notFound,
    errorMessage: query.isError ? getErrorMessage(query.error) : null,
    retry: () => void query.refetch(),
  };
};
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/hooks/usePokemonDetail.test.tsx`
Expected: PASS, all four tests.

- [ ] **Step 7: Commit**

```bash
cd frontend
git add src/test/renderWithProviders.tsx src/hooks/usePokemonDetail.ts src/hooks/usePokemonDetail.test.tsx
git commit -m "feat(frontend): add usePokemonDetail hook"
```

---

### Task 4: Frontend — extract `useCaptureFlow`, refactor `PokedexPage`

**Files:**
- Create: `frontend/src/hooks/useCaptureFlow.ts`
- Test: `frontend/src/hooks/useCaptureFlow.test.tsx`
- Modify: `frontend/src/pages/PokedexPage.tsx`

**Interfaces:**
- Consumes: `useIdentity`, `useCaptureMutation`, `useLoginMutation` (all existing, unchanged).
- Produces: `useCaptureFlow(): { capturedNames: Set<string>; capturingName: string | undefined; handleToggleCapture: (pokemon: Pokemon, captured: boolean) => void; pendingCapture: Pokemon | null; closePendingCapture: () => void; handleLoginSubmit: (username: string) => Promise<void>; loginError: string | null; snackbarMessage: string | null; dismissSnackbar: () => void }`. `PokemonDetailPage` (Task 6) consumes this same shape.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/hooks/useCaptureFlow.test.tsx`:

```tsx
import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/renderWithProviders";
import { useCaptureFlow } from "./useCaptureFlow";
import * as accountsApi from "../api/accounts";
import type { Pokemon } from "../types";

const pikachu: Pokemon = {
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

describe("useCaptureFlow", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens the login prompt instead of capturing when logged out", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({
      username: null,
      captured: [],
    });
    const capturePokemon = vi.spyOn(accountsApi, "capturePokemon");

    const { result } = renderHookWithProviders(() => useCaptureFlow());
    await waitFor(() => expect(result.current.pendingCapture).toBeNull());

    act(() => {
      result.current.handleToggleCapture(pikachu, false);
    });

    expect(result.current.pendingCapture).toEqual(pikachu);
    expect(capturePokemon).not.toHaveBeenCalled();
  });

  it("captures immediately when already logged in", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({
      username: "ash",
      captured: [],
    });
    vi.spyOn(accountsApi, "capturePokemon").mockResolvedValue({
      name: "Pikachu",
      captured: true,
    });

    const { result } = renderHookWithProviders(() => useCaptureFlow());
    await waitFor(() => expect(result.current.capturedNames.size).toBe(0));

    act(() => {
      result.current.handleToggleCapture(pikachu, false);
    });

    await waitFor(() =>
      expect(result.current.capturedNames.has("Pikachu")).toBe(true),
    );
    expect(result.current.pendingCapture).toBeNull();
  });

  it("captures the pending pokemon after a successful login", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({
      username: null,
      captured: [],
    });
    vi.spyOn(accountsApi, "login").mockResolvedValue({
      username: "misty",
      captured: [],
    });
    vi.spyOn(accountsApi, "capturePokemon").mockResolvedValue({
      name: "Pikachu",
      captured: true,
    });

    const { result } = renderHookWithProviders(() => useCaptureFlow());
    await waitFor(() => expect(result.current.pendingCapture).toBeNull());

    act(() => {
      result.current.handleToggleCapture(pikachu, false);
    });
    expect(result.current.pendingCapture).toEqual(pikachu);

    await act(async () => {
      await result.current.handleLoginSubmit("misty");
    });

    expect(result.current.pendingCapture).toBeNull();
    await waitFor(() =>
      expect(result.current.capturedNames.has("Pikachu")).toBe(true),
    );
  });

  it("shows a snackbar message when the capture mutation fails", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({
      username: "ash",
      captured: [],
    });
    vi.spyOn(accountsApi, "capturePokemon").mockRejectedValue(
      new Error("network error"),
    );

    const { result } = renderHookWithProviders(() => useCaptureFlow());
    await waitFor(() => expect(result.current.capturedNames.size).toBe(0));

    act(() => {
      result.current.handleToggleCapture(pikachu, false);
    });

    await waitFor(() =>
      expect(result.current.snackbarMessage).toBe(
        "Couldn't update capture. Try again.",
      ),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/hooks/useCaptureFlow.test.tsx`
Expected: FAIL — module `./useCaptureFlow` doesn't exist yet.

- [ ] **Step 3: Implement the hook**

Create `frontend/src/hooks/useCaptureFlow.ts`. This is the capture/login-gate logic currently inline in `PokedexPage`, moved verbatim (see `frontend/src/pages/PokedexPage.tsx` lines 26-30 and 86-126 for the source of truth being extracted):

```ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCaptureMutation } from "./useCaptureMutation";
import { useIdentity } from "./useIdentity";
import { useLoginMutation } from "./useLoginMutation";
import type { Pokemon } from "../types";

export const useCaptureFlow = () => {
  const identity = useIdentity();
  const captureMutation = useCaptureMutation();
  const loginMutation = useLoginMutation();

  const [pendingCapture, setPendingCapture] = useState<Pokemon | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  useEffect(() => {
    if (captureMutation.isError) {
      setSnackbarMessage("Couldn't update capture. Try again.");
    }
  }, [captureMutation.isError]);

  const capturedNames = useMemo(
    () => new Set(identity.captured),
    [identity.captured],
  );

  const capturingName = captureMutation.isPending
    ? captureMutation.variables?.name
    : undefined;

  const captureMutate = captureMutation.mutate;
  const handleToggleCapture = useCallback(
    (pokemon: Pokemon, captured: boolean) => {
      if (!identity.username) {
        setPendingCapture(pokemon);
        return;
      }
      captureMutate({ name: pokemon.name, captured });
    },
    [identity.username, captureMutate],
  );

  const handleLoginSubmit = useCallback(
    async (username: string) => {
      await loginMutation.login(username);
      setPendingCapture((current) => {
        if (current) {
          // pendingCapture only ever arises from a capture click on an
          // anonymous (therefore always-uncaptured) card.
          captureMutation.mutate({ name: current.name, captured: false });
        }
        return null;
      });
    },
    [loginMutation, captureMutation],
  );

  return {
    capturedNames,
    capturingName,
    handleToggleCapture,
    pendingCapture,
    closePendingCapture: () => setPendingCapture(null),
    handleLoginSubmit,
    loginError: loginMutation.error,
    snackbarMessage,
    dismissSnackbar: () => setSnackbarMessage(null),
  };
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/hooks/useCaptureFlow.test.tsx`
Expected: PASS, all four tests.

- [ ] **Step 5: Refactor `PokedexPage` to use the hook**

In `frontend/src/pages/PokedexPage.tsx`:

Replace the import block:

```ts
import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Snackbar from "@mui/material/Snackbar";
import { FilterBar } from "../components/pokedex/FilterBar";
import { LoginPrompt } from "../components/pokedex/LoginPrompt";
import { PokemonCardSkeleton } from "../components/pokedex/PokemonCardSkeleton";
import { PokemonGrid } from "../components/pokedex/PokemonGrid";
import { useCaptureMutation } from "../hooks/useCaptureMutation";
import { useIdentity } from "../hooks/useIdentity";
import { useLoginMutation } from "../hooks/useLoginMutation";
import { usePokemonList } from "../hooks/usePokemonList";
import {
  getSavedScrollEntry,
  useScrollRestoration,
} from "../hooks/useScrollRestoration";
import { useTypes } from "../hooks/useTypes";
import { useUrlState } from "../hooks/useUrlState";
import type { Pokemon } from "../types";
import { buildScrollKey } from "../utils/scrollKey";
```

with:

```ts
import { useEffect, useMemo } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Snackbar from "@mui/material/Snackbar";
import { FilterBar } from "../components/pokedex/FilterBar";
import { LoginPrompt } from "../components/pokedex/LoginPrompt";
import { PokemonCardSkeleton } from "../components/pokedex/PokemonCardSkeleton";
import { PokemonGrid } from "../components/pokedex/PokemonGrid";
import { useCaptureFlow } from "../hooks/useCaptureFlow";
import { usePokemonList } from "../hooks/usePokemonList";
import {
  getSavedScrollEntry,
  useScrollRestoration,
} from "../hooks/useScrollRestoration";
import { useTypes } from "../hooks/useTypes";
import { useUrlState } from "../hooks/useUrlState";
import { buildScrollKey } from "../utils/scrollKey";
```

Replace:

```ts
  const { state: filters, setFilters } = useUrlState();
  const types = useTypes();
  const identity = useIdentity();
  const captureMutation = useCaptureMutation();
  const loginMutation = useLoginMutation();
```

with:

```ts
  const { state: filters, setFilters } = useUrlState();
  const types = useTypes();
  const captureFlow = useCaptureFlow();
```

Delete this whole block entirely (it now lives in `useCaptureFlow`):

```ts
  const [pendingCapture, setPendingCapture] = useState<Pokemon | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  useEffect(() => {
    if (captureMutation.isError) {
      setSnackbarMessage("Couldn't update capture. Try again.");
    }
  }, [captureMutation.isError]);

  const capturedNames = useMemo(
    () => new Set(identity.captured),
    [identity.captured],
  );

  const capturingName = captureMutation.isPending
    ? captureMutation.variables?.name
    : undefined;

  const captureMutate = captureMutation.mutate;
  const handleToggleCapture = useCallback(
    (pokemon: Pokemon, captured: boolean) => {
      if (!identity.username) {
        setPendingCapture(pokemon);
        return;
      }
      captureMutate({ name: pokemon.name, captured });
    },
    [identity.username, captureMutate],
  );

  const handleLoginSubmit = async (username: string) => {
    await loginMutation.login(username);
    setPendingCapture((current) => {
      if (current) {
        // pendingCapture only ever arises from a capture click on an
        // anonymous (therefore always-uncaptured) card.
        captureMutation.mutate({ name: current.name, captured: false });
      }
      return null;
    });
  };
```

In the JSX, replace:

```tsx
            <PokemonGrid
              items={list.items}
              capturedNames={capturedNames}
              capturingName={capturingName}
              isLoading={list.isLoading}
              isFetchingNextPage={list.isFetchingNextPage}
              error={list.error}
              hasMore={list.hasMore}
              onLoadMore={list.loadMore}
              onRetry={list.retry}
              onToggleCapture={handleToggleCapture}
              pageSize={filters.pageSize}
              restoredCount={restoredCount}
            />
```

with:

```tsx
            <PokemonGrid
              items={list.items}
              capturedNames={captureFlow.capturedNames}
              capturingName={captureFlow.capturingName}
              isLoading={list.isLoading}
              isFetchingNextPage={list.isFetchingNextPage}
              error={list.error}
              hasMore={list.hasMore}
              onLoadMore={list.loadMore}
              onRetry={list.retry}
              onToggleCapture={captureFlow.handleToggleCapture}
              pageSize={filters.pageSize}
              restoredCount={restoredCount}
            />
```

And replace:

```tsx
      <LoginPrompt
        open={pendingCapture !== null}
        onClose={() => setPendingCapture(null)}
        onSubmit={handleLoginSubmit}
        error={loginMutation.error}
      />
      <Snackbar
        open={snackbarMessage !== null}
        autoHideDuration={4000}
        onClose={() => setSnackbarMessage(null)}
      >
        <Alert severity="error" onClose={() => setSnackbarMessage(null)}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
```

with:

```tsx
      <LoginPrompt
        open={captureFlow.pendingCapture !== null}
        onClose={captureFlow.closePendingCapture}
        onSubmit={captureFlow.handleLoginSubmit}
        error={captureFlow.loginError}
      />
      <Snackbar
        open={captureFlow.snackbarMessage !== null}
        autoHideDuration={4000}
        onClose={captureFlow.dismissSnackbar}
      >
        <Alert severity="error" onClose={captureFlow.dismissSnackbar}>
          {captureFlow.snackbarMessage}
        </Alert>
      </Snackbar>
```

- [ ] **Step 6: Typecheck and lint to catch stray unused imports**

Run: `cd frontend && npx tsc -b --noEmit && npm run lint`
Expected: no errors. (This is the safety net for the import surgery in Step 5 — if `useEffect` or `useMemo` end up unused, or anything else drifts, this catches it immediately.)

- [ ] **Step 7: Run the full frontend test suite**

Run: `cd frontend && npx vitest run`
Expected: PASS — this refactor changes no behavior, so every pre-existing test (including any `PokemonGrid`/`FilterBar` tests exercising the grid end-to-end) should still pass unmodified.

- [ ] **Step 8: Commit**

```bash
cd frontend
git add src/hooks/useCaptureFlow.ts src/hooks/useCaptureFlow.test.tsx src/pages/PokedexPage.tsx
git commit -m "refactor(frontend): extract useCaptureFlow out of PokedexPage"
```

---

### Task 5: Frontend — `PokemonCard` becomes a link to the detail page

**Files:**
- Modify: `frontend/src/components/pokedex/PokemonCard.tsx`
- Modify: `frontend/src/components/pokedex/CaptureButton.tsx`
- Modify: `frontend/src/components/pokedex/PokemonCard.test.tsx`

**Interfaces:**
- Produces: clicking a `PokemonCard` navigates to `/pokemon/<encoded name>` with router `state: { pokemon }`; clicking its `CaptureButton` does not navigate.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `frontend/src/components/pokedex/PokemonCard.test.tsx`:

```tsx
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { PokemonCard } from "./PokemonCard";
import { renderWithProviders } from "../../test/renderWithProviders";
import type { Pokemon } from "../../types";

const bulbasaur: Pokemon = {
  number: 1,
  name: "Bulbasaur",
  type_one: "Grass",
  type_two: "Poison",
  total: 318,
  hit_points: 45,
  attack: 49,
  defense: 49,
  special_attack: 65,
  special_defense: 65,
  speed: 45,
  generation: 1,
  legendary: false,
};

describe("PokemonCard", () => {
  it("renders the name, number, and both type chips", () => {
    renderWithProviders(
      <PokemonCard
        pokemon={bulbasaur}
        captured={false}
        onToggleCapture={vi.fn()}
      />,
    );
    expect(screen.getByText("Bulbasaur")).toBeInTheDocument();
    expect(screen.getByText("#001")).toBeInTheDocument();
    expect(screen.getByText("Grass")).toBeInTheDocument();
    expect(screen.getByText("Poison")).toBeInTheDocument();
  });

  it("omits the second chip when type_two is empty", () => {
    renderWithProviders(
      <PokemonCard
        pokemon={{ ...bulbasaur, type_two: "" }}
        captured={false}
        onToggleCapture={vi.fn()}
      />,
    );
    expect(screen.queryByText("Poison")).not.toBeInTheDocument();
  });

  it("shows an uncaptured affordance and captures on click", async () => {
    const onToggleCapture = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <PokemonCard
        pokemon={bulbasaur}
        captured={false}
        onToggleCapture={onToggleCapture}
      />,
    );
    const button = screen.getByRole("button", { name: /capture bulbasaur/i });
    await user.click(button);
    expect(onToggleCapture).toHaveBeenCalledWith(bulbasaur, false);
  });

  it("shows a captured affordance when already captured", () => {
    renderWithProviders(
      <PokemonCard pokemon={bulbasaur} captured onToggleCapture={vi.fn()} />,
    );
    expect(
      screen.getByRole("button", { name: /release bulbasaur/i }),
    ).toBeInTheDocument();
  });

  it("uses the icon endpoint for the sprite", () => {
    renderWithProviders(
      <PokemonCard
        pokemon={bulbasaur}
        captured={false}
        onToggleCapture={vi.fn()}
      />,
    );
    expect(screen.getByRole("img", { name: "Bulbasaur" })).toHaveAttribute(
      "src",
      "http://localhost:8080/icon/Bulbasaur",
    );
  });

  it("shows a skeleton over the sprite until the image loads, then hides it", () => {
    renderWithProviders(
      <PokemonCard
        pokemon={bulbasaur}
        captured={false}
        onToggleCapture={vi.fn()}
      />,
    );
    const image = screen.getByRole("img", { name: "Bulbasaur" });
    expect(document.querySelector(".MuiSkeleton-circular")).toBeInTheDocument();
    expect(image).toHaveStyle({ opacity: 0 });

    fireEvent.load(image);

    expect(
      document.querySelector(".MuiSkeleton-circular"),
    ).not.toBeInTheDocument();
    expect(image).toHaveStyle({ opacity: 1 });
  });

  it("hides the sprite skeleton even if the image fails to load", () => {
    renderWithProviders(
      <PokemonCard
        pokemon={bulbasaur}
        captured={false}
        onToggleCapture={vi.fn()}
      />,
    );
    const image = screen.getByRole("img", { name: "Bulbasaur" });

    fireEvent.error(image);

    expect(
      document.querySelector(".MuiSkeleton-circular"),
    ).not.toBeInTheDocument();
  });

  it("links to the pokemon's detail page", () => {
    renderWithProviders(
      <PokemonCard
        pokemon={bulbasaur}
        captured={false}
        onToggleCapture={vi.fn()}
      />,
    );
    expect(screen.getByRole("link", { name: /bulbasaur/i })).toHaveAttribute(
      "href",
      "/pokemon/Bulbasaur",
    );
  });

  it("clicking the capture button does not navigate to the detail page", async () => {
    const onToggleCapture = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route
          path="/"
          element={
            <PokemonCard
              pokemon={bulbasaur}
              captured={false}
              onToggleCapture={onToggleCapture}
            />
          }
        />
        <Route path="/pokemon/:name" element={<div>detail page</div>} />
      </Routes>,
    );

    const button = screen.getByRole("button", { name: /capture bulbasaur/i });
    await user.click(button);

    expect(onToggleCapture).toHaveBeenCalledWith(bulbasaur, false);
    expect(screen.queryByText("detail page")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `cd frontend && npx vitest run src/components/pokedex/PokemonCard.test.tsx`
Expected: the two new tests (`links to the pokemon's detail page`, `clicking the capture button does not navigate...`) FAIL — there's no link yet. The pre-existing tests should still PASS since `renderWithProviders` is a drop-in superset of plain `render`.

- [ ] **Step 3: Make `PokemonCard`'s root a `Link`**

In `frontend/src/components/pokedex/PokemonCard.tsx`, add the import (alongside the other imports, e.g. after the `Typography` import):

```ts
import { Link } from "react-router-dom";
```

Replace the outer `Box` opening tag:

```tsx
      <Box
        sx={{
          position: "relative",
          height: "100%",
          borderRadius: "20px",
          overflow: "hidden",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
          "&:hover": {
            transform: "translateY(-3px)",
            boxShadow: "0 14px 12px -10px rgba(0,0,0,0.4)",
          },
        }}
      >
```

with:

```tsx
      <Box
        component={Link}
        to={`/pokemon/${encodeURIComponent(pokemon.name)}`}
        state={{ pokemon }}
        sx={{
          position: "relative",
          height: "100%",
          borderRadius: "20px",
          overflow: "hidden",
          display: "block",
          textDecoration: "none",
          color: "inherit",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
          "&:hover": {
            transform: "translateY(-3px)",
            boxShadow: "0 14px 12px -10px rgba(0,0,0,0.4)",
          },
        }}
      >
```

- [ ] **Step 4: Stop the capture click from bubbling into the link**

In `frontend/src/components/pokedex/CaptureButton.tsx`, replace:

```tsx
          onClick={(e) => {
            e.currentTarget.blur();
            setIsShaking(true);
            onToggle();
          }}
```

with:

```tsx
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.blur();
            setIsShaking(true);
            onToggle();
          }}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/pokedex/PokemonCard.test.tsx`
Expected: PASS, all 8 tests.

- [ ] **Step 6: Run the full frontend suite (PokemonGrid renders PokemonCard)**

Run: `cd frontend && npx vitest run`
Expected: PASS. `PokemonGrid.test.tsx` renders `PokemonCard` inside a grid — confirm it also passes now that `PokemonCard` requires router context (it should, since `PokemonGrid.test.tsx` presumably already uses `renderWithProviders`; if it uses plain `render` instead, switch it to `renderWithProviders` the same way as Step 1 above and re-run).

- [ ] **Step 7: Commit**

```bash
cd frontend
git add src/components/pokedex/PokemonCard.tsx src/components/pokedex/CaptureButton.tsx src/components/pokedex/PokemonCard.test.tsx
git commit -m "feat(frontend): make PokemonCard link to its detail page"
```

---

### Task 6: Frontend — `PokemonDetailPage` and route wiring

**Files:**
- Create: `frontend/src/pages/PokemonDetailPage.tsx`
- Test: `frontend/src/pages/PokemonDetailPage.test.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `usePokemonDetail` (Task 3), `useCaptureFlow` (Task 4), `PokemonSprite`, `PokemonStats`, `CaptureButton`, `LoginPrompt` (all existing), `ErrorState` (existing), `typeColor`/`typeGradient` (existing).
- Produces: route `/pokemon/:name` in `App.tsx`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/pages/PokemonDetailPage.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import { PokemonDetailPage } from "./PokemonDetailPage";
import * as pokemonApi from "../api/pokemon";
import * as accountsApi from "../api/accounts";
import type { Pokemon } from "../types";

const bulbasaur: Pokemon = {
  number: 1,
  name: "Bulbasaur",
  type_one: "Grass",
  type_two: "Poison",
  total: 318,
  hit_points: 45,
  attack: 49,
  defense: 49,
  special_attack: 65,
  special_defense: 65,
  speed: 45,
  generation: 1,
  legendary: false,
};

const renderPage = (path: string) => {
  vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({
    username: null,
    captured: [],
  });
  return renderWithProviders(
    <Routes>
      <Route path="/pokemon/:name" element={<PokemonDetailPage />} />
    </Routes>,
    { initialEntries: [path] },
  );
};

describe("PokemonDetailPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading skeleton while fetching", () => {
    vi.spyOn(pokemonApi, "fetchPokemonDetail").mockReturnValue(
      new Promise(() => {}),
    );

    renderPage("/pokemon/Bulbasaur");

    expect(screen.getByTestId("pokemon-detail-skeleton")).toBeInTheDocument();
  });

  it("renders every field once loaded, including total and generation", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonDetail").mockResolvedValue(bulbasaur);

    renderPage("/pokemon/Bulbasaur");

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Bulbasaur" })).toBeInTheDocument(),
    );
    expect(screen.getByText("#001")).toBeInTheDocument();
    expect(screen.getByText("Grass")).toBeInTheDocument();
    expect(screen.getByText("Poison")).toBeInTheDocument();
    expect(screen.getByText("318")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows a not-found message for an unknown pokemon", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonDetail").mockRejectedValue(
      Object.assign(new Error("no Pokémon named 'Missingno'"), {
        isAxiosError: true,
        response: {
          status: 404,
          data: { error: "no Pokémon named 'Missingno'" },
        },
      }),
    );

    renderPage("/pokemon/Missingno");

    await waitFor(() =>
      expect(screen.getByText(/no pokémon named/i)).toBeInTheDocument(),
    );
  });

  it("opens the login prompt when capturing while logged out", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonDetail").mockResolvedValue(bulbasaur);
    const user = userEvent.setup();

    renderPage("/pokemon/Bulbasaur");
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Bulbasaur" })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /capture bulbasaur/i }));

    expect(
      screen.getByRole("heading", { name: /name your trainer/i }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/pages/PokemonDetailPage.test.tsx`
Expected: FAIL — module `./PokemonDetailPage` doesn't exist yet.

- [ ] **Step 3: Implement `PokemonDetailPage`**

Create `frontend/src/pages/PokemonDetailPage.tsx`:

```tsx
import { Link, useNavigate, useParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Skeleton from "@mui/material/Skeleton";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { CaptureButton } from "../components/pokedex/CaptureButton";
import { LoginPrompt } from "../components/pokedex/LoginPrompt";
import { PokemonSprite } from "../components/pokedex/PokemonSprite";
import { PokemonStats } from "../components/pokedex/PokemonStats";
import { ErrorState } from "../components/general/ErrorState";
import { useCaptureFlow } from "../hooks/useCaptureFlow";
import { usePokemonDetail } from "../hooks/usePokemonDetail";
import { typeColor, typeGradient } from "../utils/typeColors";

export const PokemonDetailPage = () => {
  const { name = "" } = useParams();
  const navigate = useNavigate();
  const detail = usePokemonDetail(name);
  const captureFlow = useCaptureFlow();

  if (detail.isLoading) {
    return (
      <Container maxWidth="sm" sx={{ py: 3 }} data-testid="pokemon-detail-skeleton">
        <Skeleton variant="text" width={80} height={32} sx={{ mb: 2 }} />
        <Skeleton
          variant="rounded"
          height={260}
          sx={{ borderRadius: "24px", mb: 3 }}
        />
        <Skeleton variant="rounded" height={180} sx={{ borderRadius: 2 }} />
      </Container>
    );
  }

  if (detail.notFound) {
    return (
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Alert severity="warning">No Pokémon named "{name}".</Alert>
        <Button component={Link} to="/" sx={{ mt: 2 }}>
          Back to Pokédex
        </Button>
      </Container>
    );
  }

  if (detail.isError || !detail.pokemon) {
    return (
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <ErrorState
          message={detail.errorMessage ?? "Something went wrong"}
          onRetry={detail.retry}
        />
      </Container>
    );
  }

  const pokemon = detail.pokemon;
  const types = [pokemon.type_one, pokemon.type_two].filter(Boolean);
  const captured = captureFlow.capturedNames.has(pokemon.name);

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(-1)}
        sx={{ mb: 2, textTransform: "none" }}
      >
        Back
      </Button>

      <Box
        sx={{
          position: "relative",
          borderRadius: "24px",
          overflow: "hidden",
          background: typeGradient(types),
          p: 3,
          textAlign: "center",
        }}
      >
        <CaptureButton
          name={pokemon.name}
          captured={captured}
          loading={pokemon.name === captureFlow.capturingName}
          onToggle={() => captureFlow.handleToggleCapture(pokemon, captured)}
        />
        <PokemonSprite name={pokemon.name} glow={typeColor(types[0] ?? "")} />
        <Typography
          component="h1"
          sx={{
            fontFamily: "'Baloo 2', sans-serif",
            fontWeight: 700,
            fontSize: "2rem",
            color: "#fff",
            textShadow: "0 1px 3px rgba(0,0,0,0.45)",
          }}
        >
          {pokemon.name}
        </Typography>
        <Typography
          variant="subtitle1"
          sx={{ color: "rgba(255,255,255,0.85)", fontWeight: 600 }}
        >
          #{String(pokemon.number).padStart(3, "0")}
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          justifyContent="center"
          sx={{ mt: 1.5, flexWrap: "wrap" }}
        >
          {types.map((type) => (
            <Chip
              key={type}
              label={type}
              sx={{ bgcolor: typeColor(type), color: "#fff", fontWeight: 700 }}
            />
          ))}
          {pokemon.legendary && (
            <Chip
              label="Legendary"
              sx={{ bgcolor: "#B8860B", color: "#fff", fontWeight: 700 }}
            />
          )}
        </Stack>
      </Box>

      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Base stats
        </Typography>
        <PokemonStats pokemon={pokemon} />
      </Box>

      <Stack direction="row" spacing={4} sx={{ mt: 3 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Total
          </Typography>
          <Typography variant="h6">{pokemon.total}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Generation
          </Typography>
          <Typography variant="h6">{pokemon.generation}</Typography>
        </Box>
      </Stack>

      <LoginPrompt
        open={captureFlow.pendingCapture !== null}
        onClose={captureFlow.closePendingCapture}
        onSubmit={captureFlow.handleLoginSubmit}
        error={captureFlow.loginError}
      />
      <Snackbar
        open={captureFlow.snackbarMessage !== null}
        autoHideDuration={4000}
        onClose={captureFlow.dismissSnackbar}
      >
        <Alert severity="error" onClose={captureFlow.dismissSnackbar}>
          {captureFlow.snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/pages/PokemonDetailPage.test.tsx`
Expected: PASS, all 4 tests.

- [ ] **Step 5: Wire up the route**

In `frontend/src/App.tsx`, add the import:

```ts
import { PokemonDetailPage } from "./pages/PokemonDetailPage";
```

And add the route inside `<Routes>`, alongside the existing `/` route:

```tsx
      <Routes>
        <Route path="/" element={<PokedexPage />} />
        <Route path="/pokemon/:name" element={<PokemonDetailPage />} />
      </Routes>
```

- [ ] **Step 6: Typecheck, lint, and run the full frontend suite**

Run: `cd frontend && npx tsc -b --noEmit && npm run lint && npx vitest run`
Expected: no type errors, no lint errors, all tests PASS.

- [ ] **Step 7: Commit**

```bash
cd frontend
git add src/pages/PokemonDetailPage.tsx src/pages/PokemonDetailPage.test.tsx src/App.tsx
git commit -m "feat(frontend): add the pokemon detail page and wire up its route"
```

---

### Task 7: Manual verification in the browser

**Files:** none (verification only).

- [ ] **Step 1: Start both servers**

```bash
cd backend && .venv/Scripts/python.exe app.py
```

```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Click-through check**

In a browser: load the grid, click a card (not the capture button) → lands on `/pokemon/<name>` instantly (no loading skeleton, since the row came from the grid). Confirm sprite, name, number, types, legendary badge (pick a legendary one, e.g. Articuno), all six stat bars, Total, and Generation are all visible. Click "Back" → lands back on the grid at the same scroll position/page/filters.

- [ ] **Step 3: Direct-visit check**

Paste `/pokemon/Charizard` directly into the address bar and refresh. Confirm the loading skeleton appears briefly (~2s, matching the simulated DB latency), then the same content renders.

- [ ] **Step 4: Not-found check**

Visit `/pokemon/Missingno`. Confirm the "No Pokémon named..." message and the "Back to Pokédex" link appear instead of an infinite skeleton or a crash.

- [ ] **Step 5: Capture-from-detail check**

While logged out, click the capture button on the detail page → the login dialog opens (not a navigation). Log in, confirm the Pokémon is captured (button turns red) and that it's also shown as captured back on the grid.

- [ ] **Step 6: Card-click-vs-capture-click check**

On the grid, click a card's capture button directly (not elsewhere on the card) → confirm it toggles capture state without navigating to the detail page.
