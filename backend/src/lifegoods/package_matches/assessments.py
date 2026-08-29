from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import StrEnum
from typing import TYPE_CHECKING, Any, Protocol

from lifegoods.open_food_facts.models import (
    ExternalPackageRecord,
    SourcedValue,
)
from lifegoods.reference_datasets import (
    ActiveAllergenReferenceData,
    AllergenAssessmentReferenceVersion,
    AllergenReferenceDataAccess,
    AllergenReferenceMapping,
    AllergenRelationshipType,
)
from lifegoods.reference_datasets.text_normalization import (
    find_normalized_phrase,
    normalize_english_text,
    normalized_phrase,
)

if TYPE_CHECKING:
    from lifegoods.package_matches.models import PackageMatchEvidence

logger = logging.getLogger(__name__)


class AllergenAssessmentStatus(StrEnum):
    COMPLETED = "COMPLETED"
    NOT_ASSESSED = "NOT_ASSESSED"


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
    REFERENCE_UNAVAILABLE = "REFERENCE_UNAVAILABLE"
    EVIDENCE_UNAVAILABLE = "EVIDENCE_UNAVAILABLE"
    ASSESSMENT_FAILED = "ASSESSMENT_FAILED"


class EvidenceCoverageState(StrEnum):
    NOT_ASSESSED = "NOT_ASSESSED"
    COMPLETE_READABLE_LABEL = "COMPLETE_READABLE_LABEL"
    PARTIAL = "PARTIAL"
    UNREADABLE = "UNREADABLE"


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
    parent_ids: tuple[str, ...] = ()
    rule_ids: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class AllergenAssessmentEvaluation:
    status: AllergenAssessmentStatus = AllergenAssessmentStatus.NOT_ASSESSED
    reason: AllergenAssessmentReason | None = AllergenAssessmentReason.FEATURE_DISABLED
    evidence_coverage: EvidenceCoverageState = EvidenceCoverageState.NOT_ASSESSED
    engine_version: str | None = None
    reference_dataset_version: AllergenAssessmentReferenceVersion | None = None
    concepts: tuple[AllergenConceptOutcome, ...] = ()
    findings: tuple[AllergenFinding, ...] = ()
    source_signals: tuple[PackageMatchEvidence, ...] = ()

    def __post_init__(self) -> None:
        if self.status is AllergenAssessmentStatus.COMPLETED and self.reason is not None:
            raise ValueError("COMPLETED evaluations require a null reason")
        if self.status is AllergenAssessmentStatus.NOT_ASSESSED and self.reason is None:
            raise ValueError("NOT_ASSESSED evaluations require a reason")


class OffAllergenEvidenceExtractor(Protocol):
    def extract_signals(
        self, record: ExternalPackageRecord
    ) -> tuple[PackageMatchEvidence, ...]: ...


class AllergenDeterministicMatcher(Protocol):
    def match(
        self,
        *,
        ingredient_text: SourcedValue[str],
        record: ExternalPackageRecord,
        reference_data: ActiveAllergenReferenceData,
        engine_version: str,
    ) -> tuple[AllergenFinding, ...]: ...


@dataclass(frozen=True, slots=True)
class _MatchCandidate:
    mapping: AllergenReferenceMapping
    normalized_start: int
    normalized_end: int


def _is_english_evidence(value: SourcedValue[Any]) -> bool:
    language = (value.language or "").strip().lower()
    source_field = value.source_field or ""
    return (
        language == "en"
        or language.startswith("en-")
        or source_field == "ingredients_text_en"
        or source_field.endswith("_en")
    )


