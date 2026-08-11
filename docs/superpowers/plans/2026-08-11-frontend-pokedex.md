# Frontend Pokédex Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the React/TypeScript Pokédex frontend against the existing Flask backend: paginated (infinite-scroll) list with sprites, sort-by-number, type + text filtering, capture/release with login-on-first-capture, and OS-aware/manual light-dark theming.

**Architecture:** Vite + React 19 + TypeScript. React Router owns URL query-param state (`page_size`, `sort_by`, `order`, `type`, `q`, `pages`). MUI (`ThemeProvider` + component library) is the sole theming/component source; Tailwind (v4, `@tailwindcss/vite`) is available only for minor layout utilities, never for color/theme tokens. Plain `fetch` wrapped in `src/api/client.ts` — no query library. Vitest + React Testing Library for tests, mocking at the `fetch`/API-client boundary.

**Tech Stack:** React 19, TypeScript, Vite, React Router v7, MUI v6 (`@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`), Tailwind CSS v4, Vitest, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, jsdom.

## Global Constraints

- Backend base URL: `http://localhost:8080` (configurable via `VITE_API_BASE_URL`), backend must be running separately (`cd backend && .venv/Scripts/python.exe app.py`) for manual verification.
- All API calls use `credentials: "include"` (session cookie auth, CORS already configured backend-side for `http://localhost:5173`).
- `backend/db.py` is off-limits — do not modify. Every backend file is otherwise already built for this frontend (do not add/modify backend routes).
- Theming: MUI `ThemeProvider` only. No Tailwind dark-mode classes, no CSS variables for color driving MUI components.
- Sortable fields per backend: `number, name, total, hit_points, attack, defense, special_attack, special_defense, speed, generation`. Default sort is `number` ascending.
- Allowed page sizes for the UI selector: `5, 10, 20, 50` (backend accepts 1–100; these are the exposed choices). Default `20`.
- Type filter is single-select. Text search (`q`) is a bonus fuzzy filter across all fields, already supported server-side.
- No captured-only filter in this pass (explicitly out of scope per approved design).
- Every loading card (initial load and "load more") renders as a skeleton — never a bare spinner-only placeholder.
- Design doc: `docs/superpowers/specs/2026-08-11-frontend-pokedex-design.md` — consult for rationale behind any of the above.

---

## Task 1: Project setup — dependencies, Tailwind, Vitest

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/tsconfig.app.json`
- Modify: `frontend/src/index.css`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/test/smoke.test.ts`

**Interfaces:**
- Produces: a working `npm run test` (Vitest) and `npm run dev`/`npm run build` pipeline that every later task's tests run under.

- [ ] **Step 1: Install runtime and dev dependencies**

```bash
cd frontend
npm install react-router-dom @mui/material @mui/icons-material @emotion/react @emotion/styled
npm install -D tailwindcss @tailwindcss/vite vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Configure Vite for Tailwind + Vitest**

Replace `frontend/vite.config.ts` with:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

- [ ] **Step 3: Add Tailwind import and strip scaffold theme CSS**

Replace the full contents of `frontend/src/index.css` with:

```css
@import "tailwindcss";

body {
  margin: 0;
}
```

(The scaffold's `--accent`/`--text` custom properties and dark-mode block are removed — MUI's `ThemeProvider` is the only theming source per the Global Constraints above. `App.css` and its scaffold rules are deleted in Task 12 when `App.tsx` is rewritten.)

- [ ] **Step 4: Add a test-globals type reference**

Modify `frontend/tsconfig.app.json`, changing:

```json
    "types": ["vite/client"],
```

to:

```json
    "types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"],
```

- [ ] **Step 5: Create the test setup file**

Create `frontend/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 6: Add a smoke test**

Create `frontend/src/test/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 7: Add npm scripts**

Modify `frontend/package.json` `scripts` block to add:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 8: Run the smoke test**

Run: `cd frontend && npm run test`
Expected: PASS (1 test)

- [ ] **Step 9: Verify dev server still builds**

Run: `cd frontend && npm run build`
Expected: exits 0 (scaffold `App.tsx` still compiles unchanged at this point)

- [ ] **Step 10: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts frontend/tsconfig.app.json frontend/src/index.css frontend/src/test
git commit -m "chore(frontend): add MUI, React Router, Tailwind v4, and Vitest"
```

---

## Task 2: API types and client

**Files:**
- Create: `frontend/src/api/types.ts`
- Create: `frontend/src/api/client.ts`
- Test: `frontend/src/api/client.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces: `Pokemon`, `PokemonPage`, `Identity`, `SortField`, `SortOrder`, `PokemonQuery` types; `ApiError` class; functions `fetchPokemonPage(query: PokemonQuery): Promise<PokemonPage>`, `fetchTypes(): Promise<string[]>`, `iconUrl(name: string): string`, `fetchMe(): Promise<Identity>`, `login(username: string): Promise<Identity>`, `logout(): Promise<Identity>`, `capturePokemon(name: string): Promise<{name: string; captured: boolean}>`, `releasePokemon(name: string): Promise<{name: string; captured: boolean}>`. All later tasks import from this module.

- [ ] **Step 1: Write `api/types.ts`**

Create `frontend/src/api/types.ts`:

```ts
export type SortField =
  | 'number'
  | 'name'
  | 'total'
  | 'hit_points'
  | 'attack'
  | 'defense'
  | 'special_attack'
  | 'special_defense'
  | 'speed'
  | 'generation'

export type SortOrder = 'asc' | 'desc'

export interface Pokemon {
  number: number
  name: string
  type_one: string
  type_two: string
  total: number
  hit_points: number
  attack: number
  defense: number
  special_attack: number
  special_defense: number
  speed: number
  generation: number
  legendary: boolean
  captured: boolean
}

export interface PokemonPage {
  items: Pokemon[]
  page: number
  page_size: number
  total_count: number
  total_pages: number
}

export interface Identity {
  username: string | null
  captured: string[]
}

export interface PokemonQuery {
  page: number
  pageSize: number
  sortBy: SortField
  order: SortOrder
  type?: string | null
  q?: string
}
```

- [ ] **Step 2: Write the failing tests for `api/client.ts`**

Create `frontend/src/api/client.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  capturePokemon,
  fetchMe,
  fetchPokemonPage,
  fetchTypes,
  iconUrl,
  login,
  logout,
  releasePokemon,
} from './client'

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

describe('api/client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetchPokemonPage builds the query string and includes credentials', async () => {
    const page = { items: [], page: 1, page_size: 20, total_count: 0, total_pages: 0 }
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(page))

    const result = await fetchPokemonPage({
      page: 2,
      pageSize: 10,
      sortBy: 'number',
      order: 'desc',
      type: 'Fire',
      q: 'char',
    })

    expect(result).toEqual(page)
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toContain('/pokemon?')
    expect(String(url)).toContain('page=2')
    expect(String(url)).toContain('page_size=10')
    expect(String(url)).toContain('sort_by=number')
    expect(String(url)).toContain('order=desc')
    expect(String(url)).toContain('type=Fire')
    expect(String(url)).toContain('q=char')
    expect(init).toMatchObject({ credentials: 'include' })
  })

  it('fetchPokemonPage omits type/q when not provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ items: [], page: 1, page_size: 20, total_count: 0, total_pages: 0 }),
    )
    await fetchPokemonPage({ page: 1, pageSize: 20, sortBy: 'number', order: 'asc' })
    const [url] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).not.toContain('type=')
    expect(String(url)).not.toContain('q=')
  })

  it('fetchTypes returns the parsed list', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(['Fire', 'Water']))
    await expect(fetchTypes()).resolves.toEqual(['Fire', 'Water'])
  })

  it('iconUrl points at the backend icon endpoint', () => {
    expect(iconUrl('Mr. Mime')).toBe('http://localhost:8080/icon/Mr.%20Mime')
  })

  it('fetchMe, login, logout return identity payloads', async () => {
    const identity = { username: 'ash', captured: ['Pikachu'] }
    vi.mocked(fetch).mockResolvedValue(jsonResponse(identity))
    await expect(fetchMe()).resolves.toEqual(identity)
    await expect(login('ash')).resolves.toEqual(identity)
    await expect(logout()).resolves.toEqual(identity)

    const loginCall = vi.mocked(fetch).mock.calls[1]
    expect(loginCall[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ username: 'ash' }),
    })
  })

  it('capturePokemon POSTs and releasePokemon DELETEs', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ name: 'Pikachu', captured: true }))
    await capturePokemon('Pikachu')
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ name: 'Pikachu' }),
    })

    await releasePokemon('Pikachu')
    const [url, init] = vi.mocked(fetch).mock.calls[1]
    expect(String(url)).toContain('/captures/Pikachu')
    expect(init).toMatchObject({ method: 'DELETE' })
  })

  it('throws ApiError with the backend error message on a non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: 'login required' }, false, 401),
    )
    await expect(fetchMe()).rejects.toMatchObject(
      new ApiError(401, 'login required'),
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test -- client.test`
Expected: FAIL (`client.ts` does not exist yet)

- [ ] **Step 3: Implement `api/client.ts`**

Create `frontend/src/api/client.ts`:

```ts
import type { Identity, Pokemon, PokemonPage, PokemonQuery } from './types'

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8080'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...(init?.body ? { headers: { 'Content-Type': 'application/json' } } : {}),
    ...init,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}) as { error?: string })
    throw new ApiError(response.status, body.error ?? response.statusText)
  }
  return response.json() as Promise<T>
}

