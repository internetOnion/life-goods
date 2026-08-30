from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from enum import StrEnum
from pathlib import Path
from types import MappingProxyType
from typing import Any, Protocol, cast


class ReferenceDatasetKind(StrEnum):
    FOOD_ALLERGEN = "FOOD_ALLERGEN"
    HALAL_INGREDIENT = "HALAL_INGREDIENT"


class ConditionFamily(StrEnum):
    FOOD_ALLERGEN = "FOOD_ALLERGEN"
    COELIAC_GLUTEN = "COELIAC_GLUTEN"
    SULPHITE_SENSITIVITY = "SULPHITE_SENSITIVITY"
    INTOLERANCE = "INTOLERANCE"
    HALAL_INGREDIENT = "HALAL_INGREDIENT"


class ReferenceReviewKind(StrEnum):
    FOOD_DOMAIN_REVIEW = "FOOD_DOMAIN_REVIEW"
    PROJECT_MAINTAINER_APPROVAL = "PROJECT_MAINTAINER_APPROVAL"
    HALAL_DOMAIN_REVIEW = "HALAL_DOMAIN_REVIEW"


class HalalClassification(StrEnum):
    EXPLICIT_PROHIBITED = "EXPLICIT_PROHIBITED"
    SOURCE_AMBIGUOUS = "SOURCE_AMBIGUOUS"


class HalalRelationshipType(StrEnum):
    EXACT_NAME = "EXACT_NAME"
    SPELLING_VARIANT = "SPELLING_VARIANT"
    DERIVED_FROM = "DERIVED_FROM"
    CONTAINS_SOURCE = "CONTAINS_SOURCE"


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
        required_fields = {
            "id",
            "dataset_kind",
            "jurisdiction",
            "source_url",
            "licensing_decision",
            "review_kind",
        }
        missing_fields = sorted(required_fields - data.keys())
        if missing_fields:
            missing = "', '".join(missing_fields)
            raise ValueError(f"Reference dataset manifest is missing required field(s) '{missing}'")
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
class LexicalExclusionDefinition:
    id: str
    concept_id: str
    language: str
    excluded_text: str
    notes: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> LexicalExclusionDefinition:
        return cls(
            id=str(data["id"]),
            concept_id=str(data["concept_id"]),
            language=str(data["language"]),
            excluded_text=str(data["excluded_text"]),
            notes=data.get("notes"),
        )


@dataclass(frozen=True, slots=True)
class AllergenRuleDefinition:
    id: str
    concept_id: str
    source_id: str
    rule_kind: str = AllergenRuleKind.MANDATORY_DECLARATION
    condition_family: str = ConditionFamily.FOOD_ALLERGEN
    mapping_id: str | None = None
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
            mapping_id=(str(data["mapping_id"]) if data.get("mapping_id") is not None else None),
            description=data.get("description"),
        )


@dataclass(frozen=True, slots=True)
class HalalSourceCitationDefinition:
    source_id: str
    jurisdiction: str
    edition: str
    locator: str
    notes: str | None = None

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        if self.notes is None:
            data.pop("notes", None)
        return data

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> HalalSourceCitationDefinition:
        return cls(
            source_id=str(data.get("source_id", "")),
            jurisdiction=str(data.get("jurisdiction", "")),
            edition=str(data.get("edition", "")),
            locator=str(data.get("locator", "")),
            notes=data.get("notes"),
        )


@dataclass(frozen=True, slots=True)
class HalalIngredientMappingDefinition:
    id: str
    concept_id: str
    classification: str
    citations: list[HalalSourceCitationDefinition]
    notes: str | None = None

    def to_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "id": self.id,
            "concept_id": self.concept_id,
            "classification": self.classification,
            "citations": [c.to_dict() for c in self.citations],
        }
        if self.notes is not None:
            data["notes"] = self.notes
        return data

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> HalalIngredientMappingDefinition:
        citations = [
            HalalSourceCitationDefinition.from_dict(c)
            for c in data.get("citations", [])
            if isinstance(c, dict)
        ]
        return cls(
            id=str(data.get("id", "")),
            concept_id=str(data.get("concept_id", "")),
            classification=str(data.get("classification", "")),
            citations=citations,
            notes=data.get("notes"),
        )


