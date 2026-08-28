from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any, Protocol

from lifegoods.open_food_facts.models import (
    ExternalPackageRecord,
    SourcedValue,
)

if TYPE_CHECKING:
    from lifegoods.package_matches.models import PackageMatchEvidence


class AllergenAssessmentOutcome(StrEnum):
    DECLARED_CONTAINS = "DECLARED_CONTAINS"
    DECLARED_MAY_CONTAIN = "DECLARED_MAY_CONTAIN"
    DERIVED_FROM_INGREDIENT = "DERIVED_FROM_INGREDIENT"
    NO_DECLARATION_DETECTED_IN_READABLE_LABEL = (
        "NO_DECLARATION_DETECTED_IN_READABLE_LABEL"
    )
    LABEL_INCOMPLETE_OR_UNREADABLE = "LABEL_INCOMPLETE_OR_UNREADABLE"
    NOT_ASSESSED = "NOT_ASSESSED"


class AllergenAssessmentReason(StrEnum):
    FEATURE_DISABLED = "FEATURE_DISABLED"
    EVIDENCE_UNAVAILABLE = "EVIDENCE_UNAVAILABLE"
    DATASET_UNAVAILABLE = "DATASET_UNAVAILABLE"
    REFERENCE_VERSION_UNAVAILABLE = "REFERENCE_VERSION_UNAVAILABLE"


class EvidenceCoverageState(StrEnum):
    NOT_ASSESSED = "NOT_ASSESSED"
    COMPLETE_READABLE_LABEL = "COMPLETE_READABLE_LABEL"
    PARTIAL = "PARTIAL"
    UNREADABLE = "UNREADABLE"


class AllergenRelationshipType(StrEnum):
    EXACT_NAME = "EXACT_NAME"
    SPELLING_VARIANT = "SPELLING_VARIANT"
    DERIVED_FROM = "DERIVED_FROM"
    CONTAINS_SOURCE = "CONTAINS_SOURCE"
    PRECAUTIONARY_PHRASE = "PRECAUTIONARY_PHRASE"


class ReferenceReviewKind(StrEnum):
    FOOD_DOMAIN_REVIEW = "FOOD_DOMAIN_REVIEW"
    PROJECT_MAINTAINER_APPROVAL = "PROJECT_MAINTAINER_APPROVAL"


@dataclass(frozen=True, slots=True)
class AllergenAssessmentReferenceVersion:
    id: str
    source_url: str
    retrieved_at: datetime
    activated_at: datetime
    sha256: str
    review_kind: str
    dataset_kind: str = "FOOD_ALLERGEN"


@dataclass(frozen=True, slots=True)
class AllergenFinding:
    id: str
    concept_id: str
    relationship_type: str = AllergenRelationshipType.EXACT_NAME
    matched_text: str = ""
    start_index: int = 0
    end_index: int = 0
    mapping_id: str | None = None
    rule_id: str | None = None
    source_text: str | None = None
    language: str | None = None
    source_field: str = ""
    source_url: str = ""
    source_revision: str | None = None
    off_dataset_version_id: str | None = None
    reference_dataset_version_id: str | None = None
    engine_version: str | None = None


@dataclass(frozen=True, slots=True)
class AllergenConceptOutcome:
    concept_id: str
    name: str
    outcome: AllergenAssessmentOutcome
    reason: AllergenAssessmentReason | str | None = None
    finding_ids: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class AllergenAssessmentEvaluation:
    status: AllergenAssessmentOutcome = AllergenAssessmentOutcome.NOT_ASSESSED
    reason: AllergenAssessmentReason | str | None = None
    evidence_coverage: EvidenceCoverageState | str = EvidenceCoverageState.NOT_ASSESSED
    engine_version: str | None = None
    reference_dataset_version: AllergenAssessmentReferenceVersion | None = None
    concepts: tuple[AllergenConceptOutcome, ...] = ()
    findings: tuple[AllergenFinding, ...] = ()
    source_signals: tuple[PackageMatchEvidence, ...] = ()


class OffAllergenEvidenceExtractor(Protocol):
    def extract_signals(
        self, record: ExternalPackageRecord
    ) -> tuple[PackageMatchEvidence, ...]: ...


class AllergenReferenceDataAccess(Protocol):
    def get_active_version(self) -> AllergenAssessmentReferenceVersion | None: ...


class AllergenDeterministicMatcher(Protocol):
    def match(
        self,
        text: str,
        reference_version: AllergenAssessmentReferenceVersion,
    ) -> tuple[AllergenFinding, ...]: ...


