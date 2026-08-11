import pytest

import app as flask_app
import db
from accounts import Accounts
from pokemon_service import PokemonService


def make_pokemon(number, name, type_one, type_two="", **overrides):
    pokemon = {
        "number": number,
        "name": name,
        "type_one": type_one,
        "type_two": type_two,
        "total": 300,
        "hit_points": 50,
        "attack": 50,
        "defense": 50,
        "special_attack": 50,
        "special_defense": 50,
        "speed": 50,
        "generation": 1,
        "legendary": False,
    }
    pokemon.update(overrides)
    return pokemon


# Deliberately includes the two shapes that break naive implementations: a
# repeated `number` across formes, and a Pokémon whose *secondary* type is the
# one being filtered on.
SAMPLE = [
    make_pokemon(1, "Bulbasaur", "Grass", "Poison", total=318),
    make_pokemon(4, "Charmander", "Fire", total=309),
    make_pokemon(6, "Charizard", "Fire", "Flying", total=534),
    make_pokemon(6, "CharizardMega Charizard X", "Fire", "Dragon", total=634),
    make_pokemon(7, "Squirtle", "Water", total=314),
    make_pokemon(144, "Articuno", "Ice", "Flying", total=580, legendary=True),
]


@pytest.fixture(autouse=True)
def stub_db(monkeypatch):
    """Small in-memory dataset, no 2s sleep, and fresh state per test."""
    calls = []

    def fake_get():
        calls.append(1)
        return [dict(p) for p in SAMPLE]

    monkeypatch.setattr(db, "get", fake_get)
    monkeypatch.setattr(flask_app, "pokemon_service", PokemonService())
    monkeypatch.setattr(flask_app, "accounts", Accounts())
    return calls


@pytest.fixture
def make_client():
    """Builds independent clients -- each one is its own browser/cookie jar."""
    flask_app.app.config["TESTING"] = True
    # Cookie transport flags are a browser concern, and the test client speaks
    # plain http -- it would refuse to send back a Secure cookie.
    flask_app.app.config["SESSION_COOKIE_SECURE"] = False
    flask_app.app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

    def build(username=None):
        client = flask_app.app.test_client()
        if username is not None:
            client.post("/login", json={"username": username})
        return client

    return build


@pytest.fixture
def client(make_client):
    """An anonymous client."""
    return make_client()


@pytest.fixture
def ash(make_client):
    """A client already logged in as "ash"."""
    return make_client("ash")