export function fetchPokemonPage(query: PokemonQuery): Promise<PokemonPage> {
  const params = new URLSearchParams({
    page: String(query.page),
    page_size: String(query.pageSize),
    sort_by: query.sortBy,
    order: query.order,
  })
  if (query.type) params.set('type', query.type)
  if (query.q) params.set('q', query.q)
  return apiFetch<PokemonPage>(`/pokemon?${params.toString()}`)
}

export function fetchTypes(): Promise<string[]> {
  return apiFetch<string[]>('/types')
}

export function iconUrl(name: string): string {
  return `${API_BASE}/icon/${encodeURIComponent(name)}`
}

export function fetchMe(): Promise<Identity> {
  return apiFetch<Identity>('/me')
}

export function login(username: string): Promise<Identity> {
  return apiFetch<Identity>('/login', {
    method: 'POST',
    body: JSON.stringify({ username }),
  })
}

export function logout(): Promise<Identity> {
  return apiFetch<Identity>('/logout', { method: 'POST' })
}

export function capturePokemon(name: string): Promise<{ name: string; captured: boolean }> {
  return apiFetch(`/captures`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function releasePokemon(name: string): Promise<{ name: string; captured: boolean }> {
  return apiFetch(`/captures/${encodeURIComponent(name)}`, { method: 'DELETE' })
}

export type { Pokemon, PokemonPage, Identity, PokemonQuery }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm run test -- client.test`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api
git commit -m "feat(frontend): add typed API client for the Pokédex backend"
```

---

## Task 3: Theme module (MUI palette, OS-preference default, manual override)

**Files:**
- Create: `frontend/src/theme/theme.ts`
- Create: `frontend/src/theme/mode.ts`
- Create: `frontend/src/theme/ThemeModeProvider.tsx`
- Test: `frontend/src/theme/mode.test.ts`
- Test: `frontend/src/theme/ThemeModeProvider.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `type Mode = 'light' | 'dark'`; `buildTheme(mode: Mode): Theme`; pure helpers `readStoredMode(): Mode | null`, `writeStoredMode(mode: Mode): void`, `resolveMode(stored: Mode | null, prefersDark: boolean): Mode`; `ThemeModeProvider` component; `useThemeMode(): { mode: Mode; toggle: () => void }` hook (consumed by `Header`/`ThemeToggle` in Task 10, and by `App.tsx` in Task 12).

- [ ] **Step 1: Write the failing tests for the pure mode-resolution logic**

Create `frontend/src/theme/mode.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readStoredMode, resolveMode, writeStoredMode } from './mode'

describe('resolveMode', () => {
  it('uses the stored override when present, regardless of OS preference', () => {
    expect(resolveMode('light', true)).toBe('light')
    expect(resolveMode('dark', false)).toBe('dark')
  })

  it('falls back to the OS preference when there is no stored override', () => {
    expect(resolveMode(null, true)).toBe('dark')
    expect(resolveMode(null, false)).toBe('light')
  })
})

describe('readStoredMode / writeStoredMode', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('returns null when nothing is stored', () => {
    expect(readStoredMode()).toBeNull()
  })

  it('round-trips a written mode', () => {
    writeStoredMode('dark')
    expect(readStoredMode()).toBe('dark')
  })

  it('ignores garbage values', () => {
    localStorage.setItem('pokedex-theme-mode', 'not-a-mode')
    expect(readStoredMode()).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test -- mode.test`
Expected: FAIL (`./mode` does not exist)

- [ ] **Step 3: Implement `theme/mode.ts`**

Create `frontend/src/theme/mode.ts`:

```ts
export type Mode = 'light' | 'dark'

const STORAGE_KEY = 'pokedex-theme-mode'

export function resolveMode(stored: Mode | null, prefersDark: boolean): Mode {
  if (stored) return stored
  return prefersDark ? 'dark' : 'light'
}

export function readStoredMode(): Mode | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw === 'light' || raw === 'dark' ? raw : null
}

export function writeStoredMode(mode: Mode): void {
  localStorage.setItem(STORAGE_KEY, mode)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm run test -- mode.test`
Expected: PASS (5 tests)

- [ ] **Step 5: Write `theme/theme.ts`**

Create `frontend/src/theme/theme.ts`:

```ts
import { createTheme, type Theme } from '@mui/material/styles'
import type { Mode } from './mode'

export function buildTheme(mode: Mode): Theme {
  return createTheme({
    palette: {
      mode,
      primary: { main: mode === 'light' ? '#3B4CCA' : '#8C9CFF' },
      secondary: { main: mode === 'light' ? '#B03A2E' : '#FFDE00' },
      background: {
        default: mode === 'light' ? '#f4f6fb' : '#121218',
        paper: mode === 'light' ? '#ffffff' : '#1a1b23',
      },
    },
    shape: { borderRadius: 12 },
  })
}
```

- [ ] **Step 6: Write the failing test for `ThemeModeProvider`**

Create `frontend/src/theme/ThemeModeProvider.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTheme } from '@mui/material/styles'
import { ThemeModeProvider, useThemeMode } from './ThemeModeProvider'

function Probe() {
  const { mode, toggle } = useThemeMode()
  const theme = useTheme()
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="palette-mode">{theme.palette.mode}</span>
      <button onClick={toggle}>toggle</button>
    </div>
  )
}

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  )
}

describe('ThemeModeProvider', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('defaults to the OS preference when there is no stored override', () => {
    stubMatchMedia(true)
    render(
      <ThemeModeProvider>
        <Probe />
      </ThemeModeProvider>,
    )
    expect(screen.getByTestId('mode')).toHaveTextContent('dark')
    expect(screen.getByTestId('palette-mode')).toHaveTextContent('dark')
  })

  it('toggle flips the mode and persists it, overriding the OS preference on next mount', async () => {
    stubMatchMedia(false)
    const user = userEvent.setup()
    const { unmount } = render(
      <ThemeModeProvider>
        <Probe />
      </ThemeModeProvider>,
    )
    expect(screen.getByTestId('mode')).toHaveTextContent('light')
    await user.click(screen.getByText('toggle'))
    expect(screen.getByTestId('mode')).toHaveTextContent('dark')
    unmount()

    render(
      <ThemeModeProvider>
        <Probe />
      </ThemeModeProvider>,
    )
    expect(screen.getByTestId('mode')).toHaveTextContent('dark')
  })
})
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd frontend && npm run test -- ThemeModeProvider.test`
Expected: FAIL (`./ThemeModeProvider` does not exist)

- [ ] **Step 8: Implement `theme/ThemeModeProvider.tsx`**

Create `frontend/src/theme/ThemeModeProvider.tsx`:

```tsx
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import useMediaQuery from '@mui/material/useMediaQuery'
import { buildTheme } from './theme'
import { readStoredMode, resolveMode, writeStoredMode, type Mode } from './mode'

interface ThemeModeContextValue {
  mode: Mode
  toggle: () => void
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null)

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  const [override, setOverride] = useState<Mode | null>(() => readStoredMode())
  const mode = resolveMode(override, prefersDark)

  const toggle = () => {
    const next: Mode = mode === 'dark' ? 'light' : 'dark'
    writeStoredMode(next)
    setOverride(next)
  }

  const theme = useMemo(() => buildTheme(mode), [mode])

  return (
    <ThemeModeContext.Provider value={{ mode, toggle }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  )
}

