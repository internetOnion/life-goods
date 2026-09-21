"""Pure Decimal comparison of two submitted photo extractions."""

from __future__ import annotations

from collections import OrderedDict
from decimal import Decimal

from lifegoods.photo_comparison.contracts import (
    ComparisonRequest,
    ComparisonResponse,
    ComparisonRow,
    ComparisonState,
    DerivationInput,
    DerivationInputKind,
    DerivedValue,
    Extraction,
    FieldObservation,
    FieldState,
    MeasurementUnit,
    NutrientRowKind,
    NutritionBasis,
    NutritionColumn,
    PreparationState,
    Quantity,
    ReportedValue,
    ValueQualifier,
)
from lifegoods.photo_comparison.normalization import canonical_nutrient

_UNIT_DIMENSION = {
    MeasurementUnit.G: "mass",
    MeasurementUnit.MG: "mass",
    MeasurementUnit.UG: "mass",
    MeasurementUnit.KG: "mass",
    MeasurementUnit.ML: "volume",
    MeasurementUnit.L: "volume",
    MeasurementUnit.KCAL: "energy_kcal",
    MeasurementUnit.KJ: "energy_kj",
    MeasurementUnit.PERCENT: "percentage",
    MeasurementUnit.COUNT: "count",
}
_UNIT_TO_BASE = {
    MeasurementUnit.G: (MeasurementUnit.G, Decimal("1")),
    MeasurementUnit.MG: (MeasurementUnit.G, Decimal("0.001")),
    MeasurementUnit.UG: (MeasurementUnit.G, Decimal("0.000001")),
    MeasurementUnit.KG: (MeasurementUnit.G, Decimal("1000")),
    MeasurementUnit.ML: (MeasurementUnit.ML, Decimal("1")),
    MeasurementUnit.L: (MeasurementUnit.ML, Decimal("1000")),
}


def _dimension(unit: MeasurementUnit | None) -> str | None:
    return _UNIT_DIMENSION.get(unit) if unit is not None else None


def _convert(value: Decimal, source: MeasurementUnit, target: MeasurementUnit) -> Decimal | None:
    source_dimension = _dimension(source)
    target_dimension = _dimension(target)
    if source_dimension != target_dimension:
        return None
    if source == target:
        return value
    source_info = _UNIT_TO_BASE.get(source)
    target_info = _UNIT_TO_BASE.get(target)
    if source_info is None or target_info is None or source_info[0] != target_info[0]:
        return None
    return value * source_info[1] / target_info[1]


def _quantity_is_usable(quantity: Quantity | None) -> bool:
    return bool(
        quantity is not None
        and quantity.state is FieldState.READABLE
        and quantity.qualifier is ValueQualifier.EXACT
        and quantity.normalized_value is not None
        and quantity.normalized_unit is not None
    )


def _basis_for_quantity(quantity: Quantity | None) -> NutritionBasis | None:
    if not _quantity_is_usable(quantity) or quantity is None:
        return None
    dimension = _dimension(quantity.normalized_unit)
    return (
        NutritionBasis.PER_100G
        if dimension == "mass"
        else NutritionBasis.PER_100ML
        if dimension == "volume"
        else None
    )


def _quantity_for(reported: ReportedValue) -> Quantity | None:
    if reported.basis is NutritionBasis.PER_PACKAGE:
        return reported.package_quantity
    if reported.basis is NutritionBasis.PER_SERVING:
        return reported.serving_quantity
    return None


def _reported_value(
    column: NutritionColumn, extraction: Extraction, field: FieldObservation
) -> ReportedValue:
    return ReportedValue(
        column_id=column.column_id,
        observation=field,
        basis=column.basis,
        preparation_state=column.preparation_state,
        package_quantity=extraction.package_quantity,
        serving_quantity=column.serving_quantity,
        serving_quantity_state=column.serving_quantity_state,
        basis_evidence=column.basis_evidence,
        preparation_evidence=column.preparation_evidence,
    )


def _field_key(field: FieldObservation, side: str) -> str:
    nutrient = canonical_nutrient(field.nutrient) or canonical_nutrient(field.label)
    kind_prefix = "percentage" if field.row_kind is NutrientRowKind.PERCENTAGE else "amount"
    if nutrient is not None:
        return f"{kind_prefix}:{nutrient}"
    # An opaque provider field ID has no cross-Product identity. Keep unknown
    # rows separate even when two provider responses happen to reuse an ID.
    return f"unmatched:{side}:{kind_prefix}:{field.field_id}"


