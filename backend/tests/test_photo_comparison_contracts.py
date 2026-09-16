from decimal import Decimal
from typing import Any, cast

import pytest
from pydantic import ValidationError

from lifegoods.photo_comparison.contracts import (
    ComparisonRequest,
    ComparisonResponse,
    ComparisonRow,
    ComparisonState,
    DerivationInput,
    DerivationInputKind,
    DerivedValue,
    EvidencePointer,
    Extraction,
    ExtractionOutcome,
    FieldObservation,
    FieldState,
    ImageEvidence,
    ImageRegion,
    MeasurementUnit,
    NutrientRowKind,
    NutritionBasis,
    NutritionColumn,
    ObservationAlternative,
    PreparationState,
    Quantity,
    ReportedValue,
    ValueQualifier,
)
from lifegoods.photo_comparison.examples import (
    conflicting_extraction,
    error_examples,
    missing_weight_pair,
    multiple_columns_extraction,
    normal_comparison_response,
    normal_pair,
    retake_required_extraction,
    unknown_preparation_comparison,
)


def _image(image_id: str = "panel") -> ImageEvidence:
    return ImageEvidence(
        image_id=image_id,
        original_image_id=f"original-{image_id}",
        role="nutrition_panel",
        width=100,
        height=100,
    )


def _field(
    *,
    field_id: str = "fat-field",
    image_id: str = "panel",
    nutrient: str = "fat",
    value_text: str | None = "1",
    unit_text: str | None = "g",
    normalized_value: Any = Decimal("1"),
    normalized_unit: MeasurementUnit | None = MeasurementUnit.G,
    state: FieldState = FieldState.READABLE,
    row_kind: NutrientRowKind = NutrientRowKind.AMOUNT,
    qualifier: ValueQualifier = ValueQualifier.EXACT,
    alternatives: list[ObservationAlternative] | None = None,
) -> FieldObservation:
    return FieldObservation(
        field_id=field_id,
        nutrient=nutrient,
        label="Fat" if state is FieldState.READABLE else None,
        value_text=value_text,
        unit_text=unit_text,
        original_script="Fat 1 g" if state is FieldState.READABLE else None,
        normalized_value=normalized_value,
        normalized_unit=normalized_unit,
        state=state,
        row_kind=row_kind,
        qualifier=qualifier,
        alternatives=alternatives or [],
        evidence=[EvidencePointer(image_id=image_id)]
        if state is not FieldState.NOT_VISIBLE
        else [],
    )


def _quantity(
    value: Any = Decimal("65"), unit: MeasurementUnit | None = MeasurementUnit.G
) -> Quantity:
    return Quantity(
        field_id="package-weight",
        label="Net weight",
        value_text="65 g",
        unit_text="g",
        normalized_value=value,
        normalized_unit=unit,
        evidence=[EvidencePointer(image_id="panel")],
    )


def _reported(
    *,
    field: FieldObservation | None = None,
    preparation_state: PreparationState = PreparationState.AS_SOLD,
    basis: NutritionBasis = NutritionBasis.PER_PACKAGE,
    evidence: list[EvidencePointer] | None = None,
    preparation_evidence: list[EvidencePointer] | None = None,
) -> ReportedValue:
    return ReportedValue(
        column_id="pack",
        observation=field or _field(),
        basis=basis,
        preparation_state=preparation_state,
        basis_evidence=evidence or [EvidencePointer(image_id="panel")],
        preparation_evidence=(
            preparation_evidence or [EvidencePointer(image_id="panel")]
            if preparation_state is not PreparationState.UNKNOWN
            else []
        ),
    )


def _derived_value(value: str = "1") -> DerivedValue:
    return DerivedValue(
        value=Decimal(value),
        unit=MeasurementUnit.G,
        target_basis=NutritionBasis.PER_100G,
        inputs=[
            DerivationInput(
                kind=DerivationInputKind.REPORTED_FIELD,
                source_id="fat-field",
                normalized_value=Decimal(value),
                normalized_unit=MeasurementUnit.G,
                evidence=[EvidencePointer(image_id="panel")],
            )
        ],
    )


