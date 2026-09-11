import type { ProductLookupMetaResponse, ProductLookupResponse } from "./types"

type SourceRecord = ProductLookupResponse["data"]["source_record"]
type UnknownRecord = Record<string, unknown>

export interface OriginalText {
    value: string
    language?: string
    sourceField: string
}

export interface SourceImage {
    url: string
    language?: string
    sourceField: string
}

export interface ProductIdentityPresentation {
    barcode?: string
    preferredName?: OriginalText
    names: OriginalText[]
    genericNames: OriginalText[]
    brands: string[]
    quantity?: string
}

export type NutritionAmount = number | string

export interface NutritionRow {
    nutrient: string
    label: string
    per100g?: NutritionAmount
    perServing?: NutritionAmount
    value?: NutritionAmount
    unit?: string
}

export interface NutritionPresentation {
    basis?: string
    servingSize?: string
    rows: NutritionRow[]
}

export interface GradedSourceAssessment {
    grade?: string
    score?: NutritionAmount
    version?: string
    sourceFields: string[]
}

export interface NovaSourceAssessment {
    group: NutritionAmount
    sourceField: string
}

export interface SourceAssessmentsPresentation {
    nutriScore?: GradedSourceAssessment
    nova?: NovaSourceAssessment
    greenScore?: GradedSourceAssessment
}

export interface PackagingComponent {
    shape?: string
    material?: string
    recycling?: string
    quantityPerUnit?: string
    weightMeasured?: NutritionAmount
    numberOfUnits?: NutritionAmount
}

export interface PackagingPresentation {
    texts: OriginalText[]
    recyclingInstructions: OriginalText[]
    components: PackagingComponent[]
    materials: string[]
    shapes: string[]
    recycling: string[]
}

export interface EnvironmentPresentation {
    origins: string[]
    manufacturingPlaces: string[]
    carbonFootprint100g?: NutritionAmount
    carbonFootprintFromKnownIngredients100g?: NutritionAmount
    carbonFootprintFromMeatOrFish100g?: NutritionAmount
}

export interface SourceRecordMetadataPresentation {
    name?: string
    productUrl?: string
    datasetVersion?: string
    retrievedAt?: string
    recordLanguage?: string
    languages: string[]
    creator?: string
    createdAt?: string
    lastModifiedAt?: string
    completeness?: number
    dataQualityWarnings: string[]
}

export interface SourceRecordPresentation {
    identity: ProductIdentityPresentation
    frontImage?: SourceImage
    ingredients: OriginalText[]
    additives: string[]
    storageInstructions: OriginalText[]
    nutrition: NutritionPresentation
    assessments: SourceAssessmentsPresentation
    categories: string[]
    labels: string[]
    countries: string[]
    packaging: PackagingPresentation
    environment: EnvironmentPresentation
    source: SourceRecordMetadataPresentation
}

interface FieldValue<T> {
    value: T
    sourceField: string
}

const nutritionNutrients: ReadonlyArray<{
    key: string
    label: string
}> = [
    { key: "energy-kj", label: "Energy" },
    { key: "energy-kcal", label: "Energy" },
    { key: "fat", label: "Fat" },
    { key: "saturated-fat", label: "Saturated fat" },
    { key: "monounsaturated-fat", label: "Monounsaturated fat" },
    { key: "polyunsaturated-fat", label: "Polyunsaturated fat" },
    { key: "carbohydrates", label: "Carbohydrates" },
    { key: "sugars", label: "Sugars" },
    { key: "starch", label: "Starch" },
    { key: "fiber", label: "Fiber" },
    { key: "proteins", label: "Protein" },
    { key: "salt", label: "Salt" },
    { key: "sodium", label: "Sodium" },
    { key: "alcohol", label: "Alcohol" },
    { key: "cholesterol", label: "Cholesterol" },
    { key: "vitamin-a", label: "Vitamin A" },
    { key: "vitamin-b1", label: "Vitamin B1" },
    { key: "vitamin-b2", label: "Vitamin B2" },
    { key: "vitamin-b6", label: "Vitamin B6" },
    { key: "vitamin-b9", label: "Vitamin B9" },
    { key: "vitamin-b12", label: "Vitamin B12" },
    { key: "vitamin-c", label: "Vitamin C" },
    { key: "vitamin-d", label: "Vitamin D" },
    { key: "vitamin-e", label: "Vitamin E" },
    { key: "vitamin-k", label: "Vitamin K" },
    { key: "calcium", label: "Calcium" },
    { key: "iron", label: "Iron" },
    { key: "magnesium", label: "Magnesium" },
    { key: "phosphorus", label: "Phosphorus" },
    { key: "potassium", label: "Potassium" },
    { key: "zinc", label: "Zinc" },
    { key: "copper", label: "Copper" },
    { key: "manganese", label: "Manganese" },
    { key: "selenium", label: "Selenium" },
    { key: "iodine", label: "Iodine" },
    { key: "caffeine", label: "Caffeine" },
    { key: "taurine", label: "Taurine" },
]

