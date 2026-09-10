from __future__ import annotations

from decimal import Decimal, InvalidOperation
from enum import StrEnum
from typing import Annotated, Any, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, model_validator

MAX_PHOTOS_PER_PRODUCT = 6
MAX_COMPARISON_REQUEST_BYTES = 1_048_576
IMAGE_ID_PATTERN = r"^[A-Za-z0-9_-]{1,128}$"


class PhotoComparisonModel(BaseModel):
    """Strict wire model shared by the experimental photo workflow."""

    model_config = ConfigDict(
        extra="forbid",
        revalidate_instances="always",
        validate_assignment=True,
    )


class FieldState(StrEnum):
    READABLE = "readable"
    UNREADABLE = "unreadable"
    AMBIGUOUS = "ambiguous"
    CONFLICTING = "conflicting"
    NOT_VISIBLE = "not_visible"


class ExtractionOutcome(StrEnum):
    COMPLETE = "complete"
    PARTIAL = "partial"
    RETAKE_REQUIRED = "retake_required"


class PreparationState(StrEnum):
    AS_SOLD = "as_sold"
    AS_PREPARED = "as_prepared"
    UNKNOWN = "unknown"


class ComparisonState(StrEnum):
    COMPARABLE = "comparable"
    CONDITIONAL = "conditional"
    NOT_COMPARABLE = "not_comparable"


class NutritionBasis(StrEnum):
    PER_PACKAGE = "per_package"
    PER_SERVING = "per_serving"
    PER_100G = "per_100g"
    PER_100ML = "per_100ml"
    UNKNOWN = "unknown"
    OTHER = "other"


class NutrientRowKind(StrEnum):
    AMOUNT = "amount"
    PERCENTAGE = "percentage"
    COMBINED = "combined"
    OTHER = "other"


class ValueQualifier(StrEnum):
    EXACT = "exact"
    LESS_THAN = "less_than"
    GREATER_THAN = "greater_than"
    APPROXIMATE = "approximate"


class MeasurementUnit(StrEnum):
    G = "g"
    MG = "mg"
    UG = "µg"
    KG = "kg"
    ML = "ml"
    L = "l"
    KCAL = "kcal"
    KJ = "kJ"
    PERCENT = "%"
    COUNT = "count"
    UNKNOWN = "unknown"


class DerivationInputKind(StrEnum):
    REPORTED_FIELD = "reported_field"
    PACKAGE_QUANTITY = "package_quantity"
    SERVING_QUANTITY = "serving_quantity"


class PhotoComparisonErrorCode(StrEnum):
    REQUEST_INVALID = "request_invalid"
    SIZE_LIMIT_EXCEEDED = "size_limit_exceeded"
    UNSUPPORTED_IMAGE_FORMAT = "unsupported_image_format"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    CAPACITY_LIMIT_EXCEEDED = "capacity_limit_exceeded"
    PROVIDER_OUTPUT_INVALID = "provider_output_invalid"
    PROVIDER_UNAVAILABLE = "provider_unavailable"
    PROVIDER_TIMEOUT = "provider_timeout"
    INTERNAL_ERROR = "internal_error"


PHOTO_COMPARISON_ERROR_STATUS: dict[PhotoComparisonErrorCode, int] = {
    PhotoComparisonErrorCode.REQUEST_INVALID: 422,
    PhotoComparisonErrorCode.SIZE_LIMIT_EXCEEDED: 413,
    PhotoComparisonErrorCode.UNSUPPORTED_IMAGE_FORMAT: 415,
    PhotoComparisonErrorCode.RATE_LIMIT_EXCEEDED: 429,
    PhotoComparisonErrorCode.CAPACITY_LIMIT_EXCEEDED: 429,
    PhotoComparisonErrorCode.PROVIDER_OUTPUT_INVALID: 502,
    PhotoComparisonErrorCode.PROVIDER_UNAVAILABLE: 503,
    PhotoComparisonErrorCode.PROVIDER_TIMEOUT: 504,
    PhotoComparisonErrorCode.INTERNAL_ERROR: 500,
}


def _finite_decimal(value: Any) -> Decimal:
    if isinstance(value, bool) or value is None:
        raise ValueError("a finite decimal is required")
    try:
        parsed = value if isinstance(value, Decimal) else Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as error:
        raise ValueError("a finite decimal is required") from error
    if not parsed.is_finite():
        raise ValueError("a finite decimal is required")
    return parsed


