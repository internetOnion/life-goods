from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from lifegoods.open_food_facts.models import (
    ExternalDatasetVersion,
    ExternalPackageRecord,
    ExternalSourceMetadata,
    SourcedValue,
)
from lifegoods.package_matches.assessments import (
    DisabledHalalIngredientAssessmentEvaluator,
    EvidenceCoverageState,
    HalalIngredientAssessmentEvaluation,
    HalalIngredientAssessmentOutcome,
    HalalIngredientAssessmentReason,
    HalalIngredientAssessmentStatus,
    StandardHalalIngredientAssessmentEvaluator,
)
from lifegoods.reference_datasets import (
    ActiveHalalReferenceData,
    DatabaseHalalReferenceDataAccess,
    HalalAssessmentReferenceVersion,
    HalalIngredientReferenceBundle,
    HalalReferenceConcept,
    HalalReferenceExclusion,
    HalalReferenceIngredientMapping,
    HalalReferenceLexicalMapping,
    HalalRelationshipType,
    HalalSourceCitation,
    LexicalExclusionDefinition,
    activate_reference_dataset_version,
    compute_halal_bundle_sha256,
    import_reference_bundle,
    load_reference_bundle,
)

OFF_SOURCE = ExternalSourceMetadata(
    name="Open Food Facts",
    source_type="COMMUNITY_DATABASE",
    base_url="https://world.openfoodfacts.org",
    attribution="Open Food Facts contributors",
    database_license="ODbL",
    contents_license="Database Contents License",
    image_license="CC BY-SA",
)

DATASET_VERSION = ExternalDatasetVersion(
    id="dataset-2026-08-27",
    source_url="https://static.openfoodfacts.org/data/export.jsonl.gz",
    retrieved_at=datetime(2026, 8, 27, 8, 0, tzinfo=UTC),
    activated_at=datetime(2026, 8, 27, 9, 0, tzinfo=UTC),
    sha256="a" * 64,
)


def sample_record(
    *,
    ingredient_texts: tuple[SourcedValue[str], ...] | None = None,
    product_name: str = "Example Food",
    halal_claim: tuple[str, ...] | None = None,
) -> ExternalPackageRecord:
    default_ingredients = (
        SourcedValue(
            value="Wheat flour, pork lard, salt",
            source_field="ingredients_text_en",
            language="en",
        ),
    )
    return ExternalPackageRecord(
        identifier="4006381333931",
        source=OFF_SOURCE,
        source_record_id="4006381333931",
        request_url="https://world.openfoodfacts.org/api/v2/product/4006381333931",
        source_url="https://world.openfoodfacts.org/product/4006381333931",
        names=(
            SourcedValue(
                value=product_name,
                source_field="product_name_en",
                language="en",
            ),
        ),
        brands=SourcedValue(value=("Example Foods",), source_field="brands"),
        quantity=SourcedValue(value="100 g", source_field="quantity"),
        ingredient_texts=(
            ingredient_texts if ingredient_texts is not None else default_ingredients
        ),
        allergen_declaration=None,
        allergen_tags=None,
        trace_declaration=None,
        trace_tags=None,
        additives=None,
        storage_conditions=(),
        manufacturing_places=None,
        halal_label_claim=(
            SourcedValue(value=halal_claim, source_field="labels_tags")
            if halal_claim is not None
            else None
        ),
        packaging_languages=None,
        countries_sold=None,
        nutrition=(),
        selected_images=(),
        retrieved_at=datetime(2026, 8, 27, 8, 0, tzinfo=UTC),
        source_revision="1787462400",
        dataset_version=DATASET_VERSION,
    )