function isUnknownRecord(value: unknown): value is UnknownRecord {
    return value !== null && typeof value === "object" && !Array.isArray(value)
}

function objectValue(value: unknown): UnknownRecord | undefined {
    return isUnknownRecord(value) ? value : undefined
}

function textValue(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined
    const trimmed = value.trim()
    return trimmed || undefined
}

function amountValue(value: unknown): NutritionAmount | undefined {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : undefined
    }
    return textValue(value)
}

function httpUrl(value: unknown): string | undefined {
    const candidate = textValue(value)
    if (!candidate) return undefined

    try {
        const parsed = new URL(candidate)
        return parsed.protocol === "http:" || parsed.protocol === "https:"
            ? candidate
            : undefined
    } catch {
        return undefined
    }
}

function sourceLanguage(record: UnknownRecord): string | undefined {
    return textValue(record.lang)?.toLowerCase().replaceAll("_", "-")
}

function languageFromField(
    field: string,
    baseField: string,
): string | undefined {
    if (!field.startsWith(`${baseField}_`)) return undefined
    const suffix = field.slice(baseField.length + 1)
    if (!/^[a-z]{2,3}(?:_[a-z0-9]{2,8})*$/i.test(suffix)) return undefined
    return suffix.toLowerCase().replaceAll("_", "-")
}

function originalTexts(
    record: UnknownRecord,
    baseField: string,
    recordLanguage: string | undefined,
): OriginalText[] {
    const result: OriginalText[] = []
    const seen = new Set<string>()

    const add = (
        value: unknown,
        language: string | undefined,
        sourceField: string,
    ) => {
        const text = textValue(value)
        if (!text) return
        const key = `${language ?? ""}\u0000${text}`
        if (seen.has(key)) return
        seen.add(key)
        result.push({ value: text, language, sourceField })
    }

    add(record[baseField], recordLanguage, baseField)
    for (const [field, value] of Object.entries(record)) {
        const language = languageFromField(field, baseField)
        if (language) add(value, language, field)
    }
    return result
}

function mergeOriginalTexts(...groups: OriginalText[][]): OriginalText[] {
    const result: OriginalText[] = []
    const seen = new Set<string>()
    for (const group of groups) {
        for (const item of group) {
            const key = `${item.language ?? ""}\u0000${item.value}`
            if (!seen.has(key)) {
                seen.add(key)
                result.push(item)
            }
        }
    }
    return result
}

function splitValues(value: unknown): string[] {
    const values = Array.isArray(value) ? value : [value]
    const result: string[] = []
    const seen = new Set<string>()

    for (const item of values) {
        if (typeof item !== "string") continue
        for (const part of item.split(",")) {
            const trimmed = part.trim()
            if (trimmed && !seen.has(trimmed)) {
                seen.add(trimmed)
                result.push(trimmed)
            }
        }
    }
    return result
}

function displayTaxonomyTag(value: string): string {
    return value
        .replace(/^[a-z]{2,3}:/i, "")
        .replace(/[-_]+/g, " ")
        .trim()
}

function displayTaxonomyValue(value: unknown): string | undefined {
    const text = textValue(value)
    return text ? displayTaxonomyTag(text) : undefined
}

function uniqueValues(values: Array<string | undefined>): string[] {
    const result: string[] = []
    const seen = new Set<string>()
    for (const value of values) {
        if (!value) continue
        const key = value.toLocaleLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        result.push(value)
    }
    return result
}

function listValues(
    record: UnknownRecord,
    field: string,
    tagField?: string,
): string[] {
    const direct = splitValues(record[field])
    if (direct.length > 0 || !tagField) return direct

    const result: string[] = []
    const seen = new Set<string>()
    for (const tag of splitValues(record[tagField])) {
        const displayed = displayTaxonomyTag(tag)
        if (displayed && !seen.has(displayed)) {
            seen.add(displayed)
            result.push(displayed)
        }
    }
    return result
}

