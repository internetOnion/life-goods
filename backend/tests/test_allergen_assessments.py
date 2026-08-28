from dataclasses import asdict
from datetime import UTC, datetime

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

    assert evaluation.status == AllergenAssessmentOutcome.NOT_ASSESSED
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

    assert evaluation.status == AllergenAssessmentOutcome.NOT_ASSESSED
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


def test_database_allergen_reference_data_access(tmp_path, monkeypatch) -> None:
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import create_engine
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

    active = access.get_active_version()
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
    )

    return ActiveAllergenReferenceData(
        version=version,
        concepts=concepts,
        mappings=mappings,
        rules=rules,
    )


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


class StubAllergenReferenceDataAccess:
    def __init__(self, data: ActiveAllergenReferenceData | None = None) -> None:
        self._data = data

    def get_active_version(self) -> AllergenAssessmentReferenceVersion | None:
        return self._data.version if self._data is not None else None

    def get_active_data(self) -> ActiveAllergenReferenceData | None:
        return self._data


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

    assert evaluation.status == AllergenAssessmentOutcome.DERIVED_FROM_INGREDIENT
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

    assert evaluation.status == AllergenAssessmentOutcome.DERIVED_FROM_INGREDIENT
    assert evaluation.reason is None
    assert evaluation.evidence_coverage == EvidenceCoverageState.PARTIAL
    assert len(evaluation.concepts) == 1
    assert evaluation.concepts[0].outcome == AllergenAssessmentOutcome.DERIVED_FROM_INGREDIENT
    assert len(evaluation.findings) == 1
    assert evaluation.findings[0].relationship_type == "DERIVED_FROM"
    assert evaluation.findings[0].matched_text == "whey"


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
    assert evaluation.status == AllergenAssessmentOutcome.LABEL_INCOMPLETE_OR_UNREADABLE
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

    assert evaluation.status == AllergenAssessmentOutcome.NOT_ASSESSED
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
    assert evaluation.status == AllergenAssessmentOutcome.LABEL_INCOMPLETE_OR_UNREADABLE
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

    assert evaluation.status == AllergenAssessmentOutcome.DERIVED_FROM_INGREDIENT
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