def compute_bundle_sha256(
    *,
    manifest: ReferenceDatasetManifest,
    sources: list[ReferenceSourceDefinition],
    concepts: list[ReferenceConceptDefinition],
    mappings: list[LexicalMappingDefinition],
    rules: list[AllergenRuleDefinition],
    exclusions: list[LexicalExclusionDefinition] | None = None,
) -> str:
    canonical_payload = {
        "manifest": manifest.to_dict(include_sha256=False),
        "sources": sorted([s.to_dict() for s in sources], key=lambda x: x["id"]),
        "concepts": sorted([c.to_dict() for c in concepts], key=lambda x: x["id"]),
        "mappings": sorted([m.to_dict() for m in mappings], key=lambda x: x["id"]),
        "exclusions": sorted([e.to_dict() for e in exclusions or []], key=lambda x: x["id"]),
        "rules": sorted([r.to_dict() for r in rules], key=lambda x: x["id"]),
    }
    encoded = json.dumps(canonical_payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def compute_halal_bundle_sha256(
    *,
    manifest: ReferenceDatasetManifest,
    sources: list[ReferenceSourceDefinition],
    concepts: list[ReferenceConceptDefinition],
    mappings: list[LexicalMappingDefinition],
    halal_ingredient_mappings: list[HalalIngredientMappingDefinition],
) -> str:
    canonical_payload = {
        "manifest": manifest.to_dict(include_sha256=False),
        "sources": sorted([s.to_dict() for s in sources], key=lambda x: x["id"]),
        "concepts": sorted([c.to_dict() for c in concepts], key=lambda x: x["id"]),
        "mappings": sorted([m.to_dict() for m in mappings], key=lambda x: x["id"]),
        "halal_ingredient_mappings": sorted(
            [m.to_dict() for m in halal_ingredient_mappings], key=lambda x: x["id"]
        ),
    }
    encoded = json.dumps(canonical_payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


class ReferenceDatasetBundle(Protocol):
    @property
    def manifest(self) -> ReferenceDatasetManifest: ...

    @property
    def sources(self) -> list[ReferenceSourceDefinition]: ...

    def compute_sha256(self) -> str: ...
    def to_dict(self) -> dict[str, Any]: ...


@dataclass(frozen=True, slots=True)
class FoodAllergenReferenceBundle:
    manifest: ReferenceDatasetManifest
    sources: list[ReferenceSourceDefinition]
    concepts: list[ReferenceConceptDefinition]
    mappings: list[LexicalMappingDefinition]
    rules: list[AllergenRuleDefinition]
    exclusions: list[LexicalExclusionDefinition] = field(default_factory=list)

    def compute_sha256(self) -> str:
        return compute_bundle_sha256(
            manifest=self.manifest,
            sources=self.sources,
            concepts=self.concepts,
            mappings=self.mappings,
            rules=self.rules,
            exclusions=self.exclusions,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "manifest": self.manifest.to_dict(include_sha256=True),
            "sources": [s.to_dict() for s in self.sources],
            "concepts": [c.to_dict() for c in self.concepts],
            "mappings": [m.to_dict() for m in self.mappings],
            "exclusions": [e.to_dict() for e in self.exclusions],
            "rules": [r.to_dict() for r in self.rules],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> FoodAllergenReferenceBundle:
        _validate_top_level_sections(data, ReferenceDatasetKind.FOOD_ALLERGEN)
        manifest = ReferenceDatasetManifest.from_dict(data["manifest"])
        if manifest.dataset_kind != ReferenceDatasetKind.FOOD_ALLERGEN:
            raise ValueError(
                f"Dataset kind '{manifest.dataset_kind}' cannot be parsed as a FOOD_ALLERGEN bundle"
            )
        sources = [ReferenceSourceDefinition.from_dict(s) for s in data.get("sources", [])]
        concepts = [ReferenceConceptDefinition.from_dict(c) for c in data.get("concepts", [])]
        mappings = [LexicalMappingDefinition.from_dict(m) for m in data.get("mappings", [])]
        exclusions = [LexicalExclusionDefinition.from_dict(e) for e in data.get("exclusions", [])]
        rules = [AllergenRuleDefinition.from_dict(r) for r in data.get("rules", [])]
        return cls(
            manifest=manifest,
            sources=sources,
            concepts=concepts,
            mappings=mappings,
            rules=rules,
            exclusions=exclusions,
        )

    @classmethod
    def from_json_file(cls, path: Path | str) -> FoodAllergenReferenceBundle:
        raw = Path(path).read_text(encoding="utf-8")
        return cls.from_dict(json.loads(raw))

    def to_json_file(self, path: Path | str) -> None:
        Path(path).write_text(
            json.dumps(self.to_dict(), indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )


@dataclass(frozen=True, slots=True)
class HalalIngredientReferenceBundle:
    manifest: ReferenceDatasetManifest
    sources: list[ReferenceSourceDefinition]
    concepts: list[ReferenceConceptDefinition]
    mappings: list[LexicalMappingDefinition]
    halal_ingredient_mappings: list[HalalIngredientMappingDefinition]

    def compute_sha256(self) -> str:
        return compute_halal_bundle_sha256(
            manifest=self.manifest,
            sources=self.sources,
            concepts=self.concepts,
            mappings=self.mappings,
            halal_ingredient_mappings=self.halal_ingredient_mappings,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "manifest": self.manifest.to_dict(include_sha256=True),
            "sources": [s.to_dict() for s in self.sources],
            "concepts": [c.to_dict() for c in self.concepts],
            "mappings": [m.to_dict() for m in self.mappings],
            "halal_ingredient_mappings": [m.to_dict() for m in self.halal_ingredient_mappings],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> HalalIngredientReferenceBundle:
        _validate_top_level_sections(data, ReferenceDatasetKind.HALAL_INGREDIENT)
        manifest = ReferenceDatasetManifest.from_dict(data["manifest"])
        if manifest.dataset_kind != ReferenceDatasetKind.HALAL_INGREDIENT:
            raise ValueError(
                f"Dataset kind '{manifest.dataset_kind}' cannot be parsed as a "
                "HALAL_INGREDIENT bundle"
            )
        sources = [ReferenceSourceDefinition.from_dict(s) for s in data.get("sources", [])]
        concepts = [ReferenceConceptDefinition.from_dict(c) for c in data.get("concepts", [])]
        mappings = [LexicalMappingDefinition.from_dict(m) for m in data.get("mappings", [])]
        halal_ingredient_mappings = [
            HalalIngredientMappingDefinition.from_dict(hm)
            for hm in data.get("halal_ingredient_mappings", [])
        ]
        return cls(
            manifest=manifest,
            sources=sources,
            concepts=concepts,
            mappings=mappings,
            halal_ingredient_mappings=halal_ingredient_mappings,
        )

    @classmethod
    def from_json_file(cls, path: Path | str) -> HalalIngredientReferenceBundle:
        raw = Path(path).read_text(encoding="utf-8")
        return cls.from_dict(json.loads(raw))

    def to_json_file(self, path: Path | str) -> None:
        Path(path).write_text(
            json.dumps(self.to_dict(), indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )


_COMMON_TOP_LEVEL_SECTIONS = frozenset({"manifest", "sources"})
_DATASET_SECTIONS = MappingProxyType(
    {
        ReferenceDatasetKind.FOOD_ALLERGEN.value: frozenset(
            {"concepts", "mappings", "exclusions", "rules"}
        ),
        ReferenceDatasetKind.HALAL_INGREDIENT.value: frozenset(
            {"concepts", "mappings", "halal_ingredient_mappings"}
        ),
    }
)


def _validate_top_level_sections(
    data: dict[str, Any], dataset_kind: str | ReferenceDatasetKind
) -> None:
    resolved_kind = str(dataset_kind)
    supported_sections = _DATASET_SECTIONS.get(resolved_kind)
    if supported_sections is None:
        supported_kinds = sorted(_DATASET_SECTIONS)
        raise ValueError(
            f"Unsupported dataset kind '{resolved_kind}'. Registered kinds are {supported_kinds}"
        )

    unexpected_sections = sorted(data.keys() - _COMMON_TOP_LEVEL_SECTIONS - supported_sections)
    if unexpected_sections:
        sections = "', '".join(unexpected_sections)
        raise ValueError(
            f"Dataset kind '{resolved_kind}' does not support top-level section(s) '{sections}'"
        )


def _parse_food_allergen_bundle(data: dict[str, Any]) -> ReferenceDatasetBundle:
    return FoodAllergenReferenceBundle.from_dict(data)


def _parse_halal_ingredient_bundle(data: dict[str, Any]) -> ReferenceDatasetBundle:
    return HalalIngredientReferenceBundle.from_dict(data)


_BUNDLE_PARSERS = MappingProxyType(
    {
        ReferenceDatasetKind.FOOD_ALLERGEN.value: _parse_food_allergen_bundle,
        ReferenceDatasetKind.HALAL_INGREDIENT.value: _parse_halal_ingredient_bundle,
    }
)


def parse_reference_bundle(data: dict[str, Any]) -> ReferenceDatasetBundle:
    if not isinstance(data, dict):
        raise ValueError("Reference dataset bundle must be a JSON object")

    manifest_data = data.get("manifest")
    if not isinstance(manifest_data, dict):
        raise ValueError("Reference dataset bundle must contain a manifest object")

    dataset_kind = manifest_data.get("dataset_kind")
    if not isinstance(dataset_kind, str) or not dataset_kind.strip():
        raise ValueError("Reference dataset manifest is missing required field 'dataset_kind'")

    parser = _BUNDLE_PARSERS.get(dataset_kind)
    if parser is None:
        supported_kinds = sorted(_BUNDLE_PARSERS)
        raise ValueError(
            f"Unsupported dataset kind '{dataset_kind}'. Registered kinds are {supported_kinds}"
        )

    _validate_top_level_sections(data, dataset_kind)
    return parser(data)


def load_reference_bundle(path: Path | str) -> ReferenceDatasetBundle:
    raw = Path(path).read_text(encoding="utf-8")
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError("Reference dataset bundle must be a JSON object")
    return parse_reference_bundle(cast(dict[str, Any], parsed))


# Compatibility name for existing FOOD_ALLERGEN callers. New generic callers should use
# ReferenceDatasetBundle with parse_reference_bundle/load_reference_bundle.
ReferenceBundle = FoodAllergenReferenceBundle
