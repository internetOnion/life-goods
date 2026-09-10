from decimal import Decimal

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
    MeasurementUnit,
    NutrientRowKind,
    NutritionBasis,
    NutritionColumn,
    ObservationAlternative,
    PhotoComparisonErrorCode,
    PhotoComparisonErrorDetail,
    PhotoComparisonErrorResponse,
    PreparationState,
    Quantity,
    ReportedValue,
)


def _image(image_id: str, role: str = "nutrition_panel") -> ImageEvidence:
    return ImageEvidence(
        image_id=image_id,
        original_image_id=f"seed-original-{image_id}",
        processed_image_id=f"seed-processed-{image_id}",
        role=role,
        width=1600,
        height=2400,
    )


def _pointer(image_id: str) -> EvidencePointer:
    return EvidencePointer(image_id=image_id)


def _quantity(
    field_id: str,
    image_id: str,
    value: str | None,
    unit: str | None,
    normalized: str | None,
    *,
    state: FieldState = FieldState.READABLE,
) -> Quantity:
    return Quantity(
        field_id=field_id,
        label="Net weight" if state is FieldState.READABLE else None,
        value_text=value,
        unit_text=unit,
        state=state,
        normalized_value=Decimal(normalized) if normalized is not None else None,
        normalized_unit=MeasurementUnit.G if normalized is not None else None,
        evidence=[_pointer(image_id)] if state is not FieldState.NOT_VISIBLE else [],
    )


def _field(
    field_id: str,
    image_id: str,
    nutrient: str,
    value: str | None,
    unit: str | None,
    normalized: str | None,
    *,
    state: FieldState = FieldState.READABLE,
    row_kind: NutrientRowKind = NutrientRowKind.AMOUNT,
    alternatives: list[ObservationAlternative] | None = None,
) -> FieldObservation:
    return FieldObservation(
        field_id=field_id,
        nutrient=nutrient,
        label=nutrient.title() if state is FieldState.READABLE else None,
        value_text=value,
        unit_text=unit,
        original_script=(f"{nutrient.title()} {value}{unit or ''}" if value else None),
        state=state,
        normalized_value=Decimal(normalized) if normalized is not None else None,
        normalized_unit=(MeasurementUnit.G if unit == "g" else MeasurementUnit.MG)
        if normalized is not None and unit in {"g", "mg"}
        else None,
        row_kind=row_kind,
        alternatives=alternatives or [],
        evidence=[_pointer(image_id)] if state is not FieldState.NOT_VISIBLE else [],
    )


def _column(
    image_id: str,
    *,
    column_id: str = "pack",
    basis: NutritionBasis = NutritionBasis.PER_PACKAGE,
    preparation_state: PreparationState = PreparationState.AS_SOLD,
    preparation_evidence: list[EvidencePointer] | None = None,
    serving_quantity: Quantity | None = None,
    serving_quantity_state: FieldState = FieldState.NOT_VISIBLE,
    fields: list[FieldObservation] | None = None,
) -> NutritionColumn:
    return NutritionColumn(
        column_id=column_id,
        label="Per pack" if basis is NutritionBasis.PER_PACKAGE else "Per serving",
        basis=basis,
        preparation_state=preparation_state,
        serving_quantity=serving_quantity,
        serving_quantity_state=serving_quantity_state,
        basis_evidence=[_pointer(image_id)] if basis is not NutritionBasis.UNKNOWN else [],
        preparation_evidence=(
            preparation_evidence
            if preparation_evidence is not None
            else [_pointer(image_id)]
        ),
        fields=fields or [],
    )