class AllergenAssessmentCache(Protocol):
    def get(self, key: str) -> AllergenAssessmentEvaluation | None: ...
    def set(self, key: str, value: AllergenAssessmentEvaluation) -> None: ...


class AllergenAssessmentEvaluator(Protocol):
    def evaluate(
        self, record: ExternalPackageRecord
    ) -> AllergenAssessmentEvaluation: ...


def _evidence_from_sourced(
    record: ExternalPackageRecord,
    mapped_field: str,
    sourced: SourcedValue[Any],
) -> PackageMatchEvidence:
    from lifegoods.package_matches.models import PackageMatchEvidence, json_value

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


class DefaultOffAllergenEvidenceExtractor:
    def extract_signals(
        self, record: ExternalPackageRecord
    ) -> tuple[PackageMatchEvidence, ...]:
        signals: list[PackageMatchEvidence] = []
        for mapped_field, value in (
            ("allergen_declaration", record.allergen_declaration),
            ("allergen_tags", record.allergen_tags),
            ("trace_declaration", record.trace_declaration),
            ("trace_tags", record.trace_tags),
        ):
            if value is not None:
                signals.append(_evidence_from_sourced(record, mapped_field, value))
        return tuple(signals)


class DisabledAllergenAssessmentEvaluator:
    def evaluate(
        self, record: ExternalPackageRecord
    ) -> AllergenAssessmentEvaluation:
        return AllergenAssessmentEvaluation(
            status=AllergenAssessmentOutcome.NOT_ASSESSED,
            reason=AllergenAssessmentReason.FEATURE_DISABLED,
            evidence_coverage=EvidenceCoverageState.NOT_ASSESSED,
            engine_version=None,
            reference_dataset_version=None,
            concepts=(),
            findings=(),
            source_signals=(),
        )


class StandardAllergenAssessmentEvaluator:
    def __init__(
        self,
        *,
        enabled: bool = False,
        engine_version: str = "0.1.0",
        extractor: OffAllergenEvidenceExtractor | None = None,
        reference_data: AllergenReferenceDataAccess | None = None,
        matcher: AllergenDeterministicMatcher | None = None,
        cache: AllergenAssessmentCache | None = None,
    ) -> None:
        self._enabled = enabled
        self._engine_version = engine_version
        self._extractor = extractor or DefaultOffAllergenEvidenceExtractor()
        self._reference_data = reference_data
        self._matcher = matcher
        self._cache = cache

    def evaluate(
        self, record: ExternalPackageRecord
    ) -> AllergenAssessmentEvaluation:
        if not self._enabled:
            return AllergenAssessmentEvaluation(
                status=AllergenAssessmentOutcome.NOT_ASSESSED,
                reason=AllergenAssessmentReason.FEATURE_DISABLED,
                evidence_coverage=EvidenceCoverageState.NOT_ASSESSED,
                engine_version=None,
                reference_dataset_version=None,
                concepts=(),
                findings=(),
                source_signals=(),
            )
        # Feature-enabled evaluation boundary for upcoming issues (#59, #60, #61)
        if self._reference_data is None:
            return AllergenAssessmentEvaluation(
                status=AllergenAssessmentOutcome.NOT_ASSESSED,
                reason=AllergenAssessmentReason.REFERENCE_VERSION_UNAVAILABLE,
                evidence_coverage=EvidenceCoverageState.NOT_ASSESSED,
                engine_version=self._engine_version,
                reference_dataset_version=None,
                concepts=(),
                findings=(),
                source_signals=self._extractor.extract_signals(record),
            )
        active_version = self._reference_data.get_active_version()
        if active_version is None:
            return AllergenAssessmentEvaluation(
                status=AllergenAssessmentOutcome.NOT_ASSESSED,
                reason=AllergenAssessmentReason.REFERENCE_VERSION_UNAVAILABLE,
                evidence_coverage=EvidenceCoverageState.NOT_ASSESSED,
                engine_version=self._engine_version,
                reference_dataset_version=None,
                concepts=(),
                findings=(),
                source_signals=self._extractor.extract_signals(record),
            )
        return AllergenAssessmentEvaluation(
            status=AllergenAssessmentOutcome.NOT_ASSESSED,
            reason=AllergenAssessmentReason.EVIDENCE_UNAVAILABLE,
            evidence_coverage=EvidenceCoverageState.NOT_ASSESSED,
            engine_version=self._engine_version,
            reference_dataset_version=active_version,
            concepts=(),
            findings=(),
            source_signals=self._extractor.extract_signals(record),
        )