FiniteDecimal = Annotated[Decimal, BeforeValidator(_finite_decimal)]
OpaqueIdentifier = Annotated[str, Field(min_length=1, max_length=128, pattern=IMAGE_ID_PATTERN)]


def _require_known_unit(value: Decimal | None, unit: MeasurementUnit | None) -> None:
    if value is not None and unit in {None, MeasurementUnit.UNKNOWN}:
        raise ValueError("a normalized value requires a known unit")


def _unit_dimension(unit: MeasurementUnit | None) -> str:
    if unit is None:
        return "unknown"
    if unit in {
        MeasurementUnit.G,
        MeasurementUnit.MG,
        MeasurementUnit.UG,
        MeasurementUnit.KG,
    }:
        return "mass"
    if unit in {MeasurementUnit.ML, MeasurementUnit.L}:
        return "volume"
    if unit in {MeasurementUnit.KCAL, MeasurementUnit.KJ}:
        return "energy"
    if unit is MeasurementUnit.PERCENT:
        return "percentage"
    if unit is MeasurementUnit.COUNT:
        return "count"
    return "unknown"


class ImageRegion(PhotoComparisonModel):
    """Normalized coordinates in the inclusive [0, 1] image coordinate space."""

    x: float = Field(strict=True, ge=0, le=1)
    y: float = Field(strict=True, ge=0, le=1)
    width: float = Field(strict=True, gt=0, le=1)
    height: float = Field(strict=True, gt=0, le=1)

    @model_validator(mode="after")
    def _stay_within_image(self) -> ImageRegion:
        if self.x + self.width > 1 or self.y + self.height > 1:
            raise ValueError("image region must stay within the image")
        return self


class ImageEvidence(PhotoComparisonModel):
    image_id: OpaqueIdentifier
    original_image_id: OpaqueIdentifier
    processed_image_id: OpaqueIdentifier | None = None
    role: str = Field(min_length=1, max_length=64)
    width: int = Field(strict=True, gt=0, le=100_000)
    height: int = Field(strict=True, gt=0, le=100_000)

    @property
    def pixel_count(self) -> int:
        return self.width * self.height


class EvidencePointer(PhotoComparisonModel):
    image_id: OpaqueIdentifier
    region: ImageRegion | None = None


class ObservationAlternative(PhotoComparisonModel):
    """A competing literal reading retained for an ambiguous or conflicting field."""

    value_text: str | None = Field(default=None, max_length=256)
    unit_text: str | None = Field(default=None, max_length=64)
    original_script: str | None = Field(default=None, max_length=4096)
    language: str = Field(default="und", min_length=1, max_length=32)
    state: FieldState = FieldState.READABLE
    evidence: list[EvidencePointer] = Field(default_factory=list, max_length=16)

    @model_validator(mode="after")
    def _require_evidence(self) -> ObservationAlternative:
        if not self.evidence:
            raise ValueError("alternative observations require an evidence reference")
        if self.state is FieldState.READABLE and not self.value_text:
            raise ValueError("readable alternatives require value text")
        return self


class Quantity(PhotoComparisonModel):
    field_id: OpaqueIdentifier
    label: str | None = Field(default=None, max_length=256)
    value_text: str | None = Field(default=None, max_length=256)
    unit_text: str | None = Field(default=None, max_length=64)
    language: str = Field(default="und", min_length=1, max_length=32)
    state: FieldState = FieldState.READABLE
    normalized_value: FiniteDecimal | None = None
    normalized_unit: MeasurementUnit | None = None
    qualifier: ValueQualifier = ValueQualifier.EXACT
    evidence: list[EvidencePointer] = Field(default_factory=list, max_length=16)
    alternatives: list[ObservationAlternative] = Field(default_factory=list, max_length=16)

    @model_validator(mode="after")
    def _validate_quantity(self) -> Quantity:
        if self.state is FieldState.READABLE:
            if not self.label or not self.value_text or not self.unit_text:
                raise ValueError("readable quantities require label, value, and unit text")
            if not self.evidence:
                raise ValueError("readable quantities require an evidence reference")
        if self.normalized_value is not None:
            if self.state is not FieldState.READABLE:
                raise ValueError("only readable quantities may be normalized")
            if self.normalized_value <= 0:
                raise ValueError("normalized quantity must be positive")
            if not self.evidence:
                raise ValueError("normalized quantities require an evidence reference")
        if (self.normalized_value is None) != (self.normalized_unit is None):
            raise ValueError("normalized quantity value and unit must be provided together")
        _require_known_unit(self.normalized_value, self.normalized_unit)
        if self.state is FieldState.CONFLICTING and not self.alternatives:
            raise ValueError("conflicting quantities must retain a competing observation")
        return self