def seed_extraction(
    product_id: str,
    panel_image_id: str,
    sodium_value: str,
    sodium_unit: str,
    sodium_normalized: str,
    *,
    weight_image_id: str | None = None,
    weight_g: str | None = None,
    preparation_state: PreparationState = PreparationState.AS_SOLD,
) -> Extraction:
    images = [_image(panel_image_id)]
    quantity = None
    resolved_weight_image_id = weight_image_id or panel_image_id
    if weight_image_id is not None and weight_image_id != panel_image_id:
        images.append(_image(weight_image_id, role="package_weight"))
    if weight_g is not None:
        quantity = _quantity(
            "package-weight",
            resolved_weight_image_id,
            f"{weight_g} g",
            "g",
            weight_g,
        )
    column = _column(
        panel_image_id,
        preparation_state=preparation_state,
        preparation_evidence=[_pointer(panel_image_id)],
        fields=[
            _field(
                "sodium-field",
                panel_image_id,
                "sodium",
                sodium_value,
                sodium_unit,
                sodium_normalized,
            )
        ],
    )
    return Extraction(
        product_id=product_id,
        images=images,
        package_quantity=quantity,
        nutrition_columns=[column],
        outcome=ExtractionOutcome.COMPLETE,
        provider="owner-checked-seed-transcription",
        model="seed-placeholder-model",
        configuration_version="seed-v1",
    )


def normal_pair() -> ComparisonRequest:
    """Known-basis seed pair; images are placeholder metadata, not retained photos."""

    return ComparisonRequest(
        left=seed_extraction(
            "mee-chiet",
            "mee-panel",
            "1.5",
            "g",
            "1.5",
            weight_image_id="mee-weight",
            weight_g="65",
        ),
        right=seed_extraction("mama", "mama-panel", "1380", "mg", "1380", weight_g="60"),
    )


def _reported(
    extraction: Extraction,
    *,
    image_id: str,
    preparation_state: PreparationState | None = None,
) -> ReportedValue:
    column = extraction.nutrition_columns[0]
    observation = column.fields[0]
    resolved_preparation = preparation_state or column.preparation_state
    return ReportedValue(
        column_id=column.column_id,
        observation=observation,
        basis=column.basis,
        preparation_state=resolved_preparation,
        package_quantity=extraction.package_quantity,
        serving_quantity=column.serving_quantity,
        serving_quantity_state=column.serving_quantity_state,
        basis_evidence=[_pointer(image_id)],
        preparation_evidence=(column.preparation_evidence if preparation_state is None else []),
    )


def normal_comparison_response() -> ComparisonResponse:
    request = normal_pair()
    left = _reported(request.left, image_id="mee-panel")
    right = _reported(request.right, image_id="mama-panel")
    left_derived = DerivedValue(
        value=Decimal("2.3076923077"),
        unit=MeasurementUnit.G,
        target_basis=NutritionBasis.PER_100G,
        inputs=[
            DerivationInput(
                kind=DerivationInputKind.REPORTED_FIELD,
                source_id="sodium-field",
                normalized_value=Decimal("1.5"),
                normalized_unit=MeasurementUnit.G,
                evidence=[_pointer("mee-panel")],
            ),
            DerivationInput(
                kind=DerivationInputKind.PACKAGE_QUANTITY,
                source_id="package-weight",
                normalized_value=Decimal("65"),
                normalized_unit=MeasurementUnit.G,
                evidence=[_pointer("mee-weight")],
            ),
        ],
    )
    right_derived = DerivedValue(
        value=Decimal("2.3"),
        unit=MeasurementUnit.G,
        target_basis=NutritionBasis.PER_100G,
        inputs=[
            DerivationInput(
                kind=DerivationInputKind.REPORTED_FIELD,
                source_id="sodium-field",
                normalized_value=Decimal("1380"),
                normalized_unit=MeasurementUnit.MG,
                evidence=[_pointer("mama-panel")],
            ),
            DerivationInput(
                kind=DerivationInputKind.PACKAGE_QUANTITY,
                source_id="package-weight",
                normalized_value=Decimal("60"),
                normalized_unit=MeasurementUnit.G,
                evidence=[_pointer("mama-panel")],
            ),
        ],
    )
    return ComparisonResponse(
        left_product_id=request.left.product_id,
        right_product_id=request.right.product_id,
        rows=[
            ComparisonRow(
                nutrient="sodium",
                left=left,
                right=right,
                normalized_left=left_derived,
                normalized_right=right_derived,
                derived_difference=DerivedValue(
                    value=Decimal("0.0076923077"),
                    unit=MeasurementUnit.G,
                    target_basis=NutritionBasis.PER_100G,
                    inputs=left_derived.inputs + right_derived.inputs,
                ),
                calculation_basis="per-100-g derived from reported package values",
                state=ComparisonState.COMPARABLE,
            )
        ],
    )


