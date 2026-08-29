from dataclasses import asdict, replace
from datetime import UTC, datetime
from pathlib import Path

import pytest

from lifegoods.open_food_facts.models import (
    ExternalDatasetVersion,
    ExternalPackageRecord,
    ExternalSourceMetadata,
    SourcedValue,
)
from lifegoods.package_matches.assessments import (
    AllergenAssessmentEvaluation,
    AllergenAssessmentOutcome,
    AllergenAssessmentReason,
    AllergenAssessmentStatus,
    AllergenFinding,
    DefaultAllergenDeterministicMatcher,
    DefaultOffAllergenEvidenceExtractor,
    DisabledAllergenAssessmentEvaluator,
    EvidenceCoverageState,
    StandardAllergenAssessmentEvaluator,
)
from lifegoods.package_matches.contracts import AllergenAssessmentResponse
from lifegoods.package_matches.models import PackageMatchSourceKind
from lifegoods.package_matches.router import _candidate_response
from lifegoods.package_matches.service import _candidate_from_record
from lifegoods.reference_datasets import (
    ActiveAllergenReferenceData,
    AllergenAssessmentReferenceVersion,
    AllergenReferenceConcept,
    AllergenReferenceExclusion,
    AllergenReferenceMapping,
    AllergenReferenceRule,
    DatabaseAllergenReferenceDataAccess,
)
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
from lifegoods.reference_datasets.lifecycle import activate_reference_dataset_version

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


def sample_record() -> ExternalPackageRecord:
    return ExternalPackageRecord(
        identifier="4006381333931",
        source=OFF_SOURCE,
        source_record_id="4006381333931",
        request_url="https://world.openfoodfacts.org/api/v2/product/4006381333931",
        source_url="https://world.openfoodfacts.org/product/4006381333931",
        names=(
            SourcedValue(
                value="Dark chocolate",
                source_field="product_name_en",
                language="en",
            ),
        ),
        brands=SourcedValue(value=("Example Foods",), source_field="brands"),
        quantity=SourcedValue(value="100 g", source_field="quantity"),
        ingredient_texts=(
            SourcedValue(
                value="Cocoa mass, sugar, cocoa butter, milk powder",
                source_field="ingredients_text_en",
                language="en",
            ),
        ),
        allergen_declaration=SourcedValue(
            value="Contains milk", source_field="allergens", language="en"
        ),
        allergen_tags=SourcedValue(value=("en:milk",), source_field="allergens_tags"),
        trace_declaration=SourcedValue(
            value="May contain nuts", source_field="traces", language="en"
        ),
        trace_tags=SourcedValue(value=("en:nuts",), source_field="traces_tags"),
        additives=None,
        storage_conditions=(),
        manufacturing_places=None,
        halal_label_claim=None,
        packaging_languages=None,
        countries_sold=None,
        nutrition=(),
        selected_images=(),
        retrieved_at=datetime(2026, 8, 27, 8, 0, tzinfo=UTC),
        source_revision="1787462400",
        dataset_version=DATASET_VERSION,
    )


def test_disabled_evaluator_returns_not_assessed_with_feature_disabled() -> None:
    evaluator = DisabledAllergenAssessmentEvaluator()
    record = sample_record()
    evaluation = evaluator.evaluate(record)

    assert evaluation.status == AllergenAssessmentStatus.NOT_ASSESSED
    assert evaluation.reason == AllergenAssessmentReason.FEATURE_DISABLED
    assert evaluation.evidence_coverage == EvidenceCoverageState.NOT_ASSESSED
    assert evaluation.engine_version is None
    assert evaluation.reference_dataset_version is None
    assert evaluation.concepts == ()
    assert evaluation.findings == ()
    assert evaluation.source_signals == ()


def test_standard_evaluator_when_disabled_returns_disabled_evaluation() -> None:
    evaluator = StandardAllergenAssessmentEvaluator(enabled=False)
    record = sample_record()
    evaluation = evaluator.evaluate(record)

    assert evaluation.status == AllergenAssessmentStatus.NOT_ASSESSED
    assert evaluation.reason == AllergenAssessmentReason.FEATURE_DISABLED


def test_off_evidence_extractor_extracts_attributed_signals() -> None:
    extractor = DefaultOffAllergenEvidenceExtractor()
    record = sample_record()
    signals = extractor.extract_signals(record)

    fields = [signal.field for signal in signals]
    assert "allergen_declaration" in fields
    assert "allergen_tags" in fields
    assert "trace_declaration" in fields
    assert "trace_tags" in fields

    for signal in signals:
        assert signal.source_name == "Open Food Facts"
        assert signal.source_url == record.source_url
        assert signal.dataset_version_id == DATASET_VERSION.id


def test_candidate_response_maps_allergen_assessment_cleanly() -> None:
    record = sample_record()
    evaluator = DisabledAllergenAssessmentEvaluator()
    candidate = _candidate_from_record(record, allergen_evaluator=evaluator)
    response = _candidate_response(candidate)

    assert response.source_kind == PackageMatchSourceKind.OPEN_FOOD_FACTS
    assert isinstance(response.allergen_assessment, AllergenAssessmentResponse)
    assert response.allergen_assessment.status == "NOT_ASSESSED"
    assert response.allergen_assessment.reason == "FEATURE_DISABLED"
    assert response.allergen_assessment.evidence_coverage == "NOT_ASSESSED"
    assert response.allergen_assessment.concepts == []
    assert response.allergen_assessment.findings == []
    assert response.allergen_assessment.reference_dataset_version is None


def test_evaluation_contains_no_run_id_or_fingerprint() -> None:
    evaluation = AllergenAssessmentEvaluation()
    dumped = asdict(evaluation)
    assert "run_id" not in dumped
    assert "evaluation_fingerprint" not in dumped
    assert "shopper_id" not in dumped
    assert "user_id" not in dumped
    assert "preferences" not in dumped