@pytest.fixture
def db_session_factory(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    from alembic import command
    from alembic.config import Config

    db_path = tmp_path / "test_halal_access.db"
    db_url = f"sqlite+pysqlite:///{db_path}"
    monkeypatch.setenv("LIFEGOODS_DATABASE_URL", db_url)
    config = Config("backend/alembic.ini")
    command.upgrade(config, "head")

    engine = create_engine(db_url)
    factory = sessionmaker(engine, expire_on_commit=False)
    return factory


def sample_active_halal_reference_data() -> ActiveHalalReferenceData:
    version = HalalAssessmentReferenceVersion(
        id="synthetic-halal-ingredient-2026-v1",
        source_url="https://example.test/synthetic/halal-reference-dataset",
        retrieved_at=datetime(2026, 8, 27, 8, 0, tzinfo=UTC),
        activated_at=datetime(2026, 8, 27, 9, 0, tzinfo=UTC),
        sha256="5071d15f1877bc8feb67cf2e78ae2e218c7dff404e0f0161458e72ae90958e10",
        review_kind="HALAL_DOMAIN_REVIEW",
    )
    concepts = (
        HalalReferenceConcept(
            id="concept-synthetic-porcine",
            name="Porcine ingredients",
            condition_family="HALAL_INGREDIENT",
            parent_id=None,
            is_leaf=True,
            description="Synthetic concept for porcine-derived ingredients.",
        ),
        HalalReferenceConcept(
            id="concept-synthetic-gelatin",
            name="Gelatin (source unspecified)",
            condition_family="HALAL_INGREDIENT",
            parent_id=None,
            is_leaf=True,
            description="Synthetic concept for source-ambiguous gelatin.",
        ),
    )
    mappings = (
        HalalReferenceLexicalMapping(
            id="map-synthetic-pork-en",
            concept_id="concept-synthetic-porcine",
            language="en",
            mapped_text="pork",
            relationship_type=HalalRelationshipType.EXACT_NAME,
            notes="Direct English name for pork.",
        ),
        HalalReferenceLexicalMapping(
            id="map-synthetic-gelatin-en",
            concept_id="concept-synthetic-gelatin",
            language="en",
            mapped_text="gelatin",
            relationship_type=HalalRelationshipType.EXACT_NAME,
            notes="Direct English name for gelatin.",
        ),
    )
    halal_ingredient_mappings = (
        HalalReferenceIngredientMapping(
            id="halal-map-synthetic-porcine",
            concept_id="concept-synthetic-porcine",
            classification="EXPLICIT_PROHIBITED",
            citations=(
                HalalSourceCitation(
                    source_id="source-synthetic-halal-standard-2026",
                    jurisdiction="CAMBODIA",
                    edition="2026 Edition",
                    locator="Article 4.1",
                    notes="Synthetic rule prohibiting porcine ingredients.",
                ),
            ),
            notes="Explicit prohibited porcine classification.",
        ),
        HalalReferenceIngredientMapping(
            id="halal-map-synthetic-gelatin",
            concept_id="concept-synthetic-gelatin",
            classification="SOURCE_AMBIGUOUS",
            citations=(
                HalalSourceCitation(
                    source_id="source-synthetic-halal-standard-2026",
                    jurisdiction="CAMBODIA",
                    edition="2026 Edition",
                    locator="Section 5.3",
                    notes="Synthetic rule for source-dependent gelatin ambiguity.",
                ),
            ),
            notes="Source-ambiguous gelatin classification.",
        ),
    )
    return ActiveHalalReferenceData(
        version=version,
        concepts=concepts,
        mappings=mappings,
        halal_ingredient_mappings=halal_ingredient_mappings,
    )


class StubHalalReferenceDataAccess:
    def __init__(self, data: ActiveHalalReferenceData | None = None) -> None:
        self._data = data

    def get_active_version(self) -> HalalAssessmentReferenceVersion | None:
        return self._data.version if self._data is not None else None

    def get_active_data(self) -> ActiveHalalReferenceData | None:
        return self._data


def test_database_halal_reference_data_access_returns_none_when_no_active_pointer(
    db_session_factory,
) -> None:
    access = DatabaseHalalReferenceDataAccess(db_session_factory)
    assert access.get_active_version() is None
    assert access.get_active_data() is None


def test_database_halal_reference_data_access_loads_active_data_with_citations(
    db_session_factory,
) -> None:
    fixture_path = (
        Path(__file__).parent
        / "fixtures"
        / "reference_datasets"
        / "synthetic_halal_ingredient_bundle.json"
    )
    bundle = load_reference_bundle(fixture_path)
    assert isinstance(bundle, HalalIngredientReferenceBundle)
    exclusions = [
        LexicalExclusionDefinition(
            id="exclude-synthetic-pork-free-en",
            concept_id="concept-synthetic-porcine",
            language="en",
            excluded_text="pork-free",
        )
    ]
    bundle = replace(
        bundle,
        manifest=replace(
            bundle.manifest,
            sha256=compute_halal_bundle_sha256(
                manifest=bundle.manifest,
                sources=bundle.sources,
                concepts=bundle.concepts,
                mappings=bundle.mappings,
                exclusions=exclusions,
                halal_ingredient_mappings=bundle.halal_ingredient_mappings,
            ),
        ),
        exclusions=exclusions,
    )

    with db_session_factory() as session:
        import_reference_bundle(session, bundle)
        activate_reference_dataset_version(
            session,
            bundle.manifest.id,
            approver="halal-lead@lifegoods.org",
        )

    access = DatabaseHalalReferenceDataAccess(db_session_factory)
    version = access.get_active_version()
    assert version is not None
    assert version.id == "synthetic-halal-ingredient-2026-v1"
    assert version.dataset_kind == "HALAL_INGREDIENT"
    assert version.review_kind == "HALAL_DOMAIN_REVIEW"

    active_data = access.get_active_data()
    assert active_data is not None
    assert active_data.version == version
    assert len(active_data.concepts) == 2
    assert len(active_data.mappings) == 2
    assert len(active_data.exclusions) == 1
    assert active_data.exclusions[0].excluded_text == "pork-free"
    assert len(active_data.halal_ingredient_mappings) == 2

    evaluator = StandardHalalIngredientAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=access,
    )
    evaluation = evaluator.evaluate(
        sample_record(
            ingredient_texts=(
                SourcedValue(
                    value="Pork-free gelatin",
                    source_field="ingredients_text_en",
                    language="en",
                ),
            )
        )
    )
    assert evaluation.outcome == HalalIngredientAssessmentOutcome.SOURCE_AMBIGUOUS
    assert [finding.matched_text for finding in evaluation.findings] == ["gelatin"]

    porcine_mapping = next(
        m
        for m in active_data.halal_ingredient_mappings
        if m.concept_id == "concept-synthetic-porcine"
    )
    assert porcine_mapping.classification == "EXPLICIT_PROHIBITED"
    assert len(porcine_mapping.citations) == 1
    assert porcine_mapping.citations[0].locator == "Article 4.1"
    assert porcine_mapping.citations[0].source_id == "source-synthetic-halal-standard-2026"
    assert porcine_mapping.citations[0].jurisdiction == "CAMBODIA"
    assert porcine_mapping.citations[0].edition == "2026 Edition"

    gelatin_mapping = next(
        m
        for m in active_data.halal_ingredient_mappings
        if m.concept_id == "concept-synthetic-gelatin"
    )
    assert gelatin_mapping.classification == "SOURCE_AMBIGUOUS"
    assert len(gelatin_mapping.citations) == 1
    assert gelatin_mapping.citations[0].locator == "Section 5.3"


