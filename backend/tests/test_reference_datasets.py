from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

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
from lifegoods.reference_datasets.importer import (
    ReferenceDatasetConflictError,
    ReferenceDatasetValidationError,
    import_reference_bundle,
)
from lifegoods.reference_datasets.models import (
    AllergenRuleRecord,
    LexicalMappingRecord,
    ReferenceConceptRecord,
    ReferenceDatasetVersionRecord,
    ReferenceSourceRecord,
)
from lifegoods.reference_datasets.validation import validate_bundle


def sample_manifest(*, sha256: str = "") -> ReferenceDatasetManifest:
    return ReferenceDatasetManifest(
        id="codex-food-allergen-2026-minimal",
        dataset_kind=ConditionFamily.FOOD_ALLERGEN,
        edition="CXS 1-1985 (Amended 2026)",
        jurisdiction="INTERNATIONAL",
        source_url="https://www.fao.org/fao-who-codexalimentarius/standards/cxs1-1985",
        licensing_decision="PUBLIC_GOVERNMENT_STANDARD",
        project_approver="food-reviewer@lifegoods.org",
        review_kind=ReferenceReviewKind.FOOD_DOMAIN_REVIEW,
        sha256=sha256,
    )


def sample_source() -> ReferenceSourceDefinition:
    return ReferenceSourceDefinition(
        id="source-codex-cxs-1-1985-2026",
        name="Codex General Standard for the Labelling of Prepackaged Foods",
        source_type="INTERNATIONAL_STANDARD",
        source_url="https://www.fao.org/fao-who-codexalimentarius/standards/cxs1-1985",
        jurisdiction="INTERNATIONAL",
        publisher="Codex Alimentarius Commission",
        edition="CXS 1-1985 (Amended 2026)",
        licensing_decision="PUBLIC_GOVERNMENT_STANDARD",
        terms_version="2026",
    )


def sample_concepts() -> list[ReferenceConceptDefinition]:
    return [
        ReferenceConceptDefinition(
            id="concept-food-allergen-milk",
            name="Milk and milk products",
            condition_family=ConditionFamily.FOOD_ALLERGEN,
            parent_id=None,
            is_leaf=True,
            description="Milk and ingredients derived from milk",
        )
    ]


def sample_mappings() -> list[LexicalMappingDefinition]:
    return [
        LexicalMappingDefinition(
            id="map-en-milk-exact",
            concept_id="concept-food-allergen-milk",
            language="en",
            mapped_text="milk",
            relationship_type="EXACT_NAME",
            notes="Direct milk declaration",
        ),
        LexicalMappingDefinition(
            id="map-en-whey-derived",
            concept_id="concept-food-allergen-milk",
            language="en",
            mapped_text="whey",
            relationship_type="DERIVED_FROM",
            notes="Reviewed dairy derivative",
        ),
    ]


def sample_rules() -> list[AllergenRuleDefinition]:
    return [
        AllergenRuleDefinition(
            id="rule-codex-2026-milk",
            concept_id="concept-food-allergen-milk",
            source_id="source-codex-cxs-1-1985-2026",
            rule_kind="MANDATORY_DECLARATION",
            condition_family=ConditionFamily.FOOD_ALLERGEN,
            description="Codex CXS 1-1985 mandatory allergen declaration for milk",
        )
    ]


def create_valid_bundle() -> ReferenceBundle:
    manifest = sample_manifest()
    sources = [sample_source()]
    concepts = sample_concepts()
    mappings = sample_mappings()
    rules = sample_rules()

    computed_sha256 = compute_bundle_sha256(
        manifest=manifest,
        sources=sources,
        concepts=concepts,
        mappings=mappings,
        rules=rules,
    )
    manifest_with_hash = sample_manifest(sha256=computed_sha256)
    return ReferenceBundle(
        manifest=manifest_with_hash,
        sources=sources,
        concepts=concepts,
        mappings=mappings,
        rules=rules,
    )


def test_valid_bundle_passes_validation() -> None:
    bundle = create_valid_bundle()
    report = validate_bundle(bundle)
    assert report.is_valid
    assert not report.errors
    assert report.sha256 == bundle.manifest.sha256


