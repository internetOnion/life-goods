from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from threading import Lock
from typing import Any, Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from lifegoods.reference_datasets.models import (
    AllergenRuleRecord,
    HalalIngredientMappingRecord,
    LexicalExclusionRecord,
    LexicalMappingRecord,
    ReferenceConceptRecord,
    ReferenceDatasetPointerRecord,
    ReferenceDatasetVersionRecord,
)

logger = logging.getLogger(__name__)


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
class AllergenReferenceConcept:
    id: str
    name: str
    condition_family: str
    parent_id: str | None = None
    is_leaf: bool = True
    description: str | None = None


@dataclass(frozen=True, slots=True)
class AllergenReferenceMapping:
    id: str
    concept_id: str
    language: str
    mapped_text: str
    relationship_type: str
    notes: str | None = None


@dataclass(frozen=True, slots=True)
class AllergenReferenceExclusion:
    id: str
    concept_id: str
    language: str
    excluded_text: str
    notes: str | None = None


@dataclass(frozen=True, slots=True)
class AllergenReferenceRule:
    id: str
    concept_id: str
    source_id: str
    rule_kind: str
    condition_family: str
    mapping_id: str | None = None
    description: str | None = None


@dataclass(frozen=True, slots=True)
class ActiveAllergenReferenceData:
    version: AllergenAssessmentReferenceVersion
    concepts: tuple[AllergenReferenceConcept, ...] = ()
    mappings: tuple[AllergenReferenceMapping, ...] = ()
    exclusions: tuple[AllergenReferenceExclusion, ...] = ()
    rules: tuple[AllergenReferenceRule, ...] = ()


class AllergenReferenceDataAccess(Protocol):
    def get_active_version(self) -> AllergenAssessmentReferenceVersion | None: ...
    def get_active_data(self) -> ActiveAllergenReferenceData | None: ...


class DatabaseAllergenReferenceDataAccess:
    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory
        self._cache: dict[
            tuple[str, datetime, str], ActiveAllergenReferenceData
        ] = {}
        self._cache_lock = Lock()

    def get_active_version(self) -> AllergenAssessmentReferenceVersion | None:
        active_data = self.get_active_data()
        return active_data.version if active_data is not None else None

    def get_active_data(self) -> ActiveAllergenReferenceData | None:
        try:
            with self._session_factory() as session:
                active_row = session.execute(
                    select(
                        ReferenceDatasetPointerRecord,
                        ReferenceDatasetVersionRecord,
                    )
                    .join(
                        ReferenceDatasetVersionRecord,
                        ReferenceDatasetVersionRecord.id
                        == ReferenceDatasetPointerRecord.active_version_id,
                    )
                    .where(
                        ReferenceDatasetPointerRecord.dataset_kind == "FOOD_ALLERGEN"
                    )
                )
                active = active_row.first()
                if active is None:
                    return None
                pointer, version = active
                if (
                    version.status != "ACTIVE"
                    or version.validation_errors
                ):
                    return None

                retrieved_at = (
                    version.retrieved_at.replace(tzinfo=UTC)
                    if version.retrieved_at.tzinfo is None
                    else version.retrieved_at
                )
                activated_at = (
                    pointer.activated_at.replace(tzinfo=UTC)
                    if pointer.activated_at.tzinfo is None
                    else pointer.activated_at
                )
                cache_key = (version.id, activated_at, version.review_kind)
                with self._cache_lock:
                    cached = self._cache.get(cache_key)
                if cached is not None:
                    return cached

                ref_version = AllergenAssessmentReferenceVersion(
                    id=version.id,
                    source_url=version.source_url,
                    retrieved_at=retrieved_at,
                    activated_at=activated_at,
                    sha256=version.sha256,
                    review_kind=version.review_kind,
                    dataset_kind=pointer.dataset_kind,
                )

                concepts = tuple(
                    AllergenReferenceConcept(
                        id=c.id,
                        name=c.name,
                        condition_family=c.condition_family,
                        parent_id=c.parent_id,
                        is_leaf=c.is_leaf,
                        description=c.description,
                    )
                    for c in (
                        session.query(ReferenceConceptRecord)
                        .filter_by(dataset_version_id=version.id)
                        .order_by(ReferenceConceptRecord.id)
                        .all()
                    )
                )

                mappings = tuple(
                    AllergenReferenceMapping(
                        id=m.id,
                        concept_id=m.concept_id,
                        language=m.language,
                        mapped_text=m.mapped_text,
                        relationship_type=m.relationship_type,
                        notes=m.notes,
                    )
                    for m in (
                        session.query(LexicalMappingRecord)
                        .filter_by(dataset_version_id=version.id)
                        .order_by(LexicalMappingRecord.id)
                        .all()
                    )
                )

                exclusions = tuple(
                    AllergenReferenceExclusion(
                        id=e.id,
                        concept_id=e.concept_id,
                        language=e.language,
                        excluded_text=e.excluded_text,
                        notes=e.notes,
                    )
                    for e in (
                        session.query(LexicalExclusionRecord)
                        .filter_by(dataset_version_id=version.id)
                        .order_by(LexicalExclusionRecord.id)
                        .all()
                    )
                )

                rules = tuple(
                    AllergenReferenceRule(
                        id=r.id,
                        concept_id=r.concept_id,
                        source_id=r.source_id,
                        rule_kind=r.rule_kind,
                        condition_family=r.condition_family,
                        mapping_id=r.mapping_id,
                        description=r.description,
                    )
                    for r in (
                        session.query(AllergenRuleRecord)
                        .filter_by(dataset_version_id=version.id)
                        .order_by(AllergenRuleRecord.id)
                        .all()
                    )
                )

                active_data = ActiveAllergenReferenceData(
                    version=ref_version,
                    concepts=concepts,
                    mappings=mappings,
                    exclusions=exclusions,
                    rules=rules,
                )
                with self._cache_lock:
                    self._cache[cache_key] = active_data
                    if len(self._cache) > 8:
                        oldest_key = next(iter(self._cache))
                        del self._cache[oldest_key]
                return active_data
        except Exception as error:
            logger.warning(
                "Reference Dataset operation unavailable",
                extra={
                    "event": "reference_dataset_unavailable",
                    "dependency": "postgresql",
                    "operation": "read_active_allergen_reference_data",
                    "failure_category": "dependency_error",
                    "error_category": type(error).__name__,
                },
            )
            return None