export function useThemeMode(): ThemeModeContextValue {
  const ctx = useContext(ThemeModeContext)
  if (!ctx) throw new Error('useThemeMode must be used within a ThemeModeProvider')
  return ctx
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd frontend && npm run test -- ThemeModeProvider.test`
Expected: PASS (2 tests)

- [ ] **Step 10: Commit**

```bash
git add frontend/src/theme
git commit -m "feat(frontend): add MUI theme with OS-preference default and manual override"
```

---

## Task 4: `useUrlState` hook

**Files:**
- Create: `frontend/src/hooks/useUrlState.ts`
- Test: `frontend/src/hooks/useUrlState.test.tsx`

**Interfaces:**
- Consumes: `SortField`, `SortOrder` from `../api/types`.
- Produces: `interface FilterState { pageSize: number; sortBy: SortField; order: SortOrder; type: string | null; q: string; pages: number }`; pure functions `parseFilterState(params: URLSearchParams): FilterState`, `filterStateToParams(state: FilterState): URLSearchParams`; hook `useUrlState(): { state: FilterState; setFilters: (partial: Partial<Omit<FilterState, 'pages'>>) => void; setPages: (pages: number) => void }`. Consumed by `usePokemonList` (Task 5) and `App.tsx` (Task 12) — `setFilters` always resets `pages` to 1, `setPages` never touches other fields.

- [ ] **Step 1: Add shared constants**

Create `frontend/src/constants.ts`:

```ts
import type { SortField } from './api/types'

export const ALLOWED_PAGE_SIZES = [5, 10, 20, 50] as const
export const DEFAULT_PAGE_SIZE = 20

export const SORT_FIELDS: { value: SortField; label: string }[] = [
  { value: 'number', label: 'Number' },
  { value: 'name', label: 'Name' },
  { value: 'total', label: 'Total' },
  { value: 'hit_points', label: 'HP' },
  { value: 'attack', label: 'Attack' },
  { value: 'defense', label: 'Defense' },
  { value: 'special_attack', label: 'Sp. Attack' },
  { value: 'special_defense', label: 'Sp. Defense' },
  { value: 'speed', label: 'Speed' },
  { value: 'generation', label: 'Generation' },
]

export const DEFAULT_SORT_FIELD: SortField = 'number'
```

- [ ] **Step 2: Write the failing tests**

Create `frontend/src/hooks/useUrlState.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { filterStateToParams, parseFilterState, useUrlState } from './useUrlState'

describe('parseFilterState', () => {
  it('fills in defaults for an empty query string', () => {
    expect(parseFilterState(new URLSearchParams(''))).toEqual({
      pageSize: 20,
      sortBy: 'number',
      order: 'asc',
      type: null,
      q: '',
      pages: 1,
    })
  })

  it('parses valid values', () => {
    const params = new URLSearchParams(
      'page_size=10&sort_by=attack&order=desc&type=Fire&q=char&pages=3',
    )
    expect(parseFilterState(params)).toEqual({
      pageSize: 10,
      sortBy: 'attack',
      order: 'desc',
      type: 'Fire',
      q: 'char',
      pages: 3,
    })
  })

  it('sanitizes an invalid page_size, sort_by, order, and pages back to defaults', () => {
    const params = new URLSearchParams('page_size=999&sort_by=nonsense&order=sideways&pages=-2')
    expect(parseFilterState(params)).toEqual({
      pageSize: 20,
      sortBy: 'number',
      order: 'asc',
      type: null,
      q: '',
      pages: 1,
    })
  })
})

describe('filterStateToParams', () => {
  it('round-trips through parseFilterState', () => {
    const state = { pageSize: 5, sortBy: 'speed' as const, order: 'desc' as const, type: 'Water', q: 'saur', pages: 2 }
    expect(parseFilterState(filterStateToParams(state))).toEqual(state)
  })

  it('omits type and q when empty', () => {
    const params = filterStateToParams({
      pageSize: 20,
      sortBy: 'number',
      order: 'asc',
      type: null,
      q: '',
      pages: 1,
    })
    expect(params.has('type')).toBe(false)
    expect(params.has('q')).toBe(false)
  })
})

function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter initialEntries={['/?sort_by=bogus']}>{children}</MemoryRouter>
}

