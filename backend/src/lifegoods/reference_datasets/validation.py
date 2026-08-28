from __future__ import annotations

from dataclasses import dataclass

from lifegoods.reference_datasets.bundle import (
    ConditionFamily,
    ReferenceBundle,
    compute_bundle_sha256,
)

SUPPORTED_LANGUAGES = {"en", "km", "vi", "zh", "zh-CN", "zh-TW", "th"}


@dataclass(frozen=True, slots=True)
class ValidationReport:
    is_valid: bool
    errors: list[str]
    sha256: str


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
    concept_ids: set[str] = set()
    for concept in bundle.concepts:
        if concept.id in concept_ids:
            errors.append(f"Duplicate concept ID '{concept.id}'")
        concept_ids.add(concept.id)
        concept_map[concept.id] = concept.parent_id

        if concept.condition_family not in valid_condition_families:
            errors.append(
                f"Concept '{concept.id}' has invalid condition family '{concept.condition_family}'"
            )
        elif concept.condition_family != bundle.manifest.dataset_kind:
            errors.append(
                f"Condition family '{concept.condition_family}' does not match "
                f"dataset kind '{bundle.manifest.dataset_kind}' for concept '{concept.id}'"
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

    # 4. Lexical mappings: duplicates, concepts, languages, overlapping text
    mapping_ids: set[str] = set()
    mapping_keys: set[tuple[str, str]] = set()  # (language, normalized_text)
    supported_lower = {lang.lower() for lang in SUPPORTED_LANGUAGES}
    for mapping in bundle.mappings:
        if mapping.id in mapping_ids:
            errors.append(f"Duplicate lexical mapping ID '{mapping.id}'")
        mapping_ids.add(mapping.id)

        if mapping.concept_id not in concept_ids:
            errors.append(
                f"Lexical mapping '{mapping.id}' references non-existent concept "
                f"'{mapping.concept_id}'"
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
                errors.append(
                    f"Overlapping or duplicate lexical mapping text '{mapping.mapped_text}' "
                    f"for language '{mapping.language}'"
                )
            mapping_keys.add(mapping_key)

    # 5. Rule validation: concept & source references, typed condition family
    rule_ids: set[str] = set()
    for rule in bundle.rules:
        if rule.id in rule_ids:
            errors.append(f"Duplicate rule ID '{rule.id}'")
        rule_ids.add(rule.id)

        if rule.concept_id not in concept_ids:
            errors.append(
                f"Rule '{rule.id}' references non-existent concept '{rule.concept_id}'"
            )

        if rule.source_id not in source_ids:
            errors.append(
                f"Source ID '{rule.source_id}' referenced by rule '{rule.id}' is not in "
                "bundle sources"
            )

        if rule.condition_family not in valid_condition_families:
            errors.append(
                f"Rule '{rule.id}' has invalid condition family '{rule.condition_family}'"
            )
        elif rule.condition_family != bundle.manifest.dataset_kind:
            errors.append(
                f"Condition family '{rule.condition_family}' does not match "
                f"dataset kind '{bundle.manifest.dataset_kind}' for rule '{rule.id}'"
            )

    # 6. Integrity hash calculation
    computed_sha256 = compute_bundle_sha256(
        manifest=bundle.manifest,
        sources=bundle.sources,
        concepts=bundle.concepts,
        mappings=bundle.mappings,
        rules=bundle.rules,
    )

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
