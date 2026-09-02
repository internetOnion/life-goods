from __future__ import annotations

import concurrent.futures
from datetime import UTC, datetime
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from lifegoods.reference_datasets.access import DatabaseAllergenReferenceDataAccess
from lifegoods.reference_datasets.bundle import (
    AllergenRuleDefinition,
    ConditionFamily,
    LexicalMappingDefinition,
    ReferenceBundle,
    ReferenceConceptDefinition,
    ReferenceDatasetManifest,
    ReferenceReviewKind,
    ReferenceSourceDefinition,
    compute_bundle_sha256,
)
from lifegoods.reference_datasets.importer import import_reference_bundle
from lifegoods.reference_datasets.lifecycle import (
    activate_reference_dataset_version,
    get_active_reference_dataset_pointer,
    rollback_reference_dataset_version,
)


def make_bundle(version_id: str, milk_synonym: str) -> ReferenceBundle:
    manifest = ReferenceDatasetManifest(
        id=version_id,
        dataset_kind=ConditionFamily.FOOD_ALLERGEN,
        edition=f"Edition {version_id}",
        jurisdiction="INTERNATIONAL",
        source_url=f"https://fao.org/{version_id}",
        licensing_decision="PUBLIC_GOVERNMENT_STANDARD",
        project_approver="maintainer@lifegoods.org",
        review_kind=ReferenceReviewKind.FOOD_DOMAIN_REVIEW,
        sha256="",
    )
    sources = [
        ReferenceSourceDefinition(
            id=f"source-{version_id}",
            name=f"Standard for {version_id}",
            source_type="INTERNATIONAL_STANDARD",
            source_url=f"https://fao.org/{version_id}",
            jurisdiction="INTERNATIONAL",
            publisher="Codex Commission",
            edition=f"Edition {version_id}",
            licensing_decision="PUBLIC_GOVERNMENT_STANDARD",
            terms_version="2026",
        )
    ]
    concepts = [
        ReferenceConceptDefinition(
            id="concept-food-allergen-milk",
            name="Milk and milk products",
            condition_family=ConditionFamily.FOOD_ALLERGEN,
            parent_id=None,
            is_leaf=True,
            description="Milk and ingredients derived from milk",
        )
    ]
    mappings = [
        LexicalMappingDefinition(
            id=f"map-{version_id}-1",
            concept_id="concept-food-allergen-milk",
            language="en",
            mapped_text=milk_synonym,
            relationship_type="EXACT_NAME",
            notes="Direct milk declaration",
        )
    ]
    rules = [
        AllergenRuleDefinition(
            id=f"rule-{version_id}-1",
            concept_id="concept-food-allergen-milk",
            source_id=f"source-{version_id}",
            rule_kind="MANDATORY_DECLARATION",
            condition_family=ConditionFamily.FOOD_ALLERGEN,
            description=f"Rule for {version_id}",
        )
    ]
    sha256 = compute_bundle_sha256(
        manifest=manifest,
        sources=sources,
        concepts=concepts,
        mappings=mappings,
        rules=rules,
    )
    manifest_with_hash = ReferenceDatasetManifest(
        id=manifest.id,
        dataset_kind=manifest.dataset_kind,
        edition=manifest.edition,
        jurisdiction=manifest.jurisdiction,
        source_url=manifest.source_url,
        licensing_decision=manifest.licensing_decision,
        project_approver=manifest.project_approver,
        review_kind=manifest.review_kind,
        sha256=sha256,
    )
    return ReferenceBundle(
        manifest=manifest_with_hash,
        sources=sources,
        concepts=concepts,
        mappings=mappings,
        rules=rules,
    )


def test_concurrent_readers_and_activations(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "concurrency.db"
    db_url = f"sqlite+pysqlite:///{db_path}?timeout=30"
    monkeypatch.setenv("LIFEGOODS_DATABASE_URL", db_url)
    config = Config("backend/alembic.ini")
    command.upgrade(config, "head")

    engine = create_engine(db_url, connect_args={"timeout": 30})
    factory = sessionmaker(engine, expire_on_commit=False)

    bundles = [
        make_bundle("codex-v1", "milk"),
        make_bundle("codex-v2", "lait"),
        make_bundle("codex-v3", "latte"),
    ]

    with factory() as session:
        for bundle in bundles:
            import_reference_bundle(session, bundle)

    access = DatabaseAllergenReferenceDataAccess(factory)
    valid_version_ids = {b.manifest.id for b in bundles}

    observed_active_versions: list[str] = []
    errors: list[Exception] = []

    def reader_worker() -> None:
        for _ in range(50):
            try:
                active = access.get_active_version()
                if active is not None:
                    assert active.id in valid_version_ids
                    assert active.dataset_kind == "FOOD_ALLERGEN"
                    assert len(active.sha256) == 64
                    observed_active_versions.append(active.id)
            except Exception as e:
                errors.append(e)

    def activator_worker(version_id: str) -> None:
        with factory() as session:
            try:
                activate_reference_dataset_version(session, version_id)
            except Exception as e:
                errors.append(e)

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        futures = [
            executor.submit(reader_worker),
            executor.submit(activator_worker, "codex-v1"),
            executor.submit(reader_worker),
            executor.submit(activator_worker, "codex-v2"),
            executor.submit(reader_worker),
            executor.submit(activator_worker, "codex-v3"),
        ]
        concurrent.futures.wait(futures)

    assert not errors, f"Encountered concurrency errors: {errors}"

    with factory() as session:
        pointer = get_active_reference_dataset_pointer(session, ConditionFamily.FOOD_ALLERGEN)
        assert pointer is not None
        assert pointer.active_version_id in valid_version_ids


def test_reference_data_cache_tracks_activation_and_rollback(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "cache-cutover.db"
    db_url = f"sqlite+pysqlite:///{db_path}"
    monkeypatch.setenv("LIFEGOODS_DATABASE_URL", db_url)
    config = Config("backend/alembic.ini")
    command.upgrade(config, "head")
    engine = create_engine(db_url)
    factory = sessionmaker(engine, expire_on_commit=False)
    first_bundle = make_bundle("codex-v1", "milk")
    second_bundle = make_bundle("codex-v2", "lait")

    with factory() as session:
        import_reference_bundle(session, first_bundle)
        import_reference_bundle(session, second_bundle)
        activate_reference_dataset_version(
            session,
            first_bundle.manifest.id,
            now=lambda: datetime(2026, 8, 29, 8, 0, tzinfo=UTC),
        )

    access = DatabaseAllergenReferenceDataAccess(factory)
    first = access.get_active_data()
    first_again = access.get_active_data()
    assert first is not None
    assert first_again is first
    assert first.mappings[0].mapped_text == "milk"

    with factory() as session:
        activate_reference_dataset_version(
            session,
            second_bundle.manifest.id,
            now=lambda: datetime(2026, 8, 29, 9, 0, tzinfo=UTC),
        )
    second = access.get_active_data()
    assert second is not None
    assert second.version.id == "codex-v2"
    assert second.mappings[0].mapped_text == "lait"

    with factory() as session:
        rollback_reference_dataset_version(
            session,
            approver="operator@lifegoods.org",
            now=lambda: datetime(2026, 8, 29, 10, 0, tzinfo=UTC),
        )
    rolled_back = access.get_active_data()
    assert rolled_back is not None
    assert rolled_back.version.id == "codex-v1"
    assert rolled_back.mappings[0].mapped_text == "milk"
    assert rolled_back is not first