def test_database_halal_reference_data_access_caches_by_version_and_activation(
    db_session_factory,
) -> None:
    fixture_path = (
        Path(__file__).parent
        / "fixtures"
        / "reference_datasets"
        / "synthetic_halal_ingredient_bundle.json"
    )
    bundle = load_reference_bundle(fixture_path)
    with db_session_factory() as session:
        import_reference_bundle(session, bundle)
        activate_reference_dataset_version(
            session,
            bundle.manifest.id,
            approver="halal-lead@lifegoods.org",
        )

    access = DatabaseHalalReferenceDataAccess(db_session_factory)
    data1 = access.get_active_data()
    data2 = access.get_active_data()
    assert data1 is not None
    assert data1 is data2


def test_disabled_halal_evaluator_returns_not_assessed_with_feature_disabled() -> None:
    evaluator = DisabledHalalIngredientAssessmentEvaluator()
    record = sample_record()
    evaluation = evaluator.evaluate(record)

    assert evaluation.status == HalalIngredientAssessmentStatus.NOT_ASSESSED
    assert evaluation.reason == HalalIngredientAssessmentReason.FEATURE_DISABLED
    assert evaluation.outcome == HalalIngredientAssessmentOutcome.NOT_ASSESSED
    assert evaluation.evidence_coverage == EvidenceCoverageState.NOT_ASSESSED
    assert evaluation.engine_version is None
    assert evaluation.reference_dataset_version is None
    assert evaluation.checked_evidence == ()
    assert evaluation.findings == ()


