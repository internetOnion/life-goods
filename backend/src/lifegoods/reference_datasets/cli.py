from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from lifegoods.core.settings import Settings
from lifegoods.reference_datasets.bundle import load_reference_bundle
from lifegoods.reference_datasets.importer import (
    ReferenceDatasetError,
    ReferenceDatasetValidationError,
    import_reference_bundle,
)
from lifegoods.reference_datasets.kind_adapters import (
    get_reference_dataset_kind_adapter,
)
from lifegoods.reference_datasets.lifecycle import (
    activate_reference_dataset_version,
    get_active_reference_dataset_pointer,
    rollback_reference_dataset_version,
)
from lifegoods.reference_datasets.models import ReferenceDatasetVersionRecord
from lifegoods.reference_datasets.validation import validate_bundle


def _json_default(value: object) -> str:
    if isinstance(value, datetime):
        return value.astimezone(UTC).isoformat()
    raise TypeError(f"Cannot serialize {type(value).__name__}")


def _source_output(source: Any) -> dict[str, Any]:
    return {
        "id": source.id,
        "name": source.name,
        "source_type": source.source_type,
        "source_url": source.source_url,
        "jurisdiction": source.jurisdiction,
        "publisher": source.publisher,
        "edition": source.edition,
        "licensing_decision": source.licensing_decision,
        "terms_version": source.terms_version,
    }


def validate_file(bundle_path: str | Path) -> dict[str, Any]:
    bundle = load_reference_bundle(bundle_path)
    report = validate_bundle(bundle)
    if not report.is_valid:
        raise ReferenceDatasetValidationError("; ".join(report.errors))
    adapter = get_reference_dataset_kind_adapter(bundle.manifest.dataset_kind)
    return {
        "status": "VALID",
        "id": bundle.manifest.id,
        "dataset_kind": bundle.manifest.dataset_kind,
        "edition": bundle.manifest.edition,
        "jurisdiction": bundle.manifest.jurisdiction,
        "licensing_decision": bundle.manifest.licensing_decision,
        "review_kind": bundle.manifest.review_kind,
        "project_approver": bundle.manifest.project_approver,
        "sha256": report.sha256,
        "source_count": len(bundle.sources),
        "sources": [_source_output(source) for source in bundle.sources],
        **adapter.bundle_counts(bundle),
    }


def import_file(session: Session, bundle_path: str | Path) -> dict[str, Any]:
    bundle = load_reference_bundle(bundle_path)
    record = import_reference_bundle(session, bundle)
    adapter = get_reference_dataset_kind_adapter(record.dataset_kind)
    return {
        "status": record.status,
        "id": record.id,
        "dataset_kind": record.dataset_kind,
        "edition": record.edition,
        "jurisdiction": record.jurisdiction,
        "source_url": record.source_url,
        "licensing_decision": record.licensing_decision,
        "sha256": record.sha256,
        "review_kind": record.review_kind,
        "project_approver": record.project_approver,
        "retrieved_at": record.retrieved_at,
        "reviewed_at": record.reviewed_at,
        "activated_at": record.activated_at,
        "immutable": record.immutable,
        **adapter.version_counts(record),
    }


def _format_version_output(
    record: ReferenceDatasetVersionRecord,
    pointer: Any | None = None,
) -> dict[str, Any]:
    adapter = get_reference_dataset_kind_adapter(record.dataset_kind)
    return {
        "status": record.status,
        "id": record.id,
        "dataset_kind": record.dataset_kind,
        "edition": record.edition,
        "jurisdiction": record.jurisdiction,
        "source_url": record.source_url,
        "licensing_decision": record.licensing_decision,
        "sha256": record.sha256,
        "review_kind": record.review_kind,
        "project_approver": record.project_approver,
        "retrieved_at": record.retrieved_at,
        "reviewed_at": record.reviewed_at,
        "activated_at": record.activated_at,
        "active_version_id": pointer.active_version_id if pointer else None,
        "previous_version_id": pointer.previous_version_id if pointer else None,
        "activated_by": pointer.activated_by if pointer else None,
        "activation_review_kind": pointer.review_kind if pointer else None,
        "immutable": record.immutable,
        **adapter.version_counts(record),
    }