def test_examples_cover_and_round_trip_all_contract_scenarios() -> None:
    examples = [
        normal_pair(),
        normal_comparison_response(),
        missing_weight_pair(),
        multiple_columns_extraction(),
        conflicting_extraction(),
        retake_required_extraction(),
        unknown_preparation_comparison(),
    ]
    for example in examples:
        type(example).model_validate_json(example.model_dump_json())

    for example in error_examples().values():
        type(example).model_validate_json(example.model_dump_json())


def test_seed_transcription_preserves_literal_units_and_separate_weight_photo() -> None:
    request = normal_pair()
    mee = request.left
    mama = request.right
    assert mee.images[1].role == "package_weight"
    assert mee.package_quantity is not None
    assert mee.package_quantity.value_text == "65 g"
    assert mama.nutrition_columns[0].fields[0].value_text == "1380"
    assert mama.nutrition_columns[0].fields[0].unit_text == "mg"


def test_decimal_values_are_finite_and_preserve_zero() -> None:
    field = _field(normalized_value=Decimal("0"))
    assert field.normalized_value == Decimal("0")

    for value in (True, "nan", "inf", "-inf"):
        with pytest.raises(ValidationError):
            _field(normalized_value=cast(Any, value))


def test_null_literal_values_are_allowed_for_unreadable_and_not_visible_fields() -> None:
    unreadable = _field(
        value_text=None,
        unit_text=None,
        normalized_value=None,
        normalized_unit=None,
        state=FieldState.UNREADABLE,
    )
    not_visible = _field(
        value_text=None,
        unit_text=None,
        normalized_value=None,
        normalized_unit=None,
        state=FieldState.NOT_VISIBLE,
    )
    assert unreadable.value_text is None
    assert not_visible.value_text is None


def test_conflicting_fields_retain_competing_literal_observations() -> None:
    field = _field(
        value_text="1.5",
        unit_text="g",
        normalized_value=None,
        normalized_unit=None,
        state=FieldState.CONFLICTING,
        alternatives=[
            ObservationAlternative(
                value_text="1.8",
                unit_text="g",
                original_script="Fat 1.8 g",
                evidence=[EvidencePointer(image_id="panel")],
            )
        ],
    )
    assert field.alternatives[0].value_text == "1.8"


def test_normalized_values_require_known_units_and_evidence() -> None:
    with pytest.raises(ValidationError):
        _field(normalized_unit=MeasurementUnit.UNKNOWN)
    with pytest.raises(ValidationError):
        Quantity(
            field_id="weight",
            value_text="65",
            unit_text="g",
            normalized_value=Decimal("65"),
            normalized_unit=MeasurementUnit.UNKNOWN,
            evidence=[EvidencePointer(image_id="panel")],
        )
    observation = _field()
    object.__setattr__(observation, "evidence", [])
    with pytest.raises(ValidationError):
        ReportedValue(
            column_id="pack",
            observation=observation,
            basis=NutritionBasis.PER_PACKAGE,
            basis_evidence=[EvidencePointer(image_id="panel")],
            preparation_state=PreparationState.UNKNOWN,
        )


def test_quantity_rejects_zero_and_negative_normalized_values() -> None:
    for value in (Decimal("0"), Decimal("-1")):
        with pytest.raises(ValidationError):
            _quantity(value)


def test_conflicting_quantities_retain_competing_evidence() -> None:
    quantity = Quantity(
        field_id="weight",
        label="Net weight",
        value_text="65",
        unit_text="g",
        state=FieldState.CONFLICTING,
        alternatives=[
            ObservationAlternative(
                value_text="60",
                unit_text="g",
                original_script="60 g",
                evidence=[EvidencePointer(image_id="panel")],
            )
        ],
        evidence=[EvidencePointer(image_id="panel")],
    )
    assert quantity.alternatives[0].value_text == "60"