def test_evaluation_enforces_status_reason_combinations() -> None:
    default_evaluation = AllergenAssessmentEvaluation()
    assert default_evaluation.status == AllergenAssessmentStatus.NOT_ASSESSED
    assert default_evaluation.reason == AllergenAssessmentReason.FEATURE_DISABLED

    with pytest.raises(ValueError, match="COMPLETED evaluations require a null reason"):
        AllergenAssessmentEvaluation(
            status=AllergenAssessmentStatus.COMPLETED,
            reason=AllergenAssessmentReason.FEATURE_DISABLED,
        )

    with pytest.raises(ValueError, match="NOT_ASSESSED evaluations require a reason"):
        AllergenAssessmentEvaluation(
            status=AllergenAssessmentStatus.NOT_ASSESSED,
            reason=None,
        )


def test_database_allergen_reference_data_access(tmp_path, monkeypatch) -> None:
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import create_engine, event
    from sqlalchemy.orm import sessionmaker

    db_path = tmp_path / "test_access.db"
    db_url = f"sqlite+pysqlite:///{db_path}"
    monkeypatch.setenv("LIFEGOODS_DATABASE_URL", db_url)
    config = Config("backend/alembic.ini")
    command.upgrade(config, "head")

    engine = create_engine(db_url)
    factory = sessionmaker(engine, expire_on_commit=False)

    access = DatabaseAllergenReferenceDataAccess(factory)
    assert access.get_active_version() is None

    # Import and activate a bundle
    manifest = ReferenceDatasetManifest(
        id="codex-food-allergen-2026-minimal",
        dataset_kind=ConditionFamily.FOOD_ALLERGEN,
        edition="CXS 1-1985 (Amended 2026)",
        jurisdiction="INTERNATIONAL",
        source_url="https://www.fao.org/fao-who-codexalimentarius/standards/cxs1-1985",
        licensing_decision="PUBLIC_GOVERNMENT_STANDARD",
        project_approver="food-reviewer@lifegoods.org",
        review_kind=ReferenceReviewKind.FOOD_DOMAIN_REVIEW,
        sha256="",
    )
    sources = [
        ReferenceSourceDefinition(
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
            id="map-en-milk-exact",
            concept_id="concept-food-allergen-milk",
            language="en",
            mapped_text="milk",
            relationship_type="EXACT_NAME",
            notes="Direct milk declaration",
        )
    ]
    rules = [
        AllergenRuleDefinition(
            id="rule-codex-2026-milk",
            concept_id="concept-food-allergen-milk",
            source_id="source-codex-cxs-1-1985-2026",
            rule_kind="MANDATORY_DECLARATION",
            condition_family=ConditionFamily.FOOD_ALLERGEN,
            description="Codex CXS 1-1985 mandatory allergen declaration for milk",
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
    bundle = ReferenceBundle(
        manifest=manifest_with_hash,
        sources=sources,
        concepts=concepts,
        mappings=mappings,
        rules=rules,
    )

    with factory() as session:
        import_reference_bundle(session, bundle)
        activate_reference_dataset_version(session, bundle.manifest.id)

    statements: list[str] = []

    def record_statement(*args) -> None:
        statements.append(args[2])

    event.listen(engine, "before_cursor_execute", record_statement)
    active = access.get_active_version()
    cold_query_count = len(statements)
    assert active is not None
    assert active.id == "codex-food-allergen-2026-minimal"
    assert active.source_url == bundle.manifest.source_url
    assert active.dataset_kind == "FOOD_ALLERGEN"
    assert active.review_kind == ReferenceReviewKind.FOOD_DOMAIN_REVIEW
    assert active.sha256 == sha256

    active_data = access.get_active_data()
    assert active_data is not None
    assert active_data.version == active
    assert len(active_data.concepts) == 1
    assert active_data.concepts[0].id == "concept-food-allergen-milk"
    assert active_data.concepts[0].name == "Milk and milk products"
    assert len(active_data.mappings) == 1
    assert active_data.mappings[0].id == "map-en-milk-exact"
    assert active_data.mappings[0].mapped_text == "milk"
    assert len(active_data.rules) == 1
    assert active_data.rules[0].id == "rule-codex-2026-milk"
    assert cold_query_count == 5
    assert len(statements) == cold_query_count + 1

    def unavailable_session():
        raise RuntimeError("database unavailable")

    from unittest.mock import MagicMock

    from lifegoods.reference_datasets import access as access_module

    warning = MagicMock()
    monkeypatch.setattr(access_module.logger, "warning", warning)
    monkeypatch.setattr(access, "_session_factory", unavailable_session)
    assert access.get_active_data() is None

    assert warning.call_args.kwargs["extra"]["event"] == "reference_dataset_unavailable"
    assert warning.call_args.kwargs["extra"]["error_category"] == "RuntimeError"


def sample_reference_data() -> ActiveAllergenReferenceData:
    version = AllergenAssessmentReferenceVersion(
        id="codex-food-allergen-2026-minimal",
        source_url="https://www.fao.org/fao-who-codexalimentarius/standards/cxs1-1985",
        retrieved_at=datetime(2026, 8, 27, 8, 0, tzinfo=UTC),
        activated_at=datetime(2026, 8, 27, 9, 0, tzinfo=UTC),
        sha256="d" * 64,
        review_kind="FOOD_DOMAIN_REVIEW",
        dataset_kind="FOOD_ALLERGEN",
    )
    concepts = (
        AllergenReferenceConcept(
            id="concept-food-allergen-milk",
            name="Milk and milk products",
            condition_family="FOOD_ALLERGEN",
            parent_id=None,
            is_leaf=True,
            description="Milk and ingredients derived from milk, including lactose.",
        ),
    )
    mappings = (
        AllergenReferenceMapping(
            id="map-en-milk-exact",
            concept_id="concept-food-allergen-milk",
            language="en",
            mapped_text="milk",
            relationship_type="EXACT_NAME",
            notes="Direct English name for milk allergen",
        ),
        AllergenReferenceMapping(
            id="map-en-whey-derived",
            concept_id="concept-food-allergen-milk",
            language="en",
            mapped_text="whey",
            relationship_type="DERIVED_FROM",
            notes="Clear dairy derivative mapped to milk allergen",
        ),
        AllergenReferenceMapping(
            id="map-km-milk-exact",
            concept_id="concept-food-allergen-milk",
            language="km",
            mapped_text="ទឹកដោះគោ",
            relationship_type="EXACT_NAME",
            notes="Khmer milk mapping",
        ),
    )
    rules = (
        AllergenReferenceRule(
            id="rule-codex-2026-milk",
            concept_id="concept-food-allergen-milk",
            source_id="source-codex-cxs-1-1985-2026",
            rule_kind="MANDATORY_DECLARATION",
            condition_family="FOOD_ALLERGEN",
            description="Codex CXS 1-1985 Section 4.2.1.4 mandatory declaration for milk",
        ),
        AllergenReferenceRule(
            id="rule-lifegoods-whey-milk-derivative",
            concept_id="concept-food-allergen-milk",
            source_id="source-lifegoods-reviewed-allergen-mappings-issue-63",
            rule_kind="DERIVATIVE_MATCH",
            condition_family="FOOD_ALLERGEN",
            mapping_id="map-en-whey-derived",
            description="Reviewed whey-to-milk derivative mapping",
        ),
    )
    exclusions = (
        AllergenReferenceExclusion(
            id="exclude-en-coconut-milk-for-milk",
            concept_id="concept-food-allergen-milk",
            language="en",
            excluded_text="coconut milk",
            notes="Coconut milk is not mammalian milk.",
        ),
    )

    return ActiveAllergenReferenceData(
        version=version,
        concepts=concepts,
        mappings=mappings,
        exclusions=exclusions,
        rules=rules,
    )


REVIEWED_ENGLISH_BUNDLE_PATH = (
    Path(__file__).parents[1]
    / "src"
    / "lifegoods"
    / "reference_datasets"
    / "bundles"
    / "codex_2026_food_allergen_reviewed_english_v1.json"
)


def reviewed_english_reference_data() -> ActiveAllergenReferenceData:
    bundle = ReferenceBundle.from_json_file(REVIEWED_ENGLISH_BUNDLE_PATH)
    return ActiveAllergenReferenceData(
        version=AllergenAssessmentReferenceVersion(
            id=bundle.manifest.id,
            source_url=bundle.manifest.source_url,
            retrieved_at=datetime(2026, 8, 29, 8, 0, tzinfo=UTC),
            activated_at=datetime(2026, 8, 29, 9, 0, tzinfo=UTC),
            sha256=bundle.manifest.sha256,
            review_kind=bundle.manifest.review_kind,
            dataset_kind=bundle.manifest.dataset_kind,
        ),
        concepts=tuple(
            AllergenReferenceConcept(**concept.to_dict()) for concept in bundle.concepts
        ),
        mappings=tuple(
            AllergenReferenceMapping(**mapping.to_dict()) for mapping in bundle.mappings
        ),
        exclusions=tuple(
            AllergenReferenceExclusion(**exclusion.to_dict())
            for exclusion in bundle.exclusions
        ),
        rules=tuple(AllergenReferenceRule(**rule.to_dict()) for rule in bundle.rules),
    )


@pytest.mark.parametrize(
    ("direct_name", "concept_id"),
    [
        ("almond", "concept-food-allergen-almond"),
        ("anchovy", "concept-food-allergen-anchovy"),
        ("Brazil nut", "concept-food-allergen-brazil-nut"),
        ("buckwheat", "concept-food-allergen-buckwheat"),
        ("cashew", "concept-food-allergen-cashew"),
        ("celery", "concept-food-allergen-celery"),
        ("cod", "concept-food-allergen-cod"),
        ("crustacea", "concept-food-allergen-crustacea"),
        ("egg", "concept-food-allergen-egg"),
        ("fish", "concept-food-allergen-fish"),
        ("hazelnut", "concept-food-allergen-hazelnut"),
        ("lupin", "concept-food-allergen-lupin"),
        ("macadamia", "concept-food-allergen-macadamia"),
        ("mackerel", "concept-food-allergen-mackerel"),
        ("milk", "concept-food-allergen-milk"),
        ("mustard", "concept-food-allergen-mustard"),
        ("peanut", "concept-food-allergen-peanut"),
        ("pecan", "concept-food-allergen-pecan"),
        ("pine nut", "concept-food-allergen-pine-nut"),
        ("pistachio", "concept-food-allergen-pistachio"),
        ("salmon", "concept-food-allergen-salmon"),
        ("sardine", "concept-food-allergen-sardine"),
        ("sesame", "concept-food-allergen-sesame"),
        ("soy", "concept-food-allergen-soy"),
        ("tuna", "concept-food-allergen-tuna"),
        ("walnut", "concept-food-allergen-walnut"),
    ],
)
def test_reviewed_english_release_matches_each_direct_name(
    direct_name: str, concept_id: str
) -> None:
    record = sample_record()
    findings = DefaultAllergenDeterministicMatcher().match(
        ingredient_text=SourcedValue(
            value=f"water, {direct_name}, salt",
            source_field="ingredients_text_en",
            language="en",
        ),
        record=record,
        reference_data=reviewed_english_reference_data(),
        engine_version="0.1.0",
    )

    assert [(finding.concept_id, finding.matched_text.casefold()) for finding in findings] == [
        (concept_id, direct_name.casefold())
    ]
    concept_slug = concept_id.removeprefix("concept-food-allergen-")
    assert findings[0].mapping_id == f"map-en-{concept_slug}-exact"
    assert findings[0].rule_id == f"rule-codex-2026-{concept_slug}"


@pytest.mark.parametrize(
    "ingredient_text",
    [
        "lactose",
        "wheat, rye, barley, oats",
        "sulphite, sulfite",
        "casein, groundnuts",
        "ទឹកដោះគោ",
    ],
)
def test_reviewed_english_release_does_not_match_unreviewed_terms(
    ingredient_text: str,
) -> None:
    findings = DefaultAllergenDeterministicMatcher().match(
        ingredient_text=SourcedValue(
            value=ingredient_text,
            source_field="ingredients_text_en",
            language="en",
        ),
        record=sample_record(),
        reference_data=reviewed_english_reference_data(),
        engine_version="0.1.0",
    )

    assert findings == ()


def test_release_evaluator_emits_only_leaves_with_ancestry_and_applicable_rules() -> None:
    reference_data = reviewed_english_reference_data()
    evaluator = StandardAllergenAssessmentEvaluator(
        enabled=True,
        reference_data=StubAllergenReferenceDataAccess(reference_data),
    )
    source_record = sample_record()
    record = replace(
        source_record,
        ingredient_texts=(
            SourcedValue(
                value="almond, cashew, walnut, cod, salmon",
                source_field="ingredients_text_en",
                language="en",
            ),
        ),
    )

    evaluation = evaluator.evaluate(record)

    assert len(evaluation.concepts) == 26
    assert [concept.concept_id for concept in evaluation.concepts] == sorted(
        concept.id for concept in reference_data.concepts if concept.is_leaf
    )
    assert not {
        "concept-food-allergen-root",
        "concept-food-allergen-fish-group",
        "concept-food-allergen-specific-tree-nuts",
    }.intersection(concept.concept_id for concept in evaluation.concepts)

    outcomes = {concept.concept_id: concept for concept in evaluation.concepts}
    assert outcomes["concept-food-allergen-almond"].parent_ids == (
        "concept-food-allergen-specific-tree-nuts",
        "concept-food-allergen-root",
    )
    assert outcomes["concept-food-allergen-almond"].rule_ids == (
        "rule-codex-2026-almond",
        "rule-codex-2026-derivative-exemption",
    )
    assert outcomes["concept-food-allergen-cod"].parent_ids == (
        "concept-food-allergen-fish-group",
        "concept-food-allergen-root",
    )
    assert outcomes["concept-food-allergen-cod"].rule_ids == (
        "rule-codex-2026-cod",
        "rule-codex-2026-derivative-exemption",
    )
    assert outcomes["concept-food-allergen-milk"].parent_ids == (
        "concept-food-allergen-root",
    )
    assert outcomes["concept-food-allergen-milk"].rule_ids == (
        "rule-codex-2026-milk",
        "rule-lifegoods-whey-milk-derivative",
        "rule-codex-2026-derivative-exemption",
    )
    assert {
        concept_id
        for concept_id, outcome in outcomes.items()
        if outcome.outcome == AllergenAssessmentOutcome.DERIVED_FROM_INGREDIENT
    } == {
        "concept-food-allergen-almond",
        "concept-food-allergen-cashew",
        "concept-food-allergen-walnut",
        "concept-food-allergen-cod",
        "concept-food-allergen-salmon",
    }
    assert all(
        outcome.outcome == AllergenAssessmentOutcome.LABEL_INCOMPLETE_OR_UNREADABLE
        for concept_id, outcome in outcomes.items()
        if concept_id
        not in {
            "concept-food-allergen-almond",
            "concept-food-allergen-cashew",
            "concept-food-allergen-walnut",
            "concept-food-allergen-cod",
            "concept-food-allergen-salmon",
        }
    )
    assert {
        concept_id: outcomes[concept_id].name
        for concept_id in (
            "concept-food-allergen-almond",
            "concept-food-allergen-cashew",
            "concept-food-allergen-walnut",
            "concept-food-allergen-cod",
            "concept-food-allergen-salmon",
        )
    } == {
        "concept-food-allergen-almond": "Almond",
        "concept-food-allergen-cashew": "Cashew",
        "concept-food-allergen-walnut": "Walnut",
        "concept-food-allergen-cod": "Cod",
        "concept-food-allergen-salmon": "Salmon",
    }

    expected_findings = [
        ("almond", "concept-food-allergen-almond", 0, 6),
        ("cashew", "concept-food-allergen-cashew", 8, 14),
        ("walnut", "concept-food-allergen-walnut", 16, 22),
        ("cod", "concept-food-allergen-cod", 24, 27),
        ("salmon", "concept-food-allergen-salmon", 29, 35),
    ]
    assert [
        (finding.matched_text, finding.concept_id, finding.start_index, finding.end_index)
        for finding in evaluation.findings
    ] == expected_findings
    for finding, (term, concept_id, start_index, end_index) in zip(
        evaluation.findings, expected_findings, strict=True
    ):
        slug = concept_id.removeprefix("concept-food-allergen-")
        assert finding.id == (
            "finding-codex-food-allergen-2026-reviewed-english-v1-"
            f"map-en-{slug}-exact-{start_index}-{end_index}"
        )
        assert finding.mapping_id == f"map-en-{slug}-exact"
        assert finding.rule_id == f"rule-codex-2026-{slug}"
        assert finding.relationship_type == "EXACT_NAME"
        assert finding.source_text == "almond, cashew, walnut, cod, salmon"
        assert finding.source_text[start_index:end_index] == term
        assert finding.language == "en"
        assert finding.source_field == "ingredients_text_en"
        assert finding.source_url == record.source_url
        assert finding.source_revision == record.source_revision
        assert finding.off_dataset_version_id == record.dataset_version.id
        assert finding.reference_dataset_version_id == reference_data.version.id
        assert finding.engine_version == "0.1.0"


def test_matcher_matches_exact_milk_with_full_provenance() -> None:
    matcher = DefaultAllergenDeterministicMatcher()
    record = sample_record()
    ref_data = sample_reference_data()

    ingredient_text = SourcedValue(
        value="Cocoa mass, sugar, cocoa butter, milk powder",
        source_field="ingredients_text_en",
        language="en",
    )
    findings = matcher.match(
        ingredient_text=ingredient_text,
        record=record,
        reference_data=ref_data,
        engine_version="0.1.0",
    )

    assert len(findings) == 1
    finding = findings[0]
    assert finding.concept_id == "concept-food-allergen-milk"
    assert finding.mapping_id == "map-en-milk-exact"
    assert finding.rule_id == "rule-codex-2026-milk"
    assert finding.relationship_type == "EXACT_NAME"
    assert finding.matched_text == "milk"
    assert finding.start_index == 33
    assert finding.end_index == 37
    assert ingredient_text.value[finding.start_index : finding.end_index] == "milk"
    assert finding.language == "en"
    assert finding.source_field == "ingredients_text_en"
    assert finding.source_url == record.source_url
    assert finding.source_revision == record.source_revision
    assert finding.off_dataset_version_id == record.dataset_version.id
    assert finding.reference_dataset_version_id == ref_data.version.id
    assert finding.engine_version == "0.1.0"
    assert finding.id == "finding-codex-food-allergen-2026-minimal-map-en-milk-exact-33-37"


def test_matcher_matches_whey_derivative_and_case_variations() -> None:
    matcher = DefaultAllergenDeterministicMatcher()
    record = sample_record()
    ref_data = sample_reference_data()

    ingredient_text = SourcedValue(
        value="Wheat flour, sugar, WHEY protein concentrate, whole MILK",
        source_field="ingredients_text_en",
        language="en",
    )
    findings = matcher.match(
        ingredient_text=ingredient_text,
        record=record,
        reference_data=ref_data,
        engine_version="0.1.0",
    )

    assert len(findings) == 2
    # Ordered by start_index in source text
    whey_finding = findings[0]
    assert whey_finding.concept_id == "concept-food-allergen-milk"
    assert whey_finding.mapping_id == "map-en-whey-derived"
    assert whey_finding.relationship_type == "DERIVED_FROM"
    assert whey_finding.matched_text == "WHEY"
    assert whey_finding.start_index == 20
    assert whey_finding.end_index == 24

    milk_finding = findings[1]
    assert milk_finding.concept_id == "concept-food-allergen-milk"
    assert milk_finding.mapping_id == "map-en-milk-exact"
    assert milk_finding.relationship_type == "EXACT_NAME"
    assert milk_finding.matched_text == "MILK"
    assert milk_finding.start_index == 52
    assert milk_finding.end_index == 56


def test_matcher_word_boundaries_prevent_false_positives() -> None:
    matcher = DefaultAllergenDeterministicMatcher()
    record = sample_record()
    ref_data = sample_reference_data()

    # "chamomile" contains "mil", "milkyway" contains "milk" prefix
    ingredient_text = SourcedValue(
        value="Chamomile extract, sugar, soy lecithin",
        source_field="ingredients_text_en",
        language="en",
    )
    findings = matcher.match(
        ingredient_text=ingredient_text,
        record=record,
        reference_data=ref_data,
        engine_version="0.1.0",
    )
    assert findings == ()


def test_matcher_unicode_code_point_offsets() -> None:
    matcher = DefaultAllergenDeterministicMatcher()
    record = sample_record()
    ref_data = sample_reference_data()

    ingredient_text = SourcedValue(
        value="Éclair au chocolat: cocoa, milk, sugar",
        source_field="ingredients_text_en",
        language="en",
    )
    findings = matcher.match(
        ingredient_text=ingredient_text,
        record=record,
        reference_data=ref_data,
        engine_version="0.1.0",
    )
    assert len(findings) == 1
    finding = findings[0]
    assert finding.matched_text == "milk"
    assert ingredient_text.value[finding.start_index : finding.end_index] == "milk"


def test_matcher_normalizes_nfkc_case_punctuation_and_whitespace_with_exact_span() -> None:
    ingredient_text = SourcedValue(
        value="🍫 ＭＩＬＫ\t—  powder",
        source_field="ingredients_text_en",
        language="en-US",
    )

    findings = DefaultAllergenDeterministicMatcher().match(
        ingredient_text=ingredient_text,
        record=sample_record(),
        reference_data=sample_reference_data(),
        engine_version="0.1.0",
    )

    assert len(findings) == 1
    finding = findings[0]
    assert finding.matched_text == "ＭＩＬＫ"
    assert (finding.start_index, finding.end_index) == (2, 6)
    assert ingredient_text.value[finding.start_index : finding.end_index] == "ＭＩＬＫ"


@pytest.mark.parametrize("coconut_phrase", ["coconut‑milk", "coconut\u00a0milk", "coconut\t  milk"])
def test_matcher_excludes_only_milk_inside_normalized_coconut_milk_phrase(
    coconut_phrase: str,
) -> None:
    ingredient_text = SourcedValue(
        value=f"{coconut_phrase}, MILK powder",
        source_field="ingredients_text_en",
        language="en",
    )

    findings = DefaultAllergenDeterministicMatcher().match(
        ingredient_text=ingredient_text,
        record=sample_record(),
        reference_data=sample_reference_data(),
        engine_version="0.1.0",
    )

    expected_start = ingredient_text.value.rindex("MILK")
    assert [
        (finding.matched_text, finding.start_index, finding.end_index)
        for finding in findings
    ] == [("MILK", expected_start, expected_start + 4)]


def test_matcher_word_boundaries_and_generic_flavours_do_not_infer_findings() -> None:
    ingredient_text = SourcedValue(
        value="eggplant, milky flavour, natural flavor",
        source_field="ingredients_text_en",
        language="en",
    )

    findings = DefaultAllergenDeterministicMatcher().match(
        ingredient_text=ingredient_text,
        record=sample_record(),
        reference_data=sample_reference_data(),
        engine_version="0.1.0",
    )

    assert findings == ()


def test_matcher_explicit_approved_term_inside_flavour_text_still_matches() -> None:
    ingredient_text = SourcedValue(
        value="natural milk flavour",
        source_field="ingredients_text_en",
        language="en",
    )

    findings = DefaultAllergenDeterministicMatcher().match(
        ingredient_text=ingredient_text,
        record=sample_record(),
        reference_data=sample_reference_data(),
        engine_version="0.1.0",
    )

    assert [(finding.mapping_id, finding.matched_text) for finding in findings] == [
        ("map-en-milk-exact", "milk")
    ]


def test_matcher_unicode_word_boundaries_reject_compound_and_non_ascii_prefixes() -> None:
    ingredient_text = SourcedValue(
        value="eggplant, 青egg, egg",
        source_field="ingredients_text_en",
        language="en",
    )

    findings = DefaultAllergenDeterministicMatcher().match(
        ingredient_text=ingredient_text,
        record=sample_record(),
        reference_data=reviewed_english_reference_data(),
        engine_version="0.1.0",
    )

    assert [(finding.mapping_id, finding.matched_text) for finding in findings] == [
        ("map-en-egg-exact", "egg")
    ]


def test_matcher_longest_mapping_wins_while_non_overlapping_findings_survive() -> None:
    reference_data = sample_reference_data()
    whole_milk_mapping = AllergenReferenceMapping(
        id="map-en-whole-milk-variant",
        concept_id="concept-food-allergen-milk",
        language="en",
        mapped_text="whole milk",
        relationship_type="SPELLING_VARIANT",
    )
    reference_data = replace(
        reference_data,
        mappings=(*reference_data.mappings, whole_milk_mapping),
    )
    ingredient_text = SourcedValue(
        value="whole-milk, milk",
        source_field="ingredients_text_en",
        language="en",
    )

    findings = DefaultAllergenDeterministicMatcher().match(
        ingredient_text=ingredient_text,
        record=sample_record(),
        reference_data=reference_data,
        engine_version="0.1.0",
    )

    assert [(finding.mapping_id, finding.matched_text) for finding in findings] == [
        ("map-en-whole-milk-variant", "whole-milk"),
        ("map-en-milk-exact", "milk"),
    ]


def test_matcher_uses_mapping_id_as_the_stable_final_tie_breaker() -> None:
    reference_data = sample_reference_data()
    tied_mappings = tuple(
        AllergenReferenceMapping(
            id=mapping_id,
            concept_id="concept-food-allergen-milk",
            language="en",
            mapped_text="milk",
            relationship_type="EXACT_NAME",
        )
        for mapping_id in ("map-en-milk-z", "map-en-milk-a")
    )
    reference_data = replace(reference_data, mappings=tied_mappings)

    findings = DefaultAllergenDeterministicMatcher().match(
        ingredient_text=SourcedValue(
            value="milk",
            source_field="ingredients_text_en",
            language="en",
        ),
        record=sample_record(),
        reference_data=reference_data,
        engine_version="0.1.0",
    )

    assert [finding.mapping_id for finding in findings] == ["map-en-milk-a"]


def test_matcher_preserves_repeated_derivative_findings_and_specific_rules() -> None:
    ingredient_text = SourcedValue(
        value="whey, WHEY",
        source_field="ingredients_text_en",
        language="en-GB",
    )

    findings = DefaultAllergenDeterministicMatcher().match(
        ingredient_text=ingredient_text,
        record=sample_record(),
        reference_data=sample_reference_data(),
        engine_version="0.1.0",
    )

    assert [finding.matched_text for finding in findings] == ["whey", "WHEY"]
    assert {finding.rule_id for finding in findings} == {
        "rule-lifegoods-whey-milk-derivative"
    }


class StubAllergenReferenceDataAccess:
    def __init__(self, data: ActiveAllergenReferenceData | None = None) -> None:
        self._data = data

    def get_active_version(self) -> AllergenAssessmentReferenceVersion | None:
        return self._data.version if self._data is not None else None

    def get_active_data(self) -> ActiveAllergenReferenceData | None:
        return self._data


class FailingMatcher:
    def match(self, **_kwargs: object) -> tuple[AllergenFinding, ...]:
        raise RuntimeError("matcher failed")


def test_evaluator_without_active_reference_data_reports_reference_unavailable() -> None:
    evaluator = StandardAllergenAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubAllergenReferenceDataAccess(),
    )

    evaluation = evaluator.evaluate(sample_record())

    assert evaluation.status == AllergenAssessmentStatus.NOT_ASSESSED
    assert evaluation.reason == AllergenAssessmentReason.REFERENCE_UNAVAILABLE
    assert evaluation.engine_version == "0.1.0"
    assert evaluation.reference_dataset_version is None
    assert evaluation.concepts == ()
    assert evaluation.findings == ()


def test_evaluator_isolates_matcher_failure_with_available_provenance() -> None:
    ref_data = sample_reference_data()
    evaluator = StandardAllergenAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubAllergenReferenceDataAccess(ref_data),
        matcher=FailingMatcher(),
    )

    evaluation = evaluator.evaluate(sample_record())

    assert evaluation.status == AllergenAssessmentStatus.NOT_ASSESSED
    assert evaluation.reason == AllergenAssessmentReason.ASSESSMENT_FAILED
    assert evaluation.evidence_coverage == EvidenceCoverageState.NOT_ASSESSED
    assert evaluation.engine_version == "0.1.0"
    assert evaluation.reference_dataset_version == ref_data.version
    assert evaluation.concepts == ()
    assert evaluation.findings == ()
    assert {signal.field for signal in evaluation.source_signals} == {
        "allergen_declaration",
        "allergen_tags",
        "trace_declaration",
        "trace_tags",
    }


