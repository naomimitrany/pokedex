import secrets
import threading
from collections import defaultdict


class Accounts:
    def __init__(self):
        self._lock = threading.Lock()
        self._sessions = {}
        self._captures = defaultdict(set)

    def login(self, username):
        with self._lock:
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
            self._captures[username].add(name)

    def release(self, username, name):
        with self._lock:
            self._captures[username].discard(name)

    def captured_names(self, username):
        if username is None:
            return frozenset()
        with self._lock:
            return frozenset(self._captures.get(username, ()))