def test_validation_detects_duplicate_stable_ids() -> None:
    bundle = create_valid_bundle()
    bundle_dict = bundle.to_dict()
    bundle_dict["concepts"].append(
        {
            "id": "concept-food-allergen-milk",
            "name": "Duplicate milk",
            "condition_family": "FOOD_ALLERGEN",
            "parent_id": None,
            "is_leaf": True,
        }
    )
    reconstructed = ReferenceBundle.from_dict(bundle_dict)
    report = validate_bundle(reconstructed)
    assert not report.is_valid
    assert any("Duplicate concept ID 'concept-food-allergen-milk'" in err for err in report.errors)


def test_validation_detects_invalid_parent() -> None:
    bundle = create_valid_bundle()
    bundle_dict = bundle.to_dict()
    bundle_dict["concepts"][0]["parent_id"] = "non-existent-parent"
    reconstructed = ReferenceBundle.from_dict(bundle_dict)
    report = validate_bundle(reconstructed)
    assert not report.is_valid
    assert any("Parent ID 'non-existent-parent' does not exist" in err for err in report.errors)


def test_validation_detects_cyclic_parents() -> None:
    bundle = create_valid_bundle()
    bundle_dict = bundle.to_dict()
    bundle_dict["concepts"] = [
        {
            "id": "concept-a",
            "name": "Concept A",
            "condition_family": "FOOD_ALLERGEN",
            "parent_id": "concept-b",
            "is_leaf": False,
        },
        {
            "id": "concept-b",
            "name": "Concept B",
            "condition_family": "FOOD_ALLERGEN",
            "parent_id": "concept-a",
            "is_leaf": False,
        },
    ]
    bundle_dict["mappings"][0]["concept_id"] = "concept-a"
    bundle_dict["mappings"][1]["concept_id"] = "concept-b"
    bundle_dict["rules"][0]["concept_id"] = "concept-a"
    reconstructed = ReferenceBundle.from_dict(bundle_dict)
    report = validate_bundle(reconstructed)
    assert not report.is_valid
    assert any("Cyclic parent relationship detected" in err for err in report.errors)


def test_validation_detects_overlapping_mappings() -> None:
    bundle = create_valid_bundle()
    bundle_dict = bundle.to_dict()
    bundle_dict["mappings"].append(
        {
            "id": "map-en-milk-duplicate",
            "concept_id": "concept-food-allergen-milk",
            "language": "en",
            "mapped_text": "MILK",
            "relationship_type": "EXACT_NAME",
        }
    )
    reconstructed = ReferenceBundle.from_dict(bundle_dict)
    report = validate_bundle(reconstructed)
    assert not report.is_valid
    assert any("Overlapping or duplicate lexical mapping" in err for err in report.errors)


def test_validation_detects_missing_sources() -> None:
    bundle = create_valid_bundle()
    bundle_dict = bundle.to_dict()
    bundle_dict["rules"][0]["source_id"] = "missing-source-id"
    reconstructed = ReferenceBundle.from_dict(bundle_dict)
    report = validate_bundle(reconstructed)
    assert not report.is_valid
    assert any("Source ID 'missing-source-id' referenced by rule" in err for err in report.errors)


def test_validation_detects_unsupported_languages() -> None:
    bundle = create_valid_bundle()
    bundle_dict = bundle.to_dict()
    bundle_dict["mappings"][0]["language"] = "unsupported_lang_xyz"
    reconstructed = ReferenceBundle.from_dict(bundle_dict)
    report = validate_bundle(reconstructed)
    assert not report.is_valid
    assert any("Unsupported language code 'unsupported_lang_xyz'" in err for err in report.errors)


def test_validation_detects_integrity_hash_mismatch() -> None:
    bundle = create_valid_bundle()
    bundle_dict = bundle.to_dict()
    bundle_dict["manifest"]["sha256"] = "0" * 64
    reconstructed = ReferenceBundle.from_dict(bundle_dict)
    report = validate_bundle(reconstructed)
    assert not report.is_valid
    assert any("Integrity hash mismatch" in err for err in report.errors)