def test_standard_halal_evaluator_when_disabled_returns_disabled_evaluation() -> None:
    evaluator = StandardHalalIngredientAssessmentEvaluator(enabled=False)
    record = sample_record()
    evaluation = evaluator.evaluate(record)

    assert evaluation.status == HalalIngredientAssessmentStatus.NOT_ASSESSED
    assert evaluation.reason == HalalIngredientAssessmentReason.FEATURE_DISABLED
    assert evaluation.outcome == HalalIngredientAssessmentOutcome.NOT_ASSESSED


def test_standard_halal_evaluator_when_reference_data_unavailable_returns_not_assessed() -> None:
    evaluator = StandardHalalIngredientAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubHalalReferenceDataAccess(None),
    )
    record = sample_record()
    evaluation = evaluator.evaluate(record)

    assert evaluation.status == HalalIngredientAssessmentStatus.NOT_ASSESSED
    assert evaluation.reason == HalalIngredientAssessmentReason.REFERENCE_UNAVAILABLE
    assert evaluation.outcome == HalalIngredientAssessmentOutcome.NOT_ASSESSED
    assert evaluation.engine_version == "0.1.0"
    assert evaluation.reference_dataset_version is None


def test_standard_halal_evaluator_when_no_english_ingredients_returns_evidence_unavailable(
) -> None:
    active_data = sample_active_halal_reference_data()
    evaluator = StandardHalalIngredientAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubHalalReferenceDataAccess(active_data),
    )
    record = sample_record(
        ingredient_texts=(
            SourcedValue(
                value="Farine de blé, sel",
                source_field="ingredients_text_fr",
                language="fr",
            ),
        )
    )
    evaluation = evaluator.evaluate(record)

    assert evaluation.status == HalalIngredientAssessmentStatus.NOT_ASSESSED
    assert evaluation.reason == HalalIngredientAssessmentReason.EVIDENCE_UNAVAILABLE
    assert evaluation.outcome == HalalIngredientAssessmentOutcome.NOT_ASSESSED
    assert evaluation.reference_dataset_version == active_data.version
    assert evaluation.checked_evidence == ()
    assert evaluation.findings == ()


@pytest.mark.parametrize(
    "ingredient_texts",
    [
        (),
        (
            SourcedValue(
                value="   ",
                source_field="ingredients_text_en",
                language="en",
            ),
        ),
    ],
)
def test_standard_halal_evaluator_when_english_evidence_is_missing_or_empty(
    ingredient_texts: tuple[SourcedValue[str], ...],
) -> None:
    active_data = sample_active_halal_reference_data()
    evaluator = StandardHalalIngredientAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubHalalReferenceDataAccess(active_data),
    )

    evaluation = evaluator.evaluate(sample_record(ingredient_texts=ingredient_texts))

    assert evaluation.status == HalalIngredientAssessmentStatus.NOT_ASSESSED
    assert evaluation.reason == HalalIngredientAssessmentReason.EVIDENCE_UNAVAILABLE
    assert evaluation.outcome == HalalIngredientAssessmentOutcome.NOT_ASSESSED
    assert evaluation.evidence_coverage == EvidenceCoverageState.NOT_ASSESSED