class DefaultAllergenDeterministicMatcher:
    def match(
        self,
        *,
        ingredient_text: SourcedValue[str],
        record: ExternalPackageRecord,
        reference_data: ActiveAllergenReferenceData,
        engine_version: str,
    ) -> tuple[AllergenFinding, ...]:
        source_text = ingredient_text.value
        if not source_text or not _is_english_evidence(ingredient_text):
            return ()

        normalized_source = normalize_english_text(source_text)
        declaration_rule_by_concept: dict[str, str] = {}
        derivative_rule_by_mapping: dict[str, str] = {}
        for rule in sorted(reference_data.rules, key=lambda item: item.id):
            if rule.rule_kind == "DERIVATIVE_MATCH" and rule.mapping_id:
                derivative_rule_by_mapping[rule.mapping_id] = rule.id
            elif rule.rule_kind in {
                "MANDATORY_DECLARATION",
                "REGIONAL_OR_NATIONAL_DECLARATION",
            }:
                declaration_rule_by_concept.setdefault(rule.concept_id, rule.id)

        exclusion_intervals: list[tuple[str, int, int]] = []
        for exclusion in reference_data.exclusions:
            if exclusion.language.strip().lower() != "en":
                continue
            phrase = normalized_phrase(exclusion.excluded_text)
            exclusion_intervals.extend(
                (exclusion.concept_id, start, end)
                for start, end in find_normalized_phrase(normalized_source.text, phrase)
            )

        candidates: list[_MatchCandidate] = []

        for mapping in reference_data.mappings:
            if mapping.language.strip().lower() != "en":
                continue

            mapped_text = normalized_phrase(mapping.mapped_text)
            if not mapped_text:
                continue

            for normalized_start, normalized_end in find_normalized_phrase(
                normalized_source.text, mapped_text
            ):
                if any(
                    exclusion_concept_id == mapping.concept_id
                    and normalized_start >= exclusion_start
                    and normalized_end <= exclusion_end
                    for exclusion_concept_id, exclusion_start, exclusion_end in exclusion_intervals
                ):
                    continue
                candidates.append(
                    _MatchCandidate(mapping, normalized_start, normalized_end)
                )

        candidates.sort(
            key=lambda candidate: (
                -sum(
                    character != " "
                    for character in normalized_source.text[
                        candidate.normalized_start : candidate.normalized_end
                    ]
                ),
                -(candidate.normalized_end - candidate.normalized_start),
                candidate.normalized_start,
                candidate.mapping.id,
            )
        )
        accepted_candidates: list[_MatchCandidate] = []
        for candidate in candidates:
            if any(
                candidate.normalized_start < accepted.normalized_end
                and accepted.normalized_start < candidate.normalized_end
                for accepted in accepted_candidates
            ):
                continue
            accepted_candidates.append(candidate)

        findings: list[AllergenFinding] = []
        for candidate in accepted_candidates:
            mapping = candidate.mapping
            start_index, end_index = normalized_source.source_span(
                candidate.normalized_start, candidate.normalized_end
            )
            matched_text = source_text[start_index:end_index]
            finding_id = (
                f"finding-{reference_data.version.id}-{mapping.id}-{start_index}-{end_index}"
            )
            rule_id = (
                derivative_rule_by_mapping.get(mapping.id)
                if mapping.relationship_type == AllergenRelationshipType.DERIVED_FROM
                else declaration_rule_by_concept.get(mapping.concept_id)
            )
            findings.append(
                AllergenFinding(
                    id=finding_id,
                    concept_id=mapping.concept_id,
                    relationship_type=mapping.relationship_type,
                    matched_text=matched_text,
                    start_index=start_index,
                    end_index=end_index,
                    mapping_id=mapping.id,
                    rule_id=rule_id,
                    source_text=source_text,
                    language=mapping.language,
                    source_field=ingredient_text.source_field,
                    source_url=record.source_url,
                    source_revision=record.source_revision,
                    off_dataset_version_id=record.dataset_version.id,
                    reference_dataset_version_id=reference_data.version.id,
                    engine_version=engine_version,
                )
            )

        findings.sort(key=lambda f: (f.start_index, f.end_index, f.mapping_id or ""))
        return tuple(findings)



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
            status=AllergenAssessmentStatus.NOT_ASSESSED,
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
        self._matcher = matcher or DefaultAllergenDeterministicMatcher()
        self._cache = cache

    def evaluate(
        self, record: ExternalPackageRecord
    ) -> AllergenAssessmentEvaluation:
        if not self._enabled:
            return AllergenAssessmentEvaluation(
                status=AllergenAssessmentStatus.NOT_ASSESSED,
                reason=AllergenAssessmentReason.FEATURE_DISABLED,
                evidence_coverage=EvidenceCoverageState.NOT_ASSESSED,
                engine_version=None,
                reference_dataset_version=None,
                concepts=(),
                findings=(),
                source_signals=(),
            )
        source_signals: tuple[PackageMatchEvidence, ...] = ()
        active_data: ActiveAllergenReferenceData | None = None
        try:
            source_signals = self._extractor.extract_signals(record)
            active_data = (
                self._reference_data.get_active_data()
                if self._reference_data is not None
                else None
            )
            if active_data is None:
                return AllergenAssessmentEvaluation(
                    status=AllergenAssessmentStatus.NOT_ASSESSED,
                    reason=AllergenAssessmentReason.REFERENCE_UNAVAILABLE,
                    evidence_coverage=EvidenceCoverageState.NOT_ASSESSED,
                    engine_version=self._engine_version,
                    source_signals=source_signals,
                )

            cache_key: str | None = None
            if self._cache is not None:
                from lifegoods.package_matches.cache import assessment_cache_key_for_record

                cache_key = assessment_cache_key_for_record(
                    record,
                    reference_dataset_version_id=active_data.version.id,
                    engine_version=self._engine_version,
                )
                cached_evaluation = self._cache.get(cache_key)
                if cached_evaluation is not None:
                    return cached_evaluation

            english_ingredient_text = next(
                (
                    ingredient_text
                    for ingredient_text in record.ingredient_texts
                    if _is_english_evidence(ingredient_text)
                    and ingredient_text.value
                    and ingredient_text.value.strip()
                ),
                None,
            )
            if english_ingredient_text is None:
                evaluation = AllergenAssessmentEvaluation(
                    status=AllergenAssessmentStatus.NOT_ASSESSED,
                    reason=AllergenAssessmentReason.EVIDENCE_UNAVAILABLE,
                    evidence_coverage=EvidenceCoverageState.NOT_ASSESSED,
                    engine_version=self._engine_version,
                    reference_dataset_version=active_data.version,
                    source_signals=source_signals,
                )
                if self._cache is not None and cache_key is not None:
                    self._cache.set(cache_key, evaluation)
                return evaluation

            findings = self._matcher.match(
                ingredient_text=english_ingredient_text,
                record=record,
                reference_data=active_data,
                engine_version=self._engine_version,
            )
            findings_by_concept: dict[str, list[AllergenFinding]] = {}
            for finding in findings:
                findings_by_concept.setdefault(finding.concept_id, []).append(finding)

            concepts_by_id = {concept.id: concept for concept in active_data.concepts}
            rule_ids_by_concept: dict[str, list[str]] = {}
            for rule in sorted(active_data.rules, key=lambda item: item.id):
                rule_ids_by_concept.setdefault(rule.concept_id, []).append(rule.id)

            concept_outcomes: list[AllergenConceptOutcome] = []
            for concept in sorted(active_data.concepts, key=lambda item: item.id):
                if not concept.is_leaf:
                    continue

                parent_ids: list[str] = []
                current_parent_id = concept.parent_id
                while current_parent_id is not None:
                    parent_ids.append(current_parent_id)
                    parent = concepts_by_id.get(current_parent_id)
                    current_parent_id = parent.parent_id if parent is not None else None

                applicable_concept_ids = (concept.id, *parent_ids)
                applicable_rule_ids = tuple(
                    rule_id
                    for applicable_concept_id in applicable_concept_ids
                    for rule_id in rule_ids_by_concept.get(applicable_concept_id, ())
                )
                concept_findings = findings_by_concept.get(concept.id, [])
                if concept_findings:
                    outcome = AllergenAssessmentOutcome.DERIVED_FROM_INGREDIENT
                    finding_ids = tuple(finding.id for finding in concept_findings)
                else:
                    outcome = AllergenAssessmentOutcome.LABEL_INCOMPLETE_OR_UNREADABLE
                    finding_ids = ()
                concept_outcomes.append(
                    AllergenConceptOutcome(
                        concept_id=concept.id,
                        name=concept.name,
                        outcome=outcome,
                        finding_ids=finding_ids,
                        parent_ids=tuple(parent_ids),
                        rule_ids=applicable_rule_ids,
                    )
                )

            evaluation = AllergenAssessmentEvaluation(
                status=AllergenAssessmentStatus.COMPLETED,
                reason=None,
                evidence_coverage=EvidenceCoverageState.PARTIAL,
                engine_version=self._engine_version,
                reference_dataset_version=active_data.version,
                concepts=tuple(concept_outcomes),
                findings=findings,
                source_signals=source_signals,
            )
            if self._cache is not None and cache_key is not None:
                self._cache.set(cache_key, evaluation)
            return evaluation
        except Exception as error:
            logger.warning(
                "Allergen Assessment Evaluation failed",
                extra={
                    "event": "allergen_assessment_failed",
                    "operation": "evaluate_package_match",
                    "failure_category": "evaluation_error",
                    "error_category": type(error).__name__,
                },
            )
            return AllergenAssessmentEvaluation(
                status=AllergenAssessmentStatus.NOT_ASSESSED,
                reason=AllergenAssessmentReason.ASSESSMENT_FAILED,
                evidence_coverage=EvidenceCoverageState.NOT_ASSESSED,
                engine_version=self._engine_version,
                reference_dataset_version=(
                    active_data.version if active_data is not None else None
                ),
                source_signals=source_signals,
            )