def test_validation_detects_ambiguous_derivatives_across_concepts() -> None:
    bundle = create_valid_bundle()
    bundle_dict = bundle.to_dict()
    bundle_dict["concepts"].append(
        {
            "id": "concept-food-allergen-soy",
            "name": "Soybeans and products thereof",
            "condition_family": "FOOD_ALLERGEN",
            "parent_id": None,
            "is_leaf": True,
        }
    )
    bundle_dict["mappings"].append(
        {
            "id": "map-en-whey-soy-conflict",
            "concept_id": "concept-food-allergen-soy",
            "language": "en",
            "mapped_text": "whey",
            "relationship_type": "DERIVED_FROM",
        }
    )
    reconstructed = ReferenceBundle.from_dict(bundle_dict)
    report = validate_bundle(reconstructed)
    assert not report.is_valid
    assert any("Ambiguous derivative or conflicting mapping" in err for err in report.errors)


def test_condition_families_are_strictly_typed() -> None:
    bundle = create_valid_bundle()
    bundle_dict = bundle.to_dict()
    bundle_dict["concepts"][0]["condition_family"] = "COELIAC_GLUTEN"
    reconstructed = ReferenceBundle.from_dict(bundle_dict)
    report = validate_bundle(reconstructed)
    assert not report.is_valid
    assert any(
        "Condition family 'COELIAC_GLUTEN' does not match dataset kind 'FOOD_ALLERGEN'"
        in err
        for err in report.errors
    )


