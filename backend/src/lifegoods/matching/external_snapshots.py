from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Protocol

from lifegoods.matching.external_source import (
    ExternalPackageFound,
    ExternalPackageNotFound,
    ExternalSourceMetadata,
    JsonValue,
)


class ExternalSnapshotOutcome(StrEnum):
    FOUND = "FOUND"
    NOT_FOUND = "NOT_FOUND"


class ExternalEvidenceCategory(StrEnum):
    IDENTITY = "IDENTITY"
    LABEL = "LABEL"
    IMAGE = "IMAGE"


@dataclass(frozen=True, slots=True)
class ExternalFieldEvidence:
    category: ExternalEvidenceCategory
    mapped_field: str
    source_field: str
    value: JsonValue
    language: str | None
    observed_at: datetime | None
    retrieved_at: datetime
    source_uri: str
    attribution: str
    license_name: str


@dataclass(frozen=True, slots=True)
class PersistedExternalSnapshot:
    source_record_id: str
    lookup_identifier: str
    request_url: str
    source_url: str | None
    retrieved_at: datetime
    fresh_until: datetime
    source_revision: str | None
    outcome: ExternalSnapshotOutcome
    raw_response_hash: str
    source: ExternalSourceMetadata
    field_evidence: tuple[ExternalFieldEvidence, ...]

    def is_fresh(self, now: datetime) -> bool:
        return now < self.fresh_until


class ExternalSnapshotRepository(Protocol):
    def find_latest(
        self,
        source: ExternalSourceMetadata,
        lookup_identifier: str,
    ) -> PersistedExternalSnapshot | None: ...

    def save_found(
        self,
        result: ExternalPackageFound,
        *,
        fresh_until: datetime,
    ) -> PersistedExternalSnapshot: ...

    def save_not_found(
        self,
        result: ExternalPackageNotFound,
        *,
        fresh_until: datetime,
    ) -> PersistedExternalSnapshot: ...
