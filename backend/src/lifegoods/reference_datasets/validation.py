from __future__ import annotations

from dataclasses import dataclass

from lifegoods.reference_datasets.bundle import (
    AllergenRelationshipType,
    AllergenRuleKind,
    ConditionFamily,
    FoodAllergenReferenceBundle,
    HalalClassification,
    HalalIngredientReferenceBundle,
    HalalRelationshipType,
    ReferenceConceptDefinition,
    ReferenceDatasetBundle,
    ReferenceDatasetKind,
)
from lifegoods.reference_datasets.text_normalization import (
    find_normalized_phrase,
    normalized_phrase,
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


def _validate_common_bundle(bundle: ReferenceDatasetBundle) -> list[str]:
    errors: list[str] = []

    if not bundle.manifest.id.strip():
        errors.append("Dataset version ID must not be empty")

    valid_dataset_kinds = {kind.value for kind in ReferenceDatasetKind}
    if bundle.manifest.dataset_kind not in valid_dataset_kinds:
        errors.append(
            f"Unsupported dataset kind '{bundle.manifest.dataset_kind}'. "
            f"Must be one of {sorted(valid_dataset_kinds)}"
        )

    source_ids: set[str] = set()
    for source in bundle.sources:
        if source.id in source_ids:
            errors.append(f"Duplicate source ID '{source.id}'")
        source_ids.add(source.id)
        if not source.name.strip():
            errors.append(f"Source '{source.id}' is missing a name")
        if not source.source_url.strip():
            errors.append(f"Source '{source.id}' is missing a source URL")

    return errors


def _validate_concept_hierarchy(
    concepts: list[ReferenceConceptDefinition],
    dataset_kind: str,
    valid_condition_families: set[str],
) -> tuple[list[str], set[str], dict[str, ReferenceConceptDefinition]]:
    errors: list[str] = []
    concept_map: dict[str, str | None] = {}
    concepts_by_id = {concept.id: concept for concept in concepts}
    concept_ids: set[str] = set()

    for concept in concepts:
        if concept.id in concept_ids:
            errors.append(f"Duplicate concept ID '{concept.id}'")
        concept_ids.add(concept.id)
        concept_map[concept.id] = concept.parent_id

        errors.extend(
            _validate_condition_family(
                "Concept",
                concept.id,
                concept.condition_family,
                dataset_kind,
                valid_condition_families,
            )
        )

    for concept in concepts:
        if concept.parent_id is not None:
            if concept.parent_id not in concept_ids:
                errors.append(
                    f"Parent ID '{concept.parent_id}' does not exist for concept '{concept.id}'"
                )
            elif concept.parent_id == concept.id:
                errors.append(f"Concept '{concept.id}' cannot be its own parent")

    parent_ids = {concept.parent_id for concept in concepts if concept.parent_id is not None}
    for concept in concepts:
        if concept.id in parent_ids and concept.is_leaf:
            errors.append(f"Concept '{concept.id}' has children but is marked as a leaf")
        if concept.id not in parent_ids and not concept.is_leaf:
            errors.append(f"Concept '{concept.id}' has no children but is marked as a parent")

    for cid in concept_ids:
        visited: set[str] = set()
        current: str | None = cid
        while current is not None:
            if current in visited:
                errors.append(f"Cyclic parent relationship detected involving concept '{current}'")
                break
            visited.add(current)
            current = concept_map.get(current)

    return errors, concept_ids, concepts_by_id


def _validate_food_allergen_records(bundle: FoodAllergenReferenceBundle) -> list[str]:
    errors: list[str] = []
    valid_condition_families = {f.value for f in ConditionFamily}
    source_ids = {source.id for source in bundle.sources}

    concept_errors, concept_ids, concepts_by_id = _validate_concept_hierarchy(
        bundle.concepts, bundle.manifest.dataset_kind, valid_condition_families
    )
    errors.extend(concept_errors)

    # Lexical mappings: duplicates, concepts, languages, overlapping text / ambiguous derivatives
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
                f"Lexical mapping '{mapping.id}' targets non-leaf concept '{mapping.concept_id}'"
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

        norm_text = (
            normalized_phrase(mapping.mapped_text)
            if lang_normalized == "en"
            else mapping.mapped_text.strip().casefold()
        )
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

    # Lexical exclusions: stable IDs, leaf concepts, English text, and useful scope
    exclusion_ids: set[str] = set()
    exclusion_keys: set[tuple[str, str, str]] = set()
    for exclusion in bundle.exclusions:
        if exclusion.id in exclusion_ids:
            errors.append(f"Duplicate lexical exclusion ID '{exclusion.id}'")
        exclusion_ids.add(exclusion.id)

        concept = concepts_by_id.get(exclusion.concept_id)
        if concept is None:
            errors.append(
                f"Lexical exclusion '{exclusion.id}' references non-existent concept "
                f"'{exclusion.concept_id}'"
            )
        elif not concept.is_leaf:
            errors.append(
                f"Lexical exclusion '{exclusion.id}' targets non-leaf concept "
                f"'{exclusion.concept_id}'"
            )

        language = exclusion.language.strip().lower()
        if language != "en":
            errors.append(
                f"Lexical exclusion '{exclusion.id}' must use supported English language 'en'"
            )

        normalized_exclusion = normalized_phrase(exclusion.excluded_text)
        if not normalized_exclusion:
            errors.append(f"Lexical exclusion '{exclusion.id}' has empty excluded text")
            continue

        exclusion_key = (language, exclusion.concept_id, normalized_exclusion)
        if exclusion_key in exclusion_keys:
            errors.append(
                f"Duplicate normalized lexical exclusion '{exclusion.excluded_text}' "
                f"for concept '{exclusion.concept_id}'"
            )
        exclusion_keys.add(exclusion_key)

        suppressible = any(
            mapping.concept_id == exclusion.concept_id
            and mapping.language.strip().lower() == language
            and find_normalized_phrase(normalized_exclusion, normalized_phrase(mapping.mapped_text))
            for mapping in bundle.mappings
        )
        if not suppressible:
            errors.append(
                f"Lexical exclusion '{exclusion.id}' does not contain a suppressible mapping "
                f"for concept '{exclusion.concept_id}'"
            )

    # Rule validation: concept & source references, typed condition family
    rule_ids: set[str] = set()
    declaration_rules_by_concept: dict[str, int] = {}
    derivative_rules_by_mapping: dict[str, int] = {}
    mappings_by_id = {mapping.id: mapping for mapping in bundle.mappings}
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
            errors.append(f"Rule '{rule.id}' references non-existent concept '{rule.concept_id}'")

        if rule.rule_kind not in valid_rule_kinds:
            errors.append(f"Rule '{rule.id}' has invalid rule kind '{rule.rule_kind}'")
        elif rule.rule_kind in declaration_rule_kinds:
            declaration_rules_by_concept[rule.concept_id] = (
                declaration_rules_by_concept.get(rule.concept_id, 0) + 1
            )
        elif rule.rule_kind == AllergenRuleKind.DERIVATIVE_MATCH:
            mapping = mappings_by_id.get(rule.mapping_id or "")
            if mapping is None:
                errors.append(
                    f"Derivative rule '{rule.id}' references missing mapping '{rule.mapping_id}'"
                )
            elif (
                mapping.relationship_type != AllergenRelationshipType.DERIVED_FROM
                or mapping.concept_id != rule.concept_id
            ):
                errors.append(
                    f"Derivative rule '{rule.id}' must reference a DERIVED_FROM mapping "
                    "for the same concept"
                )
            else:
                derivative_rules_by_mapping[mapping.id] = (
                    derivative_rules_by_mapping.get(mapping.id, 0) + 1
                )
        if rule.rule_kind != AllergenRuleKind.DERIVATIVE_MATCH and rule.mapping_id is not None:
            errors.append(
                f"Non-derivative rule '{rule.id}' must not reference mapping '{rule.mapping_id}'"
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

    for mapping in bundle.mappings:
        if mapping.relationship_type != AllergenRelationshipType.DERIVED_FROM:
            continue
        if derivative_rules_by_mapping.get(mapping.id, 0) != 1:
            errors.append(
                f"Derivative mapping '{mapping.id}' does not have exactly one linked "
                "DERIVATIVE_MATCH rule"
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
                f"Active leaf concept '{concept.id}' does not have an applicable declaration rule"
            )

    return errors


def _validate_halal_ingredient_records(bundle: HalalIngredientReferenceBundle) -> list[str]:
    errors: list[str] = []
    valid_condition_families = {f.value for f in ConditionFamily}
    source_ids = {source.id for source in bundle.sources}

    concept_errors, concept_ids, concepts_by_id = _validate_concept_hierarchy(
        bundle.concepts, bundle.manifest.dataset_kind, valid_condition_families
    )
    errors.extend(concept_errors)

    # Lexical mappings
    mapping_ids: set[str] = set()
    mapping_keys: dict[tuple[str, str], tuple[str, str]] = {}
    supported_lower = {lang.lower() for lang in SUPPORTED_LANGUAGES}
    direct_english_mappings_by_concept: dict[str, int] = {}
    valid_relationship_types = {kind.value for kind in HalalRelationshipType}

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
                f"Lexical mapping '{mapping.id}' targets non-leaf concept '{mapping.concept_id}'"
            )

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

        norm_text = (
            normalized_phrase(mapping.mapped_text)
            if lang_normalized == "en"
            else mapping.mapped_text.strip().casefold()
        )
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
            and mapping.relationship_type == HalalRelationshipType.EXACT_NAME
        ):
            direct_english_mappings_by_concept[mapping.concept_id] = (
                direct_english_mappings_by_concept.get(mapping.concept_id, 0) + 1
            )

    # Halal ingredient mappings
    hm_ids: set[str] = set()
    halal_mappings_by_concept: dict[str, int] = {}
    valid_classifications = {c.value for c in HalalClassification}

    for hm in bundle.halal_ingredient_mappings:
        if hm.id in hm_ids:
            errors.append(f"Duplicate Halal ingredient mapping ID '{hm.id}'")
        hm_ids.add(hm.id)

        if hm.concept_id not in concept_ids:
            errors.append(
                f"Halal ingredient mapping '{hm.id}' references non-existent concept "
                f"'{hm.concept_id}'"
            )
        elif not concepts_by_id[hm.concept_id].is_leaf:
            errors.append(
                f"Halal ingredient mapping '{hm.id}' targets non-leaf concept '{hm.concept_id}'"
            )
        else:
            halal_mappings_by_concept[hm.concept_id] = (
                halal_mappings_by_concept.get(hm.concept_id, 0) + 1
            )

        if hm.classification not in valid_classifications:
            errors.append(
                f"Halal ingredient mapping '{hm.id}' has invalid classification "
                f"'{hm.classification}'"
            )

        if len(hm.citations) == 0:
            errors.append(
                f"Halal ingredient mapping '{hm.id}' must contain at least one source citation"
            )

        for citation in hm.citations:
            if citation.source_id not in source_ids:
                errors.append(
                    f"Halal source citation in mapping '{hm.id}' references non-existent "
                    f"source '{citation.source_id}'"
                )
            if not citation.edition.strip():
                errors.append(
                    f"Halal source citation in mapping '{hm.id}' is missing edition"
                )
            if not citation.jurisdiction.strip():
                errors.append(
                    f"Halal source citation in mapping '{hm.id}' is missing jurisdiction"
                )
            if not citation.locator.strip():
                errors.append(
                    f"Halal source citation in mapping '{hm.id}' is missing locator"
                )

    for concept in bundle.concepts:
        if not concept.is_leaf:
            continue
        if direct_english_mappings_by_concept.get(concept.id, 0) != 1:
            errors.append(
                f"Active leaf concept '{concept.id}' does not have exactly one reviewed "
                "English EXACT_NAME mapping"
            )
        count = halal_mappings_by_concept.get(concept.id, 0)
        if count == 0:
            errors.append(
                f"Active leaf concept '{concept.id}' does not have a Halal ingredient mapping"
            )
        elif count > 1:
            errors.append(
                f"Active leaf concept '{concept.id}' has duplicate or contradictory "
                "Halal ingredient mappings"
            )

    return errors


def validate_bundle(bundle: ReferenceDatasetBundle) -> ValidationReport:
    errors = _validate_common_bundle(bundle)

    if bundle.manifest.dataset_kind == ReferenceDatasetKind.FOOD_ALLERGEN.value:
        if not isinstance(bundle, FoodAllergenReferenceBundle):
            errors.append(
                f"Dataset kind '{bundle.manifest.dataset_kind}' has an incompatible "
                f"bundle model '{type(bundle).__name__}'"
            )
        else:
            errors.extend(_validate_food_allergen_records(bundle))
    elif bundle.manifest.dataset_kind == ReferenceDatasetKind.HALAL_INGREDIENT.value:
        if not isinstance(bundle, HalalIngredientReferenceBundle):
            errors.append(
                f"Dataset kind '{bundle.manifest.dataset_kind}' has an incompatible "
                f"bundle model '{type(bundle).__name__}'"
            )
        else:
            errors.extend(_validate_halal_ingredient_records(bundle))

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
