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
    DefaultOffAllergenEvidenceExtractor,
    DisabledAllergenAssessmentEvaluator,
    EvidenceCoverageState,
    StandardAllergenAssessmentEvaluator,
)
from lifegoods.package_matches.contracts import AllergenAssessmentResponse
from lifegoods.package_matches.models import PackageMatchSourceKind
from lifegoods.package_matches.router import _candidate_response
from lifegoods.package_matches.service import _candidate_from_record
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

    # Test StandardAllergenAssessmentEvaluator with active reference data
    evaluator = StandardAllergenAssessmentEvaluator(enabled=True, reference_data=access)
    record = sample_record()
    evaluation = evaluator.evaluate(record)

    assert evaluation.status == AllergenAssessmentOutcome.NOT_ASSESSED
    assert evaluation.reason == AllergenAssessmentReason.EVIDENCE_UNAVAILABLE
    assert evaluation.reference_dataset_version == active

