import hashlib
import json
from datetime import UTC, datetime
from typing import cast
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from lifegoods.adapters.catalog_models import (
    ExternalFieldEvidenceRecord,
    ExternalSnapshotRecord,
    ExternalSourceRecord,
)
from lifegoods.matching.external_snapshots import (
    ExternalEvidenceCategory,
    ExternalFieldEvidence,
    ExternalSnapshotOutcome,
    PersistedExternalSnapshot,
)
from lifegoods.matching.external_source import (
    ExternalPackageFound,
    ExternalPackageNotFound,
    ExternalPackageRecord,
    ExternalSourceMetadata,
    JsonValue,
    SourcedValue,
)


class SqlAlchemyExternalSnapshotRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def find_latest(
        self,
        source: ExternalSourceMetadata,
        lookup_identifier: str,
    ) -> PersistedExternalSnapshot | None:
        statement = (
            select(ExternalSnapshotRecord)
            .join(ExternalSnapshotRecord.source)
            .options(
                selectinload(ExternalSnapshotRecord.field_evidence),
                selectinload(ExternalSnapshotRecord.source),
            )
            .where(
                ExternalSourceRecord.name == source.name,
                ExternalSourceRecord.base_url == source.base_url,
                ExternalSnapshotRecord.lookup_identifier == lookup_identifier,
            )
            .order_by(ExternalSnapshotRecord.retrieved_at.desc())
            .limit(1)
        )
        record = self._session.scalar(statement)
        return _to_domain(record) if record is not None else None

    def save_found(
        self,
        result: ExternalPackageFound,
        *,
        fresh_until: datetime,
    ) -> PersistedExternalSnapshot:
        record = result.record
        return self._save(
            source=record.source,
            source_record_id=record.source_record_id,
            lookup_identifier=record.identifier,
            request_url=record.request_url,
            source_url=record.source_url,
            retrieved_at=record.retrieved_at,
            fresh_until=fresh_until,
            source_revision=record.source_revision,
            outcome=ExternalSnapshotOutcome.FOUND,
            raw_response=record.raw_response,
            field_evidence=_field_evidence(record),
        )

    def save_not_found(
        self,
        result: ExternalPackageNotFound,
        *,
        fresh_until: datetime,
    ) -> PersistedExternalSnapshot:
        return self._save(
            source=result.source,
            source_record_id=result.identifier,
            lookup_identifier=result.identifier,
            request_url=result.request_url,
            source_url=None,
            retrieved_at=result.retrieved_at,
            fresh_until=fresh_until,
            source_revision=None,
            outcome=ExternalSnapshotOutcome.NOT_FOUND,
            raw_response=result.raw_response,
            field_evidence=(),
        )

    def _save(
        self,
        *,
        source: ExternalSourceMetadata,
        source_record_id: str,
        lookup_identifier: str,
        request_url: str,
        source_url: str | None,
        retrieved_at: datetime,
        fresh_until: datetime,
        source_revision: str | None,
        outcome: ExternalSnapshotOutcome,
        raw_response: bytes,
        field_evidence: tuple[ExternalFieldEvidence, ...],
    ) -> PersistedExternalSnapshot:
        source_record = self._source_record(source)
        snapshot = ExternalSnapshotRecord(
            id=uuid4().hex,
            source=source_record,
            source_record_id=source_record_id,
            lookup_identifier=lookup_identifier,
            request_url=request_url,
            source_url=source_url,
            retrieved_at=retrieved_at,
            fresh_until=fresh_until,
            source_revision=source_revision,
            outcome=outcome,
            raw_response=_raw_json(raw_response),
            raw_response_hash=hashlib.sha256(raw_response).hexdigest(),
            field_evidence=[
                ExternalFieldEvidenceRecord(
                    id=uuid4().hex,
                    category=evidence.category,
                    mapped_field=evidence.mapped_field,
                    source_field=evidence.source_field,
                    value_json=evidence.value,
                    language=evidence.language,
                    observed_at=evidence.observed_at,
                    retrieved_at=evidence.retrieved_at,
                    source_uri=evidence.source_uri,
                    attribution=evidence.attribution,
                    license_name=evidence.license_name,
                )
                for evidence in field_evidence
            ],
        )
        self._session.add(snapshot)
        try:
            self._session.commit()
        except IntegrityError:
            self._session.rollback()
            existing = self.find_latest(source, lookup_identifier)
            if existing is not None and existing.retrieved_at == retrieved_at:
                return existing
            raise
        return _to_domain(snapshot)

    def _source_record(self, source: ExternalSourceMetadata) -> ExternalSourceRecord:
        source_id = hashlib.sha256(
            f"{source.name}\0{source.base_url}".encode()
        ).hexdigest()[:32]
        record = self._session.get(ExternalSourceRecord, source_id)
        if record is not None:
            return record
        record = ExternalSourceRecord(
            id=source_id,
            name=source.name,
            source_type=source.source_type,
            base_url=source.base_url,
            attribution=source.attribution,
            database_license=source.database_license,
            contents_license=source.contents_license,
            image_license=source.image_license,
            terms_version=source.terms_version,
        )
        try:
            with self._session.begin_nested():
                self._session.add(record)
                self._session.flush()
        except IntegrityError:
            record = self._session.scalar(
                select(ExternalSourceRecord).where(
                    ExternalSourceRecord.name == source.name,
                    ExternalSourceRecord.base_url == source.base_url,
                )
            )
            if record is None:
                raise
        return record


