from pokemon_service import PokemonService


def names(body):
    return [p["name"] for p in body["items"]]


class TestDefaults:
    def test_returns_first_page_sorted_by_number(self, client):
        body = client.get("/pokemon").get_json()

        assert body["page"] == 1
        assert body["page_size"] == PokemonService.DEFAULT_PAGE_SIZE
        assert body["total_count"] == 6
        assert body["total_pages"] == 1
        assert names(body) == [
            "Bulbasaur",
            "Charmander",
            "Charizard",
            "CharizardMega Charizard X",
            "Squirtle",
            "Articuno",
        ]

    def test_every_field_survives_the_round_trip(self, client):
        first = client.get("/pokemon").get_json()["items"][0]

        assert first == {
            "number": 1,
            "name": "Bulbasaur",
            "type_one": "Grass",
            "type_two": "Poison",
            "total": 318,
            "hit_points": 50,
            "attack": 50,
            "defense": 50,
            "special_attack": 50,
            "special_defense": 50,
            "speed": 50,
            "generation": 1,
            "legendary": False,
        }


class TestPagination:
    def test_splits_across_pages(self, client):
        first = client.get("/pokemon?page=1&page_size=2").get_json()
        second = client.get("/pokemon?page=2&page_size=2").get_json()

        assert first["total_pages"] == 3
        assert names(first) == ["Bulbasaur", "Charmander"]
        assert names(second) == ["Charizard", "CharizardMega Charizard X"]

    def test_last_page_may_be_short(self, client):
        body = client.get("/pokemon?page=2&page_size=4").get_json()

        assert body["total_pages"] == 2
        assert names(body) == ["Squirtle", "Articuno"]

    def test_page_past_the_end_is_empty_not_an_error(self, client):
        response = client.get("/pokemon?page=99")

        assert response.status_code == 200
        assert response.get_json()["items"] == []
        assert response.get_json()["total_count"] == 6


class TestToPageRange:
    def test_collapses_a_range_of_pages_into_one_response(self, client):
        body = client.get("/pokemon?page=1&page_size=2&to_page=2").get_json()

        assert names(body) == [
            "Bulbasaur",
            "Charmander",
            "Charizard",
            "CharizardMega Charizard X",
        ]
        assert body["page"] == 2
        assert body["total_pages"] == 3

    def test_matches_two_separate_single_page_requests(self, client):
        collapsed = client.get("/pokemon?page=1&page_size=2&to_page=3").get_json()
        first = client.get("/pokemon?page=1&page_size=2").get_json()
        second = client.get("/pokemon?page=2&page_size=2").get_json()
        third = client.get("/pokemon?page=3&page_size=2").get_json()

        assert names(collapsed) == names(first) + names(second) + names(third)

    def test_beyond_the_data_clamps_the_reported_page_to_the_real_last_page(
        self, client
    ):
        body = client.get("/pokemon?page=1&page_size=2&to_page=99").get_json()

        assert names(body) == [
            "Bulbasaur",
            "Charmander",
            "Charizard",
            "CharizardMega Charizard X",
            "Squirtle",
            "Articuno",
        ]
        assert body["page"] == 3
        assert body["total_pages"] == 3

    def test_no_matches_still_reports_page_one(self, client):
        body = client.get("/pokemon?q=notapokemon&to_page=5").get_json()

        assert body["items"] == []
        assert body["page"] == 1


class TestSorting:
    def test_descending(self, client):
        body = client.get("/pokemon?order=desc").get_json()

        # Charizard and its Mega forme tie on number (6); the name tie-break
        # stays ascending even though the primary sort is descending.
        assert names(body) == [
            "Articuno",
            "Squirtle",
            "Charizard",
            "CharizardMega Charizard X",
            "Charmander",
            "Bulbasaur",
        ]

    def test_sort_by_another_field(self, client):
        body = client.get("/pokemon?sort_by=total&order=desc").get_json()

        assert names(body)[:2] == ["CharizardMega Charizard X", "Articuno"]

    def test_duplicate_numbers_get_a_stable_total_order(self, client):
        """Number 6 is both Charizard and its Mega forme.

        Without a unique tie-break, rows either repeat or vanish across page
        boundaries. Paging one at a time must still visit each row exactly once.
        """
        paged = []
        for page in range(1, 7):
            paged += names(client.get(f"/pokemon?page={page}&page_size=1").get_json())

        assert paged == names(client.get("/pokemon?page_size=10").get_json())
        assert len(set(paged)) == 6


