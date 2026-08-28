from __future__ import annotations

import re
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
    AllergenRelationshipType,
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


class AllergenDeterministicMatcher(Protocol):
    def match(
        self,
        *,
        ingredient_text: SourcedValue[str],
        record: ExternalPackageRecord,
        reference_data: ActiveAllergenReferenceData,
        engine_version: str,
    ) -> tuple[AllergenFinding, ...]: ...


class DefaultAllergenDeterministicMatcher:
    def match(
        self,
        *,
        ingredient_text: SourcedValue[str],
        record: ExternalPackageRecord,
        reference_data: ActiveAllergenReferenceData,
        engine_version: str,
    ) -> tuple[AllergenFinding, ...]:
        findings: list[AllergenFinding] = []
        source_text = ingredient_text.value
        if not source_text:
            return ()

        rule_by_concept: dict[str, str] = {}
        for rule in reference_data.rules:
            if rule.concept_id not in rule_by_concept:
                rule_by_concept[rule.concept_id] = rule.id

        for mapping in reference_data.mappings:
            if (
                ingredient_text.language
                and mapping.language
                and ingredient_text.language.lower() != mapping.language.lower()
            ):
                continue

            mapped_text = mapping.mapped_text.strip()
            if not mapped_text:
                continue

            pattern = re.compile(rf"\b{re.escape(mapped_text)}\b", re.IGNORECASE)
            for match in pattern.finditer(source_text):
                start_index = match.start()
                end_index = match.end()
                matched_text = source_text[start_index:end_index]
                finding_id = (
                    f"finding-{reference_data.version.id}-{mapping.id}-{start_index}-{end_index}"
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
                        rule_id=rule_by_concept.get(mapping.concept_id),
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
        self._matcher = matcher or DefaultAllergenDeterministicMatcher()
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
        source_signals = self._extractor.extract_signals(record)
        if self._reference_data is None:
            return AllergenAssessmentEvaluation(
                status=AllergenAssessmentOutcome.NOT_ASSESSED,
                reason=AllergenAssessmentReason.REFERENCE_VERSION_UNAVAILABLE,
                evidence_coverage=EvidenceCoverageState.NOT_ASSESSED,
                engine_version=self._engine_version,
                reference_dataset_version=None,
                concepts=(),
                findings=(),
                source_signals=source_signals,
            )
        active_data = self._reference_data.get_active_data()
        if active_data is None:
            return AllergenAssessmentEvaluation(
                status=AllergenAssessmentOutcome.NOT_ASSESSED,
                reason=AllergenAssessmentReason.REFERENCE_VERSION_UNAVAILABLE,
                evidence_coverage=EvidenceCoverageState.NOT_ASSESSED,
                engine_version=self._engine_version,
                reference_dataset_version=None,
                concepts=(),
                findings=(),
                source_signals=source_signals,
            )

        english_ingredient_text: SourcedValue[str] | None = None
        for it in record.ingredient_texts:
            if (
                it.language == "en"
                or (it.source_field and it.source_field == "ingredients_text_en")
                or (it.source_field and it.source_field.endswith("_en"))
            ) and (it.value and it.value.strip()):
                english_ingredient_text = it
                break


        if english_ingredient_text is None:
            return AllergenAssessmentEvaluation(
                status=AllergenAssessmentOutcome.NOT_ASSESSED,
                reason=AllergenAssessmentReason.EVIDENCE_UNAVAILABLE,
                evidence_coverage=EvidenceCoverageState.NOT_ASSESSED,
                engine_version=self._engine_version,
                reference_dataset_version=active_data.version,
                concepts=(),
                findings=(),
                source_signals=source_signals,
            )

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
                finding_ids = tuple(f.id for f in concept_findings)
            else:
                outcome = AllergenAssessmentOutcome.LABEL_INCOMPLETE_OR_UNREADABLE
                finding_ids = ()
            concept_outcomes.append(
                AllergenConceptOutcome(
                    concept_id=concept.id,
                    name=concept.name,
                    outcome=outcome,
                    reason=None,
                    finding_ids=finding_ids,
                    parent_ids=tuple(parent_ids),
                    rule_ids=applicable_rule_ids,
                )
            )

        top_level_status = (
            AllergenAssessmentOutcome.DERIVED_FROM_INGREDIENT
            if findings
            else AllergenAssessmentOutcome.LABEL_INCOMPLETE_OR_UNREADABLE
        )

        return AllergenAssessmentEvaluation(
            status=top_level_status,
            reason=None,
            evidence_coverage=EvidenceCoverageState.PARTIAL,
            engine_version=self._engine_version,
            reference_dataset_version=active_data.version,
            concepts=tuple(concept_outcomes),
            findings=findings,
            source_signals=source_signals,
        )