def activate_version(
    session: Session,
    version_id: str,
    *,
    approver: str | None = None,
    review_kind: str | None = None,
) -> dict[str, Any]:
    if review_kind != "PROJECT_MAINTAINER_APPROVAL":
        raise ValueError("Activation requires PROJECT_MAINTAINER_APPROVAL")
    record = activate_reference_dataset_version(
        session,
        version_id,
        approver=approver,
        review_kind=review_kind,
    )
    pointer = get_active_reference_dataset_pointer(session, record.dataset_kind)
    return _format_version_output(record, pointer)


def rollback_version(
    session: Session,
    *,
    dataset_kind: str = "FOOD_ALLERGEN",
    approver: str | None = None,
    review_kind: str | None = None,
) -> dict[str, Any]:
    record = rollback_reference_dataset_version(
        session,
        dataset_kind=dataset_kind,
        approver=approver,
        review_kind=review_kind,
    )
    pointer = get_active_reference_dataset_pointer(session, record.dataset_kind)
    return _format_version_output(record, pointer)


def status_version(
    session: Session,
    *,
    dataset_kind: str = "FOOD_ALLERGEN",
) -> dict[str, Any] | None:
    pointer = get_active_reference_dataset_pointer(session, dataset_kind)
    if pointer is None:
        return None
    if pointer.active_version_id is None:
        return {
            "dataset_kind": pointer.dataset_kind,
            "active_version_id": None,
            "previous_version_id": pointer.previous_version_id,
            "activated_at": pointer.activated_at,
            "activated_by": pointer.activated_by,
            "review_kind": pointer.review_kind,
            "activation_review_kind": pointer.review_kind,
            "release_review_kind": None,
            "release_project_approver": None,
            "status": "INACTIVE",
            "sha256": None,
        }
    record = (
        session.query(ReferenceDatasetVersionRecord).filter_by(id=pointer.active_version_id).first()
    )
    if record is None:
        return None
    return {
        "dataset_kind": pointer.dataset_kind,
        "active_version_id": pointer.active_version_id,
        "previous_version_id": pointer.previous_version_id,
        "activated_at": pointer.activated_at,
        "activated_by": pointer.activated_by,
        "review_kind": pointer.review_kind,
        "activation_review_kind": pointer.review_kind,
        "release_review_kind": record.review_kind,
        "release_project_approver": record.project_approver,
        "status": record.status,
        "sha256": record.sha256,
    }


def list_versions(session: Session) -> list[dict[str, Any]]:
    records = (
        session.query(ReferenceDatasetVersionRecord)
        .order_by(ReferenceDatasetVersionRecord.retrieved_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "dataset_kind": r.dataset_kind,
            "edition": r.edition,
            "jurisdiction": r.jurisdiction,
            "status": r.status,
            "sha256": r.sha256,
            "review_kind": r.review_kind,
            "project_approver": r.project_approver,
            "retrieved_at": r.retrieved_at,
            "activated_at": r.activated_at,
            "immutable": r.immutable,
        }
        for r in records
    ]


