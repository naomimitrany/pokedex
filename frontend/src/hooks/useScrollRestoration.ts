import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MAX_AUTO_RESTORE_PAGES } from "../constants";
import { getScrollContainer } from "../utils/scrollContainer";

const INDEX_KEY = "pokedex:scroll:index";
const MAX_TRACKED_KEYS = 20;

type ScrollEntry = { scrollTop: number; pages: number };

const readEntry = (scrollKey: string): ScrollEntry | null => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(scrollKey) ?? "null");
    if (
      !parsed ||
      typeof parsed.scrollTop !== "number" ||
      typeof parsed.pages !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeEntry = (scrollKey: string, entry: ScrollEntry) => {
  sessionStorage.setItem(scrollKey, JSON.stringify(entry));
};

const readIndex = (): string[] => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(INDEX_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Marks `key` as the most recently used scroll key, evicting the oldest
// entries once more than MAX_TRACKED_KEYS distinct keys have been written.
// Without this, every filter/search combination visited in a session would
// leave its own sessionStorage entry behind for the life of the tab.
const touchScrollKey = (key: string) => {
  const index = readIndex().filter((k) => k !== key);
  index.push(key);
  while (index.length > MAX_TRACKED_KEYS) {
    const evicted = index.shift();
    if (evicted) sessionStorage.removeItem(evicted);
  }
  sessionStorage.setItem(INDEX_KEY, JSON.stringify(index));
};

const isAlreadyRestored = (scrollKey: string) => {
  const entry = readEntry(scrollKey);
  return !entry || entry.scrollTop <= 0;
};

// The single read path for a saved scroll position: the pixel offset and
// how many pages were on screen when it was saved, written together so they
// can never disagree with each other (the old design tracked page count in
// a second place -- the URL -- and the two could drift). `pages` is clamped
// here, at read time, so a stale/tampered entry from a previous session
// can't force an oversized collapsed restore fetch.
export const getSavedScrollEntry = (
  scrollKey: string,
): ScrollEntry | null => {
  const entry = readEntry(scrollKey);
  if (!entry) return null;
  return {
    scrollTop: entry.scrollTop,
    pages: Math.min(
      Math.max(Math.trunc(entry.pages), 1),
      MAX_AUTO_RESTORE_PAGES,
    ),
  };
};

export const useScrollRestoration = (
  scrollKey: string,
  ready: boolean,
  loadedPages: number,
): boolean => {
  // Read by the scroll listener's debounced handler without making it a
  // dependency of the effect below (which would tear down and rebuild the
  // listener, and drop in-flight debounce timers, on every page load).
  const loadedPagesRef = useRef(loadedPages);
  useEffect(() => {
    loadedPagesRef.current = loadedPages;
  }, [loadedPages]);

  useEffect(() => {
    const main = getScrollContainer();
    if (!main) return;
    let timeout: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        writeEntry(scrollKey, {
          scrollTop: main.scrollTop,
          pages: loadedPagesRef.current,
        });
        touchScrollKey(scrollKey);
      }, 150);
    };
    main.addEventListener("scroll", handleScroll);
    return () => {
      clearTimeout(timeout);
      main.removeEventListener("scroll", handleScroll);
    };
  }, [scrollKey]);

  // Kept false until the saved scroll offset (if any) is applied, so a
  // restore never renders at the top before jumping down.
  const [trackedKey, setTrackedKey] = useState(scrollKey);
  const [scrollRestored, setScrollRestored] = useState(() =>
    isAlreadyRestored(scrollKey),
  );

  // Re-derive during render (not an effect) whenever scrollKey changes, so a
  // switch to a key with its own saved offset re-arms the restore instead of
  // staying latched `true` from a previous key. Doing this in render rather
  // than an effect means the caller's "hidden until restored" gate never
  // gets a chance to flash the new key's content at the old scroll offset.
  if (scrollKey !== trackedKey) {
    setTrackedKey(scrollKey);
    setScrollRestored(isAlreadyRestored(scrollKey));
  }

  // Set by the jump effect below, read by the font-settle correction that
  // follows it -- a ref (not state) because writing it must not itself
  // trigger a re-render.
  const savedScrollTopRef = useRef(0);

  // One jump, before paint, once the restore-target content has rendered.
  // Cards that were part of that initial render stay exempt from
  // content-visibility for the life of this mount (see PokemonGrid's
  // `restoredCount` prop) specifically so this scrollTo can't get knocked
  // off target by a later content-visibility re-estimate -- no re-snap
  // loop needed here as a result.
  useLayoutEffect(() => {
    if (scrollRestored || !ready) return;
    const entry = readEntry(scrollKey);
    const savedScrollTop = entry?.scrollTop ?? 0;
    savedScrollTopRef.current = savedScrollTop;
    getScrollContainer()?.scrollTo({ top: savedScrollTop });
    setScrollRestored(true);
  }, [scrollRestored, ready, scrollKey]);

  // Web fonts (card names/labels) swap in asynchronously after the initial
  // paint; their metrics differ from the fallback font, which can reflow
  // card heights just enough to leave the jump above a few px short or long
  // by the time the real font settles. This corrects for that once, tied
  // to the actual font-load completion event -- not a blind polling loop
  // -- and backs off the moment the user actually scrolls/touches
  // themselves. `document.fonts` doesn't exist in the jsdom test
  // environment, so this is a no-op there (optional chaining), which is
  // correct: there's no async font swap to correct for in tests either.
  useEffect(() => {
    if (!scrollRestored) return;
    const savedScrollTop = savedScrollTopRef.current;
    if (savedScrollTop <= 0) return;
    const container = getScrollContainer();
    if (!container) return;

    let cancelled = false;
    const cancel = () => {
      cancelled = true;
    };
    container.addEventListener("wheel", cancel, { once: true, passive: true });
    container.addEventListener("touchstart", cancel, {
      once: true,
      passive: true,
    });

    document.fonts?.ready?.then(() => {
      if (cancelled) return;
      if (container.scrollTop !== savedScrollTop) {
        container.scrollTo({ top: savedScrollTop });
      }
    });

    return () => {
      cancelled = true;
      container.removeEventListener("wheel", cancel);
      container.removeEventListener("touchstart", cancel);
    };
  }, [scrollRestored]);

  return scrollRestored;
};