def _raw_json(raw_response: bytes) -> dict[str, object]:
    payload = json.loads(raw_response)
    if not isinstance(payload, dict):
        raise ValueError("An auditable external response must be a JSON object")
    return cast(dict[str, object], payload)


def _field_evidence(record: ExternalPackageRecord) -> tuple[ExternalFieldEvidence, ...]:
    evidence = [
        _sourced_value(
            record,
            ExternalEvidenceCategory.IDENTITY,
            "identifier",
            SourcedValue(value=record.identifier, source_field="code"),
        )
    ]
    evidence.extend(
        _sourced_values(record, ExternalEvidenceCategory.IDENTITY, "name", record.names)
    )
    for mapped_field, value in (
        ("brands", record.brands),
        ("quantity", record.quantity),
    ):
        if value is not None:
            evidence.append(
                _sourced_value(record, ExternalEvidenceCategory.IDENTITY, mapped_field, value)
            )
    evidence.extend(
        _sourced_values(
            record,
            ExternalEvidenceCategory.LABEL,
            "ingredient_text",
            record.ingredient_texts,
        )
    )
    for mapped_field, value in (
        ("allergen_declaration", record.allergen_declaration),
        ("allergen_tags", record.allergen_tags),
        ("trace_declaration", record.trace_declaration),
        ("trace_tags", record.trace_tags),
        ("additive_tags", record.additives),
        ("manufacturing_places", record.manufacturing_places),
        ("halal_label_claim", record.halal_label_claim),
        ("packaging_languages", record.packaging_languages),
        ("countries_sold", record.countries_sold),
    ):
        if value is not None:
            evidence.append(
                _sourced_value(record, ExternalEvidenceCategory.LABEL, mapped_field, value)
            )
    evidence.extend(
        _sourced_values(
            record,
            ExternalEvidenceCategory.LABEL,
            "storage_instructions",
            record.storage_conditions,
        )
    )
    evidence.extend(
        _sourced_values(
            record,
            ExternalEvidenceCategory.LABEL,
            "nutrition",
            record.nutrition,
        )
    )
    if record.source.attribution and record.source.image_license:
        for image in record.selected_images:
            evidence.append(
                ExternalFieldEvidence(
                    category=ExternalEvidenceCategory.IMAGE,
                    mapped_field="reference_image",
                    source_field=image.source_field,
                    value={"role": image.role, "url": image.url},
                    language=image.language,
                    observed_at=None,
                    retrieved_at=record.retrieved_at,
                    source_uri=record.source_url,
                    attribution=record.source.attribution,
                    license_name=record.source.image_license,
                )
            )
    return tuple(evidence)


def _sourced_values(
    record: ExternalPackageRecord,
    category: ExternalEvidenceCategory,
    mapped_field: str,
    values: tuple[SourcedValue[object], ...],
) -> list[ExternalFieldEvidence]:
    return [_sourced_value(record, category, mapped_field, value) for value in values]


def _sourced_value(
    record: ExternalPackageRecord,
    category: ExternalEvidenceCategory,
    mapped_field: str,
    sourced: SourcedValue[object],
) -> ExternalFieldEvidence:
    return ExternalFieldEvidence(
        category=category,
        mapped_field=mapped_field,
        source_field=sourced.source_field,
        value=_json_value(sourced.value),
        language=sourced.language,
        observed_at=None,
        retrieved_at=record.retrieved_at,
        source_uri=record.source_url,
        attribution=record.source.attribution,
        license_name=record.source.contents_license,
    )


def _json_value(value: object) -> JsonValue:
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, tuple | list):
        return [_json_value(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _json_value(item) for key, item in value.items()}
    raise TypeError(f"Unsupported external evidence value: {type(value).__name__}")


def _to_domain(record: ExternalSnapshotRecord) -> PersistedExternalSnapshot:
    source = record.source
    return PersistedExternalSnapshot(
        source_record_id=record.source_record_id,
        lookup_identifier=record.lookup_identifier,
        request_url=record.request_url,
        source_url=record.source_url,
        retrieved_at=_utc(record.retrieved_at),
        fresh_until=_utc(record.fresh_until),
        source_revision=record.source_revision,
        outcome=ExternalSnapshotOutcome(record.outcome),
        raw_response_hash=record.raw_response_hash,
        source=ExternalSourceMetadata(
            name=source.name,
            source_type=source.source_type,
            base_url=source.base_url,
            attribution=source.attribution,
            database_license=source.database_license,
            contents_license=source.contents_license,
            image_license=source.image_license,
            terms_version=source.terms_version,
        ),
        field_evidence=tuple(
            ExternalFieldEvidence(
                category=ExternalEvidenceCategory(item.category),
                mapped_field=item.mapped_field,
                source_field=item.source_field,
                value=cast(JsonValue, item.value_json),
                language=item.language,
                observed_at=_utc(item.observed_at) if item.observed_at is not None else None,
                retrieved_at=_utc(item.retrieved_at),
                source_uri=item.source_uri,
                attribution=item.attribution,
                license_name=item.license_name,
            )
            for item in sorted(
                record.field_evidence,
                key=lambda value: (
                    value.category,
                    value.mapped_field,
                    value.source_field,
                    value.language or "",
                ),
            )
        ),
    )


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
