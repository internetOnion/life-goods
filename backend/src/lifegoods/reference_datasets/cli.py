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
from lifegoods.reference_datasets.bundle import ReferenceBundle
from lifegoods.reference_datasets.importer import (
    ReferenceDatasetError,
    ReferenceDatasetValidationError,
    import_reference_bundle,
)
from lifegoods.reference_datasets.models import ReferenceDatasetVersionRecord
from lifegoods.reference_datasets.validation import validate_bundle


def _json_default(value: object) -> str:
    if isinstance(value, datetime):
        return value.astimezone(UTC).isoformat()
    raise TypeError(f"Cannot serialize {type(value).__name__}")


def validate_file(bundle_path: str | Path) -> dict[str, Any]:
    bundle = ReferenceBundle.from_json_file(bundle_path)
    report = validate_bundle(bundle)
    if not report.is_valid:
        raise ReferenceDatasetValidationError("; ".join(report.errors))
    return {
        "status": "VALID",
        "id": bundle.manifest.id,
        "dataset_kind": bundle.manifest.dataset_kind,
        "edition": bundle.manifest.edition,
        "jurisdiction": bundle.manifest.jurisdiction,
        "sha256": report.sha256,
        "source_count": len(bundle.sources),
        "concept_count": len(bundle.concepts),
        "mapping_count": len(bundle.mappings),
        "rule_count": len(bundle.rules),
    }


def import_file(session: Session, bundle_path: str | Path) -> dict[str, Any]:
    bundle = ReferenceBundle.from_json_file(bundle_path)
    record = import_reference_bundle(session, bundle)
    return {
        "status": record.status,
        "id": record.id,
        "dataset_kind": record.dataset_kind,
        "edition": record.edition,
        "jurisdiction": record.jurisdiction,
        "source_url": record.source_url,
        "sha256": record.sha256,
        "review_kind": record.review_kind,
        "project_approver": record.project_approver,
        "retrieved_at": record.retrieved_at,
        "reviewed_at": record.reviewed_at,
        "activated_at": record.activated_at,
        "immutable": record.immutable,
        "concept_count": len(record.concepts),
        "mapping_count": len(record.mappings),
        "rule_count": len(record.rules),
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
    record = (
        session.query(ReferenceDatasetVersionRecord)
        .filter_by(id=version_id)
        .first()
    )
    if record is None:
        raise ValueError(f"Reference dataset version '{version_id}' does not exist")
    return {
        "id": record.id,
        "dataset_kind": record.dataset_kind,
        "edition": record.edition,
        "jurisdiction": record.jurisdiction,
        "source_url": record.source_url,
        "sha256": record.sha256,
        "status": record.status,
        "review_kind": record.review_kind,
        "project_approver": record.project_approver,
        "retrieved_at": record.retrieved_at,
        "activated_at": record.activated_at,
        "immutable": record.immutable,
        "validation_errors": record.validation_errors,
        "validation_history": record.validation_history,
        "concepts": [
            {
                "id": c.id,
                "name": c.name,
                "condition_family": c.condition_family,
                "parent_id": c.parent_id,
                "is_leaf": c.is_leaf,
                "description": c.description,
            }
            for c in record.concepts
        ],
        "mappings": [
            {
                "id": m.id,
                "concept_id": m.concept_id,
                "language": m.language,
                "mapped_text": m.mapped_text,
                "relationship_type": m.relationship_type,
                "notes": m.notes,
            }
            for m in record.mappings
        ],
        "rules": [
            {
                "id": r.id,
                "concept_id": r.concept_id,
                "source_id": r.source_id,
                "rule_kind": r.rule_kind,
                "condition_family": r.condition_family,
                "description": r.description,
            }
            for r in record.rules
        ],
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

    validate_parser = subparsers.add_parser(
        "validate", help="Validate a reference dataset bundle"
    )
    validate_parser.add_argument("bundle_path", help="Path to JSON bundle file")

    import_parser = subparsers.add_parser(
        "import", help="Validate and import a reference dataset bundle"
    )
    import_parser.add_argument("bundle_path", help="Path to JSON bundle file")

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