def test_evaluator_with_active_reference_data_and_milk_ingredient_text() -> None:
    ref_data = sample_reference_data()
    access = StubAllergenReferenceDataAccess(ref_data)
    evaluator = StandardAllergenAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=access,
    )
    record = sample_record()  # Has "Cocoa mass, sugar, cocoa butter, milk powder"
    evaluation = evaluator.evaluate(record)

    assert evaluation.status == AllergenAssessmentStatus.COMPLETED
    assert evaluation.reason is None
    assert evaluation.evidence_coverage == EvidenceCoverageState.PARTIAL
    assert evaluation.engine_version == "0.1.0"
    assert evaluation.reference_dataset_version == ref_data.version

    # Check concepts
    assert len(evaluation.concepts) == 1
    concept = evaluation.concepts[0]
    assert concept.concept_id == "concept-food-allergen-milk"
    assert concept.name == "Milk and milk products"
    assert concept.outcome == AllergenAssessmentOutcome.DERIVED_FROM_INGREDIENT
    assert concept.reason is None
    assert len(concept.finding_ids) == 1

    # Check findings
    assert len(evaluation.findings) == 1
    finding = evaluation.findings[0]
    assert finding.id == concept.finding_ids[0]
    assert finding.concept_id == "concept-food-allergen-milk"
    assert finding.relationship_type == "EXACT_NAME"
    assert finding.matched_text == "milk"
    assert finding.start_index == 33
    assert finding.end_index == 37
    assert finding.source_field == "ingredients_text_en"
    assert finding.source_url == record.source_url
    assert finding.source_revision == record.source_revision
    assert finding.off_dataset_version_id == record.dataset_version.id
    assert finding.reference_dataset_version_id == ref_data.version.id
    assert finding.engine_version == "0.1.0"

    # Check source signals
    signal_fields = [s.field for s in evaluation.source_signals]
    assert "allergen_declaration" in signal_fields
    assert "allergen_tags" in signal_fields


