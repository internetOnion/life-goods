from __future__ import annotations

from dataclasses import replace
from pathlib import Path

import pytest

from lifegoods.reference_datasets.bundle import (
    HalalClassification,
    HalalIngredientMappingDefinition,
    HalalIngredientReferenceBundle,
    HalalRelationshipType,
    HalalSourceCitationDefinition,
    LexicalMappingDefinition,
    ReferenceConceptDefinition,
    ReferenceDatasetKind,
    ReferenceDatasetManifest,
    ReferenceReviewKind,
    ReferenceSourceDefinition,
    compute_halal_bundle_sha256,
    load_reference_bundle,
    parse_reference_bundle,
)
from lifegoods.reference_datasets.validation import validate_bundle


def sample_halal_manifest(*, sha256: str = "") -> ReferenceDatasetManifest:
    return ReferenceDatasetManifest(
        id="synthetic-halal-ingredient-2026-v1",
        dataset_kind=ReferenceDatasetKind.HALAL_INGREDIENT,
        edition="Synthetic Edition 2026",
        jurisdiction="CAMBODIA",
        source_url="https://example.test/standards/halal-synthetic",
        licensing_decision="PROJECT_AUTHORED",
        project_approver="halal-reviewer@lifegoods.org",
        review_kind=ReferenceReviewKind.HALAL_DOMAIN_REVIEW,
        sha256=sha256,
    )


def sample_halal_source() -> ReferenceSourceDefinition:
    return ReferenceSourceDefinition(
        id="source-synthetic-halal-standard-2026",
        name="Synthetic Halal Ingredient Standard",
        source_type="NATIONAL_STANDARD",
        source_url="https://example.test/standards/halal-synthetic",
        jurisdiction="CAMBODIA",
        publisher="Synthetic Standards Authority",
        edition="2026 Edition",
        licensing_decision="PROJECT_AUTHORED",
        terms_version="2026-v1",
    )


def sample_halal_concepts() -> list[ReferenceConceptDefinition]:
    return [
        ReferenceConceptDefinition(
            id="concept-halal-pork",
            name="Porcine ingredients",
            condition_family=ReferenceDatasetKind.HALAL_INGREDIENT,
            parent_id=None,
            is_leaf=True,
            description="Synthetic engineering concept for porcine products",
        ),
        ReferenceConceptDefinition(
            id="concept-halal-gelatin",
            name="Gelatin (source unspecified)",
            condition_family=ReferenceDatasetKind.HALAL_INGREDIENT,
            parent_id=None,
            is_leaf=True,
            description="Synthetic engineering concept for source-ambiguous gelatin",
        ),
    ]


def sample_halal_lexical_mappings() -> list[LexicalMappingDefinition]:
    return [
        LexicalMappingDefinition(
            id="map-halal-pork-en-exact",
            concept_id="concept-halal-pork",
            language="en",
            mapped_text="pork",
            relationship_type=HalalRelationshipType.EXACT_NAME,
            notes="Direct English name for pork",
        ),
        LexicalMappingDefinition(
            id="map-halal-gelatin-en-exact",
            concept_id="concept-halal-gelatin",
            language="en",
            mapped_text="gelatin",
            relationship_type=HalalRelationshipType.EXACT_NAME,
            notes="Direct English name for gelatin",
        ),
    ]


def sample_halal_ingredient_mappings() -> list[HalalIngredientMappingDefinition]:
    return [
        HalalIngredientMappingDefinition(
            id="halal-map-pork",
            concept_id="concept-halal-pork",
            classification=HalalClassification.EXPLICIT_PROHIBITED,
            citations=[
                HalalSourceCitationDefinition(
                    source_id="source-synthetic-halal-standard-2026",
                    jurisdiction="CAMBODIA",
                    edition="2026 Edition",
                    locator="Article 4.1",
                    notes="Synthetic locator for prohibited porcine derivatives",
                )
            ],
            notes="Explicit prohibited classification",
        ),
        HalalIngredientMappingDefinition(
            id="halal-map-gelatin",
            concept_id="concept-halal-gelatin",
            classification=HalalClassification.SOURCE_AMBIGUOUS,
            citations=[
                HalalSourceCitationDefinition(
                    source_id="source-synthetic-halal-standard-2026",
                    jurisdiction="CAMBODIA",
                    edition="2026 Edition",
                    locator="Section 5.3",
                    notes="Synthetic locator for ambiguous source gelatin",
                )
            ],
            notes="Source ambiguous classification",
        ),
    ]


