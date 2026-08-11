from cachetools import TTLCache, cached

import db

@cached(TTLCache(maxsize=1, ttl=90))
def get_pokemon():
    return db.get()