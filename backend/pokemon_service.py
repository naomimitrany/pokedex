import math
import threading
from cachetools import TTLCache, cachedmethod

import db


class PokemonService:

    DEFAULT_PAGE_SIZE = 20
    MAX_PAGE_SIZE = 100
    DEFAULT_SORT_FIELD = "number"
    SORTABLE_FIELDS = frozenset(
        {
            "number",
            "name",
            "total",
            "hit_points",
            "attack",
            "defense",
            "special_attack",
            "special_defense",
            "speed",
            "generation",
        }
    )

    def __init__(self, ttl_seconds=500):
        self._cache = TTLCache(maxsize=1, ttl=ttl_seconds)
        self._lock = threading.Lock()
        self._condition = threading.Condition(self._lock)

    @cachedmethod(
        lambda self: self._cache,
        lock=lambda self: self._lock,
        condition=lambda self: self._condition,
    )
    def get_pokemon(self):
        return db.get()

    def find_by_name(self, name):
        return next(
            (p for p in self.get_pokemon() if p["name"].lower() == name.lower()), None
        )

    def available_types(self):  # TODO seperate type one and type two
        pokemon = self.get_pokemon()
        types = {p["type_one"] for p in pokemon} | {p["type_two"] for p in pokemon}
        return sorted(types - {""})

    def query(
        self,
        page,
        page_size,
        sort_by,
        order,
        type_name=None,
        text=None,
        captured_names=frozenset(),
    ):
        results = self.get_pokemon()

        if type_name:
            results = self.filter_by_type(results, type_name)
        if text:
            results = self.filter_by_text(results, text)
        results = self.sort_pokemon(results, sort_by, descending=order == "desc")

        total_count = len(results)
        return {
            "items": [
                {**pokemon, "captured": pokemon["name"] in captured_names}
                for pokemon in self.paginate(results, page, page_size)
            ],
            "page": page,
            "page_size": page_size,
            "total_count": total_count,
            "total_pages": math.ceil(total_count / page_size),
        }

    @staticmethod
    def filter_by_type(pokemon, type_name):
        wanted = type_name.casefold()
        return [
            p
            for p in pokemon
            if p["type_one"].casefold() == wanted or p["type_two"].casefold() == wanted
        ]

    @staticmethod
    def filter_by_text(pokemon, text):
        needle = text.casefold().strip()
        return [
            p
            for p in pokemon
            if any(needle in str(value).casefold() for value in p.values())
        ]

    @staticmethod
    def sort_pokemon(pokemon, sort_by, descending):
        return sorted(
            pokemon, key=lambda p: (p[sort_by], p["name"]), reverse=descending
        )

    @staticmethod
    def paginate(items, page, page_size):
        start = (page - 1) * page_size
        return items[start : start + page_size]