def test_per_serving_column_can_preserve_missing_serving_size() -> None:
    extraction = multiple_columns_extraction()
    serving = extraction.nutrition_columns[1]
    assert serving.basis is NutritionBasis.PER_SERVING
    assert serving.serving_quantity is None
    assert serving.serving_quantity_state is FieldState.NOT_VISIBLE


def test_identity_and_column_references_are_checked() -> None:
    from lifegoods.photo_comparison.contracts import ProductIdentity

    with pytest.raises(ValidationError):
        Extraction(
            product_id="identity",
            images=[_image()],
            identity=ProductIdentity(
                name=_field(image_id="missing", field_id="name-field")
            ),
            outcome=ExtractionOutcome.COMPLETE,
        )

    with pytest.raises(ValidationError):
        Extraction(
            product_id="columns",
            images=[_image()],
            nutrition_columns=[
                NutritionColumn(column_id="pack"),
                NutritionColumn(column_id="pack"),
            ],
            outcome=ExtractionOutcome.COMPLETE,
        )

    with pytest.raises(ValidationError):
        Extraction(
            product_id="images",
            images=[_image(), _image()],
            outcome=ExtractionOutcome.COMPLETE,
        )


def test_extraction_rejects_more_than_three_images() -> None:
    with pytest.raises(ValidationError):
        Extraction(
            product_id="too-many-images",
            images=[_image(f"panel-{index}") for index in range(4)],
            outcome=ExtractionOutcome.COMPLETE,
        )


def test_image_ids_are_opaque_and_regions_are_bounded() -> None:
    with pytest.raises(ValidationError):
        _image("https://example.com/photo.jpg")
    with pytest.raises(ValidationError):
        ImageRegion(x=0.9, y=0, width=0.2, height=0.1)
    with pytest.raises(ValidationError):
        ImageRegion(x=True, y=0, width=0.1, height=0.1)


def test_row_kind_and_qualifier_block_definitive_comparison() -> None:
    percentage = _reported(
        field=_field(
            nutrient="fat",
            row_kind=NutrientRowKind.PERCENTAGE,
            normalized_unit=MeasurementUnit.PERCENT,
        )
    )
    with pytest.raises(ValidationError):
        ComparisonRow(
            nutrient="fat",
            left=percentage,
            right=_reported(),
            state=ComparisonState.COMPARABLE,
        )

    qualified = _reported(field=_field(qualifier=ValueQualifier.LESS_THAN))
    with pytest.raises(ValidationError):
        ComparisonRow(
            nutrient="fat",
            left=qualified,
            right=_reported(),
            state=ComparisonState.COMPARABLE,
        )


