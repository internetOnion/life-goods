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
