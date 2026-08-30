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
    ReferenceSourceRecord,
)
from lifegoods.reference_datasets.validation import validate_bundle


class ReferenceDatasetError(Exception):
    pass


class ReferenceDatasetValidationError(ReferenceDatasetError):
    pass


class ReferenceDatasetConflictError(ReferenceDatasetError):
    pass


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
    if existing is not None:
        if existing.sha256 == report.sha256:
            return existing
        raise ReferenceDatasetConflictError(
            f"Bundle with version ID '{bundle.manifest.id}' conflicts with existing "
            f"imported version (SHA-256 mismatch: existing '{existing.sha256}' "
            f"vs bundle '{report.sha256}')"
        )

    # 1. Upsert / insert reference sources
    for src in bundle.sources:
        existing_source = session.query(ReferenceSourceRecord).filter_by(id=src.id).first()
        if existing_source is None:
            source_record = ReferenceSourceRecord(
                id=src.id,
                name=src.name,
                source_type=src.source_type,
                source_url=src.source_url,
                jurisdiction=src.jurisdiction,
                publisher=src.publisher,
                edition=src.edition,
                licensing_decision=src.licensing_decision,
                terms_version=src.terms_version,
                created_at=utc_now,
            )
            session.add(source_record)
        else:
            if (
                existing_source.name != src.name
                or existing_source.source_url != src.source_url
                or existing_source.jurisdiction != src.jurisdiction
                or existing_source.licensing_decision != src.licensing_decision
            ):
                raise ReferenceDatasetConflictError(
                    f"Reference source '{src.id}' conflicts with existing source definition "
                    f"in database."
                )

    # Flush sources before rules reference them
    session.flush()

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

    adapter = get_reference_dataset_kind_adapter(bundle.manifest.dataset_kind)
    adapter.persist_records(session, version_record, bundle)

    session.commit()
    session.refresh(version_record)
    return version_record
