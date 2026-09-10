export type FieldState =
    "readable" | "unreadable" | "ambiguous" | "conflicting" | "not_visible"

export type ExtractionOutcome = "complete" | "partial" | "retake_required"

export type PreparationState = "as_sold" | "as_prepared" | "unknown"

export type ComparisonState = "comparable" | "conditional" | "not_comparable"

export type NutritionBasis =
    | "per_package"
    | "per_serving"
    | "per_100g"
    | "per_100ml"
    | "unknown"
    | "other"

export type NutrientRowKind = "amount" | "percentage" | "combined" | "other"

export type ValueQualifier =
    "exact" | "less_than" | "greater_than" | "approximate"

export type MeasurementUnit =
    | "g"
    | "mg"
    | "µg"
    | "kg"
    | "ml"
    | "l"
    | "kcal"
    | "kJ"
    | "%"
    | "count"
    | "unknown"

export type DerivationInputKind =
    "reported_field" | "package_quantity" | "serving_quantity"

export interface ImageRegion {
    x: number
    y: number
    width: number
    height: number
}

export interface ImageEvidence {
    image_id: string
    original_image_id: string
    processed_image_id?: string | null
    role: string
    width: number
    height: number
}

export interface EvidencePointer {
    image_id: string
    region?: ImageRegion | null
}

export interface ObservationAlternative {
    value_text?: string | null
    unit_text?: string | null
    original_script?: string | null
    language?: string
    state?: FieldState
    evidence: EvidencePointer[]
}

export interface Quantity {
    field_id: string
    label?: string | null
    value_text?: string | null
    unit_text?: string | null
    language?: string
    state?: FieldState
    normalized_value?: string | number | null
    normalized_unit?: MeasurementUnit | null
    qualifier?: ValueQualifier
    evidence: EvidencePointer[]
    alternatives?: ObservationAlternative[]
}

export interface FieldObservation {
    field_id: string
    nutrient?: string | null
    label?: string | null
    value_text?: string | null
    unit_text?: string | null
    original_script?: string | null
    language?: string
    state?: FieldState
    normalized_value?: string | number | null
    normalized_unit?: MeasurementUnit | null
    qualifier?: ValueQualifier
    row_kind?: NutrientRowKind
    alternatives?: ObservationAlternative[]
    evidence: EvidencePointer[]
}

export interface NutritionColumn {
    column_id: string
    label?: string | null
    basis?: NutritionBasis
    preparation_state?: PreparationState
    serving_quantity?: Quantity | null
    serving_quantity_state?: FieldState
    basis_evidence?: EvidencePointer[]
    preparation_evidence?: EvidencePointer[]
    fields: FieldObservation[]
}

export interface ProductIdentity {
    name?: FieldObservation | null
    brand?: FieldObservation | null
}

export interface Extraction {
    schema_version: number
    product_id: string
    identity?: ProductIdentity | null
    images: ImageEvidence[]
    package_quantity?: Quantity | null
    nutrition_columns: NutritionColumn[]
    outcome: ExtractionOutcome
    retake_reasons?: string[]
    provider?: string | null
    model?: string | null
    configuration_version?: string | null
}

export interface ReportedValue {
    column_id: string
    observation: FieldObservation
    basis?: NutritionBasis
    preparation_state?: PreparationState
    package_quantity?: Quantity | null
    serving_quantity?: Quantity | null
    serving_quantity_state?: FieldState
    basis_evidence?: EvidencePointer[]
    preparation_evidence?: EvidencePointer[]
}

export interface DerivationInput {
    kind: DerivationInputKind
    source_id: string
    normalized_value: string | number
    normalized_unit: MeasurementUnit
    evidence: EvidencePointer[]
}

export interface DerivedValue {
    value: string | number
    unit: MeasurementUnit
    target_basis: NutritionBasis
    inputs: DerivationInput[]
}

export interface ComparisonRow {
    nutrient: string
    row_kind?: NutrientRowKind
    left?: ReportedValue | null
    right?: ReportedValue | null
    normalized_left?: DerivedValue | null
    normalized_right?: DerivedValue | null
    derived_difference?: DerivedValue | null
    calculation_basis?: string | null
    assumptions?: string[]
    state: ComparisonState
    reason?: string | null
}

export interface ComparisonRequest {
    schema_version?: number
    left: Extraction
    right: Extraction
    left_column_id?: string | null
    right_column_id?: string | null
}

export interface ComparisonResponse {
    schema_version: number
    calculated_from_submitted_evidence: true
    left_product_id: string
    right_product_id: string
    rows: ComparisonRow[]
}

export interface PhotoComparisonErrorDetail {
    code: string
    message: string
}

export interface PhotoComparisonErrorResponse {
    error: PhotoComparisonErrorDetail
}

export interface ProductPhoto {
    file: File
    url: string
    localId: string
}

export interface ProductSideState {
    id: "left" | "right"
    title: string
    number: "1" | "2"
    photos: ProductPhoto[]
    extraction: Extraction | null
    selectedColumnId: string | null
    loading: boolean
    error: string
    retry: boolean
    revision: number
}
