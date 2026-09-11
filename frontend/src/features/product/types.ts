import type { AllergenAnalysisResponse } from "@/api/generated"

export type IdentifierScheme = "GTIN_8" | "UPC_A" | "EAN_13" | "GTIN_14"

export type PackageMatchSourceKind = "REVIEWED_CATALOG" | "OPEN_FOOD_FACTS"

export type OpenFoodFactsLookupStatus =
    "AVAILABLE" | "NOT_FOUND" | "UNAVAILABLE"

export type EvidenceCoverageState =
    "COMPLETE_READABLE_LABEL" | "PARTIAL" | "UNREADABLE" | "NOT_ASSESSED"

export type AllergenAssessmentStatus = "COMPLETED" | "NOT_ASSESSED"

export type AllergenAssessmentOutcome =
    | "DECLARED_CONTAINS"
    | "DECLARED_MAY_CONTAIN"
    | "DERIVED_FROM_INGREDIENT"
    | "NO_DECLARATION_DETECTED_IN_READABLE_LABEL"
    | "LABEL_INCOMPLETE_OR_UNREADABLE"
    | "NOT_ASSESSED"

export type HalalIngredientAssessmentStatus = "COMPLETED" | "NOT_ASSESSED"

export type HalalIngredientAssessmentOutcome =
    | "EXPLICIT_PROHIBITED_INGREDIENT_DECLARED"
    | "SOURCE_AMBIGUOUS"
    | "NO_NON_HALAL_INGREDIENT_DETECTED_IN_READABLE_LABEL"
    | "LABEL_INCOMPLETE_OR_UNREADABLE"
    | "NOT_ASSESSED"

export type HalalClassification = "EXPLICIT_PROHIBITED" | "SOURCE_AMBIGUOUS"

export type HalalRelationshipType =
    "EXACT_NAME" | "SPELLING_VARIANT" | "DERIVED_FROM" | "CONTAINS_SOURCE"

export interface ExternalDatasetVersionResponse {
    id: string
    source_url: string
    retrieved_at: string | null
    activated_at: string | null
    sha256: string
}

export interface AssessmentReferenceDatasetVersionResponse {
    id: string
    source_url: string
    retrieved_at: string | null
    activated_at: string | null
    sha256: string
    review_kind: string
    dataset_kind: string
}

export interface PackageMatchSourceResponse {
    name: string
    source_type: string
    base_url: string
    record_url: string
    attribution: string
    database_license: string
    contents_license: string
    image_license: string
    terms_version: string | null
}

export interface PackageMatchEvidenceResponse {
    field: string
    value: unknown
    source_field: string
    source_name: string
    source_url: string
    language: string | null
    observed_at: string | null
    retrieved_at: string
    source_revision?: string | null
    dataset_version_id?: string | null
}

export interface PackageMatchReferenceImageResponse {
    role: string
    url: string
    original_url: string
    source_field: string
    source_name: string
    source_url: string
    attribution: string
    license_name: string
    language: string | null
    retrieved_at: string
    source_revision?: string | null
    image_revision?: string | null
    dataset_version_id?: string | null
}

export interface AllergenConceptOutcomeResponse {
    concept_id: string
    name: string
    outcome: AllergenAssessmentOutcome
    reason: string | null
    finding_ids: string[]
    parent_ids: string[]
    rule_ids: string[]
}

export interface AllergenFindingResponse {
    id: string
    concept_id: string
    mapping_id?: string | null
    rule_id?: string | null
    relationship_type?: string | null
    matched_text: string
    source_text?: string | null
    start_index: number
    end_index: number
    language?: string | null
    source_field: string
    source_url: string
}

export interface AllergenAssessmentResponse {
    status: AllergenAssessmentStatus
    reason: string | null
    evidence_coverage: EvidenceCoverageState
    engine_version?: string | null
    reference_dataset_version?: AssessmentReferenceDatasetVersionResponse | null
    concepts: AllergenConceptOutcomeResponse[]
    findings: AllergenFindingResponse[]
    source_signals: PackageMatchEvidenceResponse[]
}

export interface HalalSourceCitationResponse {
    source_id: string
    jurisdiction: string
    locator: string
    edition?: string | null
    notes?: string | null
}

export interface HalalIngredientFindingResponse {
    id: string
    concept_id: string
    mapping_id?: string | null
    halal_mapping_id?: string | null
    classification: HalalClassification
    relationship_type: HalalRelationshipType
    matched_text: string
    source_text?: string | null
    start_index: number
    end_index: number
    language?: string | null
    citations?: HalalSourceCitationResponse[]
    source_field: string
    source_url: string
}

export interface HalalIngredientAssessmentResponse {
    status: HalalIngredientAssessmentStatus
    reason: string | null
    outcome: HalalIngredientAssessmentOutcome
    evidence_coverage: EvidenceCoverageState
    engine_version?: string | null
    reference_dataset_version?: AssessmentReferenceDatasetVersionResponse | null
    checked_evidence: PackageMatchEvidenceResponse[]
    findings: HalalIngredientFindingResponse[]
}