def test_evaluator_with_active_reference_data_and_whey_ingredient_text() -> None:
    ref_data = sample_reference_data()
    access = StubAllergenReferenceDataAccess(ref_data)
    evaluator = StandardAllergenAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=access,
    )
    record = ExternalPackageRecord(
        identifier="4006381333931",
        source=OFF_SOURCE,
        source_record_id="4006381333931",
        request_url="https://world.openfoodfacts.org/api/v2/product/4006381333931",
        source_url="https://world.openfoodfacts.org/product/4006381333931",
        names=(),
        brands=None,
        quantity=None,
        ingredient_texts=(
            SourcedValue(
                value="Wheat flour, sugar, whey powder, salt",
                source_field="ingredients_text_en",
                language="en",
            ),
        ),
        allergen_declaration=None,
        allergen_tags=None,
        trace_declaration=None,
        trace_tags=None,
        additives=None,
        storage_conditions=(),
        manufacturing_places=None,
        halal_label_claim=None,
        packaging_languages=None,
        countries_sold=None,
        nutrition=(),
        selected_images=(),
        retrieved_at=datetime(2026, 8, 27, 8, 0, tzinfo=UTC),
        source_revision="1787462400",
        dataset_version=DATASET_VERSION,
    )
    evaluation = evaluator.evaluate(record)

    assert evaluation.status == AllergenAssessmentStatus.COMPLETED
    assert evaluation.reason is None
    assert evaluation.evidence_coverage == EvidenceCoverageState.PARTIAL
    assert len(evaluation.concepts) == 1
    assert evaluation.concepts[0].outcome == AllergenAssessmentOutcome.DERIVED_FROM_INGREDIENT
    assert len(evaluation.findings) == 1
    assert evaluation.findings[0].relationship_type == "DERIVED_FROM"
    assert evaluation.findings[0].matched_text == "whey"


