from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

from sqlalchemy.orm import Session, sessionmaker

from lifegoods.reference_datasets.models import (
    AllergenRuleRecord,
    LexicalMappingRecord,
    ReferenceConceptRecord,
    ReferenceDatasetPointerRecord,
    ReferenceDatasetVersionRecord,
)


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
class AllergenReferenceRule:
    id: str
    concept_id: str
    source_id: str
    rule_kind: str
    condition_family: str
    description: str | None = None


@dataclass(frozen=True, slots=True)
class ActiveAllergenReferenceData:
    version: AllergenAssessmentReferenceVersion
    concepts: tuple[AllergenReferenceConcept, ...] = ()
    mappings: tuple[AllergenReferenceMapping, ...] = ()
    rules: tuple[AllergenReferenceRule, ...] = ()


class AllergenReferenceDataAccess(Protocol):
    def get_active_version(self) -> AllergenAssessmentReferenceVersion | None: ...
    def get_active_data(self) -> ActiveAllergenReferenceData | None: ...


class DatabaseAllergenReferenceDataAccess:
    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    def get_active_version(self) -> AllergenAssessmentReferenceVersion | None:
        active_data = self.get_active_data()
        return active_data.version if active_data is not None else None

    def get_active_data(self) -> ActiveAllergenReferenceData | None:
        try:
            with self._session_factory() as session:
                pointer = (
                    session.query(ReferenceDatasetPointerRecord)
                    .filter_by(dataset_kind="FOOD_ALLERGEN")
                    .first()
                )
                if pointer is None:
                    return None

                version = (
                    session.query(ReferenceDatasetVersionRecord)
                    .filter_by(id=pointer.active_version_id)
                    .first()
                )
                if (
                    version is None
                    or version.status != "ACTIVE"
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

                ref_version = AllergenAssessmentReferenceVersion(
                    id=version.id,
                    source_url=version.source_url,
                    retrieved_at=retrieved_at,
                    activated_at=activated_at,
                    sha256=version.sha256,
                    review_kind=pointer.review_kind,
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

                rules = tuple(
                    AllergenReferenceRule(
                        id=r.id,
                        concept_id=r.concept_id,
                        source_id=r.source_id,
                        rule_kind=r.rule_kind,
                        condition_family=r.condition_family,
                        description=r.description,
                    )
                    for r in (
                        session.query(AllergenRuleRecord)
                        .filter_by(dataset_version_id=version.id)
                        .order_by(AllergenRuleRecord.id)
                        .all()
                    )
                )

                return ActiveAllergenReferenceData(
                    version=ref_version,
                    concepts=concepts,
                    mappings=mappings,
                    rules=rules,
                )
        except Exception:
            return None

