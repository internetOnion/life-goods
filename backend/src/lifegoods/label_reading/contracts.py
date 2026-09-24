"""Wire contract for Read This Label (docs/SPEC.md section 29, ADR 0005).

A Label Reading is Photo Evidence. It reuses the identity, quantity, and nutrition
shapes of the Compare Nutrition extraction and adds Printed Text read verbatim
from the label. It is never a Source Record or Original Text.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import Field, model_validator

from lifegoods.photo_comparison.contracts import (
    MAX_PHOTOS_PER_PRODUCT,
    EvidencePointer,
    ExtractionOutcome,
    FieldState,
    ImageEvidence,
    NutritionColumn,
    OpaqueIdentifier,
    PhotoComparisonModel,
    ProductIdentity,
    Quantity,
)

LABEL_READING_CONFIGURATION_VERSION = "label-reading-v1"
MAX_PRINTED_TEXT_LENGTH = 4096


class PhotoRole(StrEnum):
    PACKAGE_FRONT = "package_front"
    PACKAGE_BACK = "package_back"
    PACKAGE_SIDE = "package_side"
    UNSPECIFIED = "unspecified"


class AllergenStatementKind(StrEnum):
    CONTAINS = "contains"
    MAY_CONTAIN = "may_contain"
    OTHER = "other"


class PrintedFactKind(StrEnum):
    SERVING_SIZE = "serving_size"
    SERVINGS_PER_PACKAGE = "servings_per_package"
    STORAGE_INSTRUCTIONS = "storage_instructions"
    COUNTRY_OF_ORIGIN = "country_of_origin"
    MANUFACTURER = "manufacturer"
    IMPORTER = "importer"


class AllergenMentionsState(StrEnum):
    COMPLETED = "completed"
    NOT_CHECKED = "not_checked"
    UNAVAILABLE = "unavailable"


class PrintedTextBlock(PhotoComparisonModel):
    """Printed Text transcribed verbatim from the photos, in one printed language."""

    block_id: OpaqueIdentifier
    original_script: str | None = Field(default=None, max_length=MAX_PRINTED_TEXT_LENGTH)
    language: str = Field(default="und", min_length=1, max_length=32)
    state: FieldState = FieldState.READABLE
    evidence: list[EvidencePointer] = Field(default_factory=list, max_length=16)

    @model_validator(mode="after")
    def _validate_readable_text(self) -> PrintedTextBlock:
        if self.state is FieldState.READABLE:
            if not self.original_script:
                raise ValueError("readable Printed Text requires its printed wording")
            if not self.evidence:
                raise ValueError("readable Printed Text requires an evidence reference")
        return self


class PrintedAllergenStatement(PrintedTextBlock):
    kind: AllergenStatementKind = AllergenStatementKind.OTHER


class PrintedFact(PrintedTextBlock):
    kind: PrintedFactKind
    label: str | None = Field(default=None, max_length=256)


class LabelAllergenMention(PhotoComparisonModel):
    """One allergen-group mention found by the deterministic ingredient matcher."""

    block_id: OpaqueIdentifier
    matched_text: str = Field(min_length=1, max_length=256)
    allergen_tags: list[str] = Field(min_length=1, max_length=16)
    qualification: Literal[
        "positive_mention",
        "precautionary_statement",
        "negated_mention",
        "unresolved_context",
    ]


class LabelAllergenMentions(PhotoComparisonModel):
    state: AllergenMentionsState = AllergenMentionsState.NOT_CHECKED
    reason: str | None = Field(default=None, max_length=512)
    mentions: list[LabelAllergenMention] = Field(default_factory=list, max_length=128)
    limitations: list[str] = Field(default_factory=list, max_length=8)


class LabelReading(PhotoComparisonModel):
    schema_version: int = Field(default=1, ge=1, le=1)
    images: list[ImageEvidence] = Field(min_length=1, max_length=MAX_PHOTOS_PER_PRODUCT)
    identity: ProductIdentity | None = None
    package_quantity: Quantity | None = None
    nutrition_columns: list[NutritionColumn] = Field(default_factory=list, max_length=8)
    ingredients: list[PrintedTextBlock] = Field(default_factory=list, max_length=8)
    allergen_statements: list[PrintedAllergenStatement] = Field(
        default_factory=list, max_length=8
    )
    printed_facts: list[PrintedFact] = Field(default_factory=list, max_length=16)
    allergen_mentions: LabelAllergenMentions = Field(default_factory=LabelAllergenMentions)
    outcome: ExtractionOutcome
    retake_reasons: list[str] = Field(default_factory=list, max_length=16)
    provider: str | None = Field(default=None, max_length=128)
    model: str | None = Field(default=None, max_length=128)
    configuration_version: str | None = Field(default=None, max_length=128)

    @model_validator(mode="after")
    def _validate_references_and_outcome(self) -> LabelReading:
        image_ids = {image.image_id for image in self.images}
        if len(image_ids) != len(self.images):
            raise ValueError("image IDs must be unique within a Label Reading")

        def check(pointers: list[EvidencePointer], description: str) -> None:
            if any(pointer.image_id not in image_ids for pointer in pointers):
                raise ValueError(f"{description} must reference a Label Reading image")

        ids: set[str] = set()

        def claim(identifier: str) -> None:
            if identifier in ids:
                raise ValueError("IDs must be unique within a Label Reading")
            ids.add(identifier)

        if self.identity is not None:
            for observation in (self.identity.name, self.identity.brand):
                if observation is not None:
                    claim(observation.field_id)
                    check(observation.evidence, "identity evidence")
        if self.package_quantity is not None:
            claim(self.package_quantity.field_id)
            check(self.package_quantity.evidence, "package evidence")
        for column in self.nutrition_columns:
            claim(column.column_id)
            check(column.basis_evidence, "basis evidence")
            check(column.preparation_evidence, "preparation evidence")
            for field in column.fields:
                claim(field.field_id)
                check(field.evidence, "field evidence")
                for alternative in field.alternatives:
                    check(alternative.evidence, "field evidence")
            if column.serving_quantity is not None:
                claim(column.serving_quantity.field_id)
                check(column.serving_quantity.evidence, "serving evidence")

        blocks: list[PrintedTextBlock] = [
            *self.ingredients,
            *self.allergen_statements,
            *self.printed_facts,
        ]
        for block in blocks:
            claim(block.block_id)
            check(block.evidence, "Printed Text evidence")
        block_ids = {block.block_id for block in blocks}
        if any(mention.block_id not in block_ids for mention in self.allergen_mentions.mentions):
            raise ValueError("allergen mentions must reference a Printed Text block")

        if self.outcome is ExtractionOutcome.RETAKE_REQUIRED and not self.retake_reasons:
            raise ValueError("retake-required Label Readings need a reason")
        if self.outcome is ExtractionOutcome.COMPLETE and self.retake_reasons:
            raise ValueError("complete Label Readings cannot contain retake reasons")
        return self


__all__ = [
    "LABEL_READING_CONFIGURATION_VERSION",
    "AllergenMentionsState",
    "AllergenStatementKind",
    "LabelAllergenMention",
    "LabelAllergenMentions",
    "LabelReading",
    "PhotoRole",
    "PrintedAllergenStatement",
    "PrintedFact",
    "PrintedFactKind",
    "PrintedTextBlock",
]