@pytest.mark.parametrize("language", ["en-GB", "EN"])
def test_evaluator_accepts_case_and_region_varied_english_evidence(language: str) -> None:
    ref_data = sample_reference_data()
    evaluator = StandardAllergenAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubAllergenReferenceDataAccess(ref_data),
    )
    record = replace(
        sample_record(),
        ingredient_texts=(
            SourcedValue(
                value="Cocoa mass, milk powder",
                source_field="ingredients_text",
                language=language,
            ),
        ),
    )

    evaluation = evaluator.evaluate(record)

    assert evaluation.status == AllergenAssessmentStatus.COMPLETED
    assert evaluation.reason is None
    assert evaluation.concepts[0].outcome == (
        AllergenAssessmentOutcome.DERIVED_FROM_INGREDIENT
    )
    assert evaluation.findings[0].matched_text == "milk"


def test_evaluator_with_active_reference_data_and_no_matching_allergens() -> None:
    ref_data = sample_reference_data()
    access = StubAllergenReferenceDataAccess(ref_data)
    evaluator = StandardAllergenAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=access,
    )
    record = ExternalPackageRecord(
        identifier="4006381333931",
        source=OFF_SOURCE,
        source_record_id="4006381333931",
        request_url="https://world.openfoodfacts.org/api/v2/product/4006381333931",
        source_url="https://world.openfoodfacts.org/product/4006381333931",
        names=(),
        brands=None,
        quantity=None,
        ingredient_texts=(
            SourcedValue(
                value="Cocoa mass, sugar, cocoa butter, vanilla extract",
                source_field="ingredients_text_en",
                language="en",
            ),
        ),
        allergen_declaration=None,
        allergen_tags=None,
        trace_declaration=None,
        trace_tags=None,
        additives=None,
        storage_conditions=(),
        manufacturing_places=None,
        halal_label_claim=None,
        packaging_languages=None,
        countries_sold=None,
        nutrition=(),
        selected_images=(),
        retrieved_at=datetime(2026, 8, 27, 8, 0, tzinfo=UTC),
        source_revision="1787462400",
        dataset_version=DATASET_VERSION,
    )
    evaluation = evaluator.evaluate(record)

    # Incomplete external evidence without match produces LABEL_INCOMPLETE_OR_UNREADABLE
    assert evaluation.status == AllergenAssessmentStatus.COMPLETED
    assert evaluation.reason is None
    assert evaluation.evidence_coverage == EvidenceCoverageState.PARTIAL
    assert len(evaluation.concepts) == 1
    assert evaluation.concepts[0].concept_id == "concept-food-allergen-milk"
    assert (
        evaluation.concepts[0].outcome
        == AllergenAssessmentOutcome.LABEL_INCOMPLETE_OR_UNREADABLE
    )
    assert evaluation.concepts[0].finding_ids == ()
    assert evaluation.findings == ()