function firstFieldAmount(
    record: UnknownRecord,
    fields: string[],
): FieldValue<NutritionAmount> | undefined {
    for (const sourceField of fields) {
        const value = amountValue(record[sourceField])
        if (value !== undefined) return { value, sourceField }
    }
    return undefined
}

function firstFieldText(
    record: UnknownRecord,
    fields: string[],
): FieldValue<string> | undefined {
    for (const sourceField of fields) {
        const value = textValue(record[sourceField])
        if (value !== undefined) return { value, sourceField }
    }
    return undefined
}

function extractNutrition(record: UnknownRecord): NutritionPresentation {
    const nutriments = objectValue(record.nutriments) ?? {}
    const nutrition = objectValue(record.nutrition)
    const aggregatedSet = objectValue(nutrition?.aggregated_set)
    const aggregatedNutrients = objectValue(aggregatedSet?.nutrients) ?? {}
    const rows: NutritionRow[] = []

    for (const nutrient of nutritionNutrients) {
        const aggregatedNutrient = objectValue(
            aggregatedNutrients[nutrient.key],
        )
        const per100g =
            amountValue(nutriments[`${nutrient.key}_100g`]) ??
            amountValue(aggregatedNutrient?.value)
        const perServing = amountValue(nutriments[`${nutrient.key}_serving`])
        const value = amountValue(nutriments[`${nutrient.key}_value`])
        if (
            per100g === undefined &&
            perServing === undefined &&
            value === undefined
        ) {
            continue
        }
        rows.push({
            nutrient: nutrient.key,
            label: nutrient.label,
            per100g,
            perServing,
            value,
            unit:
                textValue(nutriments[`${nutrient.key}_unit`]) ??
                textValue(aggregatedNutrient?.unit),
        })
    }

    return {
        basis:
            textValue(record.nutrition_data_per) ??
            textValue(aggregatedSet?.per),
        servingSize: textValue(record.serving_size),
        rows,
    }
}

function extractAssessments(
    record: UnknownRecord,
): SourceAssessmentsPresentation {
    const nutriments = objectValue(record.nutriments) ?? {}
    const nutriGrade = assessmentGrade(record, ["nutriscore_grade"])
    const nutriScore =
        firstFieldAmount(record, ["nutriscore_score"]) ??
        firstFieldAmount(nutriments, ["nutrition-score-fr_100g"])
    const nutriVersion = firstFieldText(record, ["nutriscore_version"])
    const nova =
        firstFieldAmount(record, ["nova_group"]) ??
        firstFieldAmount(nutriments, ["nova-group_100g"])
    const greenGrade = assessmentGrade(record, [
        "environmental_score_grade",
        "ecoscore_grade",
        "green_score_grade",
    ])
    const greenScore = firstFieldAmount(record, [
        "environmental_score_score",
        "ecoscore_score",
        "green_score_score",
    ])
    const greenVersion = firstFieldText(record, [
        "environmental_score_version",
        "ecoscore_version",
        "green_score_version",
    ])

    const assessments: SourceAssessmentsPresentation = {}
    if (nutriGrade || nutriScore) {
        assessments.nutriScore = {
            grade: nutriGrade?.value,
            score: nutriScore?.value,
            version: nutriVersion?.value,
            sourceFields: [nutriGrade, nutriScore, nutriVersion]
                .filter((item) => item !== undefined)
                .map((item) => item.sourceField),
        }
    }
    if (nova) {
        assessments.nova = {
            group: nova.value,
            sourceField: nova.sourceField,
        }
    }
    if (greenGrade || greenScore) {
        assessments.greenScore = {
            grade: greenGrade?.value,
            score: greenScore?.value,
            version: greenVersion?.value,
            sourceFields: [greenGrade, greenScore, greenVersion]
                .filter((item) => item !== undefined)
                .map((item) => item.sourceField),
        }
    }
    return assessments
}

function assessmentGrade(
    record: UnknownRecord,
    fields: string[],
): FieldValue<string> | undefined {
    const grade = firstFieldText(record, fields)
    if (!grade) return undefined
    return [
        "unknown",
        "not-applicable",
        "not_applicable",
        "not-computed",
    ].includes(grade.value.toLowerCase())
        ? undefined
        : grade
}

function taxonomyObjectKeys(record: UnknownRecord, field: string): string[] {
    const values = objectValue(record[field])
    if (!values) return []
    return Object.keys(values)
        .filter((value) => value !== "all")
        .map(displayTaxonomyTag)
        .filter(Boolean)
}