describe('useUrlState', () => {
  it('corrects an invalid URL param without user action', () => {
    const { result } = renderHook(() => useUrlState(), { wrapper })
    expect(result.current.state.sortBy).toBe('number')
  })

  it('setFilters updates the given fields and resets pages to 1', () => {
    const { result } = renderHook(() => useUrlState(), { wrapper })
    act(() => {
      result.current.setPages(4)
    })
    expect(result.current.state.pages).toBe(4)
    act(() => {
      result.current.setFilters({ type: 'Fire' })
    })
    expect(result.current.state.type).toBe('Fire')
    expect(result.current.state.pages).toBe(1)
  })

  it('setPages only changes pages', () => {
    const { result } = renderHook(() => useUrlState(), { wrapper })
    act(() => {
      result.current.setFilters({ q: 'char' })
    })
    act(() => {
      result.current.setPages(3)
    })
    expect(result.current.state.pages).toBe(3)
    expect(result.current.state.q).toBe('char')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd frontend && npm run test -- useUrlState.test`
Expected: FAIL (`./useUrlState` does not exist)

- [ ] **Step 4: Implement `hooks/useUrlState.ts`**

Create `frontend/src/hooks/useUrlState.ts`:

```ts
import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { SortField, SortOrder } from '../api/types'
import { ALLOWED_PAGE_SIZES, DEFAULT_PAGE_SIZE, DEFAULT_SORT_FIELD, SORT_FIELDS } from '../constants'

export interface FilterState {
  pageSize: number
  sortBy: SortField
  order: SortOrder
  type: string | null
  q: string
  pages: number
}

const SORT_FIELD_SET = new Set(SORT_FIELDS.map((f) => f.value))

function parsePageSize(raw: string | null): number {
  const n = Number(raw)
  return (ALLOWED_PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE
}

function parseSortBy(raw: string | null): SortField {
  return raw && SORT_FIELD_SET.has(raw as SortField) ? (raw as SortField) : DEFAULT_SORT_FIELD
}

function parseOrder(raw: string | null): SortOrder {
  return raw === 'desc' ? 'desc' : 'asc'
}

function parsePages(raw: string | null): number {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

export function parseFilterState(params: URLSearchParams): FilterState {
  return {
    pageSize: parsePageSize(params.get('page_size')),
    sortBy: parseSortBy(params.get('sort_by')),
    order: parseOrder(params.get('order')),
    type: params.get('type') || null,
    q: params.get('q') || '',
    pages: parsePages(params.get('pages')),
  }
}

export function filterStateToParams(state: FilterState): URLSearchParams {
  const params = new URLSearchParams()
  params.set('page_size', String(state.pageSize))
  params.set('sort_by', state.sortBy)
  params.set('order', state.order)
  if (state.type) params.set('type', state.type)
  if (state.q) params.set('q', state.q)
  params.set('pages', String(state.pages))
  return params
}

export function useUrlState() {
  const [searchParams, setSearchParams] = useSearchParams()
  const state = useMemo(() => parseFilterState(searchParams), [searchParams])

  useEffect(() => {
    const canonical = filterStateToParams(state).toString()
    if (canonical !== searchParams.toString()) {
      setSearchParams(filterStateToParams(state), { replace: true })
    }
  }, [state, searchParams, setSearchParams])

  const setFilters = useCallback(
    (partial: Partial<Omit<FilterState, 'pages'>>) => {
      const next: FilterState = { ...state, ...partial, pages: 1 }
      setSearchParams(filterStateToParams(next), { replace: false })
    },
    [state, setSearchParams],
  )

  const setPages = useCallback(
    (pages: number) => {
      const next: FilterState = { ...state, pages }
      setSearchParams(filterStateToParams(next), { replace: true })
    },
    [state, setSearchParams],
  )

  return { state, setFilters, setPages }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npm run test -- useUrlState.test`
Expected: PASS (8 tests)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/constants.ts frontend/src/hooks/useUrlState.ts frontend/src/hooks/useUrlState.test.tsx
git commit -m "feat(frontend): add URL-backed filter/sort/pagination state"
```

---

## Task 5: `usePokemonList` hook (infinite scroll)

**Files:**
- Create: `frontend/src/hooks/usePokemonList.ts`
- Test: `frontend/src/hooks/usePokemonList.test.tsx`

**Interfaces:**
- Consumes: `fetchPokemonPage` from `../api/client`; `Pokemon`, `PokemonQuery` from `../api/types`.
- Produces: `interface PokemonListFilters { pageSize: number; sortBy: SortField; order: SortOrder; type: string | null; q: string }`; hook `usePokemonList({ filters: PokemonListFilters; initialPages: number; onPagesChange: (pages: number) => void }): { items: Pokemon[]; loading: boolean; loadingMore: boolean; error: string | null; hasMore: boolean; loadMore: () => void; retry: () => void }`. Consumed by `App.tsx` (Task 12), fed by `useUrlState`'s `state`/`setPages`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/hooks/usePokemonList.test.tsx`:

```tsx
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePokemonList } from './usePokemonList'
import * as client from '../api/client'
import type { Pokemon, PokemonPage } from '../api/types'

function pokemon(number: number): Pokemon {
  return {
    number,
    name: `Mon${number}`,
    type_one: 'Normal',
    type_two: '',
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
  }
}

function page(pageNum: number, totalCount: number, pageSize = 2): PokemonPage {
  const start = (pageNum - 1) * pageSize
  const items = Array.from(
    { length: Math.max(0, Math.min(pageSize, totalCount - start)) },
    (_, i) => pokemon(start + i + 1),
  )
  return { items, page: pageNum, page_size: pageSize, total_count: totalCount, total_pages: Math.ceil(totalCount / pageSize) }
}

const baseFilters = { pageSize: 2, sortBy: 'number' as const, order: 'asc' as const, type: null, q: '' }

describe('usePokemonList', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads page 1 on mount', async () => {
    const spy = vi.spyOn(client, 'fetchPokemonPage').mockResolvedValue(page(1, 6))
    const { result } = renderHook(() =>
      usePokemonList({ filters: baseFilters, initialPages: 1, onPagesChange: vi.fn() }),
    )
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items.map((p) => p.number)).toEqual([1, 2])
    expect(result.current.hasMore).toBe(true)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('loadMore appends the next page and reports the new page count', async () => {
    const spy = vi.spyOn(client, 'fetchPokemonPage').mockImplementation((q) =>
      Promise.resolve(page(q.page, 6)),
    )
    const onPagesChange = vi.fn()
    const { result } = renderHook(() =>
      usePokemonList({ filters: baseFilters, initialPages: 1, onPagesChange }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      result.current.loadMore()
    })
    await waitFor(() => expect(result.current.loadingMore).toBe(false))

    expect(result.current.items.map((p) => p.number)).toEqual([1, 2, 3, 4])
    expect(onPagesChange).toHaveBeenCalledWith(2)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('stops reporting hasMore once every item is loaded, and loadMore is a no-op past the end', async () => {
    vi.spyOn(client, 'fetchPokemonPage').mockImplementation((q) => Promise.resolve(page(q.page, 2)))
    const { result } = renderHook(() =>
      usePokemonList({ filters: baseFilters, initialPages: 1, onPagesChange: vi.fn() }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.hasMore).toBe(false)

    const spy = vi.spyOn(client, 'fetchPokemonPage')
    await act(async () => {
      result.current.loadMore()
    })
    expect(spy).not.toHaveBeenCalled()
  })

  it('reconstructs multiple pages in order on mount when initialPages > 1', async () => {
    // Resolve page 2 before page 1 to prove ordering isn't resolution-order-dependent.
    vi.spyOn(client, 'fetchPokemonPage').mockImplementation((q) => {
      const delay = q.page === 1 ? 10 : 0
      return new Promise((resolve) => setTimeout(() => resolve(page(q.page, 6)), delay))
    })
    const { result } = renderHook(() =>
      usePokemonList({ filters: baseFilters, initialPages: 2, onPagesChange: vi.fn() }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items.map((p) => p.number)).toEqual([1, 2, 3, 4])
  })

  it('resets to page 1 when filters change', async () => {
    const spy = vi.spyOn(client, 'fetchPokemonPage').mockImplementation((q) => Promise.resolve(page(q.page, 6)))
    const { result, rerender } = renderHook(
      ({ filters }) => usePokemonList({ filters, initialPages: 1, onPagesChange: vi.fn() }),
      { initialProps: { filters: baseFilters } },
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      result.current.loadMore()
    })
    await waitFor(() => expect(result.current.items).toHaveLength(4))

    rerender({ filters: { ...baseFilters, type: 'Fire' } })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items.map((p) => p.number)).toEqual([1, 2])
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, type: 'Fire' }))
  })

  it('sets an error message when the fetch rejects, and retry recovers', async () => {
    const spy = vi
      .spyOn(client, 'fetchPokemonPage')
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(page(1, 2))
    const { result } = renderHook(() =>
      usePokemonList({ filters: baseFilters, initialPages: 1, onPagesChange: vi.fn() }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('network down')
    expect(result.current.items).toEqual([])

    await act(async () => {
      result.current.retry()
    })
    await waitFor(() => expect(result.current.error).toBeNull())
    expect(result.current.items).toHaveLength(2)
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test -- usePokemonList.test`
Expected: FAIL (`./usePokemonList` does not exist)

- [ ] **Step 3: Implement `hooks/usePokemonList.ts`**

Create `frontend/src/hooks/usePokemonList.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { fetchPokemonPage } from '../api/client'
import type { Pokemon, SortField, SortOrder } from '../api/types'

export interface PokemonListFilters {
  pageSize: number
  sortBy: SortField
  order: SortOrder
  type: string | null
  q: string
}

export interface UsePokemonListArgs {
  filters: PokemonListFilters
  initialPages: number
  onPagesChange: (pages: number) => void
}

export interface UsePokemonListResult {
  items: Pokemon[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => void
  retry: () => void
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong'
}

export function usePokemonList({
  filters,
  initialPages,
  onPagesChange,
}: UsePokemonListArgs): UsePokemonListResult {
  const [items, setItems] = useState<Pokemon[]>([])
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [loadedPages, setLoadedPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtersKey = JSON.stringify(filters)

  const loadInitial = useCallback(() => {
    setLoading(true)
    setError(null)
    const pageCount = Math.max(1, initialPages)
    Promise.all(
      Array.from({ length: pageCount }, (_, i) =>
        fetchPokemonPage({ ...filters, page: i + 1 }),
      ),
    )
      .then((responses) => {
        setItems(responses.flatMap((r) => r.items))
        setTotalCount(responses[responses.length - 1].total_count)
        setLoadedPages(pageCount)
      })
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false))
    // filters/initialPages are re-read from filtersKey on purpose: this must only
    // rerun when the filter set changes, not every time loadMore advances `pages`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey])

  useEffect(() => {
    loadInitial()
  }, [loadInitial])

  const loadMore = useCallback(() => {
    if (loadingMore || loading) return
    if (totalCount !== null && items.length >= totalCount) return
    setLoadingMore(true)
    setError(null)
    const nextPage = loadedPages + 1
    fetchPokemonPage({ ...filters, page: nextPage })
      .then((response) => {
        setItems((prev) => [...prev, ...response.items])
        setTotalCount(response.total_count)
        setLoadedPages(nextPage)
        onPagesChange(nextPage)
      })
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoadingMore(false))
  }, [filters, loadedPages, loadingMore, loading, totalCount, items.length, onPagesChange])

  const hasMore = totalCount === null ? true : items.length < totalCount

  return { items, loading, loadingMore, error, hasMore, loadMore, retry: loadInitial }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm run test -- usePokemonList.test`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/usePokemonList.ts frontend/src/hooks/usePokemonList.test.tsx
git commit -m "feat(frontend): add infinite-scroll Pokémon list hook"
```

---

## Task 6: `useAuth` and `useTypes` hooks

**Files:**
- Create: `frontend/src/hooks/useAuth.ts`
- Create: `frontend/src/hooks/useTypes.ts`
- Test: `frontend/src/hooks/useAuth.test.tsx`
- Test: `frontend/src/hooks/useTypes.test.tsx`

**Interfaces:**
- Consumes: `fetchMe`, `login`, `logout`, `capturePokemon`, `releasePokemon`, `fetchTypes` from `../api/client`.
- Produces: `useAuth(): { username: string | null; captured: Set<string>; loginError: string | null; login: (username: string) => Promise<void>; logout: () => Promise<void>; toggleCapture: (name: string) => Promise<void> }`; `useTypes(): string[]`. Both consumed by `App.tsx` (Task 12); `useAuth().captured`/`toggleCapture` also drive `PokemonCard`'s capture affordance indirectly through `App.tsx`.

- [ ] **Step 1: Write the failing tests for `useAuth`**

Create `frontend/src/hooks/useAuth.test.tsx`:

```tsx
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from './useAuth'
import * as client from '../api/client'

describe('useAuth', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads the current identity on mount', async () => {
    vi.spyOn(client, 'fetchMe').mockResolvedValue({ username: 'ash', captured: ['Pikachu'] })
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.username).toBe('ash'))
    expect(result.current.captured.has('Pikachu')).toBe(true)
  })

  it('stays logged out if fetchMe fails', async () => {
    vi.spyOn(client, 'fetchMe').mockRejectedValue(new Error('no session'))
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(client.fetchMe).toHaveBeenCalled())
    expect(result.current.username).toBeNull()
    expect(result.current.captured.size).toBe(0)
  })

  it('login sets the username and captured set', async () => {
    vi.spyOn(client, 'fetchMe').mockRejectedValue(new Error('no session'))
    vi.spyOn(client, 'login').mockResolvedValue({ username: 'misty', captured: [] })
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.username).toBeNull())

    await act(async () => {
      await result.current.login('misty')
    })
    expect(result.current.username).toBe('misty')
  })

  it('login failure sets loginError and rethrows', async () => {
    vi.spyOn(client, 'fetchMe').mockRejectedValue(new Error('no session'))
    vi.spyOn(client, 'login').mockRejectedValue(new Error('name taken'))
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.username).toBeNull())

    await expect(act(() => result.current.login('misty'))).rejects.toThrow('name taken')
    expect(result.current.loginError).toBe('name taken')
  })

  it('toggleCapture optimistically adds then confirms on success', async () => {
    vi.spyOn(client, 'fetchMe').mockResolvedValue({ username: 'ash', captured: [] })
    const captureSpy = vi.spyOn(client, 'capturePokemon').mockResolvedValue({ name: 'Pikachu', captured: true })
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.username).toBe('ash'))

    await act(async () => {
      await result.current.toggleCapture('Pikachu')
    })
    expect(result.current.captured.has('Pikachu')).toBe(true)
    expect(captureSpy).toHaveBeenCalledWith('Pikachu')
  })

  it('toggleCapture rolls back on failure', async () => {
    vi.spyOn(client, 'fetchMe').mockResolvedValue({ username: 'ash', captured: [] })
    vi.spyOn(client, 'capturePokemon').mockRejectedValue(new Error('network error'))
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.username).toBe('ash'))

    await expect(act(() => result.current.toggleCapture('Pikachu'))).rejects.toThrow()
    expect(result.current.captured.has('Pikachu')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test -- useAuth.test`
Expected: FAIL (`./useAuth` does not exist)

- [ ] **Step 3: Implement `hooks/useAuth.ts`**

Create `frontend/src/hooks/useAuth.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import {
  capturePokemon,
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  releasePokemon,
} from '../api/client'

export interface UseAuthResult {
  username: string | null
  captured: Set<string>
  loginError: string | null
  login: (username: string) => Promise<void>
  logout: () => Promise<void>
  toggleCapture: (name: string) => Promise<void>
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong'
}

export function useAuth(): UseAuthResult {
  const [username, setUsername] = useState<string | null>(null)
  const [captured, setCaptured] = useState<Set<string>>(new Set())
  const [loginError, setLoginError] = useState<string | null>(null)

  useEffect(() => {
    fetchMe()
      .then((identity) => {
        setUsername(identity.username)
        setCaptured(new Set(identity.captured))
      })
      .catch(() => {
        // No session yet; stay logged out.
      })
  }, [])

  const login = useCallback(async (name: string) => {
    setLoginError(null)
    try {
      const identity = await apiLogin(name)
      setUsername(identity.username)
      setCaptured(new Set(identity.captured))
    } catch (err) {
      setLoginError(errorMessage(err))
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setUsername(null)
    setCaptured(new Set())
  }, [])

  const toggleCapture = useCallback(
    async (name: string) => {
      const wasCaptured = captured.has(name)
      setCaptured((prev) => {
        const next = new Set(prev)
        if (wasCaptured) next.delete(name)
        else next.add(name)
        return next
      })
      try {
        if (wasCaptured) await releasePokemon(name)
        else await capturePokemon(name)
      } catch (err) {
        setCaptured((prev) => {
          const next = new Set(prev)
          if (wasCaptured) next.add(name)
          else next.delete(name)
          return next
        })
        throw err
      }
    },
    [captured],
  )

  return { username, captured, loginError, login, logout, toggleCapture }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm run test -- useAuth.test`
Expected: PASS (6 tests)

- [ ] **Step 5: Write the failing test for `useTypes`**

Create `frontend/src/hooks/useTypes.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTypes } from './useTypes'
import * as client from '../api/client'

describe('useTypes', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads the type list on mount', async () => {
    vi.spyOn(client, 'fetchTypes').mockResolvedValue(['Fire', 'Water'])
    const { result } = renderHook(() => useTypes())
    expect(result.current).toEqual([])
    await waitFor(() => expect(result.current).toEqual(['Fire', 'Water']))
  })

  it('falls back to an empty list on failure', async () => {
    vi.spyOn(client, 'fetchTypes').mockRejectedValue(new Error('down'))
    const { result } = renderHook(() => useTypes())
    await waitFor(() => expect(client.fetchTypes).toHaveBeenCalled())
    expect(result.current).toEqual([])
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd frontend && npm run test -- useTypes.test`
Expected: FAIL (`./useTypes` does not exist)

- [ ] **Step 7: Implement `hooks/useTypes.ts`**

Create `frontend/src/hooks/useTypes.ts`:

```ts
import { useEffect, useState } from 'react'
import { fetchTypes } from '../api/client'

export function useTypes(): string[] {
  const [types, setTypes] = useState<string[]>([])

  useEffect(() => {
    fetchTypes()
      .then(setTypes)
      .catch(() => setTypes([]))
  }, [])

  return types
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd frontend && npm run test -- useTypes.test`
Expected: PASS (2 tests)

- [ ] **Step 9: Commit**

```bash
git add frontend/src/hooks/useAuth.ts frontend/src/hooks/useAuth.test.tsx frontend/src/hooks/useTypes.ts frontend/src/hooks/useTypes.test.tsx
git commit -m "feat(frontend): add auth/capture and types hooks"
```

---

## Task 7: `typeColors` util, `PokemonCardSkeleton`, `PokemonCard`

**Files:**
- Create: `frontend/src/utils/typeColors.ts`
- Create: `frontend/src/components/PokemonCardSkeleton.tsx`
- Create: `frontend/src/components/PokemonCard.tsx`
- Test: `frontend/src/components/PokemonCard.test.tsx`
- Test: `frontend/src/components/PokemonCardSkeleton.test.tsx`

**Interfaces:**
- Consumes: `Pokemon` from `../api/types`, `iconUrl` from `../api/client`.
- Produces: `typeColor(type: string): string`; `PokemonCardSkeleton` component (no props); `PokemonCard({ pokemon: Pokemon; onToggleCapture: (name: string) => void; captureLoading?: boolean })`. Both consumed by `PokemonGrid` (Task 11).

- [ ] **Step 1: Implement `utils/typeColors.ts`**

Create `frontend/src/utils/typeColors.ts`:

```ts
const TYPE_COLORS: Record<string, string> = {
  normal: '#A8A77A',
  fire: '#EE8130',
  water: '#6390F0',
  electric: '#F7D02C',
  grass: '#7AC74C',
  ice: '#96D9D6',
  fighting: '#C22E28',
  poison: '#A33EA1',
  ground: '#E2BF65',
  flying: '#A98FF3',
  psychic: '#F95587',
  bug: '#A6B91A',
  rock: '#B6A136',
  ghost: '#735797',
  dragon: '#6F35FC',
  dark: '#705746',
  steel: '#B7B7CE',
  fairy: '#D685AD',
}

const FALLBACK_COLOR = '#777777'

export function typeColor(type: string): string {
  return TYPE_COLORS[type.toLowerCase()] ?? FALLBACK_COLOR
}
```

- [ ] **Step 2: Write the failing test for `PokemonCardSkeleton`**

Create `frontend/src/components/PokemonCardSkeleton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PokemonCardSkeleton } from './PokemonCardSkeleton'

describe('PokemonCardSkeleton', () => {
  it('renders a skeleton placeholder card', () => {
    render(<PokemonCardSkeleton />)
    expect(screen.getByTestId('pokemon-card-skeleton')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npm run test -- PokemonCardSkeleton.test`
Expected: FAIL (`./PokemonCardSkeleton` does not exist)

- [ ] **Step 4: Implement `components/PokemonCardSkeleton.tsx`**

Create `frontend/src/components/PokemonCardSkeleton.tsx`:

```tsx
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'

export function PokemonCardSkeleton() {
  return (
    <Card data-testid="pokemon-card-skeleton" sx={{ height: '100%' }}>
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
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npm run test -- PokemonCardSkeleton.test`
Expected: PASS (1 test)

- [ ] **Step 6: Write the failing tests for `PokemonCard`**

Create `frontend/src/components/PokemonCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PokemonCard } from './PokemonCard'
import type { Pokemon } from '../api/types'

const bulbasaur: Pokemon = {
  number: 1,
  name: 'Bulbasaur',
  type_one: 'Grass',
  type_two: 'Poison',
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
}

describe('PokemonCard', () => {
  it('renders the name, number, and both type chips', () => {
    render(<PokemonCard pokemon={bulbasaur} onToggleCapture={vi.fn()} />)
    expect(screen.getByText('Bulbasaur')).toBeInTheDocument()
    expect(screen.getByText('#001')).toBeInTheDocument()
    expect(screen.getByText('Grass')).toBeInTheDocument()
    expect(screen.getByText('Poison')).toBeInTheDocument()
  })

  it('omits the second chip when type_two is empty', () => {
    render(<PokemonCard pokemon={{ ...bulbasaur, type_two: '' }} onToggleCapture={vi.fn()} />)
    expect(screen.queryByText('Poison')).not.toBeInTheDocument()
  })

  it('shows an uncaptured affordance and captures on click', async () => {
    const onToggleCapture = vi.fn()
    const user = userEvent.setup()
    render(<PokemonCard pokemon={bulbasaur} onToggleCapture={onToggleCapture} />)
    const button = screen.getByRole('button', { name: /capture bulbasaur/i })
    await user.click(button)
    expect(onToggleCapture).toHaveBeenCalledWith('Bulbasaur')
  })

  it('shows a captured affordance when already captured', () => {
    render(<PokemonCard pokemon={{ ...bulbasaur, captured: true }} onToggleCapture={vi.fn()} />)
    expect(screen.getByRole('button', { name: /release bulbasaur/i })).toBeInTheDocument()
  })

  it('uses the icon endpoint for the sprite', () => {
    render(<PokemonCard pokemon={bulbasaur} onToggleCapture={vi.fn()} />)
    expect(screen.getByRole('img', { name: 'Bulbasaur' })).toHaveAttribute(
      'src',
      'http://localhost:8080/icon/Bulbasaur',
    )
  })
})
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `cd frontend && npm run test -- PokemonCard.test`
Expected: FAIL (`./PokemonCard` does not exist)

- [ ] **Step 8: Implement `components/PokemonCard.tsx`**

Create `frontend/src/components/PokemonCard.tsx`:

```tsx
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardMedia from '@mui/material/CardMedia'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CatchingPokemonIcon from '@mui/icons-material/CatchingPokemon'
import CatchingPokemonOutlinedIcon from '@mui/icons-material/CatchingPokemonOutlined'
import { iconUrl } from '../api/client'
import type { Pokemon } from '../api/types'
import { typeColor } from '../utils/typeColors'

export interface PokemonCardProps {
  pokemon: Pokemon
  onToggleCapture: (name: string) => void
  captureLoading?: boolean
}

export function PokemonCard({ pokemon, onToggleCapture, captureLoading }: PokemonCardProps) {
  const types = [pokemon.type_one, pokemon.type_two].filter(Boolean)

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardMedia
        component="img"
        src={iconUrl(pokemon.name)}
        alt={pokemon.name}
        sx={{ height: 140, objectFit: 'contain', bgcolor: 'background.default', p: 1 }}
      />
      <CardContent sx={{ flexGrow: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" component="h3">
            {pokemon.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            #{String(pokemon.number).padStart(3, '0')}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ my: 1 }}>
          {types.map((type) => (
            <Chip
              key={type}
              label={type}
              size="small"
              sx={{ bgcolor: typeColor(type), color: '#fff', fontWeight: 600 }}
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
            aria-label={`${pokemon.captured ? 'Release' : 'Capture'} ${pokemon.name}`}
            color={pokemon.captured ? 'secondary' : 'default'}
            disabled={captureLoading}
            onClick={() => onToggleCapture(pokemon.name)}
          >
            {pokemon.captured ? <CatchingPokemonIcon /> : <CatchingPokemonOutlinedIcon />}
          </IconButton>
        </Stack>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd frontend && npm run test -- PokemonCard.test`
Expected: PASS (5 tests)

- [ ] **Step 10: Commit**

```bash
git add frontend/src/utils/typeColors.ts frontend/src/components/PokemonCard.tsx frontend/src/components/PokemonCard.test.tsx frontend/src/components/PokemonCardSkeleton.tsx frontend/src/components/PokemonCardSkeleton.test.tsx
git commit -m "feat(frontend): add Pokémon card and loading skeleton"
```

---

## Task 8: `LoginPrompt`

**Files:**
- Create: `frontend/src/components/LoginPrompt.tsx`
- Test: `frontend/src/components/LoginPrompt.test.tsx`

**Interfaces:**
- Consumes: nothing beyond MUI.
- Produces: `LoginPrompt({ open: boolean; onClose: () => void; onSubmit: (username: string) => void | Promise<void>; error?: string | null })`. Consumed by `App.tsx` (Task 12), opened when a logged-out user attempts a capture.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/LoginPrompt.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LoginPrompt } from './LoginPrompt'

describe('LoginPrompt', () => {
  it('is not rendered when closed', () => {
    render(<LoginPrompt open={false} onClose={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('submits the trimmed trainer name', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<LoginPrompt open onClose={vi.fn()} onSubmit={onSubmit} />)
    await user.type(screen.getByLabelText(/trainer name/i), '  Ash  ')
    await user.click(screen.getByRole('button', { name: /start capturing/i }))
    expect(onSubmit).toHaveBeenCalledWith('Ash')
  })

  it('does not submit an empty name', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<LoginPrompt open onClose={vi.fn()} onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: /start capturing/i }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/enter a trainer name/i)).toBeInTheDocument()
  })

  it('calls onClose from the cancel button', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<LoginPrompt open onClose={onClose} onSubmit={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows a passed-in error message', () => {
    render(<LoginPrompt open onClose={vi.fn()} onSubmit={vi.fn()} error="name taken" />)
    expect(screen.getByText('name taken')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test -- LoginPrompt.test`
Expected: FAIL (`./LoginPrompt` does not exist)

- [ ] **Step 3: Implement `components/LoginPrompt.tsx`**

Create `frontend/src/components/LoginPrompt.tsx`:

```tsx
import { useState } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'

export interface LoginPromptProps {
  open: boolean
  onClose: () => void
  onSubmit: (username: string) => void | Promise<void>
  error?: string | null
}

export function LoginPrompt({ open, onClose, onSubmit, error }: LoginPromptProps) {
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)

  const trimmed = name.trim()
  const showValidationError = touched && trimmed.length === 0

  const handleSubmit = () => {
    setTouched(true)
    if (trimmed.length === 0) return
    onSubmit(trimmed)
    setName('')
    setTouched(false)
  }

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
          helperText={showValidationError ? 'Enter a trainer name to continue.' : error}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">
          Start capturing
        </Button>
      </DialogActions>
    </Dialog>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm run test -- LoginPrompt.test`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/LoginPrompt.tsx frontend/src/components/LoginPrompt.test.tsx
git commit -m "feat(frontend): add login-on-first-capture prompt"
```

---

## Task 9: `FilterBar`

**Files:**
- Create: `frontend/src/components/FilterBar.tsx`
- Test: `frontend/src/components/FilterBar.test.tsx`

**Interfaces:**
- Consumes: `SORT_FIELDS`, `ALLOWED_PAGE_SIZES` from `../constants`; `SortField`, `SortOrder` from `../api/types`.
- Produces: `interface FilterBarFilters { type: string | null; q: string; sortBy: SortField; order: SortOrder; pageSize: number }`; `FilterBar({ types: string[]; filters: FilterBarFilters; onChange: (partial: Partial<FilterBarFilters>) => void })`. Consumed by `App.tsx` (Task 12), wired directly to `useUrlState().setFilters`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/FilterBar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FilterBar } from './FilterBar'

const baseFilters = {
  type: null as string | null,
  q: '',
  sortBy: 'number' as const,
  order: 'asc' as const,
  pageSize: 20,
}

describe('FilterBar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces search input before calling onChange', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime })
    render(<FilterBar types={['Fire', 'Water']} filters={baseFilters} onChange={onChange} />)

    await user.type(screen.getByLabelText(/search/i), 'char')
    expect(onChange).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(onChange).toHaveBeenCalledWith({ q: 'char' })
  })

  it('changing the type select calls onChange with the selected type', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime })
    render(<FilterBar types={['Fire', 'Water']} filters={baseFilters} onChange={onChange} />)

    await user.click(screen.getByLabelText(/type/i))
    await user.click(await screen.findByRole('option', { name: 'Fire' }))
    expect(onChange).toHaveBeenCalledWith({ type: 'Fire' })
  })

  it('selecting "All types" clears the filter', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime })
    render(
      <FilterBar types={['Fire', 'Water']} filters={{ ...baseFilters, type: 'Fire' }} onChange={onChange} />,
    )
    await user.click(screen.getByLabelText(/type/i))
    await user.click(await screen.findByRole('option', { name: /all types/i }))
    expect(onChange).toHaveBeenCalledWith({ type: null })
  })

  it('toggling order calls onChange with the new order', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime })
    render(<FilterBar types={[]} filters={baseFilters} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /descending/i }))
    expect(onChange).toHaveBeenCalledWith({ order: 'desc' })
  })

  it('changing page size calls onChange with the new size', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime })
    render(<FilterBar types={[]} filters={baseFilters} onChange={onChange} />)
    await user.click(screen.getByLabelText(/per page/i))
    await user.click(await screen.findByRole('option', { name: '10' }))
    expect(onChange).toHaveBeenCalledWith({ pageSize: 10 })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test -- FilterBar.test`
Expected: FAIL (`./FilterBar` does not exist)

- [ ] **Step 3: Implement `components/FilterBar.tsx`**

Create `frontend/src/components/FilterBar.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import MenuItem from '@mui/material/MenuItem'
import Select, { type SelectChangeEvent } from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { ALLOWED_PAGE_SIZES, SORT_FIELDS } from '../constants'
import type { SortField, SortOrder } from '../api/types'

