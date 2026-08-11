# Frontend Pokédex Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the React/TypeScript Pokédex frontend against the existing Flask backend: paginated (infinite-scroll) list with sprites, sort-by-number, type + text filtering, capture/release with login-on-first-capture, and OS-aware/manual light-dark theming.

**Architecture:** Vite + React 19 + TypeScript. React Router (`BrowserRouter`, single `/` route) owns URL query-param state (`page_size`, `sort_by`, `order`, `type`, `q`, `pages`). MUI 9 (`ThemeProvider` + `colorSchemes` + `useColorScheme`) is the sole theming/component source — `defaultMode="system"` gives OS-preference-by-default plus native `localStorage` persistence for a manual override, no hand-rolled theme provider needed. Tailwind v4 is available only for minor layout utilities, never color/theme tokens. `axios` (one shared instance in `api/client.ts`) + TanStack Query (`useInfiniteQuery` for the paginated list, `useQuery`/`useMutation` for types/identity/captures) handle all data fetching, caching, and optimistic updates. Vitest + React Testing Library for tests, via a shared `renderWithProviders`/`renderHookWithProviders` test helper that wraps `QueryClientProvider`/`ThemeProvider`/`MemoryRouter`.

**Tech Stack:** React 19, TypeScript, Vite, React Router v7, MUI v9 (`@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`), Tailwind CSS v4, axios, TanStack Query v5 (`@tanstack/react-query`), Vitest, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, jsdom.

## Global Constraints

