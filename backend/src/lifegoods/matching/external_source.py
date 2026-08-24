from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Literal, Protocol

from lifegoods.matching.identifier import NormalizedIdentifier

type JsonValue = None | bool | int | float | str | list[JsonValue] | dict[str, JsonValue]

@dataclass(frozen=True, slots=True)
class SourcedValue[T]:
    value: T
    source_field: str
    language: str | None = None


@dataclass(frozen=True, slots=True)
class ExternalSelectedImage:
    role: str
    url: str
    source_field: str
    language: str | None = None


@dataclass(frozen=True, slots=True)
class ExternalSourceMetadata:
    name: str
    source_type: str
    base_url: str
    attribution: str
    database_license: str
    contents_license: str
    image_license: str
    terms_version: str | None = None


@dataclass(frozen=True, slots=True)
class ExternalPackageRecord:
    identifier: str
    source_record_id: str
    request_url: str
    source_url: str
    retrieved_at: datetime
    source_revision: str | None
    raw_response: bytes
    source: ExternalSourceMetadata
    names: tuple[SourcedValue[str], ...]
    brands: SourcedValue[tuple[str, ...]] | None
    quantity: SourcedValue[str] | None
    selected_images: tuple[ExternalSelectedImage, ...]
    ingredient_texts: tuple[SourcedValue[str], ...]
    allergen_declaration: SourcedValue[str] | None
    allergen_tags: SourcedValue[tuple[str, ...]] | None
    trace_declaration: SourcedValue[str] | None
    trace_tags: SourcedValue[tuple[str, ...]] | None
    nutrition: tuple[SourcedValue[JsonValue], ...]
    packaging_languages: SourcedValue[tuple[str, ...]] | None
    countries_sold: SourcedValue[tuple[str, ...]] | None


@dataclass(frozen=True, slots=True)
class ExternalPackageFound:
    record: ExternalPackageRecord
    kind: Literal["FOUND"] = field(init=False, default="FOUND")


@dataclass(frozen=True, slots=True)
class ExternalPackageNotFound:
    identifier: str
    request_url: str
    retrieved_at: datetime
    raw_response: bytes
    source: ExternalSourceMetadata
    kind: Literal["NOT_FOUND"] = field(init=False, default="NOT_FOUND")


class ExternalSourceUnavailableReason(StrEnum):
    TIMEOUT = "TIMEOUT"
    NETWORK = "NETWORK"
    RATE_LIMITED = "RATE_LIMITED"
    UPSTREAM_ERROR = "UPSTREAM_ERROR"
    UNEXPECTED_STATUS = "UNEXPECTED_STATUS"
    INVALID_RESPONSE = "INVALID_RESPONSE"


@dataclass(frozen=True, slots=True)
class ExternalPackageUnavailable:
    identifier: str
    reason: ExternalSourceUnavailableReason
    status_code: int | None = None
    kind: Literal["UNAVAILABLE"] = field(init=False, default="UNAVAILABLE")


type ExternalLookupResult = (
    ExternalPackageFound | ExternalPackageNotFound | ExternalPackageUnavailable
)


class ExternalPackageSource(Protocol):
    def lookup(self, identifier: NormalizedIdentifier) -> ExternalLookupResult: ...