function formatBarcodeImagePath(barcode: string): string {
    const match = barcode.match(/^(\d{3})(\d{3})(\d{3})(\d+)$/)
    return barcode.length > 8 && match
        ? `${match[1]}/${match[2]}/${match[3]}/${match[4]}`
        : barcode
}

function selectedImage(
    values: UnknownRecord,
    sourceField: string,
    preferredLanguage: string | undefined,
): SourceImage | undefined {
    const languages = preferredLanguage ? [preferredLanguage, "en"] : ["en"]
    const checked = new Set<string>()

    for (const language of languages) {
        if (checked.has(language)) continue
        checked.add(language)
        const url = httpUrl(values[language])
        if (url)
            return { url, language, sourceField: `${sourceField}.${language}` }
    }
    for (const [language, value] of Object.entries(values)) {
        const url = httpUrl(value)
        if (url)
            return { url, language, sourceField: `${sourceField}.${language}` }
    }
    return undefined
}

function extractFrontImage(
    record: UnknownRecord,
    barcode: string | undefined,
    preferredLanguage: string | undefined,
): SourceImage | undefined {
    const selectedImages = objectValue(record.selected_images)
    const front = objectValue(selectedImages?.front)
    const display = objectValue(front?.display)
    if (display) {
        const selected = selectedImage(
            display,
            "selected_images.front.display",
            preferredLanguage,
        )
        if (selected) return selected
    }

    for (const sourceField of ["image_front_url", "image_url"]) {
        const url = httpUrl(record[sourceField])
        if (url) return { url, language: preferredLanguage, sourceField }
    }

    const images = objectValue(record.images)
    const selected = objectValue(images?.selected)
    const selectedFront = objectValue(selected?.front)
    if (!selectedFront || !barcode) return undefined

    const languages = preferredLanguage
        ? [preferredLanguage, "en", ...Object.keys(selectedFront)]
        : ["en", ...Object.keys(selectedFront)]
    const checked = new Set<string>()
    for (const language of languages) {
        if (checked.has(language)) continue
        checked.add(language)
        const details = objectValue(selectedFront[language])
        const revision = details ? amountValue(details.rev) : undefined
        if (revision === undefined) continue
        const path = formatBarcodeImagePath(barcode)
        return {
            url: `https://images.openfoodfacts.org/images/products/${path}/front_${language}.${revision}.400.jpg`,
            language,
            sourceField: `images.selected.front.${language}.rev`,
        }
    }
    return undefined
}

function packagingComponents(record: UnknownRecord): PackagingComponent[] {
    if (!Array.isArray(record.packagings)) return []
    const result: PackagingComponent[] = []
    const seen = new Set<string>()

    for (const value of record.packagings) {
        const component = objectValue(value)
        if (!component) continue
        const item: PackagingComponent = {
            shape: displayTaxonomyValue(component.shape),
            material: displayTaxonomyValue(component.material),
            recycling: displayTaxonomyValue(component.recycling),
            quantityPerUnit: textValue(component.quantity_per_unit),
            weightMeasured: amountValue(component.weight_measured),
            numberOfUnits: amountValue(component.number_of_units),
        }
        const key = JSON.stringify(item)
        if (
            Object.values(item).some((itemValue) => itemValue !== undefined) &&
            !seen.has(key)
        ) {
            seen.add(key)
            result.push(item)
        }
    }
    return result
}

