"""Turn provider output into a contract-valid Label Reading with application-owned IDs."""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from lifegoods.label_reading.contracts import (
    LABEL_READING_CONFIGURATION_VERSION,
    AllergenStatementKind,
    LabelReading,
    PrintedAllergenStatement,
    PrintedFact,
    PrintedFactKind,
    PrintedTextBlock,
)
from lifegoods.photo_comparison.contracts import (
    EvidencePointer,
    ExtractionOutcome,
    FieldState,
    ImageEvidence,
    NutritionColumn,
)
from lifegoods.photo_comparison.normalization import (
    ProviderOutputError,
    check_keys,
    optional_text,
    parse_evidence,
    parse_identity,
    parse_nutrition_column,
    parse_quantity,
    parse_state,
    require_mapping,
)

MAX_TEXT_BLOCKS = 8
MAX_PRINTED_FACTS = 16

_NOTHING_READABLE = "No readable label text was found in the submitted photos."
_RETAKE_REQUESTED = "Retake the label so its printed text can be read clearly."


def _list(value: Any, description: str) -> list[Any]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ProviderOutputError(f"{description} must be a list")
    return value


def _block_fields(
    raw: Any,
    description: str,
    *,
    allowed: set[str],
    fallback_image_id: str | None,
) -> dict[str, Any]:
    item = require_mapping(raw, description)
    check_keys(item, allowed, description)
    text = optional_text(item.get("original_script"), f"{description} text", 4096)
    state = parse_state(item.get("state"), description)
    evidence: list[EvidencePointer] = parse_evidence(
        item.get("evidence"), f"{description} evidence"
    )
    if state is FieldState.READABLE and not text:
        state = FieldState.NOT_VISIBLE
    if state is FieldState.READABLE and not evidence:
        if fallback_image_id is None:
            state = FieldState.NOT_VISIBLE
        else:
            evidence = [EvidencePointer(image_id=fallback_image_id)]
    return {
        "block_id": uuid4().hex,
        "original_script": text,
        "language": optional_text(item.get("language"), f"{description} language", 32) or "und",
        "state": state,
        "evidence": evidence,
    }


def _ingredients(value: Any, fallback_image_id: str | None) -> list[PrintedTextBlock]:
    blocks: list[PrintedTextBlock] = []
    for raw in _list(value, "ingredients")[:MAX_TEXT_BLOCKS]:
        fields = _block_fields(
            raw,
            "ingredients block",
            allowed={"original_script", "language", "state", "evidence"},
            fallback_image_id=fallback_image_id,
        )
        try:
            blocks.append(PrintedTextBlock(**fields))
        except ValueError as error:
            raise ProviderOutputError("ingredients block is not contract-valid") from error
    return blocks


def _allergen_statements(
    value: Any, fallback_image_id: str | None
) -> list[PrintedAllergenStatement]:
    statements: list[PrintedAllergenStatement] = []
    for raw in _list(value, "allergen_statements")[:MAX_TEXT_BLOCKS]:
        fields = _block_fields(
            raw,
            "allergen statement",
            allowed={"original_script", "language", "state", "evidence", "kind"},
            fallback_image_id=fallback_image_id,
        )
        try:
            kind = AllergenStatementKind(raw.get("kind") or AllergenStatementKind.OTHER)
        except ValueError as error:
            raise ProviderOutputError("allergen statement has an unsupported kind") from error
        try:
            statements.append(PrintedAllergenStatement(**fields, kind=kind))
        except ValueError as error:
            raise ProviderOutputError("allergen statement is not contract-valid") from error
    return statements


def _printed_facts(value: Any, fallback_image_id: str | None) -> list[PrintedFact]:
    facts: list[PrintedFact] = []
    for raw in _list(value, "printed_facts")[:MAX_PRINTED_FACTS]:
        fields = _block_fields(
            raw,
            "printed fact",
            allowed={"original_script", "language", "state", "evidence", "kind", "label"},
            fallback_image_id=fallback_image_id,
        )
        try:
            kind = PrintedFactKind(raw.get("kind"))
        except ValueError:
            # The closed list is part of the product boundary: facts outside it are
            # dropped rather than failing the whole paid reading.
            continue
        try:
            facts.append(
                PrintedFact(
                    **fields,
                    kind=kind,
                    label=optional_text(raw.get("label"), "printed fact label", 256),
                )
            )
        except ValueError as error:
            raise ProviderOutputError("printed fact is not contract-valid") from error
    return facts