class FieldObservation(PhotoComparisonModel):
    """Literal package evidence plus conservative optional normalization."""

    field_id: OpaqueIdentifier
    nutrient: str | None = Field(default=None, min_length=1, max_length=128)
    label: str | None = Field(default=None, max_length=256)
    value_text: str | None = Field(default=None, max_length=256)
    unit_text: str | None = Field(default=None, max_length=64)
    original_script: str | None = Field(default=None, max_length=4096)
    language: str = Field(default="und", min_length=1, max_length=32)
    state: FieldState = FieldState.READABLE
    normalized_value: FiniteDecimal | None = None
    normalized_unit: MeasurementUnit | None = None
    qualifier: ValueQualifier = ValueQualifier.EXACT
    row_kind: NutrientRowKind = NutrientRowKind.AMOUNT
    alternatives: list[ObservationAlternative] = Field(default_factory=list, max_length=16)
    evidence: list[EvidencePointer] = Field(default_factory=list, max_length=16)

    @model_validator(mode="after")
    def _validate_normalization_and_evidence(self) -> FieldObservation:
        if self.state is FieldState.READABLE:
            if not self.label or not self.value_text or not self.original_script:
                raise ValueError("readable fields require literal label and value text")
            if not self.evidence:
                raise ValueError("readable fields require an evidence reference")
        if self.state is not FieldState.READABLE and self.normalized_value is not None:
            raise ValueError("only readable fields may have a normalized value")
        if self.normalized_value is not None and self.normalized_value < 0:
            raise ValueError("normalized nutrient amounts cannot be negative")
        if (self.normalized_value is None) != (self.normalized_unit is None):
            raise ValueError("normalized field value and unit must be provided together")
        _require_known_unit(self.normalized_value, self.normalized_unit)
        if self.state is FieldState.CONFLICTING and not self.alternatives:
            raise ValueError("conflicting fields must retain a competing observation")
        if self.row_kind is NutrientRowKind.PERCENTAGE and self.normalized_unit not in {
            None,
            MeasurementUnit.PERCENT,
        }:
            raise ValueError("percentage rows must use the percent unit")
        return self


class NutritionColumn(PhotoComparisonModel):
    column_id: OpaqueIdentifier
    label: str | None = Field(default=None, max_length=256)
    basis: NutritionBasis = NutritionBasis.UNKNOWN
    preparation_state: PreparationState = PreparationState.UNKNOWN
    serving_quantity: Quantity | None = None
    serving_quantity_state: FieldState = FieldState.NOT_VISIBLE
    basis_evidence: list[EvidencePointer] = Field(default_factory=list, max_length=16)
    preparation_evidence: list[EvidencePointer] = Field(default_factory=list, max_length=16)
    fields: list[FieldObservation] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def _validate_column(self) -> NutritionColumn:
        if self.basis is not NutritionBasis.UNKNOWN and not self.basis_evidence:
            raise ValueError("known nutrition bases require evidence")
        if self.preparation_state is not PreparationState.UNKNOWN and not self.preparation_evidence:
            raise ValueError("known preparation states require evidence")
        if self.serving_quantity is not None:
            if self.serving_quantity_state is not self.serving_quantity.state:
                raise ValueError("serving quantity state must match its quantity")
        elif (
            self.basis is NutritionBasis.PER_SERVING
            and self.serving_quantity_state is FieldState.READABLE
        ):
            raise ValueError("a readable serving quantity requires quantity evidence")
        return self


class ProductIdentity(PhotoComparisonModel):
    name: FieldObservation | None = None
    brand: FieldObservation | None = None


