from typing import Literal, Optional

from flask import request
from pydantic import BaseModel, ConfigDict, Field, field_validator

from pokemon_service import PokemonService

SortField = Literal[
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
]


class PokemonQueryArgs(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    page: int = Field(default=1, ge=1)
    page_size: int = Field(
        default=PokemonService.DEFAULT_PAGE_SIZE, ge=1, le=PokemonService.MAX_PAGE_SIZE
    )
    to_page: Optional[int] = Field(default=None, ge=1)
    sort_by: SortField = "number"
    order: Literal["asc", "desc"] = "asc"
    type_name: Optional[str] = Field(default=None, alias="type")
    q: Optional[str] = None

    @field_validator("type_name")
    @classmethod
    def _known_type(cls, value, info):
        if value is None:
            return None
        allowed = (info.context or {}).get("allowed_types", ())
        if value.lower() not in {t.lower() for t in allowed}:
            raise ValueError(f"must be one of {sorted(allowed)}, got {value!r}")
        return value

    @field_validator("to_page")
    @classmethod
    def _to_page_not_before_page(cls, value, info):
        if value is None:
            return None
        page = info.data.get("page", 1)
        if value < page:
            raise ValueError(f"must be >= page ({page})")
        return value


def parse_pokemon_query(args, allowed_types):
    raw = {key: value for key, value in args.items() if value}
    return PokemonQueryArgs.model_validate(
        raw, context={"allowed_types": allowed_types}
    )


def body_string(field):
    value = (request.get_json(silent=True) or {}).get(field)
    if not isinstance(value, str) or not value.strip():
        return None
    return value.strip()