def _selected_column(extraction: Extraction, selected_id: str | None) -> NutritionColumn | None:
    if selected_id is not None:
        return next(
            (column for column in extraction.nutrition_columns if column.column_id == selected_id),
            None,
        )
    return extraction.nutrition_columns[0] if len(extraction.nutrition_columns) == 1 else None


def _field_map(
    extraction: Extraction, column: NutritionColumn | None, side: str
) -> OrderedDict[str, FieldObservation]:
    fields: OrderedDict[str, FieldObservation] = OrderedDict()
    if column is None:
        return fields
    for field in column.fields:
        key = _field_key(field, side)
        if key in fields:
            key = f"{key}:{field.field_id}"
        fields[key] = field
    return fields


def _same_quantity(left: Quantity, right: Quantity) -> bool:
    if left.normalized_value is None or left.normalized_unit is None:
        return False
    if right.normalized_value is None or right.normalized_unit is None:
        return False
    converted = _convert(right.normalized_value, right.normalized_unit, left.normalized_unit)
    return converted is not None and converted == left.normalized_value


def _target_basis(left: ReportedValue, right: ReportedValue) -> NutritionBasis | None:
    if left.basis in {NutritionBasis.UNKNOWN, NutritionBasis.OTHER}:
        return None
    if right.basis in {NutritionBasis.UNKNOWN, NutritionBasis.OTHER}:
        return None
    if left.basis == right.basis:
        if left.basis is NutritionBasis.PER_SERVING:
            if _quantity_is_usable(left.serving_quantity) and _quantity_is_usable(
                right.serving_quantity
            ):
                assert left.serving_quantity is not None
                assert right.serving_quantity is not None
                if _same_quantity(left.serving_quantity, right.serving_quantity):
                    return left.basis
                return _basis_for_quantity(left.serving_quantity)
            return None
        if (
            left.basis is NutritionBasis.PER_PACKAGE
            and _quantity_is_usable(left.package_quantity)
            and _quantity_is_usable(right.package_quantity)
        ):
            assert left.package_quantity is not None
            assert right.package_quantity is not None
            if _same_quantity(left.package_quantity, right.package_quantity):
                return left.basis
            return _basis_for_quantity(left.package_quantity)
        return left.basis

    candidates: set[NutritionBasis] = set()
    for reported in (left, right):
        if reported.basis in {NutritionBasis.PER_100G, NutritionBasis.PER_100ML}:
            candidates.add(reported.basis)
        else:
            quantity_basis = _basis_for_quantity(_quantity_for(reported))
            if quantity_basis is None:
                return None
            candidates.add(quantity_basis)
    return candidates.pop() if len(candidates) == 1 else None


def _derivation_inputs(
    reported: ReportedValue, *, unit: MeasurementUnit, include_quantity: bool
) -> list[DerivationInput]:
    inputs = [
        DerivationInput(
            kind=DerivationInputKind.REPORTED_FIELD,
            source_id=reported.observation.field_id,
            normalized_value=reported.observation.normalized_value or Decimal("0"),
            normalized_unit=reported.observation.normalized_unit or unit,
            evidence=reported.observation.evidence,
        )
    ]
    if include_quantity:
        quantity = _quantity_for(reported)
        if (
            quantity is not None
            and quantity.normalized_value is not None
            and quantity.normalized_unit is not None
        ):
            inputs.append(
                DerivationInput(
                    kind=(
                        DerivationInputKind.PACKAGE_QUANTITY
                        if reported.basis is NutritionBasis.PER_PACKAGE
                        else DerivationInputKind.SERVING_QUANTITY
                    ),
                    source_id=quantity.field_id,
                    normalized_value=quantity.normalized_value,
                    normalized_unit=quantity.normalized_unit,
                    evidence=quantity.evidence,
                )
            )
    return inputs