class Extraction(PhotoComparisonModel):
    schema_version: int = Field(default=1, ge=1, le=1)
    product_id: str = Field(min_length=1, max_length=128)
    identity: ProductIdentity | None = None
    images: list[ImageEvidence] = Field(min_length=1, max_length=MAX_PHOTOS_PER_PRODUCT)
    package_quantity: Quantity | None = None
    nutrition_columns: list[NutritionColumn] = Field(default_factory=list, max_length=8)
    outcome: ExtractionOutcome
    retake_reasons: list[str] = Field(default_factory=list, max_length=16)
    provider: str | None = Field(default=None, max_length=128)
    model: str | None = Field(default=None, max_length=128)
    configuration_version: str | None = Field(default=None, max_length=128)

    @staticmethod
    def _validate_pointers(
        pointers: list[EvidencePointer], image_ids: set[str], description: str
    ) -> None:
        if any(pointer.image_id not in image_ids for pointer in pointers):
            raise ValueError(f"{description} must reference an extraction image")

    @classmethod
    def _validate_observation_references(
        cls, observation: FieldObservation, image_ids: set[str], description: str
    ) -> None:
        cls._validate_pointers(observation.evidence, image_ids, description)
        for alternative in observation.alternatives:
            cls._validate_pointers(alternative.evidence, image_ids, description)

    @classmethod
    def _validate_quantity_references(
        cls, quantity: Quantity, image_ids: set[str], description: str
    ) -> None:
        cls._validate_pointers(quantity.evidence, image_ids, description)
        for alternative in quantity.alternatives:
            cls._validate_pointers(alternative.evidence, image_ids, description)

    @model_validator(mode="after")
    def _validate_references_and_outcome(self) -> Extraction:
        image_ids = {image.image_id for image in self.images}
        if len(image_ids) != len(self.images):
            raise ValueError("image IDs must be unique within an extraction")
        column_ids = {column.column_id for column in self.nutrition_columns}
        if len(column_ids) != len(self.nutrition_columns):
            raise ValueError("column IDs must be unique within an extraction")
        field_ids: set[str] = set()

        if self.identity is not None:
            for observation in (self.identity.name, self.identity.brand):
                if observation is not None:
                    if observation.field_id in field_ids:
                        raise ValueError("field IDs must be unique within an extraction")
                    field_ids.add(observation.field_id)
                    self._validate_observation_references(
                        observation, image_ids, "identity evidence"
                    )

        for column in self.nutrition_columns:
            self._validate_pointers(column.basis_evidence, image_ids, "basis evidence")
            self._validate_pointers(
                column.preparation_evidence, image_ids, "preparation evidence"
            )
            for field in column.fields:
                if field.field_id in field_ids:
                    raise ValueError("field IDs must be unique within an extraction")
                field_ids.add(field.field_id)
                self._validate_observation_references(field, image_ids, "field evidence")
            if column.serving_quantity is not None:
                if column.serving_quantity.field_id in field_ids:
                    raise ValueError("field IDs must be unique within an extraction")
                field_ids.add(column.serving_quantity.field_id)
                self._validate_quantity_references(
                    column.serving_quantity, image_ids, "serving evidence"
                )

        if self.package_quantity is not None:
            if self.package_quantity.field_id in field_ids:
                raise ValueError("field IDs must be unique within an extraction")
            field_ids.add(self.package_quantity.field_id)
            self._validate_quantity_references(
                self.package_quantity, image_ids, "package evidence"
            )
        if self.outcome is ExtractionOutcome.RETAKE_REQUIRED and not self.retake_reasons:
            raise ValueError("retake-required extractions need a reason")
        if self.outcome is ExtractionOutcome.COMPLETE and self.retake_reasons:
            raise ValueError("complete extractions cannot contain retake reasons")
        return self


class ReportedValue(PhotoComparisonModel):
    """A complete nutrition field plus the column context that reported it."""

    column_id: OpaqueIdentifier
    observation: FieldObservation
    basis: NutritionBasis = NutritionBasis.UNKNOWN
    preparation_state: PreparationState = PreparationState.UNKNOWN
    package_quantity: Quantity | None = None
    serving_quantity: Quantity | None = None
    serving_quantity_state: FieldState = FieldState.NOT_VISIBLE
    basis_evidence: list[EvidencePointer] = Field(default_factory=list, max_length=16)
    preparation_evidence: list[EvidencePointer] = Field(default_factory=list, max_length=16)

    @model_validator(mode="after")
    def _validate_context(self) -> ReportedValue:
        if self.basis is not NutritionBasis.UNKNOWN and not self.basis_evidence:
            raise ValueError("known reported bases require evidence")
        if self.preparation_state is not PreparationState.UNKNOWN and not self.preparation_evidence:
            raise ValueError("known reported preparation states require evidence")
        if (
            self.serving_quantity is not None
            and self.serving_quantity_state is not self.serving_quantity.state
        ):
            raise ValueError("serving quantity state must match its quantity")
        if self.observation.normalized_value is not None:
            if not self.observation.evidence:
                raise ValueError("normalized reported values require field evidence")
            _require_known_unit(
                self.observation.normalized_value, self.observation.normalized_unit
            )
        return self


