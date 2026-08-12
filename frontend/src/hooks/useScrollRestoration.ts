import { useEffect, useLayoutEffect, useState } from "react";
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
    if (evicted) sessionStorage.removeItem(evicted);
  }
  sessionStorage.setItem(INDEX_KEY, JSON.stringify(index));
};

const isAlreadyRestored = (scrollKey: string) =>
  Number(sessionStorage.getItem(scrollKey)) <= 0;

export const useScrollRestoration = (
  scrollKey: string,
  ready: boolean,
): boolean => {
  useEffect(() => {
    const main = getScrollContainer();
    if (!main) return;
    let timeout: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        sessionStorage.setItem(scrollKey, String(main.scrollTop));
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

  useLayoutEffect(() => {
    if (scrollRestored || !ready) return;
    const savedScrollTop = Number(sessionStorage.getItem(scrollKey));
    getScrollContainer()?.scrollTo({ top: savedScrollTop });
    setScrollRestored(true);
  }, [scrollRestored, ready, scrollKey]);

  return scrollRestored;
};