def _derive(
    reported: ReportedValue, target_basis: NutritionBasis, target_unit: MeasurementUnit
) -> DerivedValue | None:
    field = reported.observation
    if (
        field.state is not FieldState.READABLE
        or field.row_kind is not NutrientRowKind.AMOUNT
        or field.qualifier is not ValueQualifier.EXACT
        or field.normalized_value is None
        or field.normalized_unit is None
    ):
        return None
    converted_value = _convert(field.normalized_value, field.normalized_unit, target_unit)
    if converted_value is None:
        return None
    include_quantity = reported.basis != target_basis
    if include_quantity:
        quantity = _quantity_for(reported)
        if (
            not _quantity_is_usable(quantity)
            or quantity is None
            or quantity.normalized_value is None
            or quantity.normalized_unit is None
        ):
            return None
        quantity_basis = _basis_for_quantity(quantity)
        if quantity_basis != target_basis:
            return None
        quantity_unit = (
            MeasurementUnit.G if target_basis is NutritionBasis.PER_100G else MeasurementUnit.ML
        )
        quantity_value = _convert(
            quantity.normalized_value, quantity.normalized_unit, quantity_unit
        )
        if quantity_value is None or quantity_value <= 0:
            return None
        converted_value = converted_value * Decimal("100") / quantity_value
    return DerivedValue(
        value=converted_value,
        unit=target_unit,
        target_basis=target_basis,
        inputs=_derivation_inputs(
            reported,
            unit=target_unit,
            include_quantity=include_quantity,
        ),
    )


def _difference(
    left: ReportedValue,
    right: ReportedValue,
    normalized_left: DerivedValue,
    normalized_right: DerivedValue,
) -> DerivedValue:
    unit = normalized_left.unit
    right_value = _convert(normalized_right.value, normalized_right.unit, unit)
    if right_value is None:
        raise ValueError("difference requires compatible derived units")
    return DerivedValue(
        value=normalized_left.value - right_value,
        unit=unit,
        target_basis=normalized_left.target_basis,
        inputs=[
            DerivationInput(
                kind=DerivationInputKind.REPORTED_FIELD,
                source_id=left.observation.field_id,
                normalized_value=normalized_left.value,
                normalized_unit=unit,
                evidence=left.observation.evidence,
            ),
            DerivationInput(
                kind=DerivationInputKind.REPORTED_FIELD,
                source_id=right.observation.field_id,
                normalized_value=right_value,
                normalized_unit=unit,
                evidence=right.observation.evidence,
            ),
        ],
    )


def _row_kind_for(left: ReportedValue | None, right: ReportedValue | None) -> NutrientRowKind:
    for reported in (left, right):
        if reported is not None and reported.observation is not None:
            return reported.observation.row_kind
    return NutrientRowKind.AMOUNT


def _display_nutrient(
    key: str, left: ReportedValue | None, right: ReportedValue | None
) -> str:
    if ":" in key and not key.startswith("unmatched:"):
        return key.split(":", 1)[1]
    for reported in (left, right):
        if reported is not None and reported.observation is not None:
            obs = reported.observation
            if obs.nutrient:
                return obs.nutrient
            if obs.label:
                return obs.label
            if obs.original_script:
                return obs.original_script
    return "nutrition"


def _unavailable_row(
    nutrient: str,
    left: ReportedValue | None,
    right: ReportedValue | None,
    reason: str,
    row_kind: NutrientRowKind = NutrientRowKind.AMOUNT,
) -> ComparisonRow:
    return ComparisonRow(
        nutrient=nutrient,
        row_kind=row_kind,
        left=left,
        right=right,
        state=ComparisonState.NOT_COMPARABLE,
        reason=reason,
    )


