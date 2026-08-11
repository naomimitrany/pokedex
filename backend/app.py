"""Pokédex HTTP API."""

import os
import secrets

from flask import Flask, jsonify, redirect, request, session
from flask_cors import CORS

from accounts import Accounts
from pokemon_service import PokemonService

ICON_URL = (
    "https://raw.githubusercontent.com/PokeAPI/sprites/master"
    "/sprites/pokemon/other/official-artwork/{number}.png"
)

app = Flask(__name__)

app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    # The frontend is a separate origin (:5173 -> :8080), so the cookie needs
    # SameSite=None, which browsers only honour alongside Secure -- fine over
    # http because localhost is a secure context. Behind the Vite proxy instead,
    # set SAMESITE=Lax and SECURE=0.
    SESSION_COOKIE_SAMESITE=os.environ.get("SESSION_COOKIE_SAMESITE", "None"),
    SESSION_COOKIE_SECURE=os.environ.get("SESSION_COOKIE_SECURE", "1") != "0",
)

CORS(
    app,
    supports_credentials=True,
    origins=os.environ.get(
        "FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(","),
)

pokemon_service = PokemonService()
accounts = Accounts()


class InvalidRequest(Exception):
    def __init__(self, parameter, message):
        super().__init__(message)
        self.parameter = parameter
        self.message = message


class UnknownPokemon(Exception):
    def __init__(self, name):
        super().__init__(name)
        self.name = name


class NotLoggedIn(Exception):
    pass


@app.errorhandler(InvalidRequest)
def _handle_invalid_request(error):
    return jsonify({"error": error.message, "parameter": error.parameter}), 400


@app.errorhandler(UnknownPokemon)
def _handle_unknown_pokemon(error):
    return jsonify({"error": f"no Pokémon named {error.name!r}"}), 404


@app.errorhandler(NotLoggedIn)
def _handle_not_logged_in(_error):
    return jsonify({"error": "login required"}), 401


def _int_arg(name, default, minimum, maximum=None):  # TODO use pydantic instead
    raw = request.args.get(name)
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        raise InvalidRequest(name, f"must be an integer, got {raw!r}")
    if value < minimum:
        raise InvalidRequest(name, f"must be >= {minimum}, got {value}")
    if maximum is not None and value > maximum:
        raise InvalidRequest(name, f"must be <= {maximum}, got {value}")
    return value


def _choice_arg(name, default, allowed):
    raw = request.args.get(name)
    if not raw:
        return default
    if raw not in allowed:
        raise InvalidRequest(name, f"must be one of {sorted(allowed)}, got {raw!r}")
    return raw


def _type_arg():
    raw = request.args.get("type")
    if not raw:
        return None
    allowed = pokemon_service.available_types()
    if raw.casefold() not in {t.casefold() for t in allowed}:
        raise InvalidRequest("type", f"must be one of {allowed}, got {raw!r}")
    return raw


def _body_string(field):
    value = (request.get_json(silent=True) or {}).get(field)
    if not isinstance(value, str) or not value.strip():
        raise InvalidRequest(field, "must be a non-empty string")
    return value.strip()


def _current_username():
    return accounts.username_for(session.get("id"))


def _require_username():
    username = _current_username()
    if username is None:
        raise NotLoggedIn()
    return username


def _require_pokemon(name):
    pokemon = pokemon_service.find_by_name(name)
    if pokemon is None:
        raise UnknownPokemon(name)
    return pokemon


def _identity(username):
    return {
        "username": username,
        "captured": sorted(accounts.captured_names(username)),
    }


@app.get("/pokemon")
def list_pokemon():
    return jsonify(
        pokemon_service.query(
            page=_int_arg("page", default=1, minimum=1),
            page_size=_int_arg(
                "page_size",
                default=PokemonService.DEFAULT_PAGE_SIZE,
                minimum=1,
                maximum=PokemonService.MAX_PAGE_SIZE,
            ),
            sort_by=_choice_arg(
                "sort_by",
                PokemonService.DEFAULT_SORT_FIELD,
                PokemonService.SORTABLE_FIELDS,
            ),
            order=_choice_arg("order", "asc", {"asc", "desc"}),
            type_name=_type_arg(),
            text=request.args.get("q") or None,
            captured_names=accounts.captured_names(_current_username()),
        )
    )


@app.get("/types")
def list_types():
    return jsonify(pokemon_service.available_types())


@app.get("/icon/<name>")
def get_icon(name):
    return redirect(ICON_URL.format(number=_require_pokemon(name)["number"]), code=302)


@app.post("/login")
def login():
    username = _body_string("username")
    session["id"] = accounts.login(username)
    return jsonify(_identity(username))


@app.post("/logout")
def logout():
    accounts.logout(session.pop("id", None))
    return jsonify(_identity(None))


@app.get("/me")
def me():
    return jsonify(_identity(_current_username()))


@app.post("/captures")
def capture_pokemon():
    username = _require_username()
    pokemon = _require_pokemon(_body_string("name"))
    accounts.capture(username, pokemon["name"])
    return jsonify({"name": pokemon["name"], "captured": True})


@app.delete("/captures/<name>")
def release_pokemon(name):
    username = _require_username()
    pokemon = _require_pokemon(name)
    accounts.release(username, pokemon["name"])
    return jsonify({"name": pokemon["name"], "captured": False})


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/")
def index():
    return jsonify(
        {
            "endpoints": [
                "/pokemon",
                "/types",
                "/icon/<name>",
                "/login",
                "/logout",
                "/me",
                "/captures",
                "/captures/<name>",
                "/health",
            ]
        }
    )


if __name__ == "__main__":
    app.run(port=8080)