def test_comparison_states_enforce_preparation_and_difference_invariants() -> None:
    with pytest.raises(ValidationError):
        ComparisonRow(
            nutrient="fat",
            left=_reported(preparation_state=PreparationState.UNKNOWN),
            right=_reported(preparation_state=PreparationState.UNKNOWN),
            state=ComparisonState.COMPARABLE,
        )

    with pytest.raises(ValidationError):
        ComparisonRow(
            nutrient="fat",
            left=_reported(),
            right=_reported(),
            state=ComparisonState.NOT_COMPARABLE,
            reason="basis conflict",
            derived_difference=_derived_value(),
        )

    with pytest.raises(ValidationError):
        ComparisonRow(
            nutrient="fat",
            left=_reported(),
            right=_reported(),
            state=ComparisonState.CONDITIONAL,
            assumptions=["unknown preparation"],
        )

    with pytest.raises(ValidationError):
        ComparisonRow(
            nutrient="fat",
            left=_reported(basis=NutritionBasis.PER_PACKAGE),
            right=_reported(basis=NutritionBasis.PER_SERVING),
            state=ComparisonState.COMPARABLE,
        )

    wrong_input = DerivationInput(
        kind=DerivationInputKind.REPORTED_FIELD,
        source_id="not-a-reported-field",
        normalized_value=Decimal("1"),
        normalized_unit=MeasurementUnit.G,
        evidence=[EvidencePointer(image_id="panel")],
    )
    with pytest.raises(ValidationError):
        ComparisonRow(
            nutrient="fat",
            left=_reported(),
            right=_reported(),
            state=ComparisonState.COMPARABLE,
            normalized_left=DerivedValue(
                value=Decimal("1"),
                unit=MeasurementUnit.G,
                target_basis=NutritionBasis.PER_100G,
                inputs=[wrong_input],
            ),
        )

    qualified_quantity = Quantity(
        field_id="package-weight",
        label="Net weight",
        value_text="<65",
        unit_text="g",
        qualifier=ValueQualifier.LESS_THAN,
        normalized_value=Decimal("65"),
        normalized_unit=MeasurementUnit.G,
        evidence=[EvidencePointer(image_id="panel")],
    )
    with pytest.raises(ValidationError):
        ComparisonRow(
            nutrient="fat",
            left=ReportedValue(
                column_id="pack",
                observation=_field(),
                basis=NutritionBasis.PER_PACKAGE,
                preparation_state=PreparationState.AS_SOLD,
                package_quantity=qualified_quantity,
                basis_evidence=[EvidencePointer(image_id="panel")],
                preparation_evidence=[EvidencePointer(image_id="panel")],
            ),
            right=_reported(),
            normalized_left=DerivedValue(
                value=Decimal("1"),
                unit=MeasurementUnit.G,
                target_basis=NutritionBasis.PER_100G,
                inputs=[
                    DerivationInput(
                        kind=DerivationInputKind.REPORTED_FIELD,
                        source_id="fat-field",
                        normalized_value=Decimal("1"),
                        normalized_unit=MeasurementUnit.G,
                        evidence=[EvidencePointer(image_id="panel")],
                    ),
                    DerivationInput(
                        kind=DerivationInputKind.PACKAGE_QUANTITY,
                        source_id="package-weight",
                        normalized_value=Decimal("65"),
                        normalized_unit=MeasurementUnit.G,
                        evidence=[EvidencePointer(image_id="panel")],
                    ),
                ],
            ),
            state=ComparisonState.COMPARABLE,
            calculation_basis="per-100-g",
        )


def test_comparable_response_keeps_derivation_provenance() -> None:
    response = normal_comparison_response()
    row = response.rows[0]
    assert row.derived_difference is not None
    assert row.derived_difference.inputs[0].kind is DerivationInputKind.REPORTED_FIELD
    assert row.normalized_left is not None
    assert row.normalized_left.target_basis is NutritionBasis.PER_100G


def test_nested_instances_are_revalidated_and_marker_is_fixed() -> None:
    left = normal_pair().left
    right = normal_pair().right
    object.__setattr__(left.nutrition_columns[0].fields[0], "evidence", [])
    with pytest.raises(ValidationError):
        ComparisonRequest(left=left, right=right)

    with pytest.raises(ValidationError):
        ComparisonResponse(
            left_product_id="left",
            right_product_id="right",
            calculated_from_submitted_evidence=cast(Any, False),
        )


def test_model_dump_json_keeps_decimal_wire_values_readable() -> None:
    value = _field()
    assert '"normalized_value":"1"' in value.model_dump_json()


def test_original_script_and_unicode_survive_round_trip() -> None:
    field = FieldObservation(
        field_id="khmer-field",
        label="សូដ្យូម",
        value_text="១៥០០",
        unit_text="មីលីក្រាម",
        original_script="សូដ្យូម ១៥០០ មីលីក្រាម",
        language="km",
        evidence=[EvidencePointer(image_id="panel")],
    )
    restored = FieldObservation.model_validate_json(field.model_dump_json())
    assert restored.original_script == "សូដ្យូម ១៥០០ មីលីក្រាម"
    assert restored.language == "km"