export interface FilterBarFilters {
  type: string | null
  q: string
  sortBy: SortField
  order: SortOrder
  pageSize: number
}

export interface FilterBarProps {
  types: string[]
  filters: FilterBarFilters
  onChange: (partial: Partial<FilterBarFilters>) => void
}

const ALL_TYPES = '__all__'
const DEBOUNCE_MS = 300

export function FilterBar({ types, filters, onChange }: FilterBarProps) {
  const [query, setQuery] = useState(filters.q)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setQuery(filters.q), [filters.q])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleSearchChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onChange({ q: value }), DEBOUNCE_MS)
  }

  const handleTypeChange = (e: SelectChangeEvent) => {
    const value = e.target.value
    onChange({ type: value === ALL_TYPES ? null : value })
  }

  const handleSortChange = (e: SelectChangeEvent) => {
    onChange({ sortBy: e.target.value as SortField })
  }

  const handleOrderChange = (_e: unknown, value: SortOrder | null) => {
    if (value) onChange({ order: value })
  }

  const handlePageSizeChange = (e: SelectChangeEvent<number>) => {
    onChange({ pageSize: Number(e.target.value) })
  }

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
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
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm run test -- FilterBar.test`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/FilterBar.tsx frontend/src/components/FilterBar.test.tsx
git commit -m "feat(frontend): add search/type/sort/page-size filter bar"
```