@pytest.fixture
def db_session(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    database_path = tmp_path / "test_import.db"
    database_url = f"sqlite+pysqlite:///{database_path}"
    monkeypatch.setenv("LIFEGOODS_DATABASE_URL", database_url)
    config = Config("backend/alembic.ini")
    command.upgrade(config, "head")

    engine = create_engine(database_url)
    factory = sessionmaker(engine, expire_on_commit=False)
    with factory() as session:
        yield session


def test_import_valid_bundle_persists_all_entities(db_session: Session) -> None:
    bundle = create_valid_bundle()
    fixed_now = datetime(2026, 8, 28, 12, 0, tzinfo=UTC)

    version_record = import_reference_bundle(db_session, bundle, now=lambda: fixed_now)

    assert version_record.id == bundle.manifest.id
    assert version_record.status == "READY"
    assert version_record.immutable is True
    assert version_record.sha256 == bundle.manifest.sha256
    assert (
        version_record.retrieved_at.replace(tzinfo=UTC) == fixed_now
        if version_record.retrieved_at.tzinfo is None
        else version_record.retrieved_at == fixed_now
    )
    assert (
        version_record.reviewed_at.replace(tzinfo=UTC) == fixed_now
        if version_record.reviewed_at is not None and version_record.reviewed_at.tzinfo is None
        else version_record.reviewed_at == fixed_now
    )
    assert version_record.review_kind == ReferenceReviewKind.FOOD_DOMAIN_REVIEW

    # Check database rows
    sources = db_session.query(ReferenceSourceRecord).all()
    assert len(sources) == 1
    assert sources[0].id == "source-codex-cxs-1-1985-2026"

    concepts = (
        db_session.query(ReferenceConceptRecord)
        .filter_by(dataset_version_id=bundle.manifest.id)
        .all()
    )
    assert len(concepts) == 1
    assert concepts[0].id == "concept-food-allergen-milk"
    assert concepts[0].condition_family == "FOOD_ALLERGEN"

    mappings = (
        db_session.query(LexicalMappingRecord)
        .filter_by(dataset_version_id=bundle.manifest.id)
        .all()
    )
    assert len(mappings) == 2
    mapping_texts = {m.mapped_text for m in mappings}
    assert mapping_texts == {"milk", "whey"}

    rules = (
        db_session.query(AllergenRuleRecord)
        .filter_by(dataset_version_id=bundle.manifest.id)
        .all()
    )
    assert len(rules) == 1
    assert rules[0].id == "rule-codex-2026-milk"


def test_import_is_idempotent(db_session: Session) -> None:
    bundle = create_valid_bundle()
    record1 = import_reference_bundle(db_session, bundle)
    record2 = import_reference_bundle(db_session, bundle)

    assert record1.id == record2.id
    assert record1.sha256 == record2.sha256

    versions_count = db_session.query(ReferenceDatasetVersionRecord).count()
    assert versions_count == 1
    concepts_count = db_session.query(ReferenceConceptRecord).count()
    assert concepts_count == 1


def test_import_rejects_conflicting_version_content(db_session: Session) -> None:
    bundle = create_valid_bundle()
    import_reference_bundle(db_session, bundle)

    # Modify bundle content without changing manifest.id
    conflicting_dict = bundle.to_dict()
    conflicting_dict["manifest"]["source_url"] = "https://conflicting.source.org"
    conflicting_dict["manifest"]["sha256"] = compute_bundle_sha256(
        manifest=ReferenceDatasetManifest.from_dict(conflicting_dict["manifest"]),
        sources=[ReferenceSourceDefinition.from_dict(s) for s in conflicting_dict["sources"]],
        concepts=[ReferenceConceptDefinition.from_dict(c) for c in conflicting_dict["concepts"]],
        mappings=[LexicalMappingDefinition.from_dict(m) for m in conflicting_dict["mappings"]],
        rules=[AllergenRuleDefinition.from_dict(r) for r in conflicting_dict["rules"]],
    )
    conflicting_bundle = ReferenceBundle.from_dict(conflicting_dict)

    with pytest.raises(
        ReferenceDatasetConflictError, match="conflicts with existing imported version"
    ):
        import_reference_bundle(db_session, conflicting_bundle)


def test_import_invalid_bundle_fails(db_session: Session) -> None:
    bundle = create_valid_bundle()
    invalid_dict = bundle.to_dict()
    invalid_dict["concepts"][0]["parent_id"] = "non-existent"
    invalid_bundle = ReferenceBundle.from_dict(invalid_dict)

    with pytest.raises(
        ReferenceDatasetValidationError, match="Parent ID 'non-existent' does not exist"
    ):
        import_reference_bundle(db_session, invalid_bundle)

    # Ensure no partial rows were committed
    assert db_session.query(ReferenceDatasetVersionRecord).count() == 0
    assert db_session.query(ReferenceConceptRecord).count() == 0


def test_import_rejects_conflicting_source_definition(db_session: Session) -> None:
    bundle1 = create_valid_bundle()
    import_reference_bundle(db_session, bundle1)

    # Create bundle2 with different version_id but conflicting source metadata under same source_id
    bundle2_dict = create_valid_bundle().to_dict()
    bundle2_dict["manifest"]["id"] = "codex-food-allergen-2026-v2"
    bundle2_dict["sources"][0]["source_url"] = "https://conflicting-source-url.org"
    bundle2_dict["manifest"]["sha256"] = compute_bundle_sha256(
        manifest=ReferenceDatasetManifest.from_dict(bundle2_dict["manifest"]),
        sources=[ReferenceSourceDefinition.from_dict(s) for s in bundle2_dict["sources"]],
        concepts=[ReferenceConceptDefinition.from_dict(c) for c in bundle2_dict["concepts"]],
        mappings=[LexicalMappingDefinition.from_dict(m) for m in bundle2_dict["mappings"]],
        rules=[AllergenRuleDefinition.from_dict(r) for r in bundle2_dict["rules"]],
    )
    bundle2 = ReferenceBundle.from_dict(bundle2_dict)

    with pytest.raises(ReferenceDatasetConflictError, match="conflicts with existing source"):
        import_reference_bundle(db_session, bundle2)


def test_seed_bundle_file_is_valid_and_can_be_imported(db_session: Session) -> None:
    bundle_path = (
        Path(__file__).parent.parent
        / "src"
        / "lifegoods"
        / "reference_datasets"
        / "bundles"
        / "codex_2026_food_allergen_minimal.json"
    )
    assert bundle_path.exists()
    bundle = ReferenceBundle.from_json_file(bundle_path)
    report = validate_bundle(bundle)
    assert report.is_valid, f"Seed bundle validation failed: {report.errors}"
    assert report.sha256 == bundle.manifest.sha256

    record = import_reference_bundle(db_session, bundle)
    assert record.id == "codex-food-allergen-2026-minimal"
    assert record.status == "READY"
    assert record.immutable is True
    assert len(record.concepts) == 1
    assert len(record.mappings) == 2
    assert len(record.rules) == 1
