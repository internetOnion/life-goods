from typing import Any

from lifegoods.identifiers import normalize_identifier
from lifegoods.open_food_facts.models import (
    ExternalPackageFound,
    ExternalPackageNotFound,
    ExternalPackageRecord,
    ExternalPackageSource,
    ExternalPackageUnavailable,
    JsonValue,
    SourcedValue,
)
from lifegoods.package_matches.models import (
    OpenFoodFactsLookup,
    OpenFoodFactsLookupStatus,
    PackageMatchCandidate,
    PackageMatchEvidence,
    PackageMatchReferenceImage,
    PackageMatchRepository,
    PackageMatchResult,
    PackageMatchSourceKind,
    PackageMatchSourceMetadata,
    PackageMatchSourceUnavailableError,
)


class FindPackageMatches:
    def __init__(
        self,
        repository: PackageMatchRepository,
        external_source: ExternalPackageSource,
    ) -> None:
        self._repository = repository
        self._external_source = external_source

    def execute(self, entered_identifier: str) -> PackageMatchResult:
        identifier = normalize_identifier(entered_identifier)
        candidates = self._repository.find_candidates(identifier)
        result = self._external_source.fetch(identifier)
        if isinstance(result, ExternalPackageFound):
            candidates.append(_candidate_from_record(result.record))
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
            if not candidates:
                raise PackageMatchSourceUnavailableError(result.reason)
            lookup = OpenFoodFactsLookup(
                status=OpenFoodFactsLookupStatus.UNAVAILABLE,
                dataset_version=None,
                error_code=result.reason,
            )
        else:
            raise AssertionError(
                f"Unexpected external lookup result: {type(result).__name__}"
            )
        return PackageMatchResult(
            identifier=identifier,
            candidates=candidates,
            open_food_facts=lookup,
        )


def _candidate_from_record(record: ExternalPackageRecord) -> PackageMatchCandidate:
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
        ("packaging_languages", record.packaging_languages),
        ("countries_sold", record.countries_sold),
    ):
        if value is not None:
            label.append(_evidence(record, mapped_field, value))
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
        retrieved_at=record.retrieved_at,
        is_current=None,
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
        value=_json_value(sourced.value),
        source_field=sourced.source_field,
        source_name=record.source.name,
        source_url=record.source_url,
        language=sourced.language,
        observed_at=None,
        retrieved_at=record.retrieved_at,
        source_revision=record.source_revision,
    )


def _json_value(value: object) -> JsonValue:
    if value is None or isinstance(value, bool | int | float | str):
        return value
    if isinstance(value, tuple | list):
        return [_json_value(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _json_value(item) for key, item in value.items()}
    raise TypeError(f"Unsupported external evidence value: {type(value).__name__}")
