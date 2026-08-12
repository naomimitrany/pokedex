class TestLogin:
    def test_login_returns_the_identity(self, client):
        response = client.post("/login", json={"username": "ash"})

        assert response.status_code == 200
        assert response.get_json() == {"username": "ash", "captured": []}

    def test_blank_username_is_rejected(self, client):
        response = client.post("/login", json={"username": "   "})

        assert response.status_code == 400
        assert response.get_json()["parameter"] == "username"

    def test_missing_body_is_rejected(self, client):
        assert client.post("/login").status_code == 400

    def test_anonymous_me_has_no_identity(self, client):
        assert client.get("/me").get_json() == {"username": None, "captured": []}

    def test_session_survives_across_requests(self, ash):
        assert ash.get("/me").get_json()["username"] == "ash"

    def test_logout_clears_the_session(self, ash):
        ash.post("/logout")

        assert ash.get("/me").get_json()["username"] is None

    def test_logging_back_in_restores_captures(self, ash):
        """Captures belong to the user, not to the session."""
        ash.post("/captures", json={"name": "Squirtle"})
        ash.post("/logout")
        response = ash.post("/login", json={"username": "ash"})

        assert response.get_json()["captured"] == ["Squirtle"]


class TestCaptureRequiresLogin:
    def test_capture_is_401_when_anonymous(self, client):
        response = client.post("/captures", json={"name": "Squirtle"})

        assert response.status_code == 401
        assert response.get_json() == {"error": "login required"}

    def test_release_is_401_when_anonymous(self, client):
        assert client.delete("/captures/Squirtle").status_code == 401

    def test_anonymous_identity_is_unaffected_by_others_captures(self, client, ash):
        ash.post("/captures", json={"name": "Squirtle"})

        assert client.get("/me").get_json()["captured"] == []


class TestCapturing:
    def test_capture_shows_up_in_me(self, ash):
        ash.post("/captures", json={"name": "Squirtle"})

        assert ash.get("/me").get_json()["captured"] == ["Squirtle"]

    def test_capturing_twice_is_not_an_error(self, ash):
        first = ash.post("/captures", json={"name": "Squirtle"})
        second = ash.post("/captures", json={"name": "Squirtle"})

        assert first.status_code == second.status_code == 200
        assert second.get_json() == {"name": "Squirtle", "captured": True}
        assert ash.get("/me").get_json()["captured"] == ["Squirtle"]

    def test_release_undoes_a_capture(self, ash):
        ash.post("/captures", json={"name": "Squirtle"})
        response = ash.delete("/captures/Squirtle")

        assert response.get_json() == {"name": "Squirtle", "captured": False}
        assert ash.get("/me").get_json()["captured"] == []

    def test_releasing_something_uncaptured_is_not_an_error(self, ash):
        assert ash.delete("/captures/Squirtle").status_code == 200

    def test_capture_is_stored_under_the_canonical_name(self, ash):
        """A lowercase request must not create a second, separate entry."""
        ash.post("/captures", json={"name": "squirtle"})

        assert ash.get("/me").get_json()["captured"] == ["Squirtle"]

    def test_capturing_an_unknown_pokemon_is_a_404(self, ash):
        response = ash.post("/captures", json={"name": "Missingno"})

        assert response.status_code == 404
        assert "error" in response.get_json()

    def test_releasing_an_unknown_pokemon_is_a_404(self, ash):
        assert ash.delete("/captures/Missingno").status_code == 404

    def test_capture_without_a_name_is_a_400(self, ash):
        response = ash.post("/captures", json={})

        assert response.status_code == 400
        assert response.get_json()["parameter"] == "name"

    def test_captures_survive_a_forme_sharing_a_number(self, ash):
        """Charizard and its Mega share number 6; capturing one must not
        capture the other. This is why captures key off name, not number."""
        ash.post("/captures", json={"name": "Charizard"})

        assert ash.get("/me").get_json()["captured"] == ["Charizard"]


class TestUsersAreIsolated:
    def test_two_users_have_separate_captures(self, ash, make_client):
        misty = make_client("misty")

        ash.post("/captures", json={"name": "Squirtle"})
        misty.post("/captures", json={"name": "Bulbasaur"})

        assert ash.get("/me").get_json()["captured"] == ["Squirtle"]
        assert misty.get("/me").get_json()["captured"] == ["Bulbasaur"]

    def test_one_user_cannot_release_anothers_capture(self, ash, make_client):
        misty = make_client("misty")
        ash.post("/captures", json={"name": "Squirtle"})

        misty.delete("/captures/Squirtle")

        assert ash.get("/me").get_json()["captured"] == ["Squirtle"]

    def test_identity_comes_from_the_session_not_the_body(self, ash, make_client):
        """Naming another user in the payload must not act on their behalf."""
        misty = make_client("misty")

        misty.post("/captures", json={"name": "Squirtle", "username": "ash"})

        assert ash.get("/me").get_json()["captured"] == []
        assert misty.get("/me").get_json()["captured"] == ["Squirtle"]


class TestPokemonListDoesNotExposeCaptureState:
    """`/pokemon` is a shared, cacheable catalog; per-user capture state lives
    only in `/me` so the list response never has to be computed per user."""

    def test_pokemon_items_have_no_captured_key(self, ash):
        ash.post("/captures", json={"name": "Squirtle"})
        body = ash.get("/pokemon").get_json()

        assert all("captured" not in p for p in body["items"])


class TestCapturesEndpoint:
    def test_requires_login(self, client):
        assert client.get("/captures").status_code == 401

    def test_returns_full_pokemon_objects_for_captured_names(self, ash):
        ash.post("/captures", json={"name": "Charmander"})
        ash.post("/captures", json={"name": "Squirtle"})

        response = ash.get("/captures")

        assert response.status_code == 200
        body = response.get_json()
        assert [p["name"] for p in body] == ["Charmander", "Squirtle"]
        assert body[0] == {
            "number": 4,
            "name": "Charmander",
            "type_one": "Fire",
            "type_two": "",
            "total": 309,
            "hit_points": 50,
            "attack": 50,
            "defense": 50,
            "special_attack": 50,
            "special_defense": 50,
            "speed": 50,
            "generation": 1,
            "legendary": False,
        }

    def test_sorted_by_number_regardless_of_capture_order(self, ash):
        ash.post("/captures", json={"name": "Squirtle"})
        ash.post("/captures", json={"name": "Bulbasaur"})

        body = ash.get("/captures").get_json()

        assert [p["name"] for p in body] == ["Bulbasaur", "Squirtle"]

    def test_empty_when_nothing_captured(self, ash):
        assert ash.get("/captures").get_json() == []

    def test_only_returns_this_users_captures(self, ash, make_client):
        misty = make_client("misty")
        ash.post("/captures", json={"name": "Squirtle"})
        misty.post("/captures", json={"name": "Bulbasaur"})

        assert [p["name"] for p in ash.get("/captures").get_json()] == ["Squirtle"]