---

## Task 10: `ThemeToggle` and `Header`

**Files:**
- Create: `frontend/src/components/ThemeToggle.tsx`
- Create: `frontend/src/components/Header.tsx`
- Test: `frontend/src/components/ThemeToggle.test.tsx`
- Test: `frontend/src/components/Header.test.tsx`

**Interfaces:**
- Consumes: `Mode` from `../theme/mode`.
- Produces: `ThemeToggle({ mode: Mode; onToggle: () => void })`; `Header({ mode: Mode; onToggleTheme: () => void })`. `Header` consumed by `App.tsx` (Task 12), fed by `useThemeMode()`.

- [ ] **Step 1: Write the failing tests for `ThemeToggle`**

Create `frontend/src/components/ThemeToggle.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ThemeToggle } from './ThemeToggle'

describe('ThemeToggle', () => {
  it('shows a control to switch to dark mode when currently light', () => {
    render(<ThemeToggle mode="light" onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument()
  })

  it('shows a control to switch to light mode when currently dark', () => {
    render(<ThemeToggle mode="dark" onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument()
  })

  it('calls onToggle when clicked', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<ThemeToggle mode="light" onToggle={onToggle} />)
    await user.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- ThemeToggle.test`
Expected: FAIL (`./ThemeToggle` does not exist)

