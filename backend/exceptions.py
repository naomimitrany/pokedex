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
