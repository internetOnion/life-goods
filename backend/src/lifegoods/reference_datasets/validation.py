from __future__ import annotations

from dataclasses import dataclass

from lifegoods.reference_datasets.bundle import (
    AllergenRelationshipType,
    AllergenRuleKind,
    ConditionFamily,
    ReferenceBundle,
)

SUPPORTED_LANGUAGES = {"en", "km", "vi", "zh", "zh-CN", "zh-TW", "th"}


@dataclass(frozen=True, slots=True)
class ValidationReport:
    is_valid: bool
    errors: list[str]
    sha256: str


def _validate_condition_family(
    entity_kind: str,
    entity_id: str,
    condition_family: str,
    dataset_kind: str,
    valid_families: set[str],
) -> list[str]:
    errors: list[str] = []
    if condition_family not in valid_families:
        errors.append(
            f"{entity_kind} '{entity_id}' has invalid condition family '{condition_family}'"
        )
    elif condition_family != dataset_kind:
        errors.append(
            f"Condition family '{condition_family}' does not match "
            f"dataset kind '{dataset_kind}' for {entity_kind.lower()} '{entity_id}'"
        )
    return errors


def validate_bundle(bundle: ReferenceBundle) -> ValidationReport:
    errors: list[str] = []

    # 1. Manifest checks
    if not bundle.manifest.id.strip():
        errors.append("Dataset version ID must not be empty")

    valid_condition_families = {f.value for f in ConditionFamily}
    if bundle.manifest.dataset_kind not in valid_condition_families:
        errors.append(
            f"Unsupported dataset kind '{bundle.manifest.dataset_kind}'. "
            f"Must be one of {sorted(valid_condition_families)}"
        )

    # 2. Source validation & duplicate IDs
    source_ids: set[str] = set()
    for source in bundle.sources:
        if source.id in source_ids:
            errors.append(f"Duplicate source ID '{source.id}'")
        source_ids.add(source.id)
        if not source.name.strip():
            errors.append(f"Source '{source.id}' is missing a name")
        if not source.source_url.strip():
            errors.append(f"Source '{source.id}' is missing a source URL")

    # 3. Concept validation: duplicate IDs, typed condition family, parent hierarchy
    concept_map: dict[str, str | None] = {}
    concepts_by_id = {concept.id: concept for concept in bundle.concepts}
    concept_ids: set[str] = set()
    for concept in bundle.concepts:
        if concept.id in concept_ids:
            errors.append(f"Duplicate concept ID '{concept.id}'")
        concept_ids.add(concept.id)
        concept_map[concept.id] = concept.parent_id

        errors.extend(
            _validate_condition_family(
                "Concept",
                concept.id,
                concept.condition_family,
                bundle.manifest.dataset_kind,
                valid_condition_families,
            )
        )

    # Parent validation
    for concept in bundle.concepts:
        if concept.parent_id is not None:
            if concept.parent_id not in concept_ids:
                errors.append(
                    f"Parent ID '{concept.parent_id}' does not exist for concept '{concept.id}'"
                )
            elif concept.parent_id == concept.id:
                errors.append(f"Concept '{concept.id}' cannot be its own parent")

    parent_ids = {
        concept.parent_id for concept in bundle.concepts if concept.parent_id is not None
    }
    for concept in bundle.concepts:
        if concept.id in parent_ids and concept.is_leaf:
            errors.append(f"Concept '{concept.id}' has children but is marked as a leaf")
        if concept.id not in parent_ids and not concept.is_leaf:
            errors.append(f"Concept '{concept.id}' has no children but is marked as a parent")

    # Cyclic parent check
    for cid in concept_ids:
        visited: set[str] = set()
        current: str | None = cid
        while current is not None:
            if current in visited:
                errors.append(f"Cyclic parent relationship detected involving concept '{current}'")
                break
            visited.add(current)
            current = concept_map.get(current)

    # 4. Lexical mappings: duplicates, concepts, languages, overlapping text / ambiguous derivatives
    mapping_ids: set[str] = set()
    # (lang, text) -> (mapping_id, concept_id)
    mapping_keys: dict[tuple[str, str], tuple[str, str]] = {}
    supported_lower = {lang.lower() for lang in SUPPORTED_LANGUAGES}
    direct_english_mappings_by_concept: dict[str, int] = {}
    for mapping in bundle.mappings:
        if mapping.id in mapping_ids:
            errors.append(f"Duplicate lexical mapping ID '{mapping.id}'")
        mapping_ids.add(mapping.id)

        if mapping.concept_id not in concept_ids:
            errors.append(
                f"Lexical mapping '{mapping.id}' references non-existent concept "
                f"'{mapping.concept_id}'"
            )
        elif not concepts_by_id[mapping.concept_id].is_leaf:
            errors.append(
                f"Lexical mapping '{mapping.id}' targets non-leaf concept "
                f"'{mapping.concept_id}'"
            )

        valid_relationship_types = {kind.value for kind in AllergenRelationshipType}
        if mapping.relationship_type not in valid_relationship_types:
            errors.append(
                f"Lexical mapping '{mapping.id}' has invalid relationship type "
                f"'{mapping.relationship_type}'"
            )

        lang_normalized = mapping.language.strip().lower()
        if mapping.language not in SUPPORTED_LANGUAGES and lang_normalized not in supported_lower:
            errors.append(
                f"Unsupported language code '{mapping.language}' in lexical mapping '{mapping.id}'"
            )

        norm_text = mapping.mapped_text.strip().lower()
        if not norm_text:
            errors.append(f"Lexical mapping '{mapping.id}' has empty mapped text")
        else:
            mapping_key = (lang_normalized, norm_text)
            if mapping_key in mapping_keys:
                prev_id, prev_concept = mapping_keys[mapping_key]
                if prev_concept != mapping.concept_id:
                    errors.append(
                        f"Ambiguous derivative or conflicting mapping for '{mapping.mapped_text}' "
                        f"in language '{mapping.language}': mapped to multiple concepts "
                        f"('{prev_concept}' and '{mapping.concept_id}')"
                    )
                else:
                    errors.append(
                        f"Overlapping or duplicate lexical mapping text '{mapping.mapped_text}' "
                        f"for language '{mapping.language}'"
                    )
            mapping_keys[mapping_key] = (mapping.id, mapping.concept_id)

        if (
            lang_normalized == "en"
            and mapping.relationship_type == AllergenRelationshipType.EXACT_NAME
        ):
            direct_english_mappings_by_concept[mapping.concept_id] = (
                direct_english_mappings_by_concept.get(mapping.concept_id, 0) + 1
            )

    # 5. Rule validation: concept & source references, typed condition family
    rule_ids: set[str] = set()
    declaration_rules_by_concept: dict[str, int] = {}
    valid_rule_kinds = {kind.value for kind in AllergenRuleKind}
    declaration_rule_kinds = {
        AllergenRuleKind.MANDATORY_DECLARATION,
        AllergenRuleKind.REGIONAL_OR_NATIONAL_DECLARATION,
    }
    for rule in bundle.rules:
        if rule.id in rule_ids:
            errors.append(f"Duplicate rule ID '{rule.id}'")
        rule_ids.add(rule.id)

        if rule.concept_id not in concept_ids:
            errors.append(
                f"Rule '{rule.id}' references non-existent concept '{rule.concept_id}'"
            )

        if rule.rule_kind not in valid_rule_kinds:
            errors.append(f"Rule '{rule.id}' has invalid rule kind '{rule.rule_kind}'")
        elif rule.rule_kind in declaration_rule_kinds:
            declaration_rules_by_concept[rule.concept_id] = (
                declaration_rules_by_concept.get(rule.concept_id, 0) + 1
            )

        if rule.source_id not in source_ids:
            errors.append(
                f"Source ID '{rule.source_id}' referenced by rule '{rule.id}' is not in "
                "bundle sources"
            )

        errors.extend(
            _validate_condition_family(
                "Rule",
                rule.id,
                rule.condition_family,
                bundle.manifest.dataset_kind,
                valid_condition_families,
            )
        )

    for concept in bundle.concepts:
        if not concept.is_leaf:
            continue
        if direct_english_mappings_by_concept.get(concept.id, 0) != 1:
            errors.append(
                f"Active leaf concept '{concept.id}' does not have exactly one reviewed "
                "English EXACT_NAME mapping"
            )
        if declaration_rules_by_concept.get(concept.id, 0) < 1:
            errors.append(
                f"Active leaf concept '{concept.id}' does not have an applicable "
                "declaration rule"
            )

    # 6. Integrity hash calculation
    computed_sha256 = bundle.compute_sha256()

    if bundle.manifest.sha256 and bundle.manifest.sha256 != computed_sha256:
        errors.append(
            f"Integrity hash mismatch: declared '{bundle.manifest.sha256}' "
            f"but computed '{computed_sha256}'"
        )

    return ValidationReport(
        is_valid=len(errors) == 0,
        errors=errors,
        sha256=computed_sha256,
    )