def _compare_row(
    key: str, left: ReportedValue | None, right: ReportedValue | None
) -> ComparisonRow:
    row_kind = _row_kind_for(left, right)
    nutrient = _display_nutrient(key, left, right)
    if left is None or right is None:
        if left is None and right is None:
            return _unavailable_row(
                nutrient,
                left,
                right,
                "Neither Product has a selected nutrition column for comparison.",
                row_kind=row_kind,
            )
        return _unavailable_row(
            nutrient,
            left,
            right,
            "Not found in photos for the other product.",
            row_kind=row_kind,
        )
    left_observation = left.observation
    right_observation = right.observation
    if (
        left_observation.row_kind is not NutrientRowKind.AMOUNT
        or right_observation.row_kind is not NutrientRowKind.AMOUNT
    ):
        return _unavailable_row(
            nutrient,
            left,
            right,
            (
                "Percentage rows are retained for reference, but reference daily "
                "values or serving bases may differ between products."
            ),
            row_kind=row_kind,
        )
    if (
        left_observation.state is not FieldState.READABLE
        or right_observation.state is not FieldState.READABLE
    ):
        return _unavailable_row(
            nutrient, left, right, "One or both observations are not readable.", row_kind=row_kind
        )
    if (
        left_observation.qualifier is not ValueQualifier.EXACT
        or right_observation.qualifier is not ValueQualifier.EXACT
    ):
        return _unavailable_row(
            nutrient,
            left,
            right,
            "Qualified values do not produce a numeric difference.",
            row_kind=row_kind,
        )
    if left_observation.normalized_value is None or right_observation.normalized_value is None:
        return _unavailable_row(
            nutrient,
            left,
            right,
            "A numeric value is missing or could not be normalized.",
            row_kind=row_kind,
        )
    if (
        left.preparation_state is not right.preparation_state
        and left.preparation_state is not PreparationState.UNKNOWN
        and right.preparation_state is not PreparationState.UNKNOWN
    ):
        return _unavailable_row(
            nutrient,
            left,
            right,
            "The Products report different preparation states.",
            row_kind=row_kind,
        )

    target_basis = _target_basis(left, right)
    if target_basis is None:
        return _unavailable_row(
            nutrient,
            left,
            right,
            "The reported bases do not have the explicit quantities needed "
            "for a common comparison.",
            row_kind=row_kind,
        )
    if _dimension(left_observation.normalized_unit) != _dimension(
        right_observation.normalized_unit
    ):
        return _unavailable_row(
            nutrient, left, right, "The reported units are incompatible.", row_kind=row_kind
        )
    target_unit = left_observation.normalized_unit
    if target_unit is None or right_observation.normalized_unit is None:
        return _unavailable_row(
            nutrient,
            left,
            right,
            "A compatible measurement unit is unavailable.",
            row_kind=row_kind,
        )
    normalized_left = _derive(left, target_basis, target_unit)
    normalized_right = _derive(right, target_basis, target_unit)
    if normalized_left is None or normalized_right is None:
        return _unavailable_row(
            nutrient,
            left,
            right,
            "The explicit package or serving quantities needed for normalization are unavailable.",
            row_kind=row_kind,
        )

    assumptions: list[str] = []
    if target_basis in {NutritionBasis.PER_100G, NutritionBasis.PER_100ML} and (
        left.basis is NutritionBasis.PER_PACKAGE or right.basis is NutritionBasis.PER_PACKAGE
    ):
        assumptions.append("Assumes each reported per-package value covers the stated net weight.")
    preparation_unknown = (
        left.preparation_state is PreparationState.UNKNOWN
        or right.preparation_state is PreparationState.UNKNOWN
    )
    calculation_basis = f"{target_basis.value}; submitted values normalized to {target_unit.value}"
    if preparation_unknown:
        assumptions.append("Preparation state is unknown for at least one Product.")
        return ComparisonRow(
            nutrient=nutrient,
            row_kind=row_kind,
            left=left,
            right=right,
            normalized_left=normalized_left,
            normalized_right=normalized_right,
            calculation_basis=calculation_basis,
            assumptions=assumptions,
            state=ComparisonState.CONDITIONAL,
            reason="Preparation state is unknown, so the normalized values are conditional.",
        )
    return ComparisonRow(
        nutrient=nutrient,
        row_kind=row_kind,
        left=left,
        right=right,
        normalized_left=normalized_left,
        normalized_right=normalized_right,
        derived_difference=_difference(left, right, normalized_left, normalized_right),
        calculation_basis=calculation_basis,
        assumptions=assumptions,
        state=ComparisonState.COMPARABLE,
    )


def compare(request: ComparisonRequest) -> ComparisonResponse:
    left_column = _selected_column(request.left, request.left_column_id)
    right_column = _selected_column(request.right, request.right_column_id)
    left_fields = _field_map(request.left, left_column, "left")
    right_fields = _field_map(request.right, right_column, "right")
    keys = list(left_fields)
    keys.extend(key for key in right_fields if key not in left_fields)
    if not keys:
        keys = ["nutrition"]
    rows = [
        _compare_row(
            key,
            _reported_value(left_column, request.left, left_fields[key])
            if left_column and key in left_fields
            else None,
            _reported_value(right_column, request.right, right_fields[key])
            if right_column and key in right_fields
            else None,
        )
        for key in keys
    ]
    return ComparisonResponse(
        left_product_id=request.left.product_id,
        right_product_id=request.right.product_id,
        rows=rows,
    )