class DerivationInput(PhotoComparisonModel):
    kind: DerivationInputKind
    source_id: OpaqueIdentifier
    normalized_value: FiniteDecimal
    normalized_unit: MeasurementUnit
    evidence: list[EvidencePointer] = Field(min_length=1, max_length=16)

    @model_validator(mode="after")
    def _validate_input(self) -> DerivationInput:
        _require_known_unit(self.normalized_value, self.normalized_unit)
        return self


class DerivedValue(PhotoComparisonModel):
    value: FiniteDecimal
    unit: MeasurementUnit
    target_basis: NutritionBasis
    inputs: list[DerivationInput] = Field(min_length=1, max_length=16)

    @model_validator(mode="after")
    def _validate_derived_value(self) -> DerivedValue:
        _require_known_unit(self.value, self.unit)
        if self.target_basis in {NutritionBasis.UNKNOWN, NutritionBasis.OTHER}:
            raise ValueError("derived values require a supported target basis")
        return self


class ComparisonRow(PhotoComparisonModel):
    nutrient: str = Field(min_length=1, max_length=128)
    left: ReportedValue | None = None
    right: ReportedValue | None = None
    normalized_left: DerivedValue | None = None
    normalized_right: DerivedValue | None = None
    derived_difference: DerivedValue | None = None
    calculation_basis: str | None = Field(default=None, max_length=256)
    assumptions: list[str] = Field(default_factory=list, max_length=16)
    state: ComparisonState
    reason: str | None = Field(default=None, max_length=512)

    @staticmethod
    def _require_definitive_input(value: ReportedValue, nutrient: str) -> None:
        observation = value.observation
        if observation.nutrient not in {None, nutrient}:
            raise ValueError("comparison rows must retain equivalent nutrient identities")
        if observation.state is not FieldState.READABLE:
            raise ValueError("definitive comparisons require readable fields")
        if observation.row_kind is not NutrientRowKind.AMOUNT:
            raise ValueError("definitive comparisons require amount rows")
        if observation.qualifier is not ValueQualifier.EXACT:
            raise ValueError("definitive comparisons require exact values")
        if observation.normalized_value is None or observation.normalized_unit is None:
            raise ValueError("definitive comparisons require normalized values")
        if value.basis in {NutritionBasis.UNKNOWN, NutritionBasis.OTHER}:
            raise ValueError("definitive comparisons require a supported basis")
        if value.preparation_state is PreparationState.UNKNOWN:
            raise ValueError("definitive comparisons require known preparation states")

    @staticmethod
    def _require_derived_provenance(
        derived: DerivedValue, reported: ReportedValue
    ) -> None:
        allowed: dict[DerivationInputKind, set[str]] = {
            DerivationInputKind.REPORTED_FIELD: {reported.observation.field_id},
            DerivationInputKind.PACKAGE_QUANTITY: set(),
            DerivationInputKind.SERVING_QUANTITY: set(),
        }
        if reported.package_quantity is not None:
            allowed[DerivationInputKind.PACKAGE_QUANTITY].add(reported.package_quantity.field_id)
        if reported.serving_quantity is not None:
            allowed[DerivationInputKind.SERVING_QUANTITY].add(reported.serving_quantity.field_id)
        for input_value in derived.inputs:
            if input_value.source_id not in allowed[input_value.kind]:
                raise ValueError("derivation inputs must reference reported evidence")
            if input_value.kind is DerivationInputKind.PACKAGE_QUANTITY:
                quantity = reported.package_quantity
            elif input_value.kind is DerivationInputKind.SERVING_QUANTITY:
                quantity = reported.serving_quantity
            else:
                quantity = None
            if quantity is not None:
                if quantity.qualifier is not ValueQualifier.EXACT:
                    raise ValueError("qualified quantities cannot produce derived values")
                if quantity.normalized_value is None or quantity.normalized_unit is None:
                    raise ValueError("derived values require normalized quantity inputs")

    @model_validator(mode="after")
    def _validate_state(self) -> ComparisonRow:
        if self.state is ComparisonState.CONDITIONAL:
            if not self.assumptions or not self.reason:
                raise ValueError("conditional comparisons need assumptions and a reason")
            if self.derived_difference is not None:
                raise ValueError("conditional comparisons cannot contain a definitive difference")
            return self
        if self.state is ComparisonState.NOT_COMPARABLE:
            if not self.reason:
                raise ValueError("non-comparable rows need a reason")
            if self.derived_difference is not None:
                raise ValueError("non-comparable rows cannot contain a definitive difference")
            return self
        if self.reason:
            raise ValueError("comparable rows cannot contain a failure reason")
        if self.left is None or self.right is None:
            raise ValueError("comparable rows require both reported inputs")
        self._require_definitive_input(self.left, self.nutrient)
        self._require_definitive_input(self.right, self.nutrient)
        if self.left.preparation_state is not self.right.preparation_state:
            raise ValueError("comparable rows require matching preparation states")
        if self.left.basis is not self.right.basis:
            if self.normalized_left is None or self.normalized_right is None:
                raise ValueError("different reported bases require derived comparison values")
            if self.normalized_left.target_basis is not self.normalized_right.target_basis:
                raise ValueError("different reported bases require a shared target basis")
        if _unit_dimension(self.left.observation.normalized_unit) != _unit_dimension(
            self.right.observation.normalized_unit
        ):
            raise ValueError("comparable rows require compatible measurement dimensions")
        if (
            (self.normalized_left is not None or self.normalized_right is not None)
            and not self.calculation_basis
        ):
            raise ValueError("derived comparisons require a calculation basis")
        if self.normalized_left is not None:
            self._require_derived_provenance(self.normalized_left, self.left)
        if self.normalized_right is not None:
            self._require_derived_provenance(self.normalized_right, self.right)
        if self.derived_difference is not None:
            if self.normalized_left is None or self.normalized_right is None:
                raise ValueError("a difference requires both derived comparison values")
            if self.normalized_left.target_basis is not self.normalized_right.target_basis:
                raise ValueError("derived comparison values require a shared target basis")
            if _unit_dimension(self.normalized_left.unit) != _unit_dimension(
                self.normalized_right.unit
            ):
                raise ValueError("derived comparison values require compatible units")
            allowed_source_ids = {
                self.left.observation.field_id,
                self.right.observation.field_id,
            }
            if self.left.package_quantity is not None:
                allowed_source_ids.add(self.left.package_quantity.field_id)
            if self.right.package_quantity is not None:
                allowed_source_ids.add(self.right.package_quantity.field_id)
            if self.left.serving_quantity is not None:
                allowed_source_ids.add(self.left.serving_quantity.field_id)
            if self.right.serving_quantity is not None:
                allowed_source_ids.add(self.right.serving_quantity.field_id)
            if any(
                input_value.source_id not in allowed_source_ids
                for input_value in self.derived_difference.inputs
            ):
                raise ValueError("difference inputs must reference reported evidence")
        return self


class ComparisonRequest(PhotoComparisonModel):
    schema_version: int = Field(default=1, ge=1, le=1)
    left: Extraction
    right: Extraction

    @model_validator(mode="after")
    def _require_two_products(self) -> ComparisonRequest:
        if self.left.product_id == self.right.product_id:
            raise ValueError("comparison requires two distinct Products")
        return self


class ComparisonResponse(PhotoComparisonModel):
    schema_version: int = Field(default=1, ge=1, le=1)
    calculated_from_submitted_evidence: Literal[True] = True
    left_product_id: str = Field(min_length=1, max_length=128)
    right_product_id: str = Field(min_length=1, max_length=128)
    rows: list[ComparisonRow] = Field(default_factory=list, max_length=128)

    @model_validator(mode="after")
    def _require_distinct_products(self) -> ComparisonResponse:
        if self.left_product_id == self.right_product_id:
            raise ValueError("comparison requires two distinct Products")
        return self


class PhotoComparisonErrorDetail(PhotoComparisonModel):
    code: PhotoComparisonErrorCode
    message: str = Field(min_length=1, max_length=512)


class PhotoComparisonErrorResponse(PhotoComparisonModel):
    error: PhotoComparisonErrorDetail