def _has_readable_nutrition(columns: list[NutritionColumn]) -> bool:
    return any(field.state is FieldState.READABLE for column in columns for field in column.fields)


def build_label_reading(
    payload: Any,
    *,
    images: list[ImageEvidence],
    provider: str,
    model: str,
) -> LabelReading:
    raw = require_mapping(payload, "provider output")
    check_keys(
        raw,
        {
            "identity",
            "package_quantity",
            "nutrition_columns",
            "ingredients",
            "allergen_statements",
            "printed_facts",
            "outcome",
            "retake_reasons",
        },
        "provider output",
    )
    first_image_id = images[0].image_id if images else None
    columns = [
        parse_nutrition_column(item, "nutrition column", fallback_image_id=first_image_id)
        for item in _list(raw.get("nutrition_columns"), "nutrition_columns")
    ]
    package_raw = raw.get("package_quantity")
    package_quantity = (
        parse_quantity(package_raw, "package quantity", fallback_image_id=first_image_id)
        if package_raw
        else None
    )
    identity = parse_identity(raw.get("identity"))
    ingredients = _ingredients(raw.get("ingredients"), first_image_id)
    statements = _allergen_statements(raw.get("allergen_statements"), first_image_id)
    facts = _printed_facts(raw.get("printed_facts"), first_image_id)

    provider_outcome = raw.get("outcome")
    try:
        requested_outcome = ExtractionOutcome(provider_outcome) if provider_outcome else None
    except ValueError as error:
        raise ProviderOutputError("provider output has an unsupported outcome") from error
    reasons = raw.get("retake_reasons", [])
    if not isinstance(reasons, list) or any(not isinstance(reason, str) for reason in reasons):
        raise ProviderOutputError("retake_reasons must be a list of text")
    reasons = [reason[:512] for reason in reasons[:16]]

    blocks: list[PrintedTextBlock] = [*ingredients, *statements, *facts]
    readable_identity = identity is not None and any(
        observation is not None and observation.state is FieldState.READABLE
        for observation in (identity.name, identity.brand)
    )
    readable_quantity = (
        package_quantity is not None and package_quantity.state is FieldState.READABLE
    )
    readable_blocks = [block for block in blocks if block.state is FieldState.READABLE]
    anything_readable = (
        readable_identity
        or readable_quantity
        or _has_readable_nutrition(columns)
        or bool(readable_blocks)
    )

    if not anything_readable:
        outcome = ExtractionOutcome.RETAKE_REQUIRED
        reasons = reasons or [_NOTHING_READABLE]
    elif requested_outcome is ExtractionOutcome.RETAKE_REQUIRED:
        outcome = ExtractionOutcome.RETAKE_REQUIRED
        reasons = reasons or [_RETAKE_REQUESTED]
    else:
        incomplete = (
            not any(block.state is FieldState.READABLE for block in ingredients)
            or not _has_readable_nutrition(columns)
            or any(block.state is not FieldState.READABLE for block in blocks)
            or any(
                field.state is not FieldState.READABLE
                for column in columns
                for field in column.fields
            )
        )
        outcome = (
            ExtractionOutcome.PARTIAL
            if incomplete or requested_outcome is ExtractionOutcome.PARTIAL
            else ExtractionOutcome.COMPLETE
        )
        if outcome is ExtractionOutcome.COMPLETE:
            reasons = []

    try:
        return LabelReading(
            images=images,
            identity=identity,
            package_quantity=package_quantity,
            nutrition_columns=columns,
            ingredients=ingredients,
            allergen_statements=statements,
            printed_facts=facts,
            outcome=outcome,
            retake_reasons=reasons,
            provider=provider,
            model=model,
            configuration_version=LABEL_READING_CONFIGURATION_VERSION,
        )
    except ValueError as error:
        raise ProviderOutputError("provider output failed evidence validation") from error


__all__ = ["build_label_reading"]
