"""In-memory identities, sessions and captures, all lost on restart.

Logging in claims a username outright, with no password: nothing here survives a
restart, so credentials would be ceremony. What is enforced is that a caller
cannot act as someone else -- routes resolve identity from the session cookie.
"""

import secrets
import threading


class Accounts:
    def __init__(self):
        self._lock = threading.Lock()
        self._sessions = {}
        self._captures = {}

    def login(self, username):
        with self._lock:
            self._captures.setdefault(username, set())
            session_id = secrets.token_urlsafe(32)
            self._sessions[session_id] = username
            return session_id

    def logout(self, session_id):
        with self._lock:
            self._sessions.pop(session_id, None)

    def username_for(self, session_id):
        if not session_id:
            return None
        with self._lock:
            return self._sessions.get(session_id)

    def capture(self, username, name):
        with self._lock:
            self._captures.setdefault(username, set()).add(name)

    def release(self, username, name):
        with self._lock:
            self._captures.setdefault(username, set()).discard(name)

    def captured_names(self, username):
        if username is None:
            return frozenset()
        with self._lock:
            return frozenset(self._captures.get(username, ()))