- Backend base URL: `http://localhost:8080` (configurable via `VITE_API_BASE_URL`, read through `src/config.ts`'s `BASE_URL`); backend must be running separately (`cd backend && .venv/Scripts/python.exe app.py`) for manual verification.
- All API calls go through the shared axios instance with `withCredentials: true` (session cookie auth; CORS already configured backend-side for `http://localhost:5173`).
- `backend/db.py` is off-limits — do not modify. The rest of the backend (`app.py`, `pokemon_service.py`, `accounts.py`) is already built and committed (`5ecc026` on this branch) — do not add/modify backend files as part of this plan.
- Formatting: double quotes (`frontend/.prettierrc.json` → `"singleQuote": false`); components are `export const Foo = (...) => { ... }` arrow functions, never `export function Foo()`.
- File layout: `src/config.ts`, `src/types.ts`, `src/theme.ts`, `src/constants.ts` at the root; `src/api/client.ts` (the axios instance) plus one module per backend resource (`api/pokemon.ts`, `api/accounts.ts`); feature-grouped `src/components/{pokedex,navbar,general}/`; `src/pages/PokedexPage.tsx`; `src/hooks/`.
- Theming: MUI `ThemeProvider` + `colorSchemes` (`src/theme.ts`) only, `defaultMode="system"` set once on the top-level `ThemeProvider` in `main.tsx`. No Tailwind dark-mode classes, no CSS variables driving MUI component colors.
- Sortable fields per backend (`PokemonService.SORTABLE_FIELDS`): `number, name, total, hit_points, attack, defense, special_attack, special_defense, speed, generation`. Default sort is `number` ascending.
- Allowed page sizes for the UI selector: `5, 10, 20, 50` (backend accepts 1–100 via `page_size`; these are just the exposed choices). Default `20`.
- Type filter is single-select, matching `type_one` or `type_two` server-side. Text search (`q`) is a bonus fuzzy filter across all fields, already supported server-side.
- No captured-only filter in this pass (explicitly out of scope per approved design).
- Every loading card (initial load and "load more") renders as a skeleton — never a bare spinner-only placeholder.
- Design doc: `docs/superpowers/specs/2026-08-11-frontend-pokedex-design.md` describes the target behavior (data flow, edge cases, filtering/sorting scope, login-on-first-capture) — still authoritative for *what* to build. Its implementation mechanics section (plain `fetch`, a hand-rolled `ThemeModeProvider`, flat `components/`) is superseded by this plan; where they disagree on *how*, this plan wins.

---

## Task 1: Project setup — dependencies, Tailwind, Vitest ✅ DONE (commit `a47c009`, rebased as part of this branch's history)

Installed MUI, React Router, Tailwind v4, Vitest + Testing Library; wired `vite.config.ts`; added `src/test/setup.ts` and a passing smoke test; `npm run build` green. Nothing further to do here — subsequent tasks build on top of it.

---

## Task 2: Dependencies, double-quote formatting, `config.ts`

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/.prettierrc.json`
- Modify: `frontend/vite.config.ts` (reformat only)
- Modify: `frontend/src/test/setup.ts` (reformat + matchMedia polyfill)
- Modify: `frontend/src/test/smoke.test.ts` (reformat only)
- Create: `frontend/src/config.ts`

**Interfaces:**
- Produces: `BASE_URL: string` (consumed by every `api/*` module from Task 5 onward). A global `window.matchMedia` polyfill in the test setup file so any test that mounts MUI's `ThemeProvider` doesn't crash in jsdom.

- [ ] **Step 1: Install axios and TanStack Query**

```bash
cd frontend
npm install axios @tanstack/react-query
```

- [ ] **Step 2: Switch Prettier to double quotes**

Replace `frontend/.prettierrc.json`:

```json
{
  "semi": true,
  "singleQuote": false
}
```

- [ ] **Step 3: Add `src/config.ts`**

Create `frontend/src/config.ts`:

```ts
export const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8080";
```

- [ ] **Step 4: Add a `matchMedia` polyfill to the test setup**

Replace `frontend/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";

// jsdom has no matchMedia; MUI's ThemeProvider (colorSchemes) reads it on
// every mount, including in tests that never touch the "system" mode.
window.matchMedia =
  window.matchMedia ||
  ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList);
```

- [ ] **Step 5: Reformat Task 1's files to double quotes**

```bash
cd frontend
npx prettier --write vite.config.ts src/test/smoke.test.ts
```

- [ ] **Step 6: Verify the build and test pipeline still pass**

Run: `cd frontend && npm run test && npm run build`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/.prettierrc.json frontend/vite.config.ts frontend/src/test frontend/src/config.ts
git commit -m "chore(frontend): add axios/TanStack Query, switch to double-quote formatting"
```

---

## Task 3: Shared types and constants

**Files:**
- Create: `frontend/src/types.ts`
- Create: `frontend/src/constants.ts`

**Interfaces:**
- Produces: `SortField`, `SortOrder`, `Pokemon`, `PokemonPage`, `Identity`, `PokemonQuery` types (consumed by every later `api/`, `hooks/`, and `components/` file); `ALLOWED_PAGE_SIZES`, `DEFAULT_PAGE_SIZE`, `SORT_FIELDS`, `DEFAULT_SORT_FIELD` constants (consumed by `useUrlState` in Task 6 and `FilterBar` in Task 10).

- [ ] **Step 1: Write `src/types.ts`**

Create `frontend/src/types.ts`:

```ts
export type SortField =
  | "number"
  | "name"
  | "total"
  | "hit_points"
  | "attack"
  | "defense"
  | "special_attack"
  | "special_defense"
  | "speed"
  | "generation";

export type SortOrder = "asc" | "desc";

export type Pokemon = {
  number: number;
  name: string;
  type_one: string;
  type_two: string;
  total: number;
  hit_points: number;
  attack: number;
  defense: number;
  special_attack: number;
  special_defense: number;
  speed: number;
  generation: number;
  legendary: boolean;
  captured: boolean;
};

export type PokemonPage = {
  items: Pokemon[];
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
};

export type Identity = {
  username: string | null;
  captured: string[];
};

export type PokemonQuery = {
  page: number;
  pageSize: number;
  sortBy: SortField;
  order: SortOrder;
  type?: string | null;
  q?: string;
};
```

- [ ] **Step 2: Write `src/constants.ts`**

Create `frontend/src/constants.ts`:

```ts
import type { SortField } from "./types";

export const ALLOWED_PAGE_SIZES = [5, 10, 20, 50] as const;
export const DEFAULT_PAGE_SIZE = 20;

export const SORT_FIELDS: { value: SortField; label: string }[] = [
  { value: "number", label: "Number" },
  { value: "name", label: "Name" },
  { value: "total", label: "Total" },
  { value: "hit_points", label: "HP" },
  { value: "attack", label: "Attack" },
  { value: "defense", label: "Defense" },
  { value: "special_attack", label: "Sp. Attack" },
  { value: "special_defense", label: "Sp. Defense" },
  { value: "speed", label: "Speed" },
  { value: "generation", label: "Generation" },
];

export const DEFAULT_SORT_FIELD: SortField = "number";
```

- [ ] **Step 3: Verify the build**

Run: `cd frontend && npm run build`
Expected: exits 0 (nothing imports these yet, but this catches typos).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/constants.ts
git commit -m "feat(frontend): add shared Pokémon types and UI constants"
```

---

## Task 4: Theme and shared test-provider helper

**Files:**
- Create: `frontend/src/theme.ts`
- Create: `frontend/src/test/renderWithProviders.tsx`

**Interfaces:**
- Consumes: nothing beyond MUI.
- Produces: `theme: Theme` (consumed by `main.tsx` in Task 13 and directly by component tests that need a `ThemeProvider`); `renderWithProviders(ui, options?)` and `renderHookWithProviders(hook, options?)` — both wrap `QueryClientProvider` + `ThemeProvider` + `MemoryRouter`, accepting `{ initialEntries?, queryClient? }`. Consumed by every hook/component test from Task 7 onward that needs routing or query context.

- [ ] **Step 1: Write `src/theme.ts`**

Create `frontend/src/theme.ts`:

```ts
import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#3B4CCA" },
        secondary: { main: "#FFDE00", contrastText: "#1A1A1A" },
        background: { default: "#f4f6fb", paper: "#ffffff" },
      },
    },
    dark: {
      palette: {
        primary: { main: "#8C9CFF" },
        secondary: { main: "#FFDE00", contrastText: "#1A1A1A" },
        background: { default: "#121218", paper: "#1a1b23" },
      },
    },
  },
  shape: { borderRadius: 12 },
});
```

- [ ] **Step 2: Write the shared test-provider helper**

Create `frontend/src/test/renderWithProviders.tsx`:

```tsx
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { render, renderHook, type RenderHookOptions, type RenderOptions } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { theme } from "../theme";

export const createTestQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

type ProviderOptions = {
  initialEntries?: string[];
  queryClient?: QueryClient;
};

const AllProviders = ({
  children,
  queryClient,
  initialEntries,
}: {
  children: ReactNode;
  queryClient: QueryClient;
  initialEntries: string[];
}) => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    </ThemeProvider>
  </QueryClientProvider>
);

export const renderWithProviders = (
  ui: ReactElement,
  options: ProviderOptions & Omit<RenderOptions, "wrapper"> = {},
) => {
  const { initialEntries = ["/"], queryClient = createTestQueryClient(), ...renderOptions } = options;
  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders queryClient={queryClient} initialEntries={initialEntries}>
        {children}
      </AllProviders>
    ),
    ...renderOptions,
  });
};

export const renderHookWithProviders = <TResult, TProps = void>(
  hook: (props: TProps) => TResult,
  options: ProviderOptions & Omit<RenderHookOptions<TProps>, "wrapper"> = {},
) => {
  const { initialEntries = ["/"], queryClient = createTestQueryClient(), ...renderOptions } = options;
  return renderHook(hook, {
    wrapper: ({ children }) => (
      <AllProviders queryClient={queryClient} initialEntries={initialEntries}>
        {children}
      </AllProviders>
    ),
    ...renderOptions,
  });
};
```

- [ ] **Step 3: Verify the build**

Run: `cd frontend && npm run build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/theme.ts frontend/src/test/renderWithProviders.tsx
git commit -m "feat(frontend): add MUI theme and shared test-provider helper"
```

---

## Task 5: API layer — axios client, `pokemon` and `accounts` modules

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/pokemon.ts`
- Create: `frontend/src/api/accounts.ts`
- Test: `frontend/src/api/client.test.ts`
- Test: `frontend/src/api/pokemon.test.ts`
- Test: `frontend/src/api/accounts.test.ts`

**Interfaces:**
- Consumes: `BASE_URL` (Task 2), `Pokemon`, `PokemonPage`, `Identity`, `PokemonQuery` (Task 3).
- Produces: `apiClient: AxiosInstance`, `getErrorMessage(error: unknown): string` from `api/client.ts`; `fetchPokemonPage(query: PokemonQuery): Promise<PokemonPage>`, `fetchTypes(): Promise<string[]>`, `iconUrl(name: string): string` from `api/pokemon.ts`; `fetchMe(): Promise<Identity>`, `login(username: string): Promise<Identity>`, `logout(): Promise<Identity>`, `capturePokemon(name: string): Promise<{ name: string; captured: boolean }>`, `releasePokemon(name: string): Promise<{ name: string; captured: boolean }>` from `api/accounts.ts`. Consumed by every hook from Task 7 onward.

- [ ] **Step 1: Implement `api/client.ts`**

Create `frontend/src/api/client.ts`:

```ts
import axios from "axios";
import { BASE_URL } from "../config";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string } | undefined;
    return data?.error ?? error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong";
};
```

- [ ] **Step 2: Write the failing test for `client.ts`**

Create `frontend/src/api/client.test.ts`:

```ts
import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { apiClient, getErrorMessage } from "./client";

describe("apiClient", () => {
  it("is configured with credentials for the cookie-session backend", () => {
    expect(apiClient.defaults.withCredentials).toBe(true);
    expect(apiClient.defaults.baseURL).toBe("http://localhost:8080");
  });
});

describe("getErrorMessage", () => {
  it("unwraps the backend's error message from an Axios error", () => {
    const error = new AxiosError(
      "Request failed with status code 401",
      "ERR_BAD_REQUEST",
      undefined,
      undefined,
      // @ts-expect-error minimal shape for the test
      { data: { error: "login required" } },
    );
    expect(getErrorMessage(error)).toBe("login required");
  });

  it("falls back to a generic message for non-Error values", () => {
    expect(getErrorMessage("boom")).toBe("Something went wrong");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend && npm run test -- client.test`
Expected: FAIL (`./client` does not exist)

- [ ] **Step 4: Re-run after Step 1's implementation**

Run: `cd frontend && npm run test -- client.test`
Expected: PASS (3 tests)

- [ ] **Step 5: Implement `api/pokemon.ts`**

Create `frontend/src/api/pokemon.ts`:

```ts
import { apiClient } from "./client";
import { BASE_URL } from "../config";
import type { PokemonPage, PokemonQuery } from "../types";

export const fetchPokemonPage = async (query: PokemonQuery): Promise<PokemonPage> => {
  const response = await apiClient.get<PokemonPage>("/pokemon", {
    params: {
      page: query.page,
      page_size: query.pageSize,
      sort_by: query.sortBy,
      order: query.order,
      ...(query.type ? { type: query.type } : {}),
      ...(query.q ? { q: query.q } : {}),
    },
  });
  return response.data;
};

export const fetchTypes = async (): Promise<string[]> => {
  const response = await apiClient.get<string[]>("/types");
  return response.data;
};

export const iconUrl = (name: string): string => `${BASE_URL}/icon/${encodeURIComponent(name)}`;
```

- [ ] **Step 6: Write the failing test for `pokemon.ts`**

Create `frontend/src/api/pokemon.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import { fetchPokemonPage, fetchTypes, iconUrl } from "./pokemon";

describe("api/pokemon", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchPokemonPage sends the required params, omitting empty type/q", async () => {
    const page = { items: [], page: 1, page_size: 20, total_count: 0, total_pages: 0 };
    const spy = vi.spyOn(apiClient, "get").mockResolvedValue({ data: page });

    const result = await fetchPokemonPage({ page: 2, pageSize: 10, sortBy: "number", order: "desc" });

    expect(result).toEqual(page);
    expect(spy).toHaveBeenCalledWith("/pokemon", {
      params: { page: 2, page_size: 10, sort_by: "number", order: "desc" },
    });
  });

  it("fetchPokemonPage includes type and q when provided", async () => {
    const spy = vi.spyOn(apiClient, "get").mockResolvedValue({
      data: { items: [], page: 1, page_size: 20, total_count: 0, total_pages: 0 },
    });

    await fetchPokemonPage({
      page: 1,
      pageSize: 20,
      sortBy: "attack",
      order: "asc",
      type: "Fire",
      q: "char",
    });

    expect(spy).toHaveBeenCalledWith("/pokemon", {
      params: {
        page: 1,
        page_size: 20,
        sort_by: "attack",
        order: "asc",
        type: "Fire",
        q: "char",
      },
    });
  });

  it("fetchTypes returns the parsed list", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: ["Fire", "Water"] });
    await expect(fetchTypes()).resolves.toEqual(["Fire", "Water"]);
  });

  it("iconUrl points at the backend icon endpoint", () => {
    expect(iconUrl("Mr. Mime")).toBe("http://localhost:8080/icon/Mr.%20Mime");
  });
});
```

- [ ] **Step 7: Run the test**

Run: `cd frontend && npm run test -- pokemon.test`
Expected: PASS (4 tests)

- [ ] **Step 8: Implement `api/accounts.ts`**

Create `frontend/src/api/accounts.ts`:

```ts
import { apiClient } from "./client";
import type { Identity } from "../types";

export const fetchMe = async (): Promise<Identity> => {
  const response = await apiClient.get<Identity>("/me");
  return response.data;
};

export const login = async (username: string): Promise<Identity> => {
  const response = await apiClient.post<Identity>("/login", { username });
  return response.data;
};

export const logout = async (): Promise<Identity> => {
  const response = await apiClient.post<Identity>("/logout");
  return response.data;
};

export const capturePokemon = async (name: string): Promise<{ name: string; captured: boolean }> => {
  const response = await apiClient.post("/captures", { name });
  return response.data;
};

export const releasePokemon = async (name: string): Promise<{ name: string; captured: boolean }> => {
  const response = await apiClient.delete(`/captures/${encodeURIComponent(name)}`);
  return response.data;
};
```

- [ ] **Step 9: Write the failing test for `accounts.ts`**

Create `frontend/src/api/accounts.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import { capturePokemon, fetchMe, login, logout, releasePokemon } from "./accounts";

describe("api/accounts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchMe, login, logout return identity payloads", async () => {
    const identity = { username: "ash", captured: ["Pikachu"] };
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: identity });
    const postSpy = vi.spyOn(apiClient, "post").mockResolvedValue({ data: identity });

    await expect(fetchMe()).resolves.toEqual(identity);
    await expect(login("ash")).resolves.toEqual(identity);
    await expect(logout()).resolves.toEqual(identity);

    expect(postSpy).toHaveBeenNthCalledWith(1, "/login", { username: "ash" });
    expect(postSpy).toHaveBeenNthCalledWith(2, "/logout");
  });

  it("capturePokemon posts the name and releasePokemon deletes by name", async () => {
    const postSpy = vi
      .spyOn(apiClient, "post")
      .mockResolvedValue({ data: { name: "Pikachu", captured: true } });
    const deleteSpy = vi
      .spyOn(apiClient, "delete")
      .mockResolvedValue({ data: { name: "Pikachu", captured: false } });

    await capturePokemon("Pikachu");
    expect(postSpy).toHaveBeenCalledWith("/captures", { name: "Pikachu" });

    await releasePokemon("Pikachu");
    expect(deleteSpy).toHaveBeenCalledWith("/captures/Pikachu");
  });
});
```

- [ ] **Step 10: Run the test**

Run: `cd frontend && npm run test -- accounts.test`
Expected: PASS (2 tests)

- [ ] **Step 11: Run the full test suite and build**

Run: `cd frontend && npm run test && npm run build`
Expected: both exit 0.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/api
git commit -m "feat(frontend): add axios client and pokemon/accounts API modules"
```

---

## Task 6: `useUrlState` hook

**Files:**
- Create: `frontend/src/hooks/useUrlState.ts`
- Test: `frontend/src/hooks/useUrlState.test.tsx`

**Interfaces:**
- Consumes: `SortField`, `SortOrder` (Task 3); `ALLOWED_PAGE_SIZES`, `DEFAULT_PAGE_SIZE`, `DEFAULT_SORT_FIELD`, `SORT_FIELDS` (Task 3); `renderHookWithProviders` (Task 4, test only).
- Produces: `type FilterState = { pageSize: number; sortBy: SortField; order: SortOrder; type: string | null; q: string; pages: number }`; pure functions `parseFilterState(params: URLSearchParams): FilterState`, `filterStateToParams(state: FilterState): URLSearchParams`; hook `useUrlState(): { state: FilterState; setFilters: (partial: Partial<Omit<FilterState, "pages">>) => void; setPages: (pages: number) => void }`. Consumed by `usePokemonList`'s caller and `PokedexPage` (Task 13).

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/hooks/useUrlState.test.tsx`:

```tsx
import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderHookWithProviders } from "../test/renderWithProviders";
import { filterStateToParams, parseFilterState, useUrlState } from "./useUrlState";

describe("parseFilterState", () => {
  it("fills in defaults for an empty query string", () => {
    expect(parseFilterState(new URLSearchParams(""))).toEqual({
      pageSize: 20,
      sortBy: "number",
      order: "asc",
      type: null,
      q: "",
      pages: 1,
    });
  });

  it("parses valid values", () => {
    const params = new URLSearchParams(
      "page_size=10&sort_by=attack&order=desc&type=Fire&q=char&pages=3",
    );
    expect(parseFilterState(params)).toEqual({
      pageSize: 10,
      sortBy: "attack",
      order: "desc",
      type: "Fire",
      q: "char",
      pages: 3,
    });
  });

  it("sanitizes an invalid page_size, sort_by, order, and pages back to defaults", () => {
    const params = new URLSearchParams("page_size=999&sort_by=nonsense&order=sideways&pages=-2");
    expect(parseFilterState(params)).toEqual({
      pageSize: 20,
      sortBy: "number",
      order: "asc",
      type: null,
      q: "",
      pages: 1,
    });
  });
});

describe("filterStateToParams", () => {
  it("round-trips through parseFilterState", () => {
    const state = {
      pageSize: 5,
      sortBy: "speed" as const,
      order: "desc" as const,
      type: "Water",
      q: "saur",
      pages: 2,
    };
    expect(parseFilterState(filterStateToParams(state))).toEqual(state);
  });

  it("omits type and q when empty", () => {
    const params = filterStateToParams({
      pageSize: 20,
      sortBy: "number",
      order: "asc",
      type: null,
      q: "",
      pages: 1,
    });
    expect(params.has("type")).toBe(false);
    expect(params.has("q")).toBe(false);
  });
});

describe("useUrlState", () => {
  it("corrects an invalid URL param without user action", () => {
    const { result } = renderHookWithProviders(() => useUrlState(), {
      initialEntries: ["/?sort_by=bogus"],
    });
    expect(result.current.state.sortBy).toBe("number");
  });

  it("setFilters updates the given fields and resets pages to 1", () => {
    const { result } = renderHookWithProviders(() => useUrlState());
    act(() => {
      result.current.setPages(4);
    });
    expect(result.current.state.pages).toBe(4);
    act(() => {
      result.current.setFilters({ type: "Fire" });
    });
    expect(result.current.state.type).toBe("Fire");
    expect(result.current.state.pages).toBe(1);
  });

  it("setPages only changes pages", () => {
    const { result } = renderHookWithProviders(() => useUrlState());
    act(() => {
      result.current.setFilters({ q: "char" });
    });
    act(() => {
      result.current.setPages(3);
    });
    expect(result.current.state.pages).toBe(3);
    expect(result.current.state.q).toBe("char");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test -- useUrlState.test`
Expected: FAIL (`./useUrlState` does not exist)

- [ ] **Step 3: Implement `hooks/useUrlState.ts`**

Create `frontend/src/hooks/useUrlState.ts`:

```ts
import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { SortField, SortOrder } from "../types";
import { ALLOWED_PAGE_SIZES, DEFAULT_PAGE_SIZE, DEFAULT_SORT_FIELD, SORT_FIELDS } from "../constants";

export type FilterState = {
  pageSize: number;
  sortBy: SortField;
  order: SortOrder;
  type: string | null;
  q: string;
  pages: number;
};

const SORT_FIELD_SET = new Set(SORT_FIELDS.map((f) => f.value));

const parsePageSize = (raw: string | null): number => {
  const n = Number(raw);
  return (ALLOWED_PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
};

const parseSortBy = (raw: string | null): SortField =>
  raw && SORT_FIELD_SET.has(raw as SortField) ? (raw as SortField) : DEFAULT_SORT_FIELD;

const parseOrder = (raw: string | null): SortOrder => (raw === "desc" ? "desc" : "asc");

const parsePages = (raw: string | null): number => {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
};

export const parseFilterState = (params: URLSearchParams): FilterState => ({
  pageSize: parsePageSize(params.get("page_size")),
  sortBy: parseSortBy(params.get("sort_by")),
  order: parseOrder(params.get("order")),
  type: params.get("type") || null,
  q: params.get("q") || "",
  pages: parsePages(params.get("pages")),
});

export const filterStateToParams = (state: FilterState): URLSearchParams => {
  const params = new URLSearchParams();
  params.set("page_size", String(state.pageSize));
  params.set("sort_by", state.sortBy);
  params.set("order", state.order);
  if (state.type) params.set("type", state.type);
  if (state.q) params.set("q", state.q);
  params.set("pages", String(state.pages));
  return params;
};

export const useUrlState = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(() => parseFilterState(searchParams), [searchParams]);

  useEffect(() => {
    const canonical = filterStateToParams(state).toString();
    if (canonical !== searchParams.toString()) {
      setSearchParams(filterStateToParams(state), { replace: true });
    }
  }, [state, searchParams, setSearchParams]);

  const setFilters = useCallback(
    (partial: Partial<Omit<FilterState, "pages">>) => {
      const next: FilterState = { ...state, ...partial, pages: 1 };
      setSearchParams(filterStateToParams(next), { replace: false });
    },
    [state, setSearchParams],
  );

  const setPages = useCallback(
    (pages: number) => {
      const next: FilterState = { ...state, pages };
      setSearchParams(filterStateToParams(next), { replace: true });
    },
    [state, setSearchParams],
  );

  return { state, setFilters, setPages };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm run test -- useUrlState.test`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useUrlState.ts frontend/src/hooks/useUrlState.test.tsx
git commit -m "feat(frontend): add URL-backed filter/sort/pagination state"
```

---

## Task 7: `usePokemonList` (infinite scroll via TanStack Query) and `useTypes`

**Files:**
- Create: `frontend/src/hooks/usePokemonList.ts`
- Create: `frontend/src/hooks/useTypes.ts`
- Test: `frontend/src/hooks/usePokemonList.test.tsx`
- Test: `frontend/src/hooks/useTypes.test.tsx`

**Interfaces:**
- Consumes: `fetchPokemonPage`, `fetchTypes` (Task 5); `Pokemon`, `SortField`, `SortOrder` (Task 3); `renderHookWithProviders` (Task 4, test only).
- Produces: `type PokemonListFilters = { pageSize: number; sortBy: SortField; order: SortOrder; type: string | null; q: string }`; hook `usePokemonList({ filters: PokemonListFilters; restoreToPage: number; onPagesChange: (pages: number) => void }): { items: Pokemon[]; isLoading: boolean; isFetchingNextPage: boolean; error: string | null; hasMore: boolean; loadMore: () => void; retry: () => void }`; `useTypes(): string[]`. Both consumed by `PokedexPage` (Task 13).

- [ ] **Step 1: Write the failing tests for `usePokemonList`**

Create `frontend/src/hooks/usePokemonList.test.tsx`:

```tsx
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/renderWithProviders";
import { usePokemonList, type PokemonListFilters } from "./usePokemonList";
import * as pokemonApi from "../api/pokemon";
import type { Pokemon, PokemonPage } from "../types";

function pokemon(number: number): Pokemon {
  return {
    number,
    name: `Mon${number}`,
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
    captured: false,
  };
}

function page(pageNum: number, totalCount: number, pageSize = 2): PokemonPage {
  const start = (pageNum - 1) * pageSize;
  const items = Array.from(
    { length: Math.max(0, Math.min(pageSize, totalCount - start)) },
    (_, i) => pokemon(start + i + 1),
  );
  return {
    items,
    page: pageNum,
    page_size: pageSize,
    total_count: totalCount,
    total_pages: Math.ceil(totalCount / pageSize),
  };
}

const baseFilters: PokemonListFilters = {
  pageSize: 2,
  sortBy: "number",
  order: "asc",
  type: null,
  q: "",
};

describe("usePokemonList", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads page 1 on mount", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonPage").mockResolvedValue(page(1, 6));
    const { result } = renderHookWithProviders(() =>
      usePokemonList({ filters: baseFilters, restoreToPage: 1, onPagesChange: vi.fn() }),
    );
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.map((p) => p.number)).toEqual([1, 2]);
    expect(result.current.hasMore).toBe(true);
  });

  it("loadMore appends the next page and reports the new page count", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonPage").mockImplementation((q) =>
      Promise.resolve(page(q.page, 6)),
    );
    const onPagesChange = vi.fn();
    const { result } = renderHookWithProviders(() =>
      usePokemonList({ filters: baseFilters, restoreToPage: 1, onPagesChange }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(onPagesChange).toHaveBeenCalledWith(1));

    result.current.loadMore();
    await waitFor(() => expect(result.current.items).toHaveLength(4));
    expect(onPagesChange).toHaveBeenCalledWith(2);
  });

  it("stops reporting hasMore once every item is loaded", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonPage").mockImplementation((q) =>
      Promise.resolve(page(q.page, 2)),
    );
    const { result } = renderHookWithProviders(() =>
      usePokemonList({ filters: baseFilters, restoreToPage: 1, onPagesChange: vi.fn() }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasMore).toBe(false);
  });

  it("restores multiple pages on mount when restoreToPage > 1", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonPage").mockImplementation((q) =>
      Promise.resolve(page(q.page, 6)),
    );
    const onPagesChange = vi.fn();
    const { result } = renderHookWithProviders(() =>
      usePokemonList({ filters: baseFilters, restoreToPage: 2, onPagesChange }),
    );
    await waitFor(() => expect(result.current.items).toHaveLength(4));
    expect(onPagesChange).toHaveBeenCalledWith(2);
  });

  it("resets to page 1 when filters change", async () => {
    const spy = vi
      .spyOn(pokemonApi, "fetchPokemonPage")
      .mockImplementation((q) => Promise.resolve(page(q.page, 6)));
    const { result, rerender } = renderHookWithProviders(
      ({ filters }: { filters: PokemonListFilters }) =>
        usePokemonList({ filters, restoreToPage: 1, onPagesChange: vi.fn() }),
      { initialProps: { filters: baseFilters } },
    );
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    result.current.loadMore();
    await waitFor(() => expect(result.current.items).toHaveLength(4));

    rerender({ filters: { ...baseFilters, type: "Fire" } });
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.items.map((p) => p.number)).toEqual([1, 2]);
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, type: "Fire" }));
  });

  it("sets an error message when the fetch rejects, and retry recovers", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonPage")
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(page(1, 2));
    const { result } = renderHookWithProviders(() =>
      usePokemonList({ filters: baseFilters, restoreToPage: 1, onPagesChange: vi.fn() }),
    );
    await waitFor(() => expect(result.current.error).toBe("network down"));
    expect(result.current.items).toEqual([]);

    result.current.retry();
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.items).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test -- usePokemonList.test`
Expected: FAIL (`./usePokemonList` does not exist)

- [ ] **Step 3: Implement `hooks/usePokemonList.ts`**

Create `frontend/src/hooks/usePokemonList.ts`:

```ts
import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchPokemonPage } from "../api/pokemon";
import type { Pokemon, SortField, SortOrder } from "../types";

export type PokemonListFilters = {
  pageSize: number;
  sortBy: SortField;
  order: SortOrder;
  type: string | null;
  q: string;
};

export type UsePokemonListArgs = {
  filters: PokemonListFilters;
  restoreToPage: number;
  onPagesChange: (pages: number) => void;
};

export type UsePokemonListResult = {
  items: Pokemon[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  retry: () => void;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Something went wrong";

export const usePokemonList = ({
  filters,
  restoreToPage,
  onPagesChange,
}: UsePokemonListArgs): UsePokemonListResult => {
  const filtersKey = JSON.stringify(filters);
  // Frozen per query (reset only when `filtersKey` changes), so our own
  // onPagesChange calls below don't feed back into how far we "should" restore.
  const targetRef = useRef(restoreToPage);
  const reportedRef = useRef(false);

  const query = useInfiniteQuery({
    queryKey: ["pokemon", filters],
    queryFn: ({ pageParam }) => fetchPokemonPage({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,
  });

  const loadedPages = query.data?.pages.length ?? 0;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  useEffect(() => {
    targetRef.current = restoreToPage;
    reportedRef.current = false;
    // Deliberately scoped to filtersKey only: restoreToPage grows because of
    // our own onPagesChange calls and must not re-arm the restore target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  useEffect(() => {
    if (loadedPages === 0) return;
    if (loadedPages < targetRef.current && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
      return;
    }
    if (!reportedRef.current || loadedPages > targetRef.current) {
      reportedRef.current = true;
      targetRef.current = loadedPages;
      onPagesChange(loadedPages);
    }
  }, [loadedPages, hasNextPage, isFetchingNextPage, fetchNextPage, onPagesChange]);

  return {
    items: query.data?.pages.flatMap((page) => page.items) ?? [],
    isLoading: query.isPending,
    isFetchingNextPage: query.isFetchingNextPage,
    error: query.isError ? errorMessage(query.error) : null,
    hasMore: query.hasNextPage ?? false,
    loadMore: () => {
      void query.fetchNextPage();
    },
    retry: () => {
      void query.refetch();
    },
  };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm run test -- usePokemonList.test`
Expected: PASS (6 tests)

- [ ] **Step 5: Write the failing test for `useTypes`**

Create `frontend/src/hooks/useTypes.test.tsx`:

```tsx
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/renderWithProviders";
import { useTypes } from "./useTypes";
import * as pokemonApi from "../api/pokemon";

describe("useTypes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the type list on mount", async () => {
    vi.spyOn(pokemonApi, "fetchTypes").mockResolvedValue(["Fire", "Water"]);
    const { result } = renderHookWithProviders(() => useTypes());
    expect(result.current).toEqual([]);
    await waitFor(() => expect(result.current).toEqual(["Fire", "Water"]));
  });

  it("falls back to an empty list while the query is failing", async () => {
    vi.spyOn(pokemonApi, "fetchTypes").mockRejectedValue(new Error("down"));
    const { result } = renderHookWithProviders(() => useTypes());
    await waitFor(() => expect(pokemonApi.fetchTypes).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd frontend && npm run test -- useTypes.test`
Expected: FAIL (`./useTypes` does not exist)

- [ ] **Step 7: Implement `hooks/useTypes.ts`**

Create `frontend/src/hooks/useTypes.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchTypes } from "../api/pokemon";

export const useTypes = (): string[] => {
  const { data } = useQuery({ queryKey: ["types"], queryFn: fetchTypes });
  return data ?? [];
};
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd frontend && npm run test -- useTypes.test`
Expected: PASS (2 tests)

- [ ] **Step 9: Commit**

```bash
git add frontend/src/hooks/usePokemonList.ts frontend/src/hooks/usePokemonList.test.tsx frontend/src/hooks/useTypes.ts frontend/src/hooks/useTypes.test.tsx
git commit -m "feat(frontend): add infinite-scroll Pokémon list and types hooks"
```

---

## Task 8: `useIdentity`, `useLoginMutation`, `useCaptureMutation`

**Files:**
- Create: `frontend/src/hooks/useIdentity.ts`
- Create: `frontend/src/hooks/useLoginMutation.ts`
- Create: `frontend/src/hooks/useCaptureMutation.ts`
- Test: `frontend/src/hooks/useIdentity.test.tsx`
- Test: `frontend/src/hooks/useLoginMutation.test.tsx`
- Test: `frontend/src/hooks/useCaptureMutation.test.tsx`

**Interfaces:**
- Consumes: `fetchMe`, `login`, `capturePokemon`, `releasePokemon` (Task 5); `getErrorMessage` (Task 5); `Identity` (Task 3); `renderHookWithProviders` (Task 4, test only).
- Produces: `ME_QUERY_KEY` and `useIdentity(): Identity` (always `{ username: null, captured: [] }` until `/me` resolves); `useLoginMutation(): { login: (username: string) => Promise<Identity>; isPending: boolean; error: string | null }`; `useCaptureMutation()` — the raw TanStack `useMutation` result whose `mutate`/`mutateAsync` take `{ name: string; captured: boolean }` (the pokemon's *current* captured state; the mutation flips it). All three consumed by `PokedexPage` (Task 13).

- [ ] **Step 1: Implement `hooks/useIdentity.ts`**

Create `frontend/src/hooks/useIdentity.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "../api/accounts";
import type { Identity } from "../types";

export const ME_QUERY_KEY = ["me"] as const;

const LOGGED_OUT: Identity = { username: null, captured: [] };

export const useIdentity = (): Identity => {
  const { data } = useQuery({ queryKey: ME_QUERY_KEY, queryFn: fetchMe });
  return data ?? LOGGED_OUT;
};
```

- [ ] **Step 2: Write the failing tests for `useIdentity`**

Create `frontend/src/hooks/useIdentity.test.tsx`:

```tsx
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/renderWithProviders";
import { useIdentity } from "./useIdentity";
import * as accountsApi from "../api/accounts";

describe("useIdentity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the logged-out identity before the query resolves", () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: "ash", captured: ["Pikachu"] });
    const { result } = renderHookWithProviders(() => useIdentity());
    expect(result.current).toEqual({ username: null, captured: [] });
  });

  it("returns the loaded identity once the query resolves", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: "ash", captured: ["Pikachu"] });
    const { result } = renderHookWithProviders(() => useIdentity());
    await waitFor(() => expect(result.current.username).toBe("ash"));
    expect(result.current.captured).toEqual(["Pikachu"]);
  });
});
```

- [ ] **Step 3: Run test**

Run: `cd frontend && npm run test -- useIdentity.test`
Expected: PASS (2 tests)

- [ ] **Step 4: Implement `hooks/useLoginMutation.ts`**

Create `frontend/src/hooks/useLoginMutation.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { login } from "../api/accounts";
import { getErrorMessage } from "../api/client";
import { ME_QUERY_KEY } from "./useIdentity";

export const useLoginMutation = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (identity) => {
      queryClient.setQueryData(ME_QUERY_KEY, identity);
    },
  });

  return {
    login: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error ? getErrorMessage(mutation.error) : null,
  };
};
```

- [ ] **Step 5: Write the failing tests for `useLoginMutation`**

Create `frontend/src/hooks/useLoginMutation.test.tsx`:

```tsx
import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/renderWithProviders";
import { useIdentity } from "./useIdentity";
import { useLoginMutation } from "./useLoginMutation";
import * as accountsApi from "../api/accounts";

describe("useLoginMutation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates the shared identity cache on success", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: null, captured: [] });
    vi.spyOn(accountsApi, "login").mockResolvedValue({ username: "misty", captured: [] });

    const { result } = renderHookWithProviders(() => ({
      identity: useIdentity(),
      loginMutation: useLoginMutation(),
    }));
    await waitFor(() => expect(result.current.identity.username).toBeNull());

    await act(async () => {
      await result.current.loginMutation.login("misty");
    });

    await waitFor(() => expect(result.current.identity.username).toBe("misty"));
  });

  it("exposes the backend's error message on failure", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: null, captured: [] });
    vi.spyOn(accountsApi, "login").mockRejectedValue(new Error("name taken"));

    const { result } = renderHookWithProviders(() => useLoginMutation());
    await expect(act(() => result.current.login("misty"))).rejects.toThrow("name taken");
    await waitFor(() => expect(result.current.error).toBe("name taken"));
  });
});
```

- [ ] **Step 6: Run test**

Run: `cd frontend && npm run test -- useLoginMutation.test`
Expected: PASS (2 tests)

- [ ] **Step 7: Implement `hooks/useCaptureMutation.ts`**

Create `frontend/src/hooks/useCaptureMutation.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { capturePokemon, releasePokemon } from "../api/accounts";
import { ME_QUERY_KEY } from "./useIdentity";
import type { Identity } from "../types";

export const useCaptureMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, captured }: { name: string; captured: boolean }) =>
      captured ? releasePokemon(name) : capturePokemon(name),
    onMutate: async ({ name, captured }) => {
      await queryClient.cancelQueries({ queryKey: ME_QUERY_KEY });
      const previous = queryClient.getQueryData<Identity>(ME_QUERY_KEY);
      queryClient.setQueryData<Identity>(ME_QUERY_KEY, (current) => {
        const base = current ?? { username: null, captured: [] };
        return {
          ...base,
          captured: captured
            ? base.captured.filter((n) => n !== name)
            : [...base.captured, name],
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(ME_QUERY_KEY, context.previous);
    },
    onSuccess: (result) => {
      queryClient.setQueryData<Identity>(ME_QUERY_KEY, (current) => {
        const base = current ?? { username: null, captured: [] };
        const withoutName = base.captured.filter((n) => n !== result.name);
        return { ...base, captured: result.captured ? [...withoutName, result.name] : withoutName };
      });
    },
  });
};
```

- [ ] **Step 8: Write the failing tests for `useCaptureMutation`**

Create `frontend/src/hooks/useCaptureMutation.test.tsx`:

```tsx
import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/renderWithProviders";
import { useCaptureMutation } from "./useCaptureMutation";
import { useIdentity } from "./useIdentity";
import * as accountsApi from "../api/accounts";

describe("useCaptureMutation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("optimistically adds the name, then keeps it after the server confirms", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: "ash", captured: [] });
    vi.spyOn(accountsApi, "capturePokemon").mockResolvedValue({ name: "Pikachu", captured: true });

    const { result } = renderHookWithProviders(() => ({
      identity: useIdentity(),
      captureMutation: useCaptureMutation(),
    }));
    await waitFor(() => expect(result.current.identity.username).toBe("ash"));

    act(() => {
      result.current.captureMutation.mutate({ name: "Pikachu", captured: false });
    });
    await waitFor(() => expect(result.current.identity.captured).toContain("Pikachu"));
    await waitFor(() => expect(result.current.captureMutation.isSuccess).toBe(true));
    expect(result.current.identity.captured).toContain("Pikachu");
  });

  it("rolls back the optimistic update when the request fails", async () => {
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: "ash", captured: [] });
    vi.spyOn(accountsApi, "capturePokemon").mockRejectedValue(new Error("network error"));

    const { result } = renderHookWithProviders(() => ({
      identity: useIdentity(),
      captureMutation: useCaptureMutation(),
    }));
    await waitFor(() => expect(result.current.identity.username).toBe("ash"));

    act(() => {
      result.current.captureMutation.mutate({ name: "Pikachu", captured: false });
    });
    await waitFor(() => expect(result.current.captureMutation.isError).toBe(true));
    expect(result.current.identity.captured).not.toContain("Pikachu");
  });
});
```

- [ ] **Step 9: Run test**

Run: `cd frontend && npm run test -- useCaptureMutation.test`
Expected: PASS (2 tests)

- [ ] **Step 10: Commit**

```bash
git add frontend/src/hooks/useIdentity.ts frontend/src/hooks/useIdentity.test.tsx frontend/src/hooks/useLoginMutation.ts frontend/src/hooks/useLoginMutation.test.tsx frontend/src/hooks/useCaptureMutation.ts frontend/src/hooks/useCaptureMutation.test.tsx
git commit -m "feat(frontend): add identity, login, and optimistic capture mutations"
```

---

## Task 9: `typeColors` util, `PokemonCardSkeleton`, `PokemonCard`

**Files:**
- Create: `frontend/src/utils/typeColors.ts`
- Create: `frontend/src/components/pokedex/PokemonCardSkeleton.tsx`
- Create: `frontend/src/components/pokedex/PokemonCard.tsx`
- Test: `frontend/src/components/pokedex/PokemonCardSkeleton.test.tsx`
- Test: `frontend/src/components/pokedex/PokemonCard.test.tsx`

**Interfaces:**
- Consumes: `Pokemon` (Task 3), `iconUrl` (Task 5).
- Produces: `typeColor(type: string): string`; `PokemonCardSkeleton` (no props); `PokemonCard({ pokemon: Pokemon; onToggleCapture: (pokemon: Pokemon) => void; captureLoading?: boolean })`. Both consumed by `PokemonGrid` (Task 12).

- [ ] **Step 1: Implement `utils/typeColors.ts`**

Create `frontend/src/utils/typeColors.ts`:

```ts
const TYPE_COLORS: Record<string, string> = {
  normal: "#A8A77A",
  fire: "#EE8130",
  water: "#6390F0",
  electric: "#F7D02C",
  grass: "#7AC74C",
  ice: "#96D9D6",
  fighting: "#C22E28",
  poison: "#A33EA1",
  ground: "#E2BF65",
  flying: "#A98FF3",
  psychic: "#F95587",
  bug: "#A6B91A",
  rock: "#B6A136",
  ghost: "#735797",
  dragon: "#6F35FC",
  dark: "#705746",
  steel: "#B7B7CE",
  fairy: "#D685AD",
};

const FALLBACK_COLOR = "#777777";

export const typeColor = (type: string): string => TYPE_COLORS[type.toLowerCase()] ?? FALLBACK_COLOR;
```

- [ ] **Step 2: Write the failing test for `PokemonCardSkeleton`**

Create `frontend/src/components/pokedex/PokemonCardSkeleton.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PokemonCardSkeleton } from "./PokemonCardSkeleton";

describe("PokemonCardSkeleton", () => {
  it("renders a skeleton placeholder card", () => {
    render(<PokemonCardSkeleton />);
    expect(screen.getByTestId("pokemon-card-skeleton")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npm run test -- PokemonCardSkeleton.test`
Expected: FAIL (`./PokemonCardSkeleton` does not exist)

- [ ] **Step 4: Implement `components/pokedex/PokemonCardSkeleton.tsx`**

Create `frontend/src/components/pokedex/PokemonCardSkeleton.tsx`:

```tsx
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

export const PokemonCardSkeleton = () => (
  <Card data-testid="pokemon-card-skeleton" sx={{ height: "100%" }}>
    <Skeleton variant="rectangular" height={140} />
    <CardContent>
      <Skeleton variant="text" width="60%" height={32} />
      <Stack direction="row" spacing={1} sx={{ my: 1 }}>
        <Skeleton variant="rounded" width={60} height={24} />
        <Skeleton variant="rounded" width={60} height={24} />
      </Stack>
      <Skeleton variant="text" width="100%" />
      <Skeleton variant="text" width="80%" />
    </CardContent>
  </Card>
);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npm run test -- PokemonCardSkeleton.test`
Expected: PASS (1 test)

- [ ] **Step 6: Write the failing tests for `PokemonCard`**

Create `frontend/src/components/pokedex/PokemonCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PokemonCard } from "./PokemonCard";
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
  captured: false,
};

describe("PokemonCard", () => {
  it("renders the name, number, and both type chips", () => {
    render(<PokemonCard pokemon={bulbasaur} onToggleCapture={vi.fn()} />);
    expect(screen.getByText("Bulbasaur")).toBeInTheDocument();
    expect(screen.getByText("#001")).toBeInTheDocument();
    expect(screen.getByText("Grass")).toBeInTheDocument();
    expect(screen.getByText("Poison")).toBeInTheDocument();
  });

  it("omits the second chip when type_two is empty", () => {
    render(<PokemonCard pokemon={{ ...bulbasaur, type_two: "" }} onToggleCapture={vi.fn()} />);
    expect(screen.queryByText("Poison")).not.toBeInTheDocument();
  });

  it("shows an uncaptured affordance and captures on click", async () => {
    const onToggleCapture = vi.fn();
    const user = userEvent.setup();
    render(<PokemonCard pokemon={bulbasaur} onToggleCapture={onToggleCapture} />);
    const button = screen.getByRole("button", { name: /capture bulbasaur/i });
    await user.click(button);
    expect(onToggleCapture).toHaveBeenCalledWith(bulbasaur);
  });

  it("shows a captured affordance when already captured", () => {
    render(<PokemonCard pokemon={{ ...bulbasaur, captured: true }} onToggleCapture={vi.fn()} />);
    expect(screen.getByRole("button", { name: /release bulbasaur/i })).toBeInTheDocument();
  });

  it("uses the icon endpoint for the sprite", () => {
    render(<PokemonCard pokemon={bulbasaur} onToggleCapture={vi.fn()} />);
    expect(screen.getByRole("img", { name: "Bulbasaur" })).toHaveAttribute(
      "src",
      "http://localhost:8080/icon/Bulbasaur",
    );
  });
});
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `cd frontend && npm run test -- PokemonCard.test`
Expected: FAIL (`./PokemonCard` does not exist)

- [ ] **Step 8: Implement `components/pokedex/PokemonCard.tsx`**

Create `frontend/src/components/pokedex/PokemonCard.tsx`:

```tsx
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CatchingPokemonIcon from "@mui/icons-material/CatchingPokemon";
import CatchingPokemonOutlinedIcon from "@mui/icons-material/CatchingPokemonOutlined";
import { iconUrl } from "../../api/pokemon";
import type { Pokemon } from "../../types";
import { typeColor } from "../../utils/typeColors";

export type PokemonCardProps = {
  pokemon: Pokemon;
  onToggleCapture: (pokemon: Pokemon) => void;
  captureLoading?: boolean;
};

export const PokemonCard = ({ pokemon, onToggleCapture, captureLoading }: PokemonCardProps) => {
  const types = [pokemon.type_one, pokemon.type_two].filter(Boolean);

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardMedia
        component="img"
        src={iconUrl(pokemon.name)}
        alt={pokemon.name}
        sx={{ height: 140, objectFit: "contain", bgcolor: "background.default", p: 1 }}
      />
      <CardContent sx={{ flexGrow: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" component="h3">
            {pokemon.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            #{String(pokemon.number).padStart(3, "0")}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ my: 1 }}>
          {types.map((type) => (
            <Chip
              key={type}
              label={type}
              size="small"
              sx={{ bgcolor: typeColor(type), color: "#fff", fontWeight: 600 }}
            />
          ))}
          {pokemon.legendary && <Chip label="Legendary" size="small" color="secondary" />}
        </Stack>
        <Typography variant="body2" color="text.secondary">
          HP {pokemon.hit_points} · Atk {pokemon.attack} · Def {pokemon.defense}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Sp.Atk {pokemon.special_attack} · Sp.Def {pokemon.special_defense} · Spd {pokemon.speed}
        </Typography>
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
          <IconButton
            aria-label={`${pokemon.captured ? "Release" : "Capture"} ${pokemon.name}`}
            color={pokemon.captured ? "secondary" : "default"}
            disabled={captureLoading}
            onClick={() => onToggleCapture(pokemon)}
          >
            {pokemon.captured ? <CatchingPokemonIcon /> : <CatchingPokemonOutlinedIcon />}
          </IconButton>
        </Stack>
      </CardContent>
    </Card>
  );
};
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd frontend && npm run test -- PokemonCard.test`
Expected: PASS (5 tests)

- [ ] **Step 10: Commit**

```bash
git add frontend/src/utils/typeColors.ts frontend/src/components/pokedex/PokemonCard.tsx frontend/src/components/pokedex/PokemonCard.test.tsx frontend/src/components/pokedex/PokemonCardSkeleton.tsx frontend/src/components/pokedex/PokemonCardSkeleton.test.tsx
git commit -m "feat(frontend): add Pokémon card and loading skeleton"
```

---

## Task 10: `LoginPrompt` and `FilterBar`

**Files:**
- Create: `frontend/src/components/pokedex/LoginPrompt.tsx`
- Create: `frontend/src/components/pokedex/FilterBar.tsx`
- Test: `frontend/src/components/pokedex/LoginPrompt.test.tsx`
- Test: `frontend/src/components/pokedex/FilterBar.test.tsx`

**Interfaces:**
- Consumes: `SORT_FIELDS`, `ALLOWED_PAGE_SIZES` (Task 3); `SortField`, `SortOrder` (Task 3).
- Produces: `LoginPrompt({ open: boolean; onClose: () => void; onSubmit: (username: string) => void | Promise<void>; error?: string | null })`; `type FilterBarFilters = { type: string | null; q: string; sortBy: SortField; order: SortOrder; pageSize: number }`; `FilterBar({ types: string[]; filters: FilterBarFilters; onChange: (partial: Partial<FilterBarFilters>) => void })`. Both consumed by `PokedexPage` (Task 13), `FilterBar` wired directly to `useUrlState().setFilters`.

- [ ] **Step 1: Write the failing tests for `LoginPrompt`**

Create `frontend/src/components/pokedex/LoginPrompt.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginPrompt } from "./LoginPrompt";

describe("LoginPrompt", () => {
  it("is not rendered when closed", () => {
    render(<LoginPrompt open={false} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("submits the trimmed trainer name", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<LoginPrompt open onClose={vi.fn()} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/trainer name/i), "  Ash  ");
    await user.click(screen.getByRole("button", { name: /start capturing/i }));
    expect(onSubmit).toHaveBeenCalledWith("Ash");
  });

  it("does not submit an empty name", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<LoginPrompt open onClose={vi.fn()} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /start capturing/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/enter a trainer name/i)).toBeInTheDocument();
  });

  it("calls onClose from the cancel button", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<LoginPrompt open onClose={onClose} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows a passed-in error message", () => {
    render(<LoginPrompt open onClose={vi.fn()} onSubmit={vi.fn()} error="name taken" />);
    expect(screen.getByText("name taken")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test -- LoginPrompt.test`
Expected: FAIL (`./LoginPrompt` does not exist)

- [ ] **Step 3: Implement `components/pokedex/LoginPrompt.tsx`**

Create `frontend/src/components/pokedex/LoginPrompt.tsx`:

```tsx
import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";

export type LoginPromptProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (username: string) => void | Promise<void>;
  error?: string | null;
};

export const LoginPrompt = ({ open, onClose, onSubmit, error }: LoginPromptProps) => {
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);

  const trimmed = name.trim();
  const showValidationError = touched && trimmed.length === 0;

  const handleSubmit = () => {
    setTouched(true);
    if (trimmed.length === 0) return;
    onSubmit(trimmed);
    setName("");
    setTouched(false);
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Name your trainer</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Pick a trainer name to start capturing Pokémon. No password needed.
        </DialogContentText>
        <TextField
          autoFocus
          margin="dense"
          label="Trainer name"
          fullWidth
          variant="standard"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={showValidationError || Boolean(error)}
          helperText={showValidationError ? "Enter a trainer name to continue." : error}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">
          Start capturing
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm run test -- LoginPrompt.test`
Expected: PASS (5 tests)

- [ ] **Step 5: Write the failing tests for `FilterBar`**

Create `frontend/src/components/pokedex/FilterBar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilterBar } from "./FilterBar";

const baseFilters = {
  type: null as string | null,
  q: "",
  sortBy: "number" as const,
  order: "asc" as const,
  pageSize: 20,
};

describe("FilterBar", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces search input before calling onChange", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
    render(<FilterBar types={["Fire", "Water"]} filters={baseFilters} onChange={onChange} />);

    await user.type(screen.getByLabelText(/search/i), "char");
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onChange).toHaveBeenCalledWith({ q: "char" });
  });

  it("changing the type select calls onChange with the selected type", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
    render(<FilterBar types={["Fire", "Water"]} filters={baseFilters} onChange={onChange} />);

    await user.click(screen.getByLabelText(/type/i));
    await user.click(await screen.findByRole("option", { name: "Fire" }));
    expect(onChange).toHaveBeenCalledWith({ type: "Fire" });
  });

  it('selecting "All types" clears the filter', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
    render(
      <FilterBar
        types={["Fire", "Water"]}
        filters={{ ...baseFilters, type: "Fire" }}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByLabelText(/type/i));
    await user.click(await screen.findByRole("option", { name: /all types/i }));
    expect(onChange).toHaveBeenCalledWith({ type: null });
  });

  it("toggling order calls onChange with the new order", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
    render(<FilterBar types={[]} filters={baseFilters} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /descending/i }));
    expect(onChange).toHaveBeenCalledWith({ order: "desc" });
  });

  it("changing page size calls onChange with the new size", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
    render(<FilterBar types={[]} filters={baseFilters} onChange={onChange} />);
    await user.click(screen.getByLabelText(/per page/i));
    await user.click(await screen.findByRole("option", { name: "10" }));
    expect(onChange).toHaveBeenCalledWith({ pageSize: 10 });
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `cd frontend && npm run test -- FilterBar.test`
Expected: FAIL (`./FilterBar` does not exist)

- [ ] **Step 7: Implement `components/pokedex/FilterBar.tsx`**

Create `frontend/src/components/pokedex/FilterBar.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { ALLOWED_PAGE_SIZES, SORT_FIELDS } from "../../constants";
import type { SortField, SortOrder } from "../../types";

export type FilterBarFilters = {
  type: string | null;
  q: string;
  sortBy: SortField;
  order: SortOrder;
  pageSize: number;
};

export type FilterBarProps = {
  types: string[];
  filters: FilterBarFilters;
  onChange: (partial: Partial<FilterBarFilters>) => void;
};

const ALL_TYPES = "__all__";
const DEBOUNCE_MS = 300;

export const FilterBar = ({ types, filters, onChange }: FilterBarProps) => {
  const [query, setQuery] = useState(filters.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setQuery(filters.q), [filters.q]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSearchChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange({ q: value }), DEBOUNCE_MS);
  };

  const handleTypeChange = (e: SelectChangeEvent) => {
    const value = e.target.value;
    onChange({ type: value === ALL_TYPES ? null : value });
  };

  const handleSortChange = (e: SelectChangeEvent) => {
    onChange({ sortBy: e.target.value as SortField });
  };

  const handleOrderChange = (_e: unknown, value: SortOrder | null) => {
    if (value) onChange({ order: value });
  };

  const handlePageSizeChange = (e: SelectChangeEvent<number>) => {
    onChange({ pageSize: Number(e.target.value) });
  };

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
      <TextField
        label="Search"
        value={query}
        onChange={(e) => handleSearchChange(e.target.value)}
        size="small"
        sx={{ minWidth: 200 }}
      />

      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel id="type-filter-label">Type</InputLabel>
        <Select
          labelId="type-filter-label"
          label="Type"
          value={filters.type ?? ALL_TYPES}
          onChange={handleTypeChange}
        >
          <MenuItem value={ALL_TYPES}>All types</MenuItem>
          {types.map((type) => (
            <MenuItem key={type} value={type}>
              {type}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel id="sort-by-label">Sort by</InputLabel>
        <Select labelId="sort-by-label" label="Sort by" value={filters.sortBy} onChange={handleSortChange}>
          {SORT_FIELDS.map((field) => (
            <MenuItem key={field.value} value={field.value}>
              {field.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <ToggleButtonGroup exclusive value={filters.order} onChange={handleOrderChange} size="small">
        <ToggleButton value="asc" aria-label="ascending">
          Asc
        </ToggleButton>
        <ToggleButton value="desc" aria-label="descending">
          Desc
        </ToggleButton>
      </ToggleButtonGroup>

      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel id="page-size-label">Per page</InputLabel>
        <Select
          labelId="page-size-label"
          label="Per page"
          value={filters.pageSize}
          onChange={handlePageSizeChange}
        >
          {ALLOWED_PAGE_SIZES.map((size) => (
            <MenuItem key={size} value={size}>
              {size}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
};
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd frontend && npm run test -- FilterBar.test`
Expected: PASS (5 tests)

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/pokedex/LoginPrompt.tsx frontend/src/components/pokedex/LoginPrompt.test.tsx frontend/src/components/pokedex/FilterBar.tsx frontend/src/components/pokedex/FilterBar.test.tsx
git commit -m "feat(frontend): add login-on-first-capture prompt and filter bar"
```

---

## Task 11: `NavBar`, `ThemeToggle`, `EmptyState`, `ErrorState`

**Files:**
- Create: `frontend/src/components/navbar/ThemeToggle.tsx`
- Create: `frontend/src/components/navbar/NavBar.tsx`
- Create: `frontend/src/components/general/EmptyState.tsx`
- Create: `frontend/src/components/general/ErrorState.tsx`
- Test: `frontend/src/components/navbar/ThemeToggle.test.tsx`
- Test: `frontend/src/components/navbar/NavBar.test.tsx`
- Test: `frontend/src/components/general/EmptyState.test.tsx`
- Test: `frontend/src/components/general/ErrorState.test.tsx`

**Interfaces:**
- Consumes: `theme` (Task 4, test only).
- Produces: `ThemeToggle` (no props, reads/writes the color scheme via MUI's `useColorScheme`); `NavBar` (no props, renders the title + `ThemeToggle`); `EmptyState({ title: string; description?: string })`; `ErrorState({ message: string; onRetry: () => void })`. `NavBar` consumed by `App.tsx` (Task 13); `EmptyState`/`ErrorState` consumed by `PokemonGrid` (Task 12).

- [ ] **Step 1: Write the failing tests for `ThemeToggle`**

Create `frontend/src/components/navbar/ThemeToggle.test.tsx`:

```tsx
import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "./ThemeToggle";
import { theme } from "../../theme";

function renderToggle(defaultMode: "light" | "dark") {
  return render(
    <ThemeProvider theme={theme} defaultMode={defaultMode}>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows a control to switch to dark mode when currently light", () => {
    renderToggle("light");
    expect(screen.getByRole("button", { name: /switch to dark mode/i })).toBeInTheDocument();
  });

  it("shows a control to switch to light mode when currently dark", () => {
    renderToggle("dark");
    expect(screen.getByRole("button", { name: /switch to light mode/i })).toBeInTheDocument();
  });

  it("toggles the color scheme when clicked", async () => {
    const user = userEvent.setup();
    renderToggle("light");
    await user.click(screen.getByRole("button", { name: /switch to dark mode/i }));
    expect(await screen.findByRole("button", { name: /switch to light mode/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- ThemeToggle.test`
Expected: FAIL (`./ThemeToggle` does not exist)

- [ ] **Step 3: Implement `components/navbar/ThemeToggle.tsx`**

Create `frontend/src/components/navbar/ThemeToggle.tsx`:

```tsx
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import IconButton from "@mui/material/IconButton";
import { useColorScheme } from "@mui/material/styles";

export const ThemeToggle = () => {
  const { colorScheme, setMode } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <IconButton
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setMode(isDark ? "light" : "dark")}
      color="inherit"
    >
      {isDark ? <LightModeIcon /> : <DarkModeIcon />}
    </IconButton>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test -- ThemeToggle.test`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing test for `NavBar`**

Create `frontend/src/components/navbar/NavBar.test.tsx`:

```tsx
import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NavBar } from "./NavBar";
import { theme } from "../../theme";

describe("NavBar", () => {
  it("renders the title and a theme toggle button", () => {
    render(
      <ThemeProvider theme={theme}>
        <NavBar />
      </ThemeProvider>,
    );
    expect(screen.getByRole("heading", { name: /pokédex/i })).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd frontend && npm run test -- NavBar.test`
Expected: FAIL (`./NavBar` does not exist)

- [ ] **Step 7: Implement `components/navbar/NavBar.tsx`**

Create `frontend/src/components/navbar/NavBar.tsx`:

```tsx
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { ThemeToggle } from "./ThemeToggle";

export const NavBar = () => (
  <AppBar position="static" color="primary" enableColorOnDark>
    <Toolbar>
      <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
        Pokédex
      </Typography>
      <ThemeToggle />
    </Toolbar>
  </AppBar>
);
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd frontend && npm run test -- NavBar.test`
Expected: PASS (1 test)

- [ ] **Step 9: Write the failing tests for `EmptyState` and `ErrorState`**

Create `frontend/src/components/general/EmptyState.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders the title and optional description", () => {
    render(<EmptyState title="No Pokémon match your filters." description="Try clearing a filter." />);
    expect(screen.getByText("No Pokémon match your filters.")).toBeInTheDocument();
    expect(screen.getByText("Try clearing a filter.")).toBeInTheDocument();
  });

  it("omits the description when not provided", () => {
    render(<EmptyState title="No Pokémon match your filters." />);
    expect(screen.getByText("No Pokémon match your filters.")).toBeInTheDocument();
  });
});
```

Create `frontend/src/components/general/ErrorState.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErrorState } from "./ErrorState";

describe("ErrorState", () => {
  it("shows the message and calls onRetry when clicked", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorState message="network down" onRetry={onRetry} />);
    expect(screen.getByText("network down")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});
```

- [ ] **Step 10: Run tests to verify they fail**

Run: `cd frontend && npm run test -- EmptyState.test ErrorState.test`
Expected: FAIL (neither component exists yet)

- [ ] **Step 11: Implement `components/general/EmptyState.tsx` and `ErrorState.tsx`**

Create `frontend/src/components/general/EmptyState.tsx`:

```tsx
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export type EmptyStateProps = {
  title: string;
  description?: string;
};

export const EmptyState = ({ title, description }: EmptyStateProps) => (
  <Box sx={{ textAlign: "center", py: 8 }}>
    <Typography variant="h6">{title}</Typography>
    {description && (
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
    )}
  </Box>
);
```

Create `frontend/src/components/general/ErrorState.tsx`:

```tsx
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";

export type ErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export const ErrorState = ({ message, onRetry }: ErrorStateProps) => (
  <Alert
    severity="error"
    action={
      <Button color="inherit" size="small" onClick={onRetry}>
        Retry
      </Button>
    }
  >
    {message}
  </Alert>
);
```

- [ ] **Step 12: Run tests to verify they pass**

Run: `cd frontend && npm run test -- EmptyState.test ErrorState.test`
Expected: PASS (3 tests)

- [ ] **Step 13: Commit**

```bash
git add frontend/src/components/navbar frontend/src/components/general
git commit -m "feat(frontend): add navbar with theme toggle and shared empty/error states"
```

---

## Task 12: `PokemonGrid`

**Files:**
- Create: `frontend/src/components/pokedex/PokemonGrid.tsx`
- Test: `frontend/src/components/pokedex/PokemonGrid.test.tsx`

**Interfaces:**
- Consumes: `PokemonCard`, `PokemonCardSkeleton` (Task 9); `EmptyState`, `ErrorState` (Task 11); `Pokemon` (Task 3).
- Produces: `PokemonGrid({ items: Pokemon[]; isLoading: boolean; isFetchingNextPage: boolean; error: string | null; hasMore: boolean; onLoadMore: () => void; onRetry: () => void; onToggleCapture: (pokemon: Pokemon) => void; pageSize: number })`. Consumed by `PokedexPage` (Task 13), fed directly by `usePokemonList`'s return value.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/pokedex/PokemonGrid.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PokemonGrid } from "./PokemonGrid";
import type { Pokemon } from "../../types";

function pokemon(number: number): Pokemon {
  return {
    number,
    name: `Mon${number}`,
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
    captured: false,
  };
}

type IOCallback = (entries: Pick<IntersectionObserverEntry, "isIntersecting">[]) => void;
let ioCallback: IOCallback | null = null;

class IntersectionObserverMock {
  constructor(callback: IOCallback) {
    ioCallback = callback;
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

const baseProps = {
  isLoading: false,
  isFetchingNextPage: false,
  error: null as string | null,
  hasMore: true,
  onLoadMore: vi.fn(),
  onRetry: vi.fn(),
  onToggleCapture: vi.fn(),
  pageSize: 20,
};

describe("PokemonGrid", () => {
  beforeEach(() => {
    ioCallback = null;
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("shows pageSize skeleton cards while loading initially", () => {
    render(<PokemonGrid {...baseProps} items={[]} isLoading pageSize={4} />);
    expect(screen.getAllByTestId("pokemon-card-skeleton")).toHaveLength(4);
  });

  it("shows an error alert with retry when the initial load fails", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<PokemonGrid {...baseProps} items={[]} error="network down" onRetry={onRetry} />);
    expect(screen.getByText("network down")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("shows an empty state when there is no error and no items", () => {
    render(<PokemonGrid {...baseProps} items={[]} />);
    expect(screen.getByText(/no pokémon match/i)).toBeInTheDocument();
  });

  it("renders a card per item and forwards capture toggles", async () => {
    const onToggleCapture = vi.fn();
    const user = userEvent.setup();
    const mon1 = pokemon(1);
    render(
      <PokemonGrid {...baseProps} items={[mon1, pokemon(2)]} onToggleCapture={onToggleCapture} />,
    );
    expect(screen.getByText("Mon1")).toBeInTheDocument();
    expect(screen.getByText("Mon2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /capture mon1/i }));
    expect(onToggleCapture).toHaveBeenCalledWith(mon1);
  });

  it("triggers onLoadMore when the sentinel intersects and hasMore is true", () => {
    const onLoadMore = vi.fn();
    render(<PokemonGrid {...baseProps} items={[pokemon(1)]} hasMore onLoadMore={onLoadMore} />);
    expect(ioCallback).not.toBeNull();
    ioCallback?.([{ isIntersecting: true }]);
    expect(onLoadMore).toHaveBeenCalled();
  });

  it("shows an end-of-list message and no sentinel when hasMore is false", () => {
    render(<PokemonGrid {...baseProps} items={[pokemon(1)]} hasMore={false} />);
    expect(screen.getByText(/that's all of them/i)).toBeInTheDocument();
  });

  it("shows trailing skeletons while fetching the next page", () => {
    render(<PokemonGrid {...baseProps} items={[pokemon(1)]} isFetchingNextPage pageSize={3} />);
    expect(screen.getAllByTestId("pokemon-card-skeleton")).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test -- PokemonGrid.test`
Expected: FAIL (`./PokemonGrid` does not exist)

- [ ] **Step 3: Implement `components/pokedex/PokemonGrid.tsx`**

Create `frontend/src/components/pokedex/PokemonGrid.tsx`:

```tsx
import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import { EmptyState } from "../general/EmptyState";
import { ErrorState } from "../general/ErrorState";
import { PokemonCard } from "./PokemonCard";
import { PokemonCardSkeleton } from "./PokemonCardSkeleton";
import type { Pokemon } from "../../types";

export type PokemonGridProps = {
  items: Pokemon[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onToggleCapture: (pokemon: Pokemon) => void;
  pageSize: number;
};

export const PokemonGrid = ({
  items,
  isLoading,
  isFetchingNextPage,
  error,
  hasMore,
  onLoadMore,
  onRetry,
  onToggleCapture,
  pageSize,
}: PokemonGridProps) => {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isLoading || isFetchingNextPage || error || !hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [isLoading, isFetchingNextPage, error, hasMore, onLoadMore]);

  if (isLoading) {
    return (
      <Grid container spacing={2}>
        {Array.from({ length: pageSize }, (_, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <PokemonCardSkeleton />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (error && items.length === 0) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  if (items.length === 0) {
    return <EmptyState title="No Pokémon match your filters." />;
  }

  return (
    <Box>
      <Grid container spacing={2}>
        {items.map((pokemon) => (
          <Grid key={pokemon.name} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <PokemonCard pokemon={pokemon} onToggleCapture={onToggleCapture} />
          </Grid>
        ))}
        {isFetchingNextPage &&
          Array.from({ length: pageSize }, (_, i) => (
            <Grid key={`skeleton-${i}`} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <PokemonCardSkeleton />
            </Grid>
          ))}
      </Grid>

      {error && (
        <Box sx={{ mt: 2 }}>
          <ErrorState message={error} onRetry={onRetry} />
        </Box>
      )}

      {hasMore ? (
        <div ref={sentinelRef} data-testid="scroll-sentinel" style={{ height: 1 }} />
      ) : (
        <Box sx={{ textAlign: "center", py: 4 }}>
          <Typography variant="body2" color="text.secondary">
            That's all of them!
          </Typography>
        </Box>
      )}
    </Box>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm run test -- PokemonGrid.test`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/pokedex/PokemonGrid.tsx frontend/src/components/pokedex/PokemonGrid.test.tsx
git commit -m "feat(frontend): add infinite-scroll Pokémon grid"
```

---

## Task 13: `PokedexPage`, `App.tsx`, `main.tsx` — wire it up, remove the scaffold

**Files:**
- Create: `frontend/src/pages/PokedexPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/index.html`
- Delete: `frontend/src/App.css`
- Delete: `frontend/src/assets/react.svg`
- Delete: `frontend/src/assets/vite.svg`
- Delete: `frontend/src/assets/hero.png`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `useUrlState` (Task 6); `usePokemonList`, `useTypes` (Task 7); `useIdentity`, `useLoginMutation`, `useCaptureMutation` (Task 8); `FilterBar`, `LoginPrompt`, `PokemonGrid` (Tasks 10, 12); `NavBar` (Task 11); `theme` (Task 4); `renderWithProviders` (Task 4, test only).
- Produces: the assembled app. Nothing downstream consumes it.

- [ ] **Step 1: Implement `pages/PokedexPage.tsx`**

Create `frontend/src/pages/PokedexPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Container from "@mui/material/Container";
import Snackbar from "@mui/material/Snackbar";
import { FilterBar } from "../components/pokedex/FilterBar";
import { LoginPrompt } from "../components/pokedex/LoginPrompt";
import { PokemonGrid } from "../components/pokedex/PokemonGrid";
import { useCaptureMutation } from "../hooks/useCaptureMutation";
import { useIdentity } from "../hooks/useIdentity";
import { useLoginMutation } from "../hooks/useLoginMutation";
import { usePokemonList } from "../hooks/usePokemonList";
import { useTypes } from "../hooks/useTypes";
import { useUrlState } from "../hooks/useUrlState";
import type { Pokemon } from "../types";

export const PokedexPage = () => {
  const { state: filters, setFilters, setPages } = useUrlState();
  const types = useTypes();
  const identity = useIdentity();
  const captureMutation = useCaptureMutation();
  const loginMutation = useLoginMutation();

  const list = usePokemonList({
    filters: {
      pageSize: filters.pageSize,
      sortBy: filters.sortBy,
      order: filters.order,
      type: filters.type,
      q: filters.q,
    },
    restoreToPage: filters.pages,
    onPagesChange: setPages,
  });

  const [pendingCapture, setPendingCapture] = useState<Pokemon | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  useEffect(() => {
    if (captureMutation.isError) {
      setSnackbarMessage("Couldn't update capture. Try again.");
    }
  }, [captureMutation.isError]);

  const mergedItems = list.items.map((pokemon) => ({
    ...pokemon,
    captured: identity.captured.includes(pokemon.name),
  }));

  const handleToggleCapture = (pokemon: Pokemon) => {
    if (!identity.username) {
      setPendingCapture(pokemon);
      return;
    }
    captureMutation.mutate({ name: pokemon.name, captured: pokemon.captured });
  };

  const handleLoginSubmit = async (username: string) => {
    await loginMutation.login(username);
    setPendingCapture((current) => {
      if (current) {
        captureMutation.mutate({ name: current.name, captured: current.captured });
      }
      return null;
    });
  };

  return (
    <>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <FilterBar types={types} filters={filters} onChange={setFilters} />
        <PokemonGrid
          items={mergedItems}
          isLoading={list.isLoading}
          isFetchingNextPage={list.isFetchingNextPage}
          error={list.error}
          hasMore={list.hasMore}
          onLoadMore={list.loadMore}
          onRetry={list.retry}
          onToggleCapture={handleToggleCapture}
          pageSize={filters.pageSize}
        />
      </Container>
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
    </>
  );
};
```

- [ ] **Step 2: Rewrite `App.tsx`**

Replace the full contents of `frontend/src/App.tsx`:

```tsx
import { Route, Routes } from "react-router-dom";
import { NavBar } from "./components/navbar/NavBar";
import { PokedexPage } from "./pages/PokedexPage";

const App = () => (
  <>
    <NavBar />
    <Routes>
      <Route path="/" element={<PokedexPage />} />
    </Routes>
  </>
);

export default App;
```

- [ ] **Step 3: Rewrite `main.tsx`**

Replace the full contents of `frontend/src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { theme } from "./theme";
import "./index.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme} defaultMode="system">
        <CssBaseline enableColorScheme />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **Step 4: Update the page title**

In `frontend/index.html`, change:

```html
    <title>frontend</title>
```

to:

```html
    <title>Pokédex</title>
```

- [ ] **Step 5: Delete unused scaffold files**

```bash
cd frontend
rm src/App.css src/assets/react.svg src/assets/vite.svg src/assets/hero.png
```

- [ ] **Step 6: Write the failing integration tests**

Create `frontend/src/App.test.tsx`:

```tsx
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { renderWithProviders } from "./test/renderWithProviders";
import * as accountsApi from "./api/accounts";
import * as pokemonApi from "./api/pokemon";
import type { Pokemon, PokemonPage } from "./types";

function pokemon(number: number, overrides: Partial<Pokemon> = {}): Pokemon {
  return {
    number,
    name: `Mon${number}`,
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
    captured: false,
    ...overrides,
  };
}

function page(items: Pokemon[], totalCount: number): PokemonPage {
  return { items, page: 1, page_size: 20, total_count: totalCount, total_pages: 1 };
}

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
    vi.spyOn(accountsApi, "fetchMe").mockResolvedValue({ username: null, captured: [] });
    vi.spyOn(pokemonApi, "fetchTypes").mockResolvedValue(["Fire", "Water"]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads and renders the first page of Pokémon", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonPage").mockResolvedValue(page([pokemon(1), pokemon(2)], 2));
    renderWithProviders(<App />);
    await waitFor(() => expect(screen.getByText("Mon1")).toBeInTheDocument());
    expect(screen.getByText("Mon2")).toBeInTheDocument();
  });

  it("prompts for a trainer name on first capture, then captures after login", async () => {
    vi.spyOn(pokemonApi, "fetchPokemonPage").mockResolvedValue(page([pokemon(1)], 1));
    vi.spyOn(accountsApi, "login").mockResolvedValue({ username: "ash", captured: [] });
    vi.spyOn(accountsApi, "capturePokemon").mockResolvedValue({ name: "Mon1", captured: true });
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await waitFor(() => expect(screen.getByText("Mon1")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /capture mon1/i }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/trainer name/i), "Ash");
    await user.click(within(dialog).getByRole("button", { name: /start capturing/i }));

    await waitFor(() => expect(accountsApi.capturePokemon).toHaveBeenCalledWith("Mon1"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /release mon1/i })).toBeInTheDocument(),
    );
  });

  it("re-fetches with the selected type when the filter changes", async () => {
    const spy = vi
      .spyOn(pokemonApi, "fetchPokemonPage")
      .mockResolvedValue(page([pokemon(1, { type_one: "Fire" })], 1));
    const user = userEvent.setup();
    renderWithProviders(<App />);
    await waitFor(() => expect(screen.getByText("Mon1")).toBeInTheDocument());

    await user.click(screen.getByLabelText(/^type$/i));
    await user.click(await screen.findByRole("option", { name: "Fire" }));

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ type: "Fire", page: 1 })),
    );
  });
});
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd frontend && npm run test -- App.test`
Expected: PASS (3 tests)

- [ ] **Step 8: Run the full test suite**

Run: `cd frontend && npm run test`
Expected: PASS (all tests across every task)

- [ ] **Step 9: Run the linter and type check**

Run: `cd frontend && npm run lint && npm run build`
Expected: both exit 0. Fix any type or lint errors surfaced (e.g. unused imports left over from the scaffold) before proceeding.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/pages frontend/src/App.tsx frontend/src/App.test.tsx frontend/src/main.tsx frontend/index.html
git rm frontend/src/App.css frontend/src/assets/react.svg frontend/src/assets/vite.svg frontend/src/assets/hero.png
git commit -m "feat(frontend): wire up the Pokédex app and remove Vite scaffold"
```

---

## Task 14: Manual verification in the browser

**Files:** none (verification only; fix-forward into whichever files are implicated if something breaks).

- [ ] **Step 1: Set up and start the backend**

If `backend/.venv` doesn't exist in this worktree yet:

```bash
cd backend
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt -r requirements-dev.txt
```

Then run in a background/separate terminal: `cd backend && .venv/Scripts/python.exe app.py`
Expected: listening on port 8080.

- [ ] **Step 2: Start the frontend**

Run: `cd frontend && npm run dev`
Expected: listening on port 5173.

- [ ] **Step 3: Golden path**

Open `http://localhost:5173` in a browser. Verify: cards render with sprites after the initial load (skeletons visible first), scrolling down loads more cards (skeletons appear at the bottom while loading), typing in search filters the list, selecting a type filters the list, changing sort field/order re-sorts, changing page size changes how many load per batch, clicking a Pokéball on a card opens the trainer-name prompt, submitting a name captures that Pokémon (icon flips to captured) without reloading the page, toggling theme switches light/dark instantly.

- [ ] **Step 4: Edge cases**

Verify: a search with no matches shows the empty state; scrolling to the actual end of the (filtered) list shows "That's all of them!" and stops firing requests; loading `http://localhost:5173/?sort_by=bogus&page_size=999` corrects the URL back to valid values and still loads data; stopping the backend and clicking "Retry" after a failed load recovers once the backend is back; refreshing the page after scrolling several pages down reloads the same accumulated set (check the URL's `pages` value before and after refresh).

- [ ] **Step 5: Theming**

Verify: with no `localStorage` override (clear site data first), the app matches the OS/browser `prefers-color-scheme` setting on load; toggling the theme switches it and the choice survives a refresh; switching the OS-level preference afterward no longer changes the app's theme (manual override wins).

- [ ] **Step 6: Fix any issues found**

If any check above fails, identify the responsible file(s) from Tasks 1–13, fix it, re-run the relevant test file, and re-verify manually. Commit the fix separately with a message describing what was wrong.

---

## Self-Review Notes

- **Spec coverage:** list+sprites (Task 9/12), pagination via infinite scroll + URL persistence (Tasks 6/7/13), sorting by number asc/desc + other fields (Task 10), type filter + bonus text filter (Task 10), capture/release with server-memory persistence (Task 8/13, backend already handles persistence), theming with OS default + manual override via native MUI `colorSchemes`/`useColorScheme` (Task 4/11/13), performance (paginated fetches only via TanStack Query's cache, bounded infinite-scroll state), edge cases (Task 14, plus empty/error/end-of-list states built into Task 12).
- **Type consistency checked:** `FilterState` (Task 6) fields match what `PokedexPage` (Task 13) passes into `usePokemonList`'s `PokemonListFilters` (Task 7) and `FilterBar`'s `FilterBarFilters` (Task 10); `Pokemon`/`PokemonPage`/`Identity` (Task 3) are the only shapes referenced by every later hook/component; `useCaptureMutation`'s `{ name, captured }` payload shape (Task 8) matches what `PokedexPage.handleToggleCapture` (Task 13) and `PokemonCard.onToggleCapture` (Task 9, now passed the full `Pokemon`) produce.
- **No placeholders:** every step above has literal code, not descriptions of code.
- **Backend dependency:** this plan assumes the backend committed at `5ecc026` (pagination/sort/filter/accounts/captures) is present on this branch — confirmed via `git log` on `worktree-frontend-pokedex` before this rewrite.
