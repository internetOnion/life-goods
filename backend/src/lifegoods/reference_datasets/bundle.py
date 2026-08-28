from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from enum import StrEnum
from pathlib import Path
from typing import Any


class ConditionFamily(StrEnum):
    FOOD_ALLERGEN = "FOOD_ALLERGEN"
    COELIAC_GLUTEN = "COELIAC_GLUTEN"
    SULPHITE_SENSITIVITY = "SULPHITE_SENSITIVITY"
    INTOLERANCE = "INTOLERANCE"


class ReferenceReviewKind(StrEnum):
    FOOD_DOMAIN_REVIEW = "FOOD_DOMAIN_REVIEW"
    PROJECT_MAINTAINER_APPROVAL = "PROJECT_MAINTAINER_APPROVAL"


class AllergenRelationshipType(StrEnum):
    EXACT_NAME = "EXACT_NAME"
    SPELLING_VARIANT = "SPELLING_VARIANT"
    DERIVED_FROM = "DERIVED_FROM"
    CONTAINS_SOURCE = "CONTAINS_SOURCE"
    PRECAUTIONARY_PHRASE = "PRECAUTIONARY_PHRASE"


class AllergenRuleKind(StrEnum):
    MANDATORY_DECLARATION = "MANDATORY_DECLARATION"
    REGIONAL_OR_NATIONAL_DECLARATION = "REGIONAL_OR_NATIONAL_DECLARATION"
    EXEMPTION = "EXEMPTION"
    DERIVATIVE_MATCH = "DERIVATIVE_MATCH"
    PRECAUTIONARY = "PRECAUTIONARY"


@dataclass(frozen=True, slots=True)
class ReferenceDatasetManifest:
    id: str
    dataset_kind: str
    edition: str | None
    jurisdiction: str
    source_url: str
    licensing_decision: str
    project_approver: str | None
    review_kind: str
    sha256: str = ""

    def to_dict(self, *, include_sha256: bool = True) -> dict[str, Any]:
        data = asdict(self)
        if not include_sha256:
            data.pop("sha256", None)
        return data

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ReferenceDatasetManifest:
        return cls(
            id=str(data["id"]),
            dataset_kind=str(data["dataset_kind"]),
            edition=data.get("edition"),
            jurisdiction=str(data["jurisdiction"]),
            source_url=str(data["source_url"]),
            licensing_decision=str(data["licensing_decision"]),
            project_approver=data.get("project_approver"),
            review_kind=str(data["review_kind"]),
            sha256=str(data.get("sha256", "")),
        )


@dataclass(frozen=True, slots=True)
class ReferenceSourceDefinition:
    id: str
    name: str
    source_type: str
    source_url: str
    jurisdiction: str
    publisher: str
    edition: str | None = None
    licensing_decision: str = ""
    terms_version: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ReferenceSourceDefinition:
        return cls(
            id=str(data["id"]),
            name=str(data["name"]),
            source_type=str(data["source_type"]),
            source_url=str(data["source_url"]),
            jurisdiction=str(data["jurisdiction"]),
            publisher=str(data["publisher"]),
            edition=data.get("edition"),
            licensing_decision=str(data.get("licensing_decision", "")),
            terms_version=data.get("terms_version"),
        )


@dataclass(frozen=True, slots=True)
class ReferenceConceptDefinition:
    id: str
    name: str
    condition_family: str
    parent_id: str | None = None
    is_leaf: bool = True
    description: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ReferenceConceptDefinition:
        return cls(
            id=str(data["id"]),
            name=str(data["name"]),
            condition_family=str(data["condition_family"]),
            parent_id=data.get("parent_id"),
            is_leaf=bool(data.get("is_leaf", True)),
            description=data.get("description"),
        )


@dataclass(frozen=True, slots=True)
class LexicalMappingDefinition:
    id: str
    concept_id: str
    language: str
    mapped_text: str
    relationship_type: str = AllergenRelationshipType.EXACT_NAME
    notes: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> LexicalMappingDefinition:
        return cls(
            id=str(data["id"]),
            concept_id=str(data["concept_id"]),
            language=str(data["language"]),
            mapped_text=str(data["mapped_text"]),
            relationship_type=str(
                data.get("relationship_type", AllergenRelationshipType.EXACT_NAME)
            ),
            notes=data.get("notes"),
        )


@dataclass(frozen=True, slots=True)
class AllergenRuleDefinition:
    id: str
    concept_id: str
    source_id: str
    rule_kind: str = AllergenRuleKind.MANDATORY_DECLARATION
    condition_family: str = ConditionFamily.FOOD_ALLERGEN
    description: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AllergenRuleDefinition:
        return cls(
            id=str(data["id"]),
            concept_id=str(data["concept_id"]),
            source_id=str(data["source_id"]),
            rule_kind=str(data.get("rule_kind", AllergenRuleKind.MANDATORY_DECLARATION)),
            condition_family=str(data.get("condition_family", ConditionFamily.FOOD_ALLERGEN)),
            description=data.get("description"),
        )


def compute_bundle_sha256(
    *,
    manifest: ReferenceDatasetManifest,
    sources: list[ReferenceSourceDefinition],
    concepts: list[ReferenceConceptDefinition],
    mappings: list[LexicalMappingDefinition],
    rules: list[AllergenRuleDefinition],
) -> str:
    canonical_payload = {
        "manifest": manifest.to_dict(include_sha256=False),
        "sources": sorted([s.to_dict() for s in sources], key=lambda x: x["id"]),
        "concepts": sorted([c.to_dict() for c in concepts], key=lambda x: x["id"]),
        "mappings": sorted([m.to_dict() for m in mappings], key=lambda x: x["id"]),
        "rules": sorted([r.to_dict() for r in rules], key=lambda x: x["id"]),
    }
    encoded = json.dumps(canonical_payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


@dataclass(frozen=True, slots=True)
class ReferenceBundle:
    manifest: ReferenceDatasetManifest
    sources: list[ReferenceSourceDefinition]
    concepts: list[ReferenceConceptDefinition]
    mappings: list[LexicalMappingDefinition]
    rules: list[AllergenRuleDefinition]

    def compute_sha256(self) -> str:
        return compute_bundle_sha256(
            manifest=self.manifest,
            sources=self.sources,
            concepts=self.concepts,
            mappings=self.mappings,
            rules=self.rules,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "manifest": self.manifest.to_dict(include_sha256=True),
            "sources": [s.to_dict() for s in self.sources],
            "concepts": [c.to_dict() for c in self.concepts],
            "mappings": [m.to_dict() for m in self.mappings],
            "rules": [r.to_dict() for r in self.rules],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ReferenceBundle:
        manifest = ReferenceDatasetManifest.from_dict(data["manifest"])
        sources = [ReferenceSourceDefinition.from_dict(s) for s in data.get("sources", [])]
        concepts = [ReferenceConceptDefinition.from_dict(c) for c in data.get("concepts", [])]
        mappings = [LexicalMappingDefinition.from_dict(m) for m in data.get("mappings", [])]
        rules = [AllergenRuleDefinition.from_dict(r) for r in data.get("rules", [])]
        return cls(
            manifest=manifest,
            sources=sources,
            concepts=concepts,
            mappings=mappings,
            rules=rules,
        )

    @classmethod
    def from_json_file(cls, path: Path | str) -> ReferenceBundle:
        raw = Path(path).read_text(encoding="utf-8")
        return cls.from_dict(json.loads(raw))

    def to_json_file(self, path: Path | str) -> None:
        Path(path).write_text(
            json.dumps(self.to_dict(), indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