def create_sample_halal_bundle() -> HalalIngredientReferenceBundle:
    manifest = sample_halal_manifest()
    sources = [sample_halal_source()]
    concepts = sample_halal_concepts()
    mappings = sample_halal_lexical_mappings()
    halal_ingredient_mappings = sample_halal_ingredient_mappings()
    sha256 = compute_halal_bundle_sha256(
        manifest=manifest,
        sources=sources,
        concepts=concepts,
        mappings=mappings,
        halal_ingredient_mappings=halal_ingredient_mappings,
    )
    manifest_with_hash = replace(manifest, sha256=sha256)
    return HalalIngredientReferenceBundle(
        manifest=manifest_with_hash,
        sources=sources,
        concepts=concepts,
        mappings=mappings,
        halal_ingredient_mappings=halal_ingredient_mappings,
    )


def test_halal_bundle_round_trip_serialization() -> None:
    bundle = create_sample_halal_bundle()
    payload = bundle.to_dict()

    parsed = parse_reference_bundle(payload)
    assert isinstance(parsed, HalalIngredientReferenceBundle)
    assert parsed.to_dict() == payload
    assert parsed.compute_sha256() == bundle.manifest.sha256


def test_halal_bundle_from_json_file(tmp_path: Path) -> None:
    bundle = create_sample_halal_bundle()
    bundle_path = tmp_path / "synthetic_halal_bundle.json"
    bundle.to_json_file(bundle_path)

    loaded = load_reference_bundle(bundle_path)
    assert isinstance(loaded, HalalIngredientReferenceBundle)
    assert loaded.manifest.id == "synthetic-halal-ingredient-2026-v1"
    assert loaded.manifest.dataset_kind == ReferenceDatasetKind.HALAL_INGREDIENT
    assert len(loaded.halal_ingredient_mappings) == 2


def test_halal_bundle_dispatch_rejects_foreign_allergen_rules() -> None:
    bundle = create_sample_halal_bundle()
    payload = bundle.to_dict()
    payload["rules"] = []

    with pytest.raises(
        ValueError,
        match="Dataset kind 'HALAL_INGREDIENT' does not support top-level section.*rules",
    ):
        parse_reference_bundle(payload)


def test_halal_bundle_validates_successfully() -> None:
    bundle = create_sample_halal_bundle()
    report = validate_bundle(bundle)
    assert report.is_valid is True
    assert report.errors == []
    assert report.sha256 == bundle.manifest.sha256


def test_halal_validation_rejects_missing_citations() -> None:
    bundle = create_sample_halal_bundle()
    hm_without_citations = replace(bundle.halal_ingredient_mappings[0], citations=[])
    invalid_bundle = replace(
        bundle,
        halal_ingredient_mappings=[hm_without_citations, bundle.halal_ingredient_mappings[1]],
    )
    report = validate_bundle(invalid_bundle)
    assert not report.is_valid
    assert any("must contain at least one source citation" in e for e in report.errors)


def test_halal_validation_rejects_incomplete_citation_fields() -> None:
    bundle = create_sample_halal_bundle()
    incomplete_citation = replace(
        bundle.halal_ingredient_mappings[0].citations[0],
        edition="",
        jurisdiction="",
        locator="",
    )
    hm = replace(bundle.halal_ingredient_mappings[0], citations=[incomplete_citation])
    invalid_bundle = replace(
        bundle,
        halal_ingredient_mappings=[hm, bundle.halal_ingredient_mappings[1]],
    )
    report = validate_bundle(invalid_bundle)
    assert not report.is_valid
    assert any("missing edition" in e for e in report.errors)
    assert any("missing jurisdiction" in e for e in report.errors)
    assert any("missing locator" in e for e in report.errors)


def test_halal_validation_rejects_citation_with_non_existent_source() -> None:
    bundle = create_sample_halal_bundle()
    bad_source_citation = replace(
        bundle.halal_ingredient_mappings[0].citations[0],
        source_id="non-existent-source",
    )
    hm = replace(bundle.halal_ingredient_mappings[0], citations=[bad_source_citation])
    invalid_bundle = replace(
        bundle,
        halal_ingredient_mappings=[hm, bundle.halal_ingredient_mappings[1]],
    )
    report = validate_bundle(invalid_bundle)
    assert not report.is_valid
    assert any("references non-existent source 'non-existent-source'" in e for e in report.errors)


def test_halal_validation_rejects_missing_mapping_for_leaf_concept() -> None:
    bundle = create_sample_halal_bundle()
    invalid_bundle = replace(
        bundle,
        halal_ingredient_mappings=[bundle.halal_ingredient_mappings[0]],  # missing second leaf
    )
    report = validate_bundle(invalid_bundle)
    assert not report.is_valid
    assert any(
        "Active leaf concept 'concept-halal-gelatin' does not have a Halal ingredient mapping" in e
        for e in report.errors
    )