def test_standard_halal_evaluator_ignores_product_name_categories_and_halal_claims() -> None:
    active_data = sample_active_halal_reference_data()
    evaluator = StandardHalalIngredientAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubHalalReferenceDataAccess(active_data),
    )
    # Product name mentions pork, label claims halal, but ingredient text has no matches
    record = sample_record(
        product_name="Pork Sausage Roll",
        halal_claim=("en:halal",),
        ingredient_texts=(
            SourcedValue(
                value="Wheat flour, water, vegetable oil, salt",
                source_field="ingredients_text_en",
                language="en",
            ),
        ),
    )
    evaluation = evaluator.evaluate(record)

    assert evaluation.status == HalalIngredientAssessmentStatus.COMPLETED
    assert evaluation.reason is None
    assert (
        evaluation.outcome
        == HalalIngredientAssessmentOutcome.NO_NON_HALAL_INGREDIENT_DETECTED_IN_READABLE_LABEL
    )
    assert evaluation.evidence_coverage == EvidenceCoverageState.PARTIAL
    assert evaluation.findings == ()
    assert len(evaluation.checked_evidence) == 1
    assert evaluation.checked_evidence[0].field == "ingredient_text"
    assert evaluation.checked_evidence[0].value == "Wheat flour, water, vegetable oil, salt"


def test_exact_prohibited_ingredient_declared_outcome_and_provenance() -> None:
    active_data = sample_active_halal_reference_data()
    evaluator = StandardHalalIngredientAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubHalalReferenceDataAccess(active_data),
    )
    record = sample_record(
        ingredient_texts=(
            SourcedValue(
                value="Wheat flour, pork lard, salt",
                source_field="ingredients_text_en",
                language="en",
            ),
        )
    )
    evaluation = evaluator.evaluate(record)

    assert evaluation.status == HalalIngredientAssessmentStatus.COMPLETED
    assert evaluation.reason is None
    assert (
        evaluation.outcome
        == HalalIngredientAssessmentOutcome.EXPLICIT_PROHIBITED_INGREDIENT_DECLARED
    )
    assert evaluation.evidence_coverage == EvidenceCoverageState.PARTIAL
    assert evaluation.engine_version == "0.1.0"
    assert evaluation.reference_dataset_version == active_data.version
    assert len(evaluation.checked_evidence) == 1
    assert len(evaluation.findings) == 1

    finding = evaluation.findings[0]
    assert finding.id == "finding-synthetic-halal-ingredient-2026-v1-map-synthetic-pork-en-13-17"
    assert finding.concept_id == "concept-synthetic-porcine"
    assert finding.mapping_id == "map-synthetic-pork-en"
    assert finding.halal_mapping_id == "halal-map-synthetic-porcine"
    assert finding.classification == "EXPLICIT_PROHIBITED"
    assert finding.relationship_type == HalalRelationshipType.EXACT_NAME
    assert finding.matched_text == "pork"
    assert finding.source_text == "Wheat flour, pork lard, salt"
    assert finding.start_index == 13
    assert finding.end_index == 17
    assert finding.language == "en"
    assert len(finding.citations) == 1
    assert finding.citations[0].source_id == "source-synthetic-halal-standard-2026"
    assert finding.citations[0].locator == "Article 4.1"
    assert finding.citations[0].jurisdiction == "CAMBODIA"
    assert finding.citations[0].edition == "2026 Edition"
    assert finding.source_field == "ingredients_text_en"
    assert finding.source_url == record.source_url
    assert finding.source_revision == record.source_revision
    assert finding.off_dataset_version_id == record.dataset_version.id
    assert finding.reference_dataset_version_id == "synthetic-halal-ingredient-2026-v1"
    assert finding.engine_version == "0.1.0"