function unixTimestamp(value: unknown): string | undefined {
    const amount = amountValue(value)
    if (amount === undefined) return undefined
    const seconds = typeof amount === "number" ? amount : Number(amount)
    if (!Number.isFinite(seconds)) return undefined
    const date = new Date(seconds * 1000)
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function inputParts(
    input: ProductLookupResponse | SourceRecord,
    explicitMeta: ProductLookupMetaResponse | undefined,
): { record: UnknownRecord; meta?: UnknownRecord } {
    const inputRecord = objectValue(input) ?? {}
    const data = objectValue(inputRecord.data)
    const embeddedRecord = objectValue(data?.source_record)
    const embeddedMeta = objectValue(inputRecord.meta)

    if (embeddedRecord && embeddedMeta) {
        return {
            record: embeddedRecord,
            meta: objectValue(explicitMeta) ?? embeddedMeta,
        }
    }
    return { record: inputRecord, meta: objectValue(explicitMeta) }
}

export function adaptSourceRecord(
    response: ProductLookupResponse,
): SourceRecordPresentation
export function adaptSourceRecord(
    sourceRecord: SourceRecord,
    meta?: ProductLookupMetaResponse,
): SourceRecordPresentation
export function adaptSourceRecord(
    input: ProductLookupResponse | SourceRecord,
    explicitMeta?: ProductLookupMetaResponse,
): SourceRecordPresentation {
    const { record, meta } = inputParts(input, explicitMeta)
    const lookupMeta = objectValue(meta?.lookup)
    const sourceMeta = objectValue(meta?.source)
    const datasetMeta = objectValue(meta?.dataset)
    const recordLanguage = sourceLanguage(record)
    const barcode = textValue(lookupMeta?.barcode) ?? textValue(record.code)
    const names = originalTexts(record, "product_name", recordLanguage)
    const genericNames = originalTexts(record, "generic_name", recordLanguage)
    const preferredName =
        names.find((name) => name.language === recordLanguage) ??
        names.find((name) => name.language === "en") ??
        names[0]
    const packagingTexts = mergeOriginalTexts(
        originalTexts(record, "packaging", recordLanguage),
        originalTexts(record, "packaging_text", recordLanguage),
    )
    const recyclingInstructions = mergeOriginalTexts(
        originalTexts(
            record,
            "recycling_instructions_to_discard",
            recordLanguage,
        ),
        originalTexts(record, "recycling_instructions", recordLanguage),
    )

    return {
        identity: {
            barcode,
            preferredName,
            names,
            genericNames,
            brands: listValues(record, "brands", "brands_tags"),
            quantity: textValue(record.quantity),
        },
        frontImage: extractFrontImage(record, barcode, recordLanguage),
        ingredients: originalTexts(record, "ingredients_text", recordLanguage),
        additives: listValues(record, "additives", "additives_tags"),
        storageInstructions: mergeOriginalTexts(
            originalTexts(record, "conservation_conditions", recordLanguage),
            originalTexts(record, "storage_conditions", recordLanguage),
        ),
        nutrition: extractNutrition(record),
        assessments: extractAssessments(record),
        categories: listValues(record, "categories", "categories_tags"),
        labels: listValues(record, "labels", "labels_tags"),
        countries: listValues(record, "countries", "countries_tags"),
        packaging: {
            texts: packagingTexts,
            recyclingInstructions,
            components: packagingComponents(record),
            materials: uniqueValues(
                [
                    ...listValues(
                        record,
                        "packaging_materials",
                        "packaging_materials_tags",
                    ),
                    ...taxonomyObjectKeys(record, "packagings_materials"),
                ].map(displayTaxonomyTag),
            ),
            shapes: uniqueValues(
                listValues(
                    record,
                    "packaging_shapes",
                    "packaging_shapes_tags",
                ).map(displayTaxonomyTag),
            ),
            recycling: uniqueValues(
                listValues(
                    record,
                    "packaging_recycling",
                    "packaging_recycling_tags",
                ).map(displayTaxonomyTag),
            ),
        },
        environment: {
            origins: listValues(record, "origins", "origins_tags"),
            manufacturingPlaces: listValues(
                record,
                "manufacturing_places",
                "manufacturing_places_tags",
            ),
            carbonFootprint100g: amountValue(record.carbon_footprint_100g),
            carbonFootprintFromKnownIngredients100g: amountValue(
                record.carbon_footprint_from_known_ingredients_100g,
            ),
            carbonFootprintFromMeatOrFish100g: amountValue(
                record.carbon_footprint_from_meat_or_fish_100g,
            ),
        },
        source: {
            name: textValue(sourceMeta?.name),
            productUrl: httpUrl(sourceMeta?.product_url),
            datasetVersion: textValue(datasetMeta?.version),
            retrievedAt: textValue(datasetMeta?.retrieved_at),
            recordLanguage,
            languages: listValues(record, "languages", "languages_tags"),
            creator: textValue(record.creator),
            createdAt: unixTimestamp(record.created_t),
            lastModifiedAt:
                textValue(record.last_modified_datetime) ??
                unixTimestamp(record.last_modified_t),
            completeness:
                typeof record.completeness === "number" &&
                Number.isFinite(record.completeness)
                    ? record.completeness
                    : undefined,
            dataQualityWarnings: listValues(
                record,
                "data_quality_warnings",
                "data_quality_warnings_tags",
            ),
        },
    }
}
