from __future__ import annotations

from types import MappingProxyType
from typing import Any, Protocol, cast

from sqlalchemy.orm import Session

from lifegoods.reference_datasets.bundle import (
    FoodAllergenReferenceBundle,
    ReferenceDatasetBundle,
    ReferenceDatasetKind,
)
from lifegoods.reference_datasets.models import (
    AllergenRuleRecord,
    LexicalExclusionRecord,
    LexicalMappingRecord,
    ReferenceConceptRecord,
    ReferenceDatasetVersionRecord,
    ReferenceSourceRecord,
)


class ReferenceDatasetKindAdapter(Protocol):
    def persist_records(
        self,
        session: Session,
        version: ReferenceDatasetVersionRecord,
        bundle: ReferenceDatasetBundle,
    ) -> None: ...

    def bundle_counts(self, bundle: ReferenceDatasetBundle) -> dict[str, int]: ...
    def version_counts(self, version: ReferenceDatasetVersionRecord) -> dict[str, int]: ...
    def inspect_records(self, version: ReferenceDatasetVersionRecord) -> dict[str, Any]: ...

    def activation_errors(
        self, session: Session, version: ReferenceDatasetVersionRecord
    ) -> list[str]: ...


class FoodAllergenReferenceDatasetAdapter:
    @staticmethod
    def _bundle(bundle: ReferenceDatasetBundle) -> FoodAllergenReferenceBundle:
        if not isinstance(bundle, FoodAllergenReferenceBundle):
            raise ValueError(
                "FOOD_ALLERGEN persistence requires FoodAllergenReferenceBundle, "
                f"received '{type(bundle).__name__}'"
            )
        return cast(FoodAllergenReferenceBundle, bundle)

    def persist_records(
        self,
        session: Session,
        version: ReferenceDatasetVersionRecord,
        bundle: ReferenceDatasetBundle,
    ) -> None:
        allergen_bundle = self._bundle(bundle)

        roots = [concept for concept in allergen_bundle.concepts if concept.parent_id is None]
        children = [
            concept for concept in allergen_bundle.concepts if concept.parent_id is not None
        ]
        for concept in (*roots, *children):
            session.add(
                ReferenceConceptRecord(
                    dataset_version_id=version.id,
                    id=concept.id,
                    name=concept.name,
                    condition_family=concept.condition_family,
                    parent_id=concept.parent_id,
                    is_leaf=concept.is_leaf,
                    description=concept.description,
                )
            )

        session.flush()

        for mapping in allergen_bundle.mappings:
            session.add(
                LexicalMappingRecord(
                    dataset_version_id=version.id,
                    id=mapping.id,
                    concept_id=mapping.concept_id,
                    language=mapping.language,
                    mapped_text=mapping.mapped_text,
                    relationship_type=mapping.relationship_type,
                    notes=mapping.notes,
                )
            )

        session.flush()

        for exclusion in allergen_bundle.exclusions:
            session.add(
                LexicalExclusionRecord(
                    dataset_version_id=version.id,
                    id=exclusion.id,
                    concept_id=exclusion.concept_id,
                    language=exclusion.language,
                    excluded_text=exclusion.excluded_text,
                    notes=exclusion.notes,
                )
            )

        for rule in allergen_bundle.rules:
            session.add(
                AllergenRuleRecord(
                    dataset_version_id=version.id,
                    id=rule.id,
                    concept_id=rule.concept_id,
                    source_id=rule.source_id,
                    rule_kind=rule.rule_kind,
                    condition_family=rule.condition_family,
                    mapping_id=rule.mapping_id,
                    description=rule.description,
                )
            )

    def bundle_counts(self, bundle: ReferenceDatasetBundle) -> dict[str, int]:
        allergen_bundle = self._bundle(bundle)
        return {
            "concept_count": len(allergen_bundle.concepts),
            "mapping_count": len(allergen_bundle.mappings),
            "exclusion_count": len(allergen_bundle.exclusions),
            "rule_count": len(allergen_bundle.rules),
        }

    def version_counts(self, version: ReferenceDatasetVersionRecord) -> dict[str, int]:
        return {
            "concept_count": len(version.concepts),
            "mapping_count": len(version.mappings),
            "exclusion_count": len(version.exclusions),
            "rule_count": len(version.rules),
        }

    def inspect_records(self, version: ReferenceDatasetVersionRecord) -> dict[str, Any]:
        return {
            "concepts": [
                {
                    "id": concept.id,
                    "name": concept.name,
                    "condition_family": concept.condition_family,
                    "parent_id": concept.parent_id,
                    "is_leaf": concept.is_leaf,
                    "description": concept.description,
                }
                for concept in version.concepts
            ],
            "mappings": [
                {
                    "id": mapping.id,
                    "concept_id": mapping.concept_id,
                    "language": mapping.language,
                    "mapped_text": mapping.mapped_text,
                    "relationship_type": mapping.relationship_type,
                    "notes": mapping.notes,
                }
                for mapping in version.mappings
            ],
            "exclusions": [
                {
                    "id": exclusion.id,
                    "concept_id": exclusion.concept_id,
                    "language": exclusion.language,
                    "excluded_text": exclusion.excluded_text,
                    "notes": exclusion.notes,
                }
                for exclusion in version.exclusions
            ],
            "rules": [
                {
                    "id": rule.id,
                    "concept_id": rule.concept_id,
                    "source_id": rule.source_id,
                    "rule_kind": rule.rule_kind,
                    "condition_family": rule.condition_family,
                    "mapping_id": rule.mapping_id,
                    "description": rule.description,
                }
                for rule in version.rules
            ],
        }

    def activation_errors(
        self, session: Session, version: ReferenceDatasetVersionRecord
    ) -> list[str]:
        errors: list[str] = []
        for rule in version.rules:
            source = (
                rule.source
                or session.query(ReferenceSourceRecord).filter_by(id=rule.source_id).first()
            )
            if (
                source is None
                or not source.source_url
                or not source.licensing_decision
                or not source.jurisdiction
                or not source.name
                or not source.publisher
            ):
                errors.append(
                    f"Reference dataset version '{version.id}' references missing or "
                    f"incomplete source '{rule.source_id}'"
                )
        return errors


_KIND_ADAPTERS = MappingProxyType(
    {
        ReferenceDatasetKind.FOOD_ALLERGEN.value: FoodAllergenReferenceDatasetAdapter(),
    }
)


def get_reference_dataset_kind_adapter(
    dataset_kind: str | ReferenceDatasetKind,
) -> ReferenceDatasetKindAdapter:
    resolved_kind = str(dataset_kind)
    adapter = _KIND_ADAPTERS.get(resolved_kind)
    if adapter is None:
        supported_kinds = sorted(_KIND_ADAPTERS)
        raise ValueError(
            f"Unsupported dataset kind '{resolved_kind}'. Registered kinds are {supported_kinds}"
        )
    return adapter
