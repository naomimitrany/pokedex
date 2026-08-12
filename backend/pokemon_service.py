import math
import threading
from cachetools import TTLCache, cachedmethod, keys

import db


class PokemonService:
    DEFAULT_PAGE_SIZE = 20
    MAX_PAGE_SIZE = 100
    QUERY_CACHE_SIZE = 256

    def __init__(self, ttl_seconds=500):
        self._lock = threading.Lock()
        self._snapshot_cache = TTLCache(maxsize=1, ttl=ttl_seconds)
        self._condition = threading.Condition(self._lock)
        self._version = 0

        self._query_lock = threading.Lock()
        self._query_cache = TTLCache(maxsize=self.QUERY_CACHE_SIZE, ttl=ttl_seconds)

    @cachedmethod(
        lambda self: self._snapshot_cache,
        lock=lambda self: self._lock,
        condition=lambda self: self._condition,
    )
    def _snapshot(self):
        """The one place `db.get()` is called.

        Computes the raw list alongside everything derived from a full pass
        over it -- a name lookup dict, the sorted type list, and a version
        number -- so those derivations happen once per snapshot instead of
        once per request. The version lets `_filtered_sorted` detect a
        refreshed snapshot without keying on `id()`, which CPython can reuse
        across allocations once the old snapshot dict is freed.
        """
        pokemon = db.get()
        types = {p.get("type_one", "") for p in pokemon} | {
            p.get("type_two", "") for p in pokemon
        }
        self._version += 1
        return {
            "pokemon": pokemon,
            "by_name": {p["name"].lower(): p for p in pokemon},
            "types": sorted(types - {""}),
            "version": self._version,
        }

    def get_pokemon(self):
        return self._snapshot()["pokemon"]

    def find_by_name(self, name):
        return self._snapshot()["by_name"].get(name.lower())

    def pokemon_for_names(self, names):
        wanted = {n.lower() for n in names}
        matches = [
            p for p in self._snapshot()["pokemon"] if p["name"].lower() in wanted
        ]
        return self.sort_pokemon(matches, "number", descending=False)

    def available_types(self):
        return self._snapshot()["types"]

    @cachedmethod(
        lambda self: self._query_cache,
        key=lambda self, type_name, text, sort_by, order: keys.hashkey(
            self._snapshot()["version"], type_name, text, sort_by, order
        ),
        lock=lambda self: self._query_lock,
    )
    def _filtered_sorted(self, type_name, text, sort_by, order):
        results = self._snapshot()["pokemon"]
        if type_name:
            results = self.filter_by_type(results, type_name)
        if text:
            results = self.filter_by_text(results, text)
        return self.sort_pokemon(results, sort_by, descending=order == "desc")

    def query(
        self,
        page,
        page_size,
        sort_by,
        order,
        type_name=None,
        text=None,
        to_page=None,
    ):
        results = self._filtered_sorted(type_name, text, sort_by, order)

        total_count = len(results)
        total_pages = math.ceil(total_count / page_size)
        if to_page is not None:
            reached_page = min(to_page, total_pages) if total_pages else 1
        else:
            reached_page = page
        return {
            "items": self.paginate(results, page, page_size, to_page),
            "page": reached_page,
            "page_size": page_size,
            "total_count": total_count,
            "total_pages": total_pages,
        }

    @staticmethod
    def filter_by_type(pokemon, type_name):
        wanted = type_name.lower()
        return [
            p
            for p in pokemon
            if p["type_one"].lower() == wanted or p["type_two"].lower() == wanted
        ]

    @staticmethod
    def filter_by_text(pokemon, text):
        needle = text.lower().strip()
        return [
            p
            for p in pokemon
            if any(needle in str(value).lower() for value in p.values())
        ]

    @staticmethod
    def sort_pokemon(pokemon, sort_by, descending):
        # Two stable passes so the name tie-break always reads ascending,
        # regardless of `descending` -- a single `reverse=descending` on the
        # combined (sort_by, name) tuple would flip the tie-break direction
        # too, which is surprising (e.g. "descending" ties sorting Z-to-A).
        by_name = sorted(pokemon, key=lambda p: p["name"])
        return sorted(by_name, key=lambda p: p[sort_by], reverse=descending)

    @staticmethod
    def paginate(items, page, page_size, to_page=None):
        start = (page - 1) * page_size
        end = (to_page if to_page is not None else page) * page_size
        return items[start:end]