- [ ] **Step 3: Implement `components/ThemeToggle.tsx`**

Create `frontend/src/components/ThemeToggle.tsx`:

```tsx
import IconButton from '@mui/material/IconButton'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import type { Mode } from '../theme/mode'

export interface ThemeToggleProps {
  mode: Mode
  onToggle: () => void
}

export function ThemeToggle({ mode, onToggle }: ThemeToggleProps) {
  const label = mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
  return (
    <IconButton aria-label={label} onClick={onToggle} color="inherit">
      {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
    </IconButton>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test -- ThemeToggle.test`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing test for `Header`**

Create `frontend/src/components/Header.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Header } from './Header'

describe('Header', () => {
  it('renders the title', () => {
    render(<Header mode="light" onToggleTheme={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /pokédex/i })).toBeInTheDocument()
  })

  it('wires the theme toggle button', async () => {
    const onToggleTheme = vi.fn()
    const user = userEvent.setup()
    render(<Header mode="light" onToggleTheme={onToggleTheme} />)
    await user.click(screen.getByRole('button', { name: /switch to dark mode/i }))
    expect(onToggleTheme).toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd frontend && npm run test -- Header.test`
Expected: FAIL (`./Header` does not exist)

- [ ] **Step 7: Implement `components/Header.tsx`**

Create `frontend/src/components/Header.tsx`:

```tsx
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { ThemeToggle } from './ThemeToggle'
import type { Mode } from '../theme/mode'

export interface HeaderProps {
  mode: Mode
  onToggleTheme: () => void
}

export function Header({ mode, onToggleTheme }: HeaderProps) {
  return (
    <AppBar position="static" color="primary" enableColorOnDark>
      <Toolbar>
        <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
          Pokédex
        </Typography>
        <ThemeToggle mode={mode} onToggle={onToggleTheme} />
      </Toolbar>
    </AppBar>
  )
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd frontend && npm run test -- Header.test`
Expected: PASS (2 tests)

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/ThemeToggle.tsx frontend/src/components/ThemeToggle.test.tsx frontend/src/components/Header.tsx frontend/src/components/Header.test.tsx
git commit -m "feat(frontend): add header with theme toggle"
```

---

## Task 11: `PokemonGrid`

**Files:**
- Create: `frontend/src/components/PokemonGrid.tsx`
- Test: `frontend/src/components/PokemonGrid.test.tsx`

**Interfaces:**
- Consumes: `PokemonCard`, `PokemonCardSkeleton` (Task 7); `Pokemon` from `../api/types`.
- Produces: `PokemonGrid({ items: Pokemon[]; loading: boolean; loadingMore: boolean; error: string | null; hasMore: boolean; onLoadMore: () => void; onRetry: () => void; onToggleCapture: (name: string) => void; pageSize: number })`. Consumed by `App.tsx` (Task 12), fed directly by `usePokemonList`'s return value.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/PokemonGrid.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PokemonGrid } from './PokemonGrid'
import type { Pokemon } from '../api/types'

function pokemon(number: number): Pokemon {
  return {
    number,
    name: `Mon${number}`,
    type_one: 'Normal',
    type_two: '',
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
  }
}

type IOCallback = (entries: Pick<IntersectionObserverEntry, 'isIntersecting'>[]) => void
let ioCallback: IOCallback | null = null

class IntersectionObserverMock {
  constructor(callback: IOCallback) {
    ioCallback = callback
  }
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

const baseProps = {
  loading: false,
  loadingMore: false,
  error: null as string | null,
  hasMore: true,
  onLoadMore: vi.fn(),
  onRetry: vi.fn(),
  onToggleCapture: vi.fn(),
  pageSize: 20,
}

describe('PokemonGrid', () => {
  beforeEach(() => {
    ioCallback = null
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('shows pageSize skeleton cards while loading initially', () => {
    render(<PokemonGrid {...baseProps} items={[]} loading pageSize={4} />)
    expect(screen.getAllByTestId('pokemon-card-skeleton')).toHaveLength(4)
  })

  it('shows an error alert with retry when the initial load fails', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()
    render(<PokemonGrid {...baseProps} items={[]} error="network down" onRetry={onRetry} />)
    expect(screen.getByText('network down')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('shows an empty state when there is no error and no items', () => {
    render(<PokemonGrid {...baseProps} items={[]} />)
    expect(screen.getByText(/no pokémon match/i)).toBeInTheDocument()
  })

  it('renders a card per item and forwards capture toggles', async () => {
    const onToggleCapture = vi.fn()
    const user = userEvent.setup()
    render(<PokemonGrid {...baseProps} items={[pokemon(1), pokemon(2)]} onToggleCapture={onToggleCapture} />)
    expect(screen.getByText('Mon1')).toBeInTheDocument()
    expect(screen.getByText('Mon2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /capture mon1/i }))
    expect(onToggleCapture).toHaveBeenCalledWith('Mon1')
  })

  it('triggers onLoadMore when the sentinel intersects and hasMore is true', () => {
    const onLoadMore = vi.fn()
    render(<PokemonGrid {...baseProps} items={[pokemon(1)]} hasMore onLoadMore={onLoadMore} />)
    expect(ioCallback).not.toBeNull()
    ioCallback?.([{ isIntersecting: true }])
    expect(onLoadMore).toHaveBeenCalled()
  })

  it('shows an end-of-list message and no sentinel when hasMore is false', () => {
    render(<PokemonGrid {...baseProps} items={[pokemon(1)]} hasMore={false} />)
    expect(screen.getByText(/that's all of them/i)).toBeInTheDocument()
  })

  it('shows trailing skeletons while loading more', () => {
    render(<PokemonGrid {...baseProps} items={[pokemon(1)]} loadingMore pageSize={3} />)
    expect(screen.getAllByTestId('pokemon-card-skeleton')).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test -- PokemonGrid.test`
Expected: FAIL (`./PokemonGrid` does not exist)

- [ ] **Step 3: Implement `components/PokemonGrid.tsx`**

Create `frontend/src/components/PokemonGrid.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import { PokemonCard } from './PokemonCard'
import { PokemonCardSkeleton } from './PokemonCardSkeleton'
import type { Pokemon } from '../api/types'

export interface PokemonGridProps {
  items: Pokemon[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  hasMore: boolean
  onLoadMore: () => void
  onRetry: () => void
  onToggleCapture: (name: string) => void
  pageSize: number
}

export function PokemonGrid({
  items,
  loading,
  loadingMore,
  error,
  hasMore,
  onLoadMore,
  onRetry,
  onToggleCapture,
  pageSize,
}: PokemonGridProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (loading || loadingMore || error || !hasMore) return
    const node = sentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onLoadMore()
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [loading, loadingMore, error, hasMore, onLoadMore])

  if (loading) {
    return (
      <Grid container spacing={2}>
        {Array.from({ length: pageSize }, (_, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <PokemonCardSkeleton />
          </Grid>
        ))}
      </Grid>
    )
  }

  if (error && items.length === 0) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    )
  }

  if (items.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6">No Pokémon match your filters.</Typography>
      </Box>
    )
  }

  return (
    <Box>
      <Grid container spacing={2}>
        {items.map((pokemon) => (
          <Grid key={pokemon.name} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <PokemonCard pokemon={pokemon} onToggleCapture={onToggleCapture} />
          </Grid>
        ))}
        {loadingMore &&
          Array.from({ length: pageSize }, (_, i) => (
            <Grid key={`skeleton-${i}`} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <PokemonCardSkeleton />
            </Grid>
          ))}
      </Grid>

      {error && (
        <Alert
          severity="error"
          sx={{ mt: 2 }}
          action={
            <Button color="inherit" size="small" onClick={onRetry}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {hasMore ? (
        <div ref={sentinelRef} data-testid="scroll-sentinel" style={{ height: 1 }} />
      ) : (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body2" color="text.secondary">
            That's all of them!
          </Typography>
        </Box>
      )}
    </Box>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm run test -- PokemonGrid.test`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PokemonGrid.tsx frontend/src/components/PokemonGrid.test.tsx