def test_evaluator_with_active_reference_data_and_missing_english_ingredients() -> None:
    ref_data = sample_reference_data()
    access = StubAllergenReferenceDataAccess(ref_data)
    evaluator = StandardAllergenAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=access,
    )
    record = ExternalPackageRecord(
        identifier="4006381333931",
        source=OFF_SOURCE,
        source_record_id="4006381333931",
        request_url="https://world.openfoodfacts.org/api/v2/product/4006381333931",
        source_url="https://world.openfoodfacts.org/product/4006381333931",
        names=(),
        brands=None,
        quantity=None,
        ingredient_texts=(
            SourcedValue(
                value="ម៉ាសកាកាវ ស្ករ ប៊ឺកាកាវ",
                source_field="ingredients_text_km",
                language="km",
            ),
        ),
        allergen_declaration=None,
        allergen_tags=None,
        trace_declaration=None,
        trace_tags=None,
        additives=None,
        storage_conditions=(),
        manufacturing_places=None,
        halal_label_claim=None,
        packaging_languages=None,
        countries_sold=None,
        nutrition=(),
        selected_images=(),
        retrieved_at=datetime(2026, 8, 27, 8, 0, tzinfo=UTC),
        source_revision="1787462400",
        dataset_version=DATASET_VERSION,
    )
    evaluation = evaluator.evaluate(record)

    assert evaluation.status == AllergenAssessmentStatus.NOT_ASSESSED
    assert evaluation.reason == AllergenAssessmentReason.EVIDENCE_UNAVAILABLE
    assert evaluation.evidence_coverage == EvidenceCoverageState.NOT_ASSESSED
    assert evaluation.reference_dataset_version == ref_data.version
    assert evaluation.concepts == ()
    assert evaluation.findings == ()


