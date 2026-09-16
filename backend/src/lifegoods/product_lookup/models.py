from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from lifegoods.core.types import JsonValue
from lifegoods.identifiers import NormalizedIdentifier


class DatasetUnavailableError(RuntimeError):
    pass


class InvalidSourceRecordError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class DatasetSnapshot:
    version: str
    retrieved_at: datetime
    collection_name: str


type SourceRecord = dict[str, JsonValue]


class RawProductLookupSource(Protocol):
    def resolve_product_lookup_snapshot(self) -> DatasetSnapshot: ...

    def fetch_source_record(
        self,
        identifier: NormalizedIdentifier,
        snapshot: DatasetSnapshot,
    ) -> SourceRecord | None: ...