@dataclass(frozen=True, slots=True)
class HalalAssessmentReferenceVersion:
    id: str
    source_url: str
    retrieved_at: datetime
    activated_at: datetime
    sha256: str
    review_kind: str
    dataset_kind: str = "HALAL_INGREDIENT"


@dataclass(frozen=True, slots=True)
class HalalReferenceConcept:
    id: str
    name: str
    condition_family: str
    parent_id: str | None = None
    is_leaf: bool = True
    description: str | None = None


@dataclass(frozen=True, slots=True)
class HalalReferenceLexicalMapping:
    id: str
    concept_id: str
    language: str
    mapped_text: str
    relationship_type: str
    notes: str | None = None


HalalReferenceExclusion = AllergenReferenceExclusion


@dataclass(frozen=True, slots=True)
class HalalSourceCitation:
    source_id: str
    jurisdiction: str
    edition: str | None = None
    locator: str = ""
    notes: str | None = None


@dataclass(frozen=True, slots=True)
class HalalReferenceIngredientMapping:
    id: str
    concept_id: str
    classification: str
    citations: tuple[HalalSourceCitation, ...] = ()
    notes: str | None = None


@dataclass(frozen=True, slots=True)
class ActiveHalalReferenceData:
    version: HalalAssessmentReferenceVersion
    concepts: tuple[HalalReferenceConcept, ...] = ()
    mappings: tuple[HalalReferenceLexicalMapping, ...] = ()
    exclusions: tuple[HalalReferenceExclusion, ...] = ()
    halal_ingredient_mappings: tuple[HalalReferenceIngredientMapping, ...] = ()


class HalalReferenceDataAccess(Protocol):
    def get_active_version(self) -> HalalAssessmentReferenceVersion | None: ...
    def get_active_data(self) -> ActiveHalalReferenceData | None: ...


def _parse_citations(raw_citations: Any) -> tuple[HalalSourceCitation, ...]:
    if not isinstance(raw_citations, list):
        return ()
    citations: list[HalalSourceCitation] = []
    for item in raw_citations:
        if isinstance(item, dict):
            citations.append(
                HalalSourceCitation(
                    source_id=str(item.get("source_id", "")),
                    jurisdiction=str(item.get("jurisdiction", "")),
                    edition=item.get("edition"),
                    locator=str(item.get("locator", "")),
                    notes=item.get("notes"),
                )
            )
    return tuple(citations)


