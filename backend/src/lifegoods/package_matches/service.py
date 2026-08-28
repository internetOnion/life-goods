from typing import Any

from lifegoods.identifiers import normalize_identifier
from lifegoods.open_food_facts.models import (
    ExternalPackageFound,
    ExternalPackageNotFound,
    ExternalPackageRecord,
    ExternalPackageSource,
    ExternalPackageUnavailable,
    SourcedValue,
)
from lifegoods.package_matches.assessments import (
    AllergenAssessmentEvaluator,
    DisabledAllergenAssessmentEvaluator,
)
from lifegoods.package_matches.models import (
    OpenFoodFactsLookup,
    OpenFoodFactsLookupStatus,
    PackageMatchCandidate,
    PackageMatchEvidence,
    PackageMatchReferenceImage,
    PackageMatchResult,
    PackageMatchSourceKind,
    PackageMatchSourceMetadata,
    PackageMatchSourceUnavailableError,
    json_value,
)


class FindPackageMatches:
    def __init__(
        self,
        external_source: ExternalPackageSource,
        allergen_evaluator: AllergenAssessmentEvaluator | None = None,
    ) -> None:
        self._external_source = external_source
        self._allergen_evaluator = (
            allergen_evaluator or DisabledAllergenAssessmentEvaluator()
        )

    def execute(self, entered_identifier: str) -> PackageMatchResult:
        identifier = normalize_identifier(entered_identifier)
        result = self._external_source.fetch(identifier)
        candidates: list[PackageMatchCandidate] = []
        if isinstance(result, ExternalPackageFound):
            candidates = [
                _candidate_from_record(
                    result.record, allergen_evaluator=self._allergen_evaluator
                )
            ]
            lookup = OpenFoodFactsLookup(
                status=OpenFoodFactsLookupStatus.AVAILABLE,
                dataset_version=result.record.dataset_version,
            )
        elif isinstance(result, ExternalPackageNotFound):
            lookup = OpenFoodFactsLookup(
                status=OpenFoodFactsLookupStatus.NOT_FOUND,
                dataset_version=result.dataset_version,
            )
        elif isinstance(result, ExternalPackageUnavailable):
            raise PackageMatchSourceUnavailableError(result.reason)
        else:
            raise AssertionError(
                f"Unexpected external lookup result: {type(result).__name__}"
            )
        return PackageMatchResult(
            identifier=identifier,
            candidates=candidates,
            open_food_facts=lookup,
        )


def _candidate_from_record(
    record: ExternalPackageRecord,
    allergen_evaluator: AllergenAssessmentEvaluator | None = None,
) -> PackageMatchCandidate:
    evaluator = allergen_evaluator or DisabledAllergenAssessmentEvaluator()
    allergen_assessment = evaluator.evaluate(record)
    source = PackageMatchSourceMetadata(
        name=record.source.name,
        source_type=record.source.source_type,
        base_url=record.source.base_url,
        record_url=record.source_url,
        attribution=record.source.attribution,
        database_license=record.source.database_license,
        contents_license=record.source.contents_license,
        image_license=record.source.image_license,
        terms_version=record.source.terms_version,
    )
    identity = [
        _evidence(
            record,
            "identifier",
            SourcedValue(value=record.identifier, source_field="code"),
        )
    ]
    identity.extend(_evidence(record, "name", value) for value in record.names)
    for mapped_field, value in (
        ("brands", record.brands),
        ("quantity", record.quantity),
    ):
        if value is not None:
            identity.append(_evidence(record, mapped_field, value))

    label: list[PackageMatchEvidence] = []
    label.extend(
        _evidence(record, "ingredient_text", value)
        for value in record.ingredient_texts
    )
    for mapped_field, value in (
        ("allergen_declaration", record.allergen_declaration),
        ("allergen_tags", record.allergen_tags),
        ("trace_declaration", record.trace_declaration),
        ("trace_tags", record.trace_tags),
        ("additive_tags", record.additives),
        ("manufacturing_places", record.manufacturing_places),
        ("halal_label_claim", record.halal_label_claim),
        ("packaging_languages", record.packaging_languages),
        ("countries_sold", record.countries_sold),
    ):
        if value is not None:
            label.append(_evidence(record, mapped_field, value))
    label.extend(
        _evidence(record, "storage_instructions", value)
        for value in record.storage_conditions
    )
    label.extend(_evidence(record, "nutrition", value) for value in record.nutrition)

    images = tuple(
        PackageMatchReferenceImage(
            role=image.role,
            url=image.url,
            source_field=image.source_field,
            source_name=record.source.name,
            source_url=record.source_url,
            attribution=record.source.attribution,
            license_name=record.source.image_license,
            language=image.language,
            retrieved_at=record.retrieved_at,
            source_revision=record.source_revision,
            original_url=image.url,
            image_revision=image.image_revision,
            dataset_version_id=record.dataset_version.id,
        )
        for image in record.selected_images
    )
    return PackageMatchCandidate(
        source_kind=PackageMatchSourceKind.OPEN_FOOD_FACTS,
        external_record_id=record.source_record_id,
        source=source,
        identity_evidence=tuple(identity),
        label_evidence=tuple(label),
        reference_images=images,
        allergen_assessment=allergen_assessment,
        retrieved_at=record.retrieved_at,
        source_revision=record.source_revision,
        dataset_version=record.dataset_version,
    )


def _evidence(
    record: ExternalPackageRecord,
    mapped_field: str,
    sourced: SourcedValue[Any],
) -> PackageMatchEvidence:
    return PackageMatchEvidence(
        field=mapped_field,
        value=json_value(sourced.value),
        source_field=sourced.source_field,
        source_name=record.source.name,
        source_url=record.source_url,
        language=sourced.language,
        observed_at=None,
        retrieved_at=record.retrieved_at,
        source_revision=record.source_revision,
        dataset_version_id=record.dataset_version.id,
    )