def test_halal_validation_rejects_duplicate_or_contradictory_mappings() -> None:
    bundle = create_sample_halal_bundle()
    duplicate_hm = HalalIngredientMappingDefinition(
        id="halal-map-pork-duplicate",
        concept_id="concept-halal-pork",
        classification=HalalClassification.SOURCE_AMBIGUOUS,
        citations=bundle.halal_ingredient_mappings[0].citations,
    )
    invalid_bundle = replace(
        bundle,
        halal_ingredient_mappings=[*bundle.halal_ingredient_mappings, duplicate_hm],
    )
    report = validate_bundle(invalid_bundle)
    assert not report.is_valid
    assert any(
        "Active leaf concept 'concept-halal-pork' has duplicate or contradictory "
        "Halal ingredient mappings"
        in e
        for e in report.errors
    )


def test_halal_validation_rejects_mapping_targeting_non_leaf_concept() -> None:
    bundle = create_sample_halal_bundle()
    parent_concept = ReferenceConceptDefinition(
        id="concept-halal-group",
        name="Halal Parent Group",
        condition_family=ReferenceDatasetKind.HALAL_INGREDIENT,
        parent_id=None,
        is_leaf=False,
    )
    child_concepts = [
        replace(c, parent_id="concept-halal-group") for c in bundle.concepts
    ]
    bad_mapping = HalalIngredientMappingDefinition(
        id="halal-map-parent",
        concept_id="concept-halal-group",
        classification=HalalClassification.EXPLICIT_PROHIBITED,
        citations=bundle.halal_ingredient_mappings[0].citations,
    )
    invalid_bundle = replace(
        bundle,
        concepts=[parent_concept, *child_concepts],
        halal_ingredient_mappings=[*bundle.halal_ingredient_mappings, bad_mapping],
    )
    report = validate_bundle(invalid_bundle)
    assert not report.is_valid
    assert any(
        "Halal ingredient mapping 'halal-map-parent' targets non-leaf concept 'concept-halal-group'"
        in e
        for e in report.errors
    )


def test_halal_validation_rejects_unsupported_relationship_type() -> None:
    bundle = create_sample_halal_bundle()
    bad_lexical_mapping = replace(
        bundle.mappings[0],
        relationship_type="PRECAUTIONARY_PHRASE",  # Allergen-only relationship type
    )
    invalid_bundle = replace(
        bundle,
        mappings=[bad_lexical_mapping, bundle.mappings[1]],
    )
    report = validate_bundle(invalid_bundle)
    assert not report.is_valid
    assert any("has invalid relationship type 'PRECAUTIONARY_PHRASE'" in e for e in report.errors)


def test_halal_validation_rejects_foreign_condition_family() -> None:
    bundle = create_sample_halal_bundle()
    bad_concept = replace(
        bundle.concepts[0],
        condition_family="FOOD_ALLERGEN",
    )
    invalid_bundle = replace(
        bundle,
        concepts=[bad_concept, bundle.concepts[1]],
    )
    report = validate_bundle(invalid_bundle)
    assert not report.is_valid
    assert any(
        "Condition family 'FOOD_ALLERGEN' does not match dataset kind 'HALAL_INGREDIENT'" in e
        for e in report.errors
    )


def test_halal_validation_rejects_hash_mismatch() -> None:
    bundle = create_sample_halal_bundle()
    tampered_bundle = replace(
        bundle,
        manifest=replace(bundle.manifest, sha256="wrong-hash"),
    )
    report = validate_bundle(tampered_bundle)
    assert not report.is_valid
    assert any("Integrity hash mismatch" in e for e in report.errors)


