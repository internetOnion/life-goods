from dataclasses import dataclass
from typing import Protocol


class ExternalImageUrlInvalidError(ValueError):
    pass


class ExternalImageUnavailableError(RuntimeError):
    pass


class ExternalImageNotFoundError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class ExternalImage:
    content: bytes
    media_type: str


class ExternalImageSource(Protocol):
    def fetch(self, url: str) -> ExternalImage: ...