def test_evaluator_off_signals_do_not_drive_lifegoods_outcome() -> None:
    ref_data = sample_reference_data()
    access = StubAllergenReferenceDataAccess(ref_data)
    evaluator = StandardAllergenAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=access,
    )
    # Ingredient text does NOT contain milk, but OFF has allergen_declaration and allergen_tags
    record = ExternalPackageRecord(
        identifier="4006381333931",
        source=OFF_SOURCE,
        source_record_id="4006381333931",
        request_url="https://world.openfoodfacts.org/api/v2/product/4006381333931",
        source_url="https://world.openfoodfacts.org/product/4006381333931",
        names=(),
        brands=None,
        quantity=None,
        ingredient_texts=(
            SourcedValue(
                value="Cocoa mass, sugar, cocoa butter",
                source_field="ingredients_text_en",
                language="en",
            ),
        ),
        allergen_declaration=SourcedValue(
            value="Contains milk", source_field="allergens", language="en"
        ),
        allergen_tags=SourcedValue(value=("en:milk",), source_field="allergens_tags"),
        trace_declaration=SourcedValue(
            value="May contain nuts", source_field="traces", language="en"
        ),
        trace_tags=SourcedValue(value=("en:nuts",), source_field="traces_tags"),
        additives=None,
        storage_conditions=(),
        manufacturing_places=None,
        halal_label_claim=None,
        packaging_languages=None,
        countries_sold=None,
        nutrition=(),
        selected_images=(),
        retrieved_at=datetime(2026, 8, 27, 8, 0, tzinfo=UTC),
        source_revision="1787462400",
        dataset_version=DATASET_VERSION,
    )
    evaluation = evaluator.evaluate(record)

    # Must be LABEL_INCOMPLETE_OR_UNREADABLE, NOT DECLARED_CONTAINS or DERIVED_FROM_INGREDIENT
    assert evaluation.status == AllergenAssessmentStatus.COMPLETED
    assert (
        evaluation.concepts[0].outcome
        == AllergenAssessmentOutcome.LABEL_INCOMPLETE_OR_UNREADABLE
    )
    assert evaluation.findings == ()


    # Signals are preserved as attributed metadata
    signal_fields = {s.field: s.value for s in evaluation.source_signals}
    assert signal_fields["allergen_declaration"] == "Contains milk"
    assert signal_fields["allergen_tags"] == ["en:milk"]
    assert signal_fields["trace_declaration"] == "May contain nuts"
    assert signal_fields["trace_tags"] == ["en:nuts"]