def test_source_ambiguous_ingredient_declared_outcome() -> None:
    active_data = sample_active_halal_reference_data()
    evaluator = StandardHalalIngredientAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubHalalReferenceDataAccess(active_data),
    )
    record = sample_record(
        ingredient_texts=(
            SourcedValue(
                value="Sugar, gelatin, natural flavor",
                source_field="ingredients_text_en",
                language="en",
            ),
        )
    )
    evaluation = evaluator.evaluate(record)

    assert evaluation.status == HalalIngredientAssessmentStatus.COMPLETED
    assert evaluation.outcome == HalalIngredientAssessmentOutcome.SOURCE_AMBIGUOUS
    assert len(evaluation.findings) == 1
    assert evaluation.findings[0].classification == "SOURCE_AMBIGUOUS"
    assert evaluation.findings[0].matched_text == "gelatin"
    assert evaluation.findings[0].citations[0].locator == "Section 5.3"


def test_normalization_preserves_exact_unicode_source_spans() -> None:
    active_data = sample_active_halal_reference_data()
    evaluator = StandardHalalIngredientAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubHalalReferenceDataAccess(active_data),
    )
    source_text = "Salt，ＰＯＲＫ； gelatin"

    evaluation = evaluator.evaluate(
        sample_record(
            ingredient_texts=(
                SourcedValue(
                    value=source_text,
                    source_field="ingredients_text_en",
                    language="en",
                ),
            )
        )
    )

    assert [finding.matched_text for finding in evaluation.findings] == [
        "ＰＯＲＫ",
        "gelatin",
    ]
    for finding in evaluation.findings:
        assert source_text[finding.start_index : finding.end_index] == finding.matched_text


def test_word_boundaries_reject_contained_mapping_text() -> None:
    active_data = sample_active_halal_reference_data()
    evaluator = StandardHalalIngredientAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubHalalReferenceDataAccess(active_data),
    )

    evaluation = evaluator.evaluate(
        sample_record(
            ingredient_texts=(
                SourcedValue(
                    value="Porkpie, gelatinous starch",
                    source_field="ingredients_text_en",
                    language="en",
                ),
            )
        )
    )

    assert (
        evaluation.outcome
        == HalalIngredientAssessmentOutcome.NO_NON_HALAL_INGREDIENT_DETECTED_IN_READABLE_LABEL
    )
    assert evaluation.evidence_coverage == EvidenceCoverageState.PARTIAL
    assert evaluation.findings == ()


def test_both_prohibited_and_ambiguous_yields_explicit_prohibited_outcome() -> None:
    active_data = sample_active_halal_reference_data()
    evaluator = StandardHalalIngredientAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubHalalReferenceDataAccess(active_data),
    )
    record = sample_record(
        ingredient_texts=(
            SourcedValue(
                value="Pork broth, gelatin, salt",
                source_field="ingredients_text_en",
                language="en",
            ),
        )
    )
    evaluation = evaluator.evaluate(record)

    assert evaluation.status == HalalIngredientAssessmentStatus.COMPLETED
    assert (
        evaluation.outcome
        == HalalIngredientAssessmentOutcome.EXPLICIT_PROHIBITED_INGREDIENT_DECLARED
    )
    assert len(evaluation.findings) == 2


def test_concept_scoped_exclusion_suppresses_only_its_concept() -> None:
    active_data = sample_active_halal_reference_data()
    active_data = replace(
        active_data,
        exclusions=(
            HalalReferenceExclusion(
                id="exclude-synthetic-pork-gelatin",
                concept_id="concept-synthetic-porcine",
                language="en",
                excluded_text="pork gelatin",
            ),
        ),
    )
    evaluator = StandardHalalIngredientAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubHalalReferenceDataAccess(active_data),
    )

    evaluation = evaluator.evaluate(
        sample_record(
            ingredient_texts=(
                SourcedValue(
                    value="Sugar, pork gelatin, salt",
                    source_field="ingredients_text_en",
                    language="en",
                ),
            )
        )
    )

    assert evaluation.outcome == HalalIngredientAssessmentOutcome.SOURCE_AMBIGUOUS
    assert [finding.matched_text for finding in evaluation.findings] == ["gelatin"]
    assert evaluation.findings[0].concept_id == "concept-synthetic-gelatin"