export interface PackageMatchCandidateResponse {
    source_kind: PackageMatchSourceKind
    package_variant_id: string | null
    product_id: string | null
    external_record_id: string | null
    source: PackageMatchSourceResponse | null
    identity_evidence: PackageMatchEvidenceResponse[]
    label_evidence: PackageMatchEvidenceResponse[]
    reference_images: PackageMatchReferenceImageResponse[]
    retrieved_at: string | null
    source_revision: string | null
    dataset_version: ExternalDatasetVersionResponse | null
    allergen_assessment: AllergenAssessmentResponse
    halal_ingredient_assessment: HalalIngredientAssessmentResponse
}

export interface OpenFoodFactsLookupResponse {
    status: OpenFoodFactsLookupStatus
    dataset_version: ExternalDatasetVersionResponse | null
    error_code: string | null
}

export interface PackageMatchesResponse {
    normalized_identifier: string
    scheme: IdentifierScheme
    candidates: PackageMatchCandidateResponse[]
    open_food_facts: OpenFoodFactsLookupResponse
}

export interface ErrorEnvelope {
    error: {
        code: string
        message: string
        details?: unknown
    }
}

export type ProductLookupErrorCode =
    | "invalid_barcode"
    | "product_not_found"
    | "dataset_unavailable"
    | "rate_limit_exceeded"
    | "internal_error"

export interface ProductLookupErrorDetail {
    code: ProductLookupErrorCode
    message: string
}

export interface DatasetSnapshotResponse {
    version: string
    retrieved_at: string
}

export interface ProductLookupMetadataResponse {
    barcode: string
}

export interface SourceAttributionResponse {
    name: string
    product_url: string
}

export interface ProductLookupDataResponse {
    source_record: Record<string, unknown>
    allergen_analysis: AllergenAnalysisResponse
}

export interface ProductLookupMetaResponse {
    lookup: ProductLookupMetadataResponse
    source: SourceAttributionResponse
    dataset: DatasetSnapshotResponse
}

export interface ProductLookupResponse {
    data: ProductLookupDataResponse
    meta: ProductLookupMetaResponse
}

export interface ProductLookupErrorMetaResponse {
    dataset: DatasetSnapshotResponse
}

export interface ProductLookupErrorResponse {
    error: ProductLookupErrorDetail
    meta?: ProductLookupErrorMetaResponse | null
}

export type NutrientLevel = "low" | "moderate" | "high"

export interface NutrientLevels {
    fat?: NutrientLevel | null
    saturatedFat?: NutrientLevel | null
    sugars?: NutrientLevel | null
    salt?: NutrientLevel | null
}

export interface IngredientsAnalysis {
    palmOil: "yes" | "no" | "maybe" | "unknown"
    vegan: "yes" | "no" | "maybe" | "unknown"
    vegetarian: "yes" | "no" | "maybe" | "unknown"
}

export interface PackagingComponent {
    shape?: string | null
    material?: string | null
    recycling?: string | null
    quantityPerUnit?: string | null
    weightMeasured?: number | null
    foodContact?: number | null
    numberOfUnits?: number | null
}

export interface ProductPhoto {
    id: string
    url: string
    originalUrl: string
    role: string
    uploader?: string | null
    uploadedAt?: string | null
    sizes?: Record<string, { w?: number; h?: number }>
}

export interface OpenFoodFactsProductView {
    // Identification
    barcode: string
    scheme: IdentifierScheme
    productName: string
    genericName?: string | null
    brands: string[]
    quantity?: string | null
    categories: string[]
    labels: string[]
    stores: string[]
    origins?: string | null
    manufacturingPlaces?: string | null
    embCodes: string[]
    countriesSold: string[]
    packagingText?: string | null
    customerService?: string | null
    link?: string | null

    // Scores
    nutriscoreGrade?: "a" | "b" | "c" | "d" | "e" | "unknown" | null
    nutriscoreScore?: number | null
    nutriscoreVersion?: string | null
    novaGroup?: 1 | 2 | 3 | 4 | null
    novaGroupsMarkers?: Record<string, unknown>
    ecoscoreGrade?: "a" | "b" | "c" | "d" | "e" | "unknown" | null
    ecoscoreScore?: number | null
    nutrientLevels: NutrientLevels

    // Dietary Analysis
    ingredientsAnalysis: IngredientsAnalysis

    // Packaging Components Table
    packagings: PackagingComponent[]

    // Data Quality & Meta
    completeness?: number | null
    statesTags: string[]
    dataQualityWarnings: string[]
    creator?: string | null
    lastModified?: string | null

    // Photos
    allImages: ProductPhoto[]
}