class DatabaseHalalReferenceDataAccess:
    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory
        self._cache: dict[
            tuple[str, datetime, str], ActiveHalalReferenceData
        ] = {}
        self._cache_lock = Lock()

    def get_active_version(self) -> HalalAssessmentReferenceVersion | None:
        active_data = self.get_active_data()
        return active_data.version if active_data is not None else None

    def get_active_data(self) -> ActiveHalalReferenceData | None:
        try:
            with self._session_factory() as session:
                active_row = session.execute(
                    select(
                        ReferenceDatasetPointerRecord,
                        ReferenceDatasetVersionRecord,
                    )
                    .join(
                        ReferenceDatasetVersionRecord,
                        ReferenceDatasetVersionRecord.id
                        == ReferenceDatasetPointerRecord.active_version_id,
                    )
                    .where(
                        ReferenceDatasetPointerRecord.dataset_kind
                        == "HALAL_INGREDIENT"
                    )
                )
                active = active_row.first()
                if active is None:
                    return None
                pointer, version = active
                if (
                    version.status != "ACTIVE"
                    or version.validation_errors
                ):
                    return None

                retrieved_at = (
                    version.retrieved_at.replace(tzinfo=UTC)
                    if version.retrieved_at.tzinfo is None
                    else version.retrieved_at
                )
                activated_at = (
                    pointer.activated_at.replace(tzinfo=UTC)
                    if pointer.activated_at.tzinfo is None
                    else pointer.activated_at
                )
                cache_key = (version.id, activated_at, version.review_kind)
                with self._cache_lock:
                    cached = self._cache.get(cache_key)
                if cached is not None:
                    return cached

                ref_version = HalalAssessmentReferenceVersion(
                    id=version.id,
                    source_url=version.source_url,
                    retrieved_at=retrieved_at,
                    activated_at=activated_at,
                    sha256=version.sha256,
                    review_kind=version.review_kind,
                    dataset_kind=pointer.dataset_kind,
                )

                concepts = tuple(
                    HalalReferenceConcept(
                        id=c.id,
                        name=c.name,
                        condition_family=c.condition_family,
                        parent_id=c.parent_id,
                        is_leaf=c.is_leaf,
                        description=c.description,
                    )
                    for c in (
                        session.query(ReferenceConceptRecord)
                        .filter_by(dataset_version_id=version.id)
                        .order_by(ReferenceConceptRecord.id)
                        .all()
                    )
                )

                mappings = tuple(
                    HalalReferenceLexicalMapping(
                        id=m.id,
                        concept_id=m.concept_id,
                        language=m.language,
                        mapped_text=m.mapped_text,
                        relationship_type=m.relationship_type,
                        notes=m.notes,
                    )
                    for m in (
                        session.query(LexicalMappingRecord)
                        .filter_by(dataset_version_id=version.id)
                        .order_by(LexicalMappingRecord.id)
                        .all()
                    )
                )

                exclusions = tuple(
                    HalalReferenceExclusion(
                        id=e.id,
                        concept_id=e.concept_id,
                        language=e.language,
                        excluded_text=e.excluded_text,
                        notes=e.notes,
                    )
                    for e in (
                        session.query(LexicalExclusionRecord)
                        .filter_by(dataset_version_id=version.id)
                        .order_by(LexicalExclusionRecord.id)
                        .all()
                    )
                )

                halal_ingredient_mappings = tuple(
                    HalalReferenceIngredientMapping(
                        id=hm.id,
                        concept_id=hm.concept_id,
                        classification=hm.classification,
                        citations=_parse_citations(hm.citations),
                        notes=hm.notes,
                    )
                    for hm in (
                        session.query(HalalIngredientMappingRecord)
                        .filter_by(dataset_version_id=version.id)
                        .order_by(HalalIngredientMappingRecord.id)
                        .all()
                    )
                )

                active_data = ActiveHalalReferenceData(
                    version=ref_version,
                    concepts=concepts,
                    mappings=mappings,
                    exclusions=exclusions,
                    halal_ingredient_mappings=halal_ingredient_mappings,
                )
                with self._cache_lock:
                    self._cache[cache_key] = active_data
                    if len(self._cache) > 8:
                        oldest_key = next(iter(self._cache))
                        del self._cache[oldest_key]
                return active_data
        except Exception as error:
            logger.warning(
                "Reference Dataset operation unavailable",
                extra={
                    "event": "reference_dataset_unavailable",
                    "dependency": "postgresql",
                    "operation": "read_active_halal_reference_data",
                    "failure_category": "dependency_error",
                    "error_category": type(error).__name__,
                },
            )
            return None