@pytest.fixture
def db_session(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    db_path = tmp_path / "test_halal.db"
    db_url = f"sqlite+pysqlite:///{db_path}"
    monkeypatch.setenv("LIFEGOODS_DATABASE_URL", db_url)
    config = Config("backend/alembic.ini")
    command.upgrade(config, "head")

    engine = create_engine(db_url)
    factory = sessionmaker(engine, expire_on_commit=False)
    with factory() as session:
        yield session


def test_import_halal_bundle_persists_records(db_session) -> None:
    from lifegoods.reference_datasets.importer import import_reference_bundle
    from lifegoods.reference_datasets.models import (
        HalalIngredientMappingRecord,
        ReferenceDatasetVersionRecord,
    )

    bundle = create_sample_halal_bundle()
    version = import_reference_bundle(db_session, bundle)

    assert version.id == "synthetic-halal-ingredient-2026-v1"
    assert version.dataset_kind == "HALAL_INGREDIENT"
    assert version.status == "READY"
    assert version.immutable is True

    stored_version = (
        db_session.query(ReferenceDatasetVersionRecord)
        .filter_by(id="synthetic-halal-ingredient-2026-v1")
        .first()
    )
    assert stored_version is not None
    assert len(stored_version.concepts) == 2
    assert len(stored_version.mappings) == 2
    assert len(stored_version.halal_ingredient_mappings) == 2

    porcine_hm = (
        db_session.query(HalalIngredientMappingRecord)
        .filter_by(dataset_version_id=version.id, concept_id="concept-halal-pork")
        .first()
    )
    assert porcine_hm is not None
    assert porcine_hm.classification == "EXPLICIT_PROHIBITED"
    assert len(porcine_hm.citations) == 1
    assert porcine_hm.citations[0]["source_id"] == "source-synthetic-halal-standard-2026"
    assert porcine_hm.citations[0]["locator"] == "Article 4.1"


def test_activate_and_rollback_halal_version(db_session) -> None:
    from lifegoods.reference_datasets.importer import import_reference_bundle
    from lifegoods.reference_datasets.lifecycle import (
        activate_reference_dataset_version,
        get_active_reference_dataset_pointer,
        rollback_reference_dataset_version,
    )

    # Version 1
    b1 = create_sample_halal_bundle()
    import_reference_bundle(db_session, b1)
    v1 = activate_reference_dataset_version(
        db_session,
        b1.manifest.id,
        approver="halal-approver@lifegoods.org",
        review_kind=ReferenceReviewKind.HALAL_DOMAIN_REVIEW,
    )
    assert v1.status == "ACTIVE"

    pointer1 = get_active_reference_dataset_pointer(
        db_session, ReferenceDatasetKind.HALAL_INGREDIENT
    )
    assert pointer1 is not None
    assert pointer1.active_version_id == "synthetic-halal-ingredient-2026-v1"
    assert pointer1.previous_version_id is None
    assert pointer1.review_kind == "HALAL_DOMAIN_REVIEW"

    # Version 2
    b2_manifest = replace(
        b1.manifest,
        id="synthetic-halal-ingredient-2026-v2",
        source_url="https://example.test/v2",
    )
    sha2 = compute_halal_bundle_sha256(
        manifest=b2_manifest,
        sources=b1.sources,
        concepts=b1.concepts,
        mappings=b1.mappings,
        halal_ingredient_mappings=b1.halal_ingredient_mappings,
    )
    b2 = replace(b1, manifest=replace(b2_manifest, sha256=sha2))
    import_reference_bundle(db_session, b2)
    v2 = activate_reference_dataset_version(
        db_session,
        b2.manifest.id,
        approver="halal-approver@lifegoods.org",
    )
    assert v2.status == "ACTIVE"

    pointer2 = get_active_reference_dataset_pointer(
        db_session, ReferenceDatasetKind.HALAL_INGREDIENT
    )
    assert pointer2 is not None
    assert pointer2.active_version_id == "synthetic-halal-ingredient-2026-v2"
    assert pointer2.previous_version_id == "synthetic-halal-ingredient-2026-v1"

    # Rollback to Version 1
    rolled_back = rollback_reference_dataset_version(
        db_session,
        dataset_kind=ReferenceDatasetKind.HALAL_INGREDIENT,
        approver="operator@lifegoods.org",
    )
    assert rolled_back.id == "synthetic-halal-ingredient-2026-v1"
    assert rolled_back.status == "ACTIVE"

    pointer3 = get_active_reference_dataset_pointer(
        db_session, ReferenceDatasetKind.HALAL_INGREDIENT
    )
    assert pointer3 is not None
    assert pointer3.active_version_id == "synthetic-halal-ingredient-2026-v1"
    assert pointer3.previous_version_id is None


def test_synthetic_fixture_file_validates_and_imports(db_session) -> None:
    from lifegoods.reference_datasets.importer import import_reference_bundle
    from lifegoods.reference_datasets.kind_adapters import get_reference_dataset_kind_adapter

    fixture_path = (
        Path(__file__).parent
        / "fixtures"
        / "reference_datasets"
        / "synthetic_halal_ingredient_bundle.json"
    )
    bundle = load_reference_bundle(fixture_path)
    assert isinstance(bundle, HalalIngredientReferenceBundle)

    report = validate_bundle(bundle)
    assert report.is_valid is True
    assert report.errors == []

    version = import_reference_bundle(db_session, bundle)
    assert version.id == bundle.manifest.id

    adapter = get_reference_dataset_kind_adapter(version.dataset_kind)
    inspection = adapter.inspect_records(version)
    assert len(inspection["concepts"]) == 2
    assert len(inspection["mappings"]) == 2
    assert len(inspection["halal_ingredient_mappings"]) == 2


