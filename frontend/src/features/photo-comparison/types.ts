export type {
    BodyExtractPhotoComparison,
    ComparePhotoComparisonData,
    ComparisonResponse,
    ComparisonRow,
    ComparisonState,
    DerivedValue,
    DerivationInput,
    DerivationInputKind,
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
    PhotoComparisonErrorDetail,
    PhotoComparisonErrorResponse,
    PreparationState,
    ProductIdentity,
    Quantity,
    ReportedValue,
    ValueQualifier,
} from "@/api/generated"

export const MAX_PHOTOS_PER_PRODUCT = 3

export interface ComparisonRequest {
    schema_version?: number
    left: import("@/api/generated").Extraction
    right: import("@/api/generated").Extraction
    left_column_id?: string | null
    right_column_id?: string | null
}

export interface ProductPhoto {
    file: File
    url: string
    localId: string
    previewError?: boolean
    /** Browser cannot render this format (HEIC outside Safari); the photo is still usable. */
    previewUnsupported?: boolean
}

export interface ProductSideState {
    id: "left" | "right"
    title: string
    titleSource?: "default" | "shopper" | "photo_evidence"
    number: "1" | "2"
    photos: ProductPhoto[]
    extraction: import("@/api/generated").Extraction | null
    selectedColumnId: string | null
    loading: boolean
    error: string
    retry: boolean
    revision: number
}