def test_longest_match_wins_without_hiding_separate_occurrences() -> None:
    active_data = sample_active_halal_reference_data()
    active_data = replace(
        active_data,
        mappings=(
            *active_data.mappings,
            HalalReferenceLexicalMapping(
                id="map-synthetic-pork-lard-en",
                concept_id="concept-synthetic-porcine",
                language="en",
                mapped_text="pork lard",
                relationship_type=HalalRelationshipType.CONTAINS_SOURCE,
            ),
        ),
    )
    evaluator = StandardHalalIngredientAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubHalalReferenceDataAccess(active_data),
    )

    evaluation = evaluator.evaluate(
        sample_record(
            ingredient_texts=(
                SourcedValue(
                    value="Pork lard, gelatin, pork",
                    source_field="ingredients_text_en",
                    language="en",
                ),
            )
        )
    )

    assert [finding.matched_text for finding in evaluation.findings] == [
        "Pork lard",
        "gelatin",
        "pork",
    ]
    assert evaluation.findings[0].mapping_id == "map-synthetic-pork-lard-en"


def test_repeated_occurrences_and_multiple_english_fields_keep_provenance() -> None:
    active_data = sample_active_halal_reference_data()
    evaluator = StandardHalalIngredientAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubHalalReferenceDataAccess(active_data),
    )
    record = sample_record(
        ingredient_texts=(
            SourcedValue(
                value="Pork, pork",
                source_field="ingredients_text_en",
                language="en",
            ),
            SourcedValue(
                value="Pork, gelatin",
                source_field="ingredients_text_en_imported",
                language="en-GB",
            ),
        )
    )

    first = evaluator.evaluate(record)
    second = evaluator.evaluate(record)

    assert [finding.matched_text for finding in first.findings] == [
        "Pork",
        "pork",
        "Pork",
        "gelatin",
    ]
    assert [finding.source_field for finding in first.findings] == [
        "ingredients_text_en",
        "ingredients_text_en",
        "ingredients_text_en_imported",
        "ingredients_text_en_imported",
    ]
    assert len({finding.id for finding in first.findings}) == 4
    assert first.findings == second.findings


@pytest.mark.parametrize("halal_claim", [None, (), ("en:halal",)])
def test_halal_label_claim_does_not_change_prohibited_outcome(
    halal_claim: tuple[str, ...] | None,
) -> None:
    active_data = sample_active_halal_reference_data()
    evaluator = StandardHalalIngredientAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubHalalReferenceDataAccess(active_data),
    )

    evaluation = evaluator.evaluate(sample_record(halal_claim=halal_claim))

    assert (
        evaluation.outcome
        == HalalIngredientAssessmentOutcome.EXPLICIT_PROHIBITED_INGREDIENT_DECLARED
    )
    assert [finding.matched_text for finding in evaluation.findings] == ["pork"]


def test_evaluator_exception_returns_assessment_failed() -> None:
    class FailingMatcher:
        def match(self, **kwargs):
            raise RuntimeError("Unexpected failure during matching")

    active_data = sample_active_halal_reference_data()
    evaluator = StandardHalalIngredientAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubHalalReferenceDataAccess(active_data),
        matcher=FailingMatcher(),
    )
    record = sample_record()
    evaluation = evaluator.evaluate(record)

    assert evaluation.status == HalalIngredientAssessmentStatus.NOT_ASSESSED
    assert evaluation.reason == HalalIngredientAssessmentReason.ASSESSMENT_FAILED
    assert evaluation.outcome == HalalIngredientAssessmentOutcome.NOT_ASSESSED
    assert evaluation.reference_dataset_version == active_data.version


