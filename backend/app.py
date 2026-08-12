import os
import secrets

from flask import Flask, jsonify, redirect, request, session
from flask_cors import CORS
from pydantic import ValidationError

from accounts import Accounts
from exceptions import InvalidRequest, UnknownPokemon, NotLoggedIn
from pokemon_service import PokemonService
from request_args import body_string, parse_pokemon_query

ICON_URL = (
    "https://raw.githubusercontent.com/PokeAPI/sprites/master"
    "/sprites/pokemon/other/official-artwork/{number}.png"
)

app = Flask(__name__)

app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
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


@app.errorhandler(InvalidRequest)
def _handle_invalid_request(error):
    return jsonify({"error": error.message, "parameter": error.parameter}), 400


@app.errorhandler(UnknownPokemon)
def _handle_unknown_pokemon(error):
    return jsonify({"error": f"no Pokémon named {error.name!r}"}), 404


@app.errorhandler(NotLoggedIn)
def _handle_not_logged_in(_error):
    return jsonify({"error": "login required"}), 401


def _pokemon_query_args():
    try:
        return parse_pokemon_query(request.args, pokemon_service.available_types())
    except ValidationError as error:
        first = error.errors()[0]
        parameter = str(first["loc"][0]) if first["loc"] else "?"
        raise InvalidRequest(parameter, first["msg"])


def _body_string(field):
    value = body_string(field)
    if value is None:
        raise InvalidRequest(field, "must be a non-empty string")
    return value


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
    args = _pokemon_query_args()
    return jsonify(
        pokemon_service.query(
            page=args.page,
            page_size=args.page_size,
            sort_by=args.sort_by,
            order=args.order,
            type_name=args.type_name,
            text=args.q,
            to_page=args.to_page,
        )
    )


@app.get("/types")
def list_types():
    return jsonify(pokemon_service.available_types())


@app.get("/icon/<name>")
def get_icon(name):
    response = redirect(
        ICON_URL.format(number=_require_pokemon(name)["number"]), code=302
    )
    response.headers["Cache-Control"] = "public, max-age=604800, immutable"
    return response


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


@app.get("/captures")
def list_captures():
    username = _require_username()
    return jsonify(pokemon_service.pokemon_for_names(accounts.captured_names(username)))


if __name__ == "__main__":
    app.run(port=8080)
