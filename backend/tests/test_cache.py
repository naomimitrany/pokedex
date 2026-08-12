import threading
import time

import db
from pokemon_service import PokemonService


def test_repeated_calls_hit_the_db_once(stub_db):
    service = PokemonService()

    for _ in range(5):
        service.get_pokemon()

    assert len(stub_db) == 1


def test_snapshot_reloads_once_the_ttl_lapses(stub_db):
    """The database is live, so the cache must not serve one snapshot forever."""
    service = PokemonService(ttl_seconds=0.05)

    service.get_pokemon()
    time.sleep(0.1)
    service.get_pokemon()

    assert len(stub_db) == 2


def test_filtered_sorted_reflects_a_refreshed_snapshot(monkeypatch):
    """Regression test for the id()-based query cache key.

    `_filtered_sorted` used to key its cache on `id(self._snapshot())`. With
    `_snapshot_cache` bounded to maxsize=1, the old snapshot dict is freed the
    instant a refreshed one replaces it, and CPython can reuse that freed
    address for the new dict -- making the "new" key collide with a
    query-cache entry computed against the old, stale data.
    """
    datasets = [
        [{"number": 1, "name": "Bulbasaur"}],
        [{"number": 1, "name": "Bulbasaur"}, {"number": 4, "name": "Charmander"}],
    ]
    calls = []

    def fake_get():
        data = datasets[min(len(calls), len(datasets) - 1)]
        calls.append(1)
        return data

    monkeypatch.setattr(db, "get", fake_get)
    service = PokemonService(ttl_seconds=0.05)

    first = service.query(1, 10, "number", "asc")
    assert first["total_count"] == 1

    time.sleep(0.1)

    second = service.query(1, 10, "number", "asc")
    assert second["total_count"] == 2
    assert len(calls) == 2
    assert service._snapshot()["version"] == 2


def test_concurrent_misses_hit_the_db_once(monkeypatch):
    """The stampede guard.

    `cachedmethod` calls the wrapped method outside its `lock`, so a lock alone
    would let all eight threads run db.get() and each pay the full latency. The
    `condition` makes it single-flight: one thread loads, the rest wait.
    """
    calls = []
    concurrency = 8
    barrier = threading.Barrier(concurrency)

    def slow_get():
        calls.append(1)
        time.sleep(0.3)  # stands in for db.QUERY_EXECUTION_TIME
        return [{"number": 1, "name": "Bulbasaur"}]

    monkeypatch.setattr(db, "get", slow_get)
    service = PokemonService()
    results = []

    def worker():
        barrier.wait()  # everyone misses at the same instant
        results.append(service.get_pokemon())

    threads = [threading.Thread(target=worker) for _ in range(concurrency)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert len(calls) == 1, f"expected one db.get(), got {len(calls)}"
    assert len(results) == concurrency
    assert all(result == results[0] for result in results)