def test_serialize_and_deserialize_halal_assessment_evaluation() -> None:
    from lifegoods.package_matches.cache import (
        deserialize_halal_assessment_evaluation,
        serialize_halal_assessment_evaluation,
    )

    active_data = sample_active_halal_reference_data()
    evaluator = StandardHalalIngredientAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubHalalReferenceDataAccess(active_data),
    )
    record = sample_record()
    evaluation = evaluator.evaluate(record)

    serialized = serialize_halal_assessment_evaluation(evaluation)
    assert isinstance(serialized, str)

    deserialized = deserialize_halal_assessment_evaluation(serialized)
    assert deserialized == evaluation


def test_redis_halal_assessment_cache_roundtrip() -> None:
    from lifegoods.package_matches.cache import (
        RedisHalalIngredientAssessmentCache,
    )

    class FakeRedisClient:
        def __init__(self) -> None:
            self.store: dict[str, str] = {}

        def get(self, name: str) -> str | None:
            return self.store.get(name)

        def set(self, name: str, value: str, ex: int | None = None) -> None:
            self.store[name] = value

    fake_redis = FakeRedisClient()
    cache = RedisHalalIngredientAssessmentCache(fake_redis)

    active_data = sample_active_halal_reference_data()
    evaluator = StandardHalalIngredientAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubHalalReferenceDataAccess(active_data),
    )
    record = sample_record()
    evaluation = evaluator.evaluate(record)

    cache.set("test-key", evaluation)
    cached = cache.get("test-key")
    assert cached == evaluation


def test_evaluator_with_cache_stores_and_retrieves_evaluation() -> None:
    from lifegoods.package_matches.cache import (
        RedisHalalIngredientAssessmentCache,
    )

    class FakeRedisClient:
        def __init__(self) -> None:
            self.store: dict[str, str] = {}

        def get(self, name: str) -> str | None:
            return self.store.get(name)

        def set(self, name: str, value: str, ex: int | None = None) -> None:
            self.store[name] = value

    fake_redis = FakeRedisClient()
    cache = RedisHalalIngredientAssessmentCache(fake_redis)

    active_data = sample_active_halal_reference_data()
    evaluator = StandardHalalIngredientAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubHalalReferenceDataAccess(active_data),
        cache=cache,
    )
    record = sample_record()
    eval1 = evaluator.evaluate(record)
    assert eval1.status == HalalIngredientAssessmentStatus.COMPLETED
    assert len(fake_redis.store) == 1

    eval2 = evaluator.evaluate(record)
    assert eval2 == eval1


def test_evaluator_rejects_cached_finding_with_mismatched_mapping_provenance() -> None:
    active_data = sample_active_halal_reference_data()
    record = sample_record()
    uncached_evaluator = StandardHalalIngredientAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubHalalReferenceDataAccess(active_data),
    )
    valid_evaluation = uncached_evaluator.evaluate(record)
    invalid_finding = replace(
        valid_evaluation.findings[0],
        relationship_type=HalalRelationshipType.SPELLING_VARIANT,
        halal_mapping_id="halal-map-wrong",
    )
    invalid_evaluation = replace(valid_evaluation, findings=(invalid_finding,))

    class InvalidCache:
        def __init__(self) -> None:
            self.stored: HalalIngredientAssessmentEvaluation | None = None

        def get(self, key: str) -> HalalIngredientAssessmentEvaluation:
            return invalid_evaluation

        def set(self, key: str, value: HalalIngredientAssessmentEvaluation) -> None:
            self.stored = value

    cache = InvalidCache()
    evaluator = StandardHalalIngredientAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubHalalReferenceDataAccess(active_data),
        cache=cache,
    )

    evaluation = evaluator.evaluate(record)

    assert evaluation == valid_evaluation
    assert cache.stored == valid_evaluation
