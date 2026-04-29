class DomainError(Exception):
    pass


class NotFoundError(DomainError):
    def __init__(self, resource: str, identifier: str | int):
        self.resource = resource
        self.identifier = identifier
        super().__init__(f"{resource} '{identifier}' not found")


class ForbiddenError(DomainError):
    def __init__(self, message: str = "Access denied"):
        super().__init__(message)


class ValidationError(DomainError):
    def __init__(self, message: str):
        super().__init__(message)


class ConflictError(DomainError):
    def __init__(self, message: str):
        super().__init__(message)


class UnauthorizedError(DomainError):
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(message)