def test_evaluator_with_multiple_concepts_unmatched_concept_yields_incomplete() -> None:
    version = AllergenAssessmentReferenceVersion(
        id="codex-food-allergen-2026-minimal",
        source_url="https://www.fao.org/fao-who-codexalimentarius/standards/cxs1-1985",
        retrieved_at=datetime(2026, 8, 27, 8, 0, tzinfo=UTC),
        activated_at=datetime(2026, 8, 27, 9, 0, tzinfo=UTC),
        sha256="d" * 64,
        review_kind="FOOD_DOMAIN_REVIEW",
        dataset_kind="FOOD_ALLERGEN",
    )
    concepts = (
        AllergenReferenceConcept(
            id="concept-food-allergen-eggs",
            name="Egg and egg products",
            condition_family="FOOD_ALLERGEN",
        ),
        AllergenReferenceConcept(
            id="concept-food-allergen-milk",
            name="Milk and milk products",
            condition_family="FOOD_ALLERGEN",
        ),
    )
    mappings = (
        AllergenReferenceMapping(
            id="map-en-milk-exact",
            concept_id="concept-food-allergen-milk",
            language="en",
            mapped_text="milk",
            relationship_type="EXACT_NAME",
        ),
        AllergenReferenceMapping(
            id="map-en-egg-exact",
            concept_id="concept-food-allergen-eggs",
            language="en",
            mapped_text="egg",
            relationship_type="EXACT_NAME",
        ),
    )
    rules = (
        AllergenReferenceRule(
            id="rule-codex-2026-milk",
            concept_id="concept-food-allergen-milk",
            source_id="source-1",
            rule_kind="MANDATORY_DECLARATION",
            condition_family="FOOD_ALLERGEN",
        ),
        AllergenReferenceRule(
            id="rule-codex-2026-eggs",
            concept_id="concept-food-allergen-eggs",
            source_id="source-1",
            rule_kind="MANDATORY_DECLARATION",
            condition_family="FOOD_ALLERGEN",
        ),
    )
    ref_data = ActiveAllergenReferenceData(
        version=version,
        concepts=concepts,
        mappings=mappings,
        rules=rules,
    )
    access = StubAllergenReferenceDataAccess(ref_data)
    evaluator = StandardAllergenAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=access,
    )
    record = sample_record()  # Contains "milk" but NOT "egg"
    evaluation = evaluator.evaluate(record)

    assert evaluation.status == AllergenAssessmentStatus.COMPLETED
    assert len(evaluation.concepts) == 2
    # Egg concept has no match -> LABEL_INCOMPLETE_OR_UNREADABLE
    assert evaluation.concepts[0].concept_id == "concept-food-allergen-eggs"
    assert (
        evaluation.concepts[0].outcome
        == AllergenAssessmentOutcome.LABEL_INCOMPLETE_OR_UNREADABLE
    )
    assert evaluation.concepts[0].finding_ids == ()
    # Milk concept has match -> DERIVED_FROM_INGREDIENT
    assert evaluation.concepts[1].concept_id == "concept-food-allergen-milk"
    assert (
        evaluation.concepts[1].outcome
        == AllergenAssessmentOutcome.DERIVED_FROM_INGREDIENT
    )
    assert len(evaluation.concepts[1].finding_ids) == 1

    # Prohibited outcomes are NOT emitted in this slice
    prohibited_outcomes = {
        AllergenAssessmentOutcome.NO_DECLARATION_DETECTED_IN_READABLE_LABEL,
        AllergenAssessmentOutcome.DECLARED_CONTAINS,
        AllergenAssessmentOutcome.DECLARED_MAY_CONTAIN,
    }
    assert evaluation.status not in prohibited_outcomes
    for c in evaluation.concepts:
        assert c.outcome not in prohibited_outcomes
