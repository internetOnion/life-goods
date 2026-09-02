from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from lifegoods.reference_datasets.access import DatabaseHalalReferenceDataAccess
from lifegoods.reference_datasets.bundle import (
    HalalClassification,
    HalalIngredientReferenceBundle,
    HalalRelationshipType,
    ReferenceDatasetKind,
    ReferenceReviewKind,
    load_reference_bundle,
    parse_reference_bundle,
)
from lifegoods.reference_datasets.importer import (
    import_reference_bundle,
)
from lifegoods.reference_datasets.kind_adapters import (
    HalalIngredientReferenceDatasetAdapter,
)
from lifegoods.reference_datasets.lifecycle import (
    get_active_reference_dataset_pointer,
)
from lifegoods.reference_datasets.validation import validate_bundle

BUNDLE_PATH = (
    Path(__file__).parents[1]
    / "src"
    / "lifegoods"
    / "reference_datasets"
    / "bundles"
    / "halal_ingredient_2026_reviewed_english_v1.json"
)

EXPECTED_SHA256 = "fa2b3088080e4d1e6938610d518880231ea4a4cc0b5ffee3bfbf1ce5ae795a78"
EXPECTED_PROJECT_APPROVER = "cambodia-halal-reviewer@lifegoods.org"
EXPECTED_SOURCE_METADATA = {
    "source-cambodia-prakas-090-2020": {
        "jurisdiction": "CAMBODIA",
        "edition": "Prakas No. 090 (2020)",
        "licensing_decision": "PUBLIC_GOVERNMENT_STANDARD",
    },
    "source-oic-smiic-1-2019": {
        "jurisdiction": "INTERNATIONAL",
        "edition": "OIC/SMIIC 1:2019",
        "licensing_decision": "LICENSED_STANDARD",
    },
    "source-oic-smiic-24-2020": {
        "jurisdiction": "INTERNATIONAL",
        "edition": "OIC/SMIIC 24:2020",
        "licensing_decision": "LICENSED_STANDARD",
    },
    "source-lifegoods-reviewed-halal-mappings-issue-67": {
        "jurisdiction": "PROJECT_SCOPE",
        "edition": "Issue 67",
        "licensing_decision": "PROJECT_AUTHORED",
    },
}

EXPECTED_PROHIBITED_DIRECT_NAMES = {
    "concept-halal-pork": "pork",
    "concept-halal-bacon": "bacon",
    "concept-halal-ham": "ham",
    "concept-halal-lard": "lard",
    "concept-halal-porcine-gelatin": "porcine gelatin",
    "concept-halal-alcohol": "alcohol",
    "concept-halal-wine": "wine",
    "concept-halal-beer": "beer",
    "concept-halal-rum": "rum",
    "concept-halal-liqueur": "liqueur",
    "concept-halal-mirin": "mirin",
    "concept-halal-blood": "blood",
    "concept-halal-carrion": "carrion",
}

EXPECTED_AMBIGUOUS_DIRECT_NAMES = {
    "concept-halal-gelatin": "gelatin",
    "concept-halal-collagen": "collagen",
    "concept-halal-mono-and-diglycerides": "mono- and diglycerides of fatty acids",
    "concept-halal-l-cysteine": "L-cysteine",
    "concept-halal-rennet": "rennet",
    "concept-halal-pepsin": "pepsin",
    "concept-halal-glycerol": "glycerol",
    "concept-halal-carmine": "carmine",
    "concept-halal-stearic-acid": "stearic acid",
    "concept-halal-tallow": "tallow",
    "concept-halal-shellac": "shellac",
}

EXPECTED_ALL_DIRECT_NAMES = {
    **EXPECTED_PROHIBITED_DIRECT_NAMES,
    **EXPECTED_AMBIGUOUS_DIRECT_NAMES,
}


def load_bundle() -> HalalIngredientReferenceBundle:
    bundle = load_reference_bundle(BUNDLE_PATH)
    assert isinstance(bundle, HalalIngredientReferenceBundle)
    return bundle