def missing_weight_pair() -> ComparisonRequest:
    return ComparisonRequest(
        left=seed_extraction(
            "mee-chiet",
            "mee-panel",
            "1.5",
            "g",
            "1.5",
            weight_image_id="mee-weight",
            weight_g="65",
        ),
        right=seed_extraction("mama", "mama-panel", "1380", "mg", "1380"),
    )


def multiple_columns_extraction() -> Extraction:
    image_id = "multi-panel"
    serving_column = _column(
        image_id,
        column_id="serving",
        basis=NutritionBasis.PER_SERVING,
        serving_quantity=None,
        serving_quantity_state=FieldState.NOT_VISIBLE,
        fields=[
            _field("serving-sodium", image_id, "sodium", "690", "mg", "690"),
        ],
    )
    return Extraction(
        product_id="multi-column",
        images=[_image(image_id)],
        nutrition_columns=[
            _column(
                image_id,
                fields=[_field("pack-sodium", image_id, "sodium", "1.5", "g", "1.5")],
            ),
            serving_column,
        ],
        outcome=ExtractionOutcome.PARTIAL,
        retake_reasons=["Serving size is not visible in the current photo."],
    )


def conflicting_extraction() -> Extraction:
    return Extraction(
        product_id="conflict",
        images=[_image("conflict-a"), _image("conflict-b")],
        nutrition_columns=[
            _column(
                "conflict-a",
                preparation_state=PreparationState.UNKNOWN,
                preparation_evidence=[],
                fields=[
                    _field(
                        "conflict-sodium",
                        "conflict-a",
                        "sodium",
                        "1.5",
                        "g",
                        None,
                        state=FieldState.CONFLICTING,
                        alternatives=[
                            ObservationAlternative(
                                value_text="1.8",
                                unit_text="g",
                                original_script="Sodium 1.8 g",
                                evidence=[_pointer("conflict-b")],
                            )
                        ],
                    )
                ],
            )
        ],
        outcome=ExtractionOutcome.PARTIAL,
    )


def retake_required_extraction() -> Extraction:
    return Extraction(
        product_id="retake",
        images=[_image("retake-panel")],
        nutrition_columns=[],
        outcome=ExtractionOutcome.RETAKE_REQUIRED,
        retake_reasons=["The sodium value is unreadable; retake the nutrition panel."],
    )


def unknown_preparation_comparison() -> ComparisonResponse:
    request = normal_pair()
    left = _reported(
        request.left,
        image_id="mee-panel",
        preparation_state=PreparationState.UNKNOWN,
    )
    right = _reported(
        request.right,
        image_id="mama-panel",
        preparation_state=PreparationState.UNKNOWN,
    )
    return ComparisonResponse(
        left_product_id=request.left.product_id,
        right_product_id=request.right.product_id,
        rows=[
            ComparisonRow(
                nutrient="sodium",
                left=left,
                right=right,
                state=ComparisonState.CONDITIONAL,
                assumptions=[
                    "Both per-pack values are treated as covering the stated net weight."
                ],
                reason="Preparation states are unknown in both source photos.",
            )
        ],
    )


def error_examples() -> dict[str, PhotoComparisonErrorResponse]:
    return {
        "invalid_request": PhotoComparisonErrorResponse(
            error=PhotoComparisonErrorDetail(
                code=PhotoComparisonErrorCode.REQUEST_INVALID,
                message="The photo-comparison request is invalid.",
            )
        ),
        "provider_timeout": PhotoComparisonErrorResponse(
            error=PhotoComparisonErrorDetail(
                code=PhotoComparisonErrorCode.PROVIDER_TIMEOUT,
                message="The extraction provider timed out.",
            )
        ),
    }
