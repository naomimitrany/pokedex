import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getScrollContainer } from "../utils/scrollContainer";

const INDEX_KEY = "pokedex:scroll:index";
const MAX_TRACKED_KEYS = 20;

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
    if (evicted) {
      sessionStorage.removeItem(evicted);
      sessionStorage.removeItem(pagesKey(evicted));
    }
  }
  sessionStorage.setItem(INDEX_KEY, JSON.stringify(index));
};

const isAlreadyRestored = (scrollKey: string) =>
  Number(sessionStorage.getItem(scrollKey)) <= 0;

const pagesKey = (scrollKey: string) => `${scrollKey}:pages`;

// How many pages were loaded the last time this key's scroll position was
// saved. The URL's own `pages` value can lag behind this -- it's written
// asynchronously once a fetch resolves, while the scroll listener below
// captures scrollTop the moment the user stops scrolling, which can be
// before that write lands. Restoring against only the URL's count can then
// under-load content and clamp the restored scroll short of the real
// position. Callers should restore to at least `Math.max(urlPages, this)`.
export const getSavedPages = (scrollKey: string): number => {
  const raw = Number(sessionStorage.getItem(pagesKey(scrollKey)));
  return Number.isInteger(raw) && raw > 0 ? raw : 1;
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
        sessionStorage.setItem(scrollKey, String(main.scrollTop));
        sessionStorage.setItem(
          pagesKey(scrollKey),
          String(loadedPagesRef.current),
        );
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

  // Set by the jump effect below, read by the settle effect that follows it --
  // a ref (not state) because writing it must not itself trigger a re-render.
  const savedScrollTopRef = useRef(0);

  useLayoutEffect(() => {
    if (scrollRestored || !ready) return;
    const savedScrollTop = Number(sessionStorage.getItem(scrollKey));
    savedScrollTopRef.current = savedScrollTop;
    getScrollContainer()?.scrollTo({ top: savedScrollTop });
    setScrollRestored(true);
  }, [scrollRestored, ready, scrollKey]);

  // A restore fetch inserts every card for the target pages in one commit, and
  // things like content-visibility's skip-sizing of off-screen cards settle
  // asynchronously on a later paint rather than synchronously with that
  // insert -- so the jump above can still get nudged out of place for a few
  // frames afterward. Re-snap to the saved offset until layout stops moving,
  // backing off the moment the user actually touches the scroll themselves.
  // A separate effect (rather than folding this into the one above) so that
  // setScrollRestored(true) firing doesn't tear this loop down before its
  // first frame runs -- this one only depends on the state that effect sets.
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

    const deadline = performance.now() + 300;
    let raf = requestAnimationFrame(function reassert() {
      if (cancelled) return;
      if (container.scrollTop !== savedScrollTop) {
        container.scrollTo({ top: savedScrollTop });
      }
      if (performance.now() < deadline) raf = requestAnimationFrame(reassert);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      container.removeEventListener("wheel", cancel);
      container.removeEventListener("touchstart", cancel);
    };
  }, [scrollRestored]);

  return scrollRestored;
};
