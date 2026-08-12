// Single source of truth for "how do we find the app's scroll container" —
// avoids each caller independently querying the DOM for `<main>`.
export const getScrollContainer = (): HTMLElement | null =>
  document.querySelector("main");