class TestFiltering:
    def test_type_matches_primary_or_secondary(self, client):
        body = client.get("/pokemon?type=Flying").get_json()

        # Neither of these has Flying as its *primary* type.
        assert names(body) == ["Charizard", "Articuno"]
        assert body["total_count"] == 2

    def test_type_is_case_insensitive(self, client):
        assert client.get("/pokemon?type=fire").get_json()["total_count"] == 3

    def test_text_search_spans_all_fields(self, client):
        # "Dragon" appears only as a secondary type, never in a name.
        body = client.get("/pokemon?q=dragon").get_json()

        assert names(body) == ["CharizardMega Charizard X"]

    def test_text_search_matches_names(self, client):
        assert client.get("/pokemon?q=char").get_json()["total_count"] == 3

    def test_no_matches_is_an_empty_page_not_an_error(self, client):
        response = client.get("/pokemon?q=notapokemon")

        assert response.status_code == 200
        assert response.get_json() == {
            "items": [],
            "page": 1,
            "page_size": PokemonService.DEFAULT_PAGE_SIZE,
            "total_count": 0,
            "total_pages": 0,
        }

    def test_filter_sort_and_paginate_combine(self, client):
        body = client.get(
            "/pokemon?type=fire&sort_by=total&order=desc&page=2&page_size=1"
        ).get_json()

        assert body["total_count"] == 3
        assert body["total_pages"] == 3
        assert names(body) == ["Charizard"]


class TestInvalidParameters:
    def test_non_numeric_page(self, client):
        response = client.get("/pokemon?page=abc")

        assert response.status_code == 400
        assert response.get_json()["parameter"] == "page"

    def test_page_below_one(self, client):
        assert client.get("/pokemon?page=0").status_code == 400

    def test_page_size_above_the_cap(self, client):
        response = client.get(f"/pokemon?page_size={PokemonService.MAX_PAGE_SIZE + 1}")

        assert response.status_code == 400
        assert response.get_json()["parameter"] == "page_size"

    def test_unsortable_field(self, client):
        response = client.get("/pokemon?sort_by=legendary")

        assert response.status_code == 400
        assert response.get_json()["parameter"] == "sort_by"

    def test_unknown_order(self, client):
        assert client.get("/pokemon?order=sideways").status_code == 400

    def test_unknown_type(self, client):
        response = client.get("/pokemon?type=banana")

        assert response.status_code == 400
        assert response.get_json()["parameter"] == "type"

    def test_to_page_before_page(self, client):
        response = client.get("/pokemon?page=3&to_page=2")

        assert response.status_code == 400
        assert response.get_json()["parameter"] == "to_page"

    def test_blank_values_fall_back_to_defaults(self, client):
        response = client.get("/pokemon?page=&page_size=&sort_by=&order=&type=&q=")

        assert response.status_code == 200
        assert response.get_json()["total_count"] == 6


class TestTypes:
    def test_lists_primary_and_secondary_types_sorted(self, client):
        assert client.get("/types").get_json() == [
            "Dragon",
            "Fire",
            "Flying",
            "Grass",
            "Ice",
            "Poison",
            "Water",
        ]

    def test_excludes_the_empty_secondary_type(self, client):
        assert "" not in client.get("/types").get_json()


class TestPokemonDetail:
    def test_returns_the_full_record(self, client):
        response = client.get("/pokemon/Bulbasaur")

        assert response.status_code == 200
        assert response.get_json() == {
            "number": 1,
            "name": "Bulbasaur",
            "type_one": "Grass",
            "type_two": "Poison",
            "total": 318,
            "hit_points": 50,
            "attack": 50,
            "defense": 50,
            "special_attack": 50,
            "special_defense": 50,
            "speed": 50,
            "generation": 1,
            "legendary": False,
        }

    def test_is_case_insensitive(self, client):
        assert client.get("/pokemon/bulbasaur").status_code == 200

    def test_unknown_name_is_a_404(self, client):
        response = client.get("/pokemon/Missingno")

        assert response.status_code == 404
        assert "error" in response.get_json()


class TestIcon:
    def test_redirects_to_the_artwork_for_that_number(self, client):
        response = client.get("/icon/Charizard")

        assert response.status_code == 302
        assert response.headers["Location"].endswith("/official-artwork/6.png")

    def test_is_case_insensitive(self, client):
        assert client.get("/icon/charizard").status_code == 302

    def test_unknown_name_is_a_404(self, client):
        response = client.get("/icon/Missingno")

        assert response.status_code == 404
        assert "error" in response.get_json()


class TestCaching:
    def test_many_requests_hit_the_db_once(self, client, stub_db):
        for _ in range(4):
            client.get("/pokemon")
        client.get("/types")
        client.get("/icon/Squirtle")

        assert len(stub_db) == 1
