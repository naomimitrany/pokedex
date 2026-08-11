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