def unhashed_bundle(data: dict) -> HalalIngredientReferenceBundle:
    data["manifest"]["sha256"] = ""
    parsed = parse_reference_bundle(data)
    assert isinstance(parsed, HalalIngredientReferenceBundle)
    return parsed


@pytest.fixture
def db_session_factory(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    from alembic import command
    from alembic.config import Config

    db_path = tmp_path / "test_halal_release.db"
    db_url = f"sqlite+pysqlite:///{db_path}"
    monkeypatch.setenv("LIFEGOODS_DATABASE_URL", db_url)
    config = Config("backend/alembic.ini")
    command.upgrade(config, "head")

    engine = create_engine(db_url)
    return sessionmaker(engine, expire_on_commit=False)


def test_reviewed_release_has_prohibited_and_ambiguous_concepts() -> None:
    bundle = load_bundle()
    report = validate_bundle(bundle)

    assert report.is_valid, report.errors
    assert bundle.manifest.id == "halal-ingredient-2026-reviewed-english-v1"
    assert bundle.manifest.dataset_kind == ReferenceDatasetKind.HALAL_INGREDIENT
    assert bundle.manifest.review_kind == ReferenceReviewKind.HALAL_DOMAIN_REVIEW
    assert bundle.manifest.project_approver == EXPECTED_PROJECT_APPROVER
    assert report.sha256 == bundle.manifest.sha256 == EXPECTED_SHA256

    # Concept verification
    assert len(bundle.concepts) == 24
    leaves = {concept.id: concept for concept in bundle.concepts if concept.is_leaf}
    assert set(leaves) == set(EXPECTED_ALL_DIRECT_NAMES)

    # Lexical mapping verification
    exact_mappings = {
        mapping.concept_id: mapping
        for mapping in bundle.mappings
        if mapping.relationship_type == HalalRelationshipType.EXACT_NAME
    }
    assert {concept_id: m.mapped_text for concept_id, m in exact_mappings.items()} == (
        EXPECTED_ALL_DIRECT_NAMES
    )
    assert all(m.language == "en" for m in bundle.mappings)

    # Halal ingredient mapping verification
    halal_mappings = {hm.concept_id: hm for hm in bundle.halal_ingredient_mappings}
    assert set(halal_mappings) == set(EXPECTED_ALL_DIRECT_NAMES)

    prohibited_concepts = {
        concept_id
        for concept_id, hm in halal_mappings.items()
        if hm.classification == HalalClassification.EXPLICIT_PROHIBITED
    }
    ambiguous_concepts = {
        concept_id
        for concept_id, hm in halal_mappings.items()
        if hm.classification == HalalClassification.SOURCE_AMBIGUOUS
    }
    assert prohibited_concepts == set(EXPECTED_PROHIBITED_DIRECT_NAMES)
    assert ambiguous_concepts == set(EXPECTED_AMBIGUOUS_DIRECT_NAMES)

    # Source and citation verification
    sources_by_id = {s.id: s for s in bundle.sources}
    assert set(sources_by_id) == set(EXPECTED_SOURCE_METADATA)
    for source_id, expected in EXPECTED_SOURCE_METADATA.items():
        source = sources_by_id[source_id]
        assert source.jurisdiction == expected["jurisdiction"]
        assert source.edition == expected["edition"]
        assert source.licensing_decision == expected["licensing_decision"]

    for hm in bundle.halal_ingredient_mappings:
        assert len(hm.citations) >= 1
        for citation in hm.citations:
            assert citation.source_id in sources_by_id
            assert citation.edition.strip()
            assert citation.jurisdiction.strip()
            assert citation.locator.strip()


@pytest.mark.parametrize(
    ("mutation", "error_text"),
    [
        (
            lambda data: data["halal_ingredient_mappings"][0].update(
                classification="UNKNOWN_CLASSIFICATION"
            ),
            "invalid classification 'UNKNOWN_CLASSIFICATION'",
        ),
        (
            lambda data: data["halal_ingredient_mappings"][0].update(citations=[]),
            "must contain at least one source citation",
        ),
        (
            lambda data: data["halal_ingredient_mappings"][0]["citations"][0].update(
                locator=""
            ),
            "missing locator",
        ),
        (
            lambda data: data["halal_ingredient_mappings"][0]["citations"][0].update(
                edition=""
            ),
            "missing edition",
        ),
        (
            lambda data: data["halal_ingredient_mappings"][0]["citations"][0].update(
                jurisdiction=""
            ),
            "missing jurisdiction",
        ),
        (
            lambda data: data["halal_ingredient_mappings"][0]["citations"][0].update(
                source_id="non-existent-source"
            ),
            "references non-existent source 'non-existent-source'",
        ),
        (
            lambda data: data.update(
                mappings=[
                    mapping
                    for mapping in data["mappings"]
                    if mapping["id"] != "map-en-pork-exact"
                ]
            ),
            "does not have exactly one reviewed English EXACT_NAME mapping",
        ),
        (
            lambda data: data["halal_ingredient_mappings"].pop(0),
            "does not have a Halal ingredient mapping",
        ),
    ],
)
def test_release_invariants_are_rejected(mutation, error_text: str) -> None:
    data = load_bundle().to_dict()
    mutation(data)

    report = validate_bundle(unhashed_bundle(data))

    assert not report.is_valid
    assert any(error_text in error for error in report.errors)


def test_reviewed_release_excludes_unreviewed_or_out_of_scope_terms() -> None:
    bundle = load_bundle()
    mapped_terms = {mapping.mapped_text.casefold() for mapping in bundle.mappings}
    serialized = str(bundle.to_dict()).casefold()

    # No positive halal whitelist or certificate claims
    assert mapped_terms.isdisjoint(
        {"halal", "permissible", "certified", "kosher", "vegan", "vegetarian"}
    )
    # No allergen condition families
    assert "coeliac_gluten" not in serialized
    assert "sulphite_sensitivity" not in serialized
    assert "intolerance" not in serialized
    # No product-level verdict
    assert "product_verdict" not in serialized
    assert "guarantee" not in serialized


def test_database_import_and_inspection_of_reviewed_release(db_session_factory) -> None:
    bundle = load_bundle()
    adapter = HalalIngredientReferenceDatasetAdapter()

    with db_session_factory() as session:
        # Verify initial status has no active pointer
        pointer_before = get_active_reference_dataset_pointer(
            session, dataset_kind=ReferenceDatasetKind.HALAL_INGREDIENT
        )
        assert pointer_before is None

        # Import release
        version = import_reference_bundle(session, bundle)
        assert version.id == "halal-ingredient-2026-reviewed-english-v1"
        assert version.dataset_kind == "HALAL_INGREDIENT"
        assert version.review_kind == "HALAL_DOMAIN_REVIEW"

        # Status must remain inactive until explicit operator activation
        pointer_after_import = get_active_reference_dataset_pointer(
            session, dataset_kind=ReferenceDatasetKind.HALAL_INGREDIENT
        )
        assert pointer_after_import is None

        # Inspect imported version through adapter
        inspection = adapter.inspect_records(version)
        assert {record["id"]: record for record in inspection["concepts"]} == {
            concept.id: concept.to_dict() for concept in bundle.concepts
        }
        assert {record["id"]: record for record in inspection["mappings"]} == {
            mapping.id: mapping.to_dict() for mapping in bundle.mappings
        }
        assert inspection["exclusions"] == []
        assert {
            record["id"]: record for record in inspection["halal_ingredient_mappings"]
        } == {
            mapping.id: mapping.to_dict()
            for mapping in bundle.halal_ingredient_mappings
        }

        # Access returns None when inactive
        access = DatabaseHalalReferenceDataAccess(db_session_factory)
        assert access.get_active_version() is None
        assert access.get_active_data() is None