def inspect_version(session: Session, version_id: str) -> dict[str, Any]:
    record = session.query(ReferenceDatasetVersionRecord).filter_by(id=version_id).first()
    if record is None:
        raise ValueError(f"Reference dataset version '{version_id}' does not exist")
    adapter = get_reference_dataset_kind_adapter(record.dataset_kind)
    return {
        "id": record.id,
        "dataset_kind": record.dataset_kind,
        "edition": record.edition,
        "jurisdiction": record.jurisdiction,
        "source_url": record.source_url,
        "licensing_decision": record.licensing_decision,
        "sha256": record.sha256,
        "status": record.status,
        "review_kind": record.review_kind,
        "project_approver": record.project_approver,
        "retrieved_at": record.retrieved_at,
        "activated_at": record.activated_at,
        "immutable": record.immutable,
        "validation_errors": record.validation_errors,
        "validation_history": record.validation_history,
        "sources": [_source_output(source) for source in record.sources],
        **adapter.inspect_records(record),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Manage reference dataset versions, concepts, and mappings"
    )
    parser.add_argument(
        "--database-url",
        default=os.getenv("LIFEGOODS_DATABASE_URL"),
        help="PostgreSQL database URL (defaults to LIFEGOODS_DATABASE_URL or settings)",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    validate_parser = subparsers.add_parser("validate", help="Validate a reference dataset bundle")
    validate_parser.add_argument("bundle_path", help="Path to JSON bundle file")

    import_parser = subparsers.add_parser(
        "import", help="Validate and import a reference dataset bundle"
    )
    import_parser.add_argument("bundle_path", help="Path to JSON bundle file")

    activate_parser = subparsers.add_parser(
        "activate", help="Activate an imported reference dataset version"
    )
    activate_parser.add_argument("version_id", help="Reference dataset version ID")
    activate_parser.add_argument(
        "--approver",
        required=True,
        help="Recorded project maintainer approver",
    )
    activate_parser.add_argument(
        "--review-kind",
        required=True,
        help="Operational review kind (PROJECT_MAINTAINER_APPROVAL)",
    )

    rollback_parser = subparsers.add_parser(
        "rollback", help="Roll back to immediately previous valid reference dataset version"
    )
    rollback_parser.add_argument(
        "--dataset-kind",
        default="FOOD_ALLERGEN",
        help="Dataset kind (default: FOOD_ALLERGEN)",
    )
    rollback_parser.add_argument(
        "--approver",
        required=True,
        help="Recorded operator requesting rollback",
    )
    rollback_parser.add_argument(
        "--review-kind",
        required=True,
        help="Rollback approval kind (PROJECT_MAINTAINER_APPROVAL)",
    )

    status_parser = subparsers.add_parser(
        "status", help="Show active reference dataset pointer status"
    )
    status_parser.add_argument(
        "--dataset-kind",
        default="FOOD_ALLERGEN",
        help="Dataset kind (default: FOOD_ALLERGEN)",
    )

    subparsers.add_parser("list", help="List all imported reference dataset versions")

    inspect_parser = subparsers.add_parser(
        "inspect", help="Inspect an imported reference dataset version"
    )
    inspect_parser.add_argument("version_id", help="Reference dataset version ID")

    args = parser.parse_args(argv)

    try:
        if args.command == "validate":
            result = validate_file(args.bundle_path)
            print(json.dumps(result, default=_json_default, indent=2))
            return 0

        database_url = args.database_url or Settings().database_url
        engine = create_engine(database_url)
        factory = sessionmaker(engine, expire_on_commit=False)

        with factory() as session:
            if args.command == "import":
                output: object = import_file(session, args.bundle_path)
            elif args.command == "activate":
                output = activate_version(
                    session,
                    args.version_id,
                    approver=args.approver,
                    review_kind=args.review_kind,
                )
            elif args.command == "rollback":
                output = rollback_version(
                    session,
                    dataset_kind=args.dataset_kind,
                    approver=args.approver,
                    review_kind=args.review_kind,
                )
            elif args.command == "status":
                output = status_version(
                    session,
                    dataset_kind=args.dataset_kind,
                )
            elif args.command == "list":
                output = list_versions(session)
            elif args.command == "inspect":
                output = inspect_version(session, args.version_id)
            else:
                parser.print_help()
                return 1

            print(json.dumps(output, default=_json_default, indent=2))
            return 0
    except (ReferenceDatasetError, ValueError, FileNotFoundError, json.JSONDecodeError) as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