git commit -m "feat(frontend): add infinite-scroll Pokémon grid"
```

---

## Task 12: Wire up `App.tsx` and `main.tsx`, remove scaffold

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/index.html`
- Delete: `frontend/src/App.css`
- Delete: `frontend/src/assets/react.svg`
- Delete: `frontend/src/assets/vite.svg`
- Delete: `frontend/src/assets/hero.png`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `useUrlState` (Task 4), `usePokemonList` (Task 5), `useAuth`/`useTypes` (Task 6), `Header` (Task 10), `FilterBar` (Task 9), `PokemonGrid` (Task 11), `LoginPrompt` (Task 8), `ThemeModeProvider`/`useThemeMode` (Task 3).
- Produces: the assembled app. Nothing downstream consumes `App`.

- [ ] **Step 1: Write the failing integration tests**

Create `frontend/src/App.test.tsx`:

```tsx
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { ThemeModeProvider } from './theme/ThemeModeProvider'
import * as client from './api/client'
import type { Pokemon, PokemonPage } from './api/types'

function pokemon(number: number, overrides: Partial<Pokemon> = {}): Pokemon {
  return {
    number,
    name: `Mon${number}`,
    type_one: 'Normal',
    type_two: '',
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
  }
}

function page(items: Pokemon[], totalCount: number): PokemonPage {
  return { items, page: 1, page_size: 20, total_count: totalCount, total_pages: 1 }
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ThemeModeProvider>
        <App />
      </ThemeModeProvider>
    </MemoryRouter>,
  )
}

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
      },
    )
    vi.spyOn(client, 'fetchMe').mockRejectedValue(new Error('no session'))
    vi.spyOn(client, 'fetchTypes').mockResolvedValue(['Fire', 'Water'])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads and renders the first page of Pokémon', async () => {
    vi.spyOn(client, 'fetchPokemonPage').mockResolvedValue(page([pokemon(1), pokemon(2)], 2))
    renderApp()
    await waitFor(() => expect(screen.getByText('Mon1')).toBeInTheDocument())
    expect(screen.getByText('Mon2')).toBeInTheDocument()
  })

  it('prompts for a trainer name on first capture, then captures after login', async () => {
    vi.spyOn(client, 'fetchPokemonPage').mockResolvedValue(page([pokemon(1)], 1))
    vi.spyOn(client, 'login').mockResolvedValue({ username: 'ash', captured: [] })
    vi.spyOn(client, 'capturePokemon').mockResolvedValue({ name: 'Mon1', captured: true })
    const user = userEvent.setup()
    renderApp()

    await waitFor(() => expect(screen.getByText('Mon1')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /capture mon1/i }))

    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/trainer name/i), 'Ash')
    await user.click(within(dialog).getByRole('button', { name: /start capturing/i }))

    await waitFor(() => expect(client.capturePokemon).toHaveBeenCalledWith('Mon1'))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /release mon1/i })).toBeInTheDocument(),
    )
  })

  it('re-fetches with the selected type when the filter changes', async () => {
    const spy = vi
      .spyOn(client, 'fetchPokemonPage')
      .mockResolvedValue(page([pokemon(1, { type_one: 'Fire' })], 1))
    const user = userEvent.setup()
    renderApp()
    await waitFor(() => expect(screen.getByText('Mon1')).toBeInTheDocument())

    await user.click(screen.getByLabelText(/^type$/i))
    await user.click(await screen.findByRole('option', { name: 'Fire' }))

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'Fire', page: 1 })),
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test -- App.test`
Expected: FAIL (current `App.tsx` is still the Vite scaffold)

- [ ] **Step 3: Rewrite `App.tsx`**

Replace the full contents of `frontend/src/App.tsx`:

```tsx
import { useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Container from '@mui/material/Container'
import Snackbar from '@mui/material/Snackbar'
import { FilterBar } from './components/FilterBar'
import { Header } from './components/Header'
import { LoginPrompt } from './components/LoginPrompt'
import { PokemonGrid } from './components/PokemonGrid'
import { useAuth } from './hooks/useAuth'
import { usePokemonList } from './hooks/usePokemonList'
import { useTypes } from './hooks/useTypes'
import { useUrlState } from './hooks/useUrlState'
import { useThemeMode } from './theme/ThemeModeProvider'

function App() {
  const { mode, toggle } = useThemeMode()
  const { state: filters, setFilters, setPages } = useUrlState()
  const types = useTypes()
  const auth = useAuth()
  const { items, loading, loadingMore, error, hasMore, loadMore, retry } = usePokemonList({
    filters: {
      pageSize: filters.pageSize,
      sortBy: filters.sortBy,
      order: filters.order,
      type: filters.type,
      q: filters.q,
    },
    initialPages: filters.pages,
    onPagesChange: setPages,
  })

  const [pendingCapture, setPendingCapture] = useState<string | null>(null)
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null)

  const mergedItems = useMemo(
    () => items.map((pokemon) => ({ ...pokemon, captured: auth.captured.has(pokemon.name) })),
    [items, auth.captured],
  )

  const handleToggleCapture = (name: string) => {
    if (!auth.username) {
      setPendingCapture(name)
      return
    }
    auth.toggleCapture(name).catch(() => setSnackbarMessage("Couldn't update capture. Try again."))
  }

  const handleLoginSubmit = async (username: string) => {
    await auth.login(username)
    setPendingCapture((current) => {
      if (current) {
        auth
          .toggleCapture(current)
          .catch(() => setSnackbarMessage("Couldn't update capture. Try again."))
      }
      return null
    })
  }

  return (
    <>
      <Header mode={mode} onToggleTheme={toggle} />
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <FilterBar types={types} filters={filters} onChange={setFilters} />
        <PokemonGrid
          items={mergedItems}
          loading={loading}
          loadingMore={loadingMore}
          error={error}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onRetry={retry}
          onToggleCapture={handleToggleCapture}
          pageSize={filters.pageSize}
        />
      </Container>
      <LoginPrompt
        open={pendingCapture !== null}
        onClose={() => setPendingCapture(null)}
        onSubmit={handleLoginSubmit}
        error={auth.loginError}
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
  )
}

export default App
```

- [ ] **Step 4: Rewrite `main.tsx`**

Replace the full contents of `frontend/src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { ThemeModeProvider } from './theme/ThemeModeProvider'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeModeProvider>
        <App />
      </ThemeModeProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 5: Update the page title**

In `frontend/index.html`, change:

```html
    <title>frontend</title>
```

to:

```html
    <title>Pokédex</title>
```

- [ ] **Step 6: Delete unused scaffold files**

```bash
cd frontend
rm src/App.css src/assets/react.svg src/assets/vite.svg src/assets/hero.png
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
git add frontend/src/App.tsx frontend/src/App.test.tsx frontend/src/main.tsx frontend/index.html
git rm frontend/src/App.css frontend/src/assets/react.svg frontend/src/assets/vite.svg frontend/src/assets/hero.png
git commit -m "feat(frontend): wire up the Pokédex app and remove Vite scaffold"
```

---

## Task 13: Manual verification in the browser

**Files:** none (verification only; fix-forward into whichever files are implicated if something breaks).

- [ ] **Step 1: Start the backend**

Run in a background/separate terminal: `cd backend && .venv/Scripts/python.exe app.py`
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

If any check above fails, identify the responsible file(s) from Tasks 1–12, fix it, re-run the relevant test file, and re-verify manually. Commit the fix separately with a message describing what was wrong.

---

## Self-Review Notes

- **Spec coverage:** list+sprites (Task 7/11), pagination via infinite scroll + URL persistence (Tasks 4/5/12), sorting by number asc/desc + other fields (Task 9), type filter + bonus text filter (Task 9), capture/release with server-memory persistence (Task 6/12, backend already handles persistence), theming with OS default + manual override (Task 3/10), performance (paginated fetches only, bounded infinite-scroll state per design doc), edge cases (Task 13, plus empty/error/end-of-list states built into Task 11).
- **Type consistency checked:** `FilterState` (Task 4) fields match what `usePokemonList`'s `PokemonListFilters` (Task 5) and `FilterBar`'s `FilterBarFilters` (Task 9) consume; `Pokemon`/`PokemonPage`/`Identity` (Task 2) are the only shapes referenced by every later hook/component; `Mode` (Task 3) is threaded unchanged through `ThemeToggle`/`Header` (Task 10) and `App.tsx` (Task 12).
- **No placeholders:** every step above has literal code, not descriptions of code.
