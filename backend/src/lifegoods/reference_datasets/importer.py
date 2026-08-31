from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from lifegoods.reference_datasets.bundle import ReferenceDatasetBundle
from lifegoods.reference_datasets.kind_adapters import (
    get_reference_dataset_kind_adapter,
)
from lifegoods.reference_datasets.models import (
    ReferenceDatasetVersionRecord,
    ReferenceDatasetVersionSourceRecord,
    ReferenceSourceRecord,
)
from lifegoods.reference_datasets.validation import validate_bundle


class ReferenceDatasetError(Exception):
    pass


class ReferenceDatasetValidationError(ReferenceDatasetError):
    pass


class ReferenceDatasetConflictError(ReferenceDatasetError):
    pass


def _persist_sources(
    session: Session,
    bundle: ReferenceDatasetBundle,
    *,
    created_at: datetime,
) -> None:
    for source in bundle.sources:
        existing = session.query(ReferenceSourceRecord).filter_by(id=source.id).first()
        if existing is None:
            session.add(
                ReferenceSourceRecord(
                    id=source.id,
                    name=source.name,
                    source_type=source.source_type,
                    source_url=source.source_url,
                    jurisdiction=source.jurisdiction,
                    publisher=source.publisher,
                    edition=source.edition,
                    licensing_decision=source.licensing_decision,
                    terms_version=source.terms_version,
                    created_at=created_at,
                )
            )
            continue

        expected = (
            source.name,
            source.source_type,
            source.source_url,
            source.jurisdiction,
            source.publisher,
            source.edition,
            source.licensing_decision,
            source.terms_version,
        )
        actual = (
            existing.name,
            existing.source_type,
            existing.source_url,
            existing.jurisdiction,
            existing.publisher,
            existing.edition,
            existing.licensing_decision,
            existing.terms_version,
        )
        if actual != expected:
            raise ReferenceDatasetConflictError(
                f"Reference source '{source.id}' conflicts with existing source definition "
                "in database."
            )


def _associate_version_sources(
    session: Session,
    version_id: str,
    bundle: ReferenceDatasetBundle,
) -> None:
    existing_source_ids = {
        source_id
        for (source_id,) in (
            session.query(ReferenceDatasetVersionSourceRecord.source_id)
            .filter_by(dataset_version_id=version_id)
            .all()
        )
    }
    for source in bundle.sources:
        if source.id not in existing_source_ids:
            session.add(
                ReferenceDatasetVersionSourceRecord(
                    dataset_version_id=version_id,
                    source_id=source.id,
                )
            )


def import_reference_bundle(
    session: Session,
    bundle: ReferenceDatasetBundle,
    *,
    now: Callable[[], datetime] | None = None,
) -> ReferenceDatasetVersionRecord:
    report = validate_bundle(bundle)
    if not report.is_valid:
        raise ReferenceDatasetValidationError("; ".join(report.errors))

    utc_now = (now or (lambda: datetime.now(UTC)))()

    existing = session.query(ReferenceDatasetVersionRecord).filter_by(id=bundle.manifest.id).first()
    if existing is not None and existing.sha256 != report.sha256:
        raise ReferenceDatasetConflictError(
            f"Bundle with version ID '{bundle.manifest.id}' conflicts with existing "
            f"imported version (SHA-256 mismatch: existing '{existing.sha256}' "
            f"vs bundle '{report.sha256}')"
        )

    # 1. Upsert / insert reference sources for both new and idempotent imports.
    _persist_sources(session, bundle, created_at=utc_now)

    # Flush sources before rules reference them
    session.flush()

    if existing is not None:
        _associate_version_sources(session, existing.id, bundle)
        session.commit()
        session.refresh(existing)
        return existing

    # 2. Create version record
    version_record = ReferenceDatasetVersionRecord(
        id=bundle.manifest.id,
        dataset_kind=bundle.manifest.dataset_kind,
        edition=bundle.manifest.edition,
        jurisdiction=bundle.manifest.jurisdiction,
        source_url=bundle.manifest.source_url,
        licensing_decision=bundle.manifest.licensing_decision,
        sha256=report.sha256,
        retrieved_at=utc_now,
        status="READY",
        review_kind=bundle.manifest.review_kind,
        project_approver=bundle.manifest.project_approver,
        reviewed_at=utc_now if bundle.manifest.project_approver else None,
        activated_at=None,
        immutable=True,
        validation_errors=[],
        validation_history=[
            {
                "validated_at": utc_now.isoformat(),
                "errors": [],
            }
        ],
    )
    session.add(version_record)
    session.flush()
    _associate_version_sources(session, version_record.id, bundle)

    adapter = get_reference_dataset_kind_adapter(bundle.manifest.dataset_kind)
    adapter.persist_records(session, version_record, bundle)

    session.commit()
    session.refresh(version_record)
    return version_record
