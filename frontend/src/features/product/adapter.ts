import { getIdentifierScheme, normalizeIdentifier } from "@/lib/identifier"

import type {
    ProductProjection,
    ProductProjectionResponse,
} from "@/api/generated"
import type {
    ExternalDatasetVersionResponse,
    IdentifierScheme,
    IngredientsAnalysis,
    NutrientLevels,
    OpenFoodFactsProductView,
    PackageMatchCandidateResponse,
    PackageMatchEvidenceResponse,
    PackageMatchReferenceImageResponse,
    PackageMatchSourceResponse,
    PackagingComponent,
    ProductLookupMetaResponse,
    ProductLookupResponse,
    ProductPhoto,
} from "./types"

export interface AdaptedProductResult {
    candidate: PackageMatchCandidateResponse
    offView: OpenFoodFactsProductView
    normalizedIdentifier: string
    scheme: IdentifierScheme
    rawRecord: Record<string, unknown>
    meta: ProductLookupMetaResponse
}

/**
 * Splits barcode for Open Food Facts image URL directory structure:
 * GTIN barcodes longer than 8 digits: 3017620422003 -> 301/762/042/2003
 */
export function formatBarcodeImagePath(barcode: string): string {
    if (barcode.length > 8 && /^\d+$/.test(barcode)) {
        const match = barcode.match(/^(\d{3})(\d{3})(\d{3})(\d+)$/)
        if (match) {
            return `${match[1]}/${match[2]}/${match[3]}/${match[4]}`
        }
    }
    return barcode
}

/**
 * Builds a proxied image URL through backend image router if applicable,
 * or returns original URL.
 */
export function buildProxiedImageUrl(originalUrl: string): string {
    if (!originalUrl) return ""
    if (originalUrl.startsWith("/api/")) return originalUrl
    return `/api/v1/open-food-facts-images?url=${encodeURIComponent(originalUrl)}`
}

/**
 * Extracts and prioritizes images from Open Food Facts raw product record.
 */
export function extractReferenceImages(
    raw: Record<string, unknown>,
    barcode: string,
    sourceUrl: string,
    retrievedAt: string,
    datasetVersionId: string,
): PackageMatchReferenceImageResponse[] {
    const images: PackageMatchReferenceImageResponse[] = []
    const seenOriginalUrls = new Set<string>()
    const barcodePath = formatBarcodeImagePath(barcode)
    const lastModified =
        typeof raw.last_modified_t === "string"
            ? raw.last_modified_t
            : typeof raw.last_modified_t === "number"
              ? String(raw.last_modified_t)
              : null

    // 1. Raw MongoDB export structure: images.selected.<role>.<language>
    const rawImages = raw.images
    if (
        rawImages &&
        typeof rawImages === "object" &&
        !Array.isArray(rawImages)
    ) {
        const selected = (rawImages as Record<string, unknown>).selected
        if (
            selected &&
            typeof selected === "object" &&
            !Array.isArray(selected)
        ) {
            for (const [role, langMap] of Object.entries(
                selected as Record<string, unknown>,
            )) {
                if (
                    !langMap ||
                    typeof langMap !== "object" ||
                    Array.isArray(langMap)
                )
                    continue
                for (const [language, details] of Object.entries(
                    langMap as Record<string, unknown>,
                )) {
                    if (
                        !details ||
                        typeof details !== "object" ||
                        Array.isArray(details)
                    )
                        continue
                    const rev = (details as Record<string, unknown>).rev
                    const revStr =
                        typeof rev === "string"
                            ? rev.trim()
                            : typeof rev === "number"
                              ? String(rev).trim()
                              : null
                    const filename = revStr
                        ? `${role}_${language}.${revStr}.400.jpg`
                        : `${role}_${language}.400.jpg`
                    const originalUrl = `https://images.openfoodfacts.org/images/products/${barcodePath}/${filename}`

                    if (!seenOriginalUrls.has(originalUrl)) {
                        seenOriginalUrls.add(originalUrl)
                        images.push({
                            role,
                            url: buildProxiedImageUrl(originalUrl),
                            original_url: originalUrl,
                            source_field: `images.selected.${role}.${language}`,
                            source_name: "Open Food Facts",
                            source_url: sourceUrl,
                            attribution: "Open Food Facts contributors",
                            license_name: "CC BY-SA",
                            language,
                            retrieved_at: retrievedAt,
                            source_revision: lastModified,
                            image_revision: revStr,
                            dataset_version_id: datasetVersionId,
                        })
                    }
                }
            }
        }
    }

    // 2. HTTP API response structure: selected_images.<role>.display.<language>
    const rawSelected = raw.selected_images
    if (
        rawSelected &&
        typeof rawSelected === "object" &&
        !Array.isArray(rawSelected)
    ) {
        for (const [role, variants] of Object.entries(
            rawSelected as Record<string, unknown>,
        )) {
            if (
                !variants ||
                typeof variants !== "object" ||
                Array.isArray(variants)
            )
                continue
            const display = (variants as Record<string, unknown>).display
            if (
                !display ||
                typeof display !== "object" ||
                Array.isArray(display)
            )
                continue
            for (const [language, urlVal] of Object.entries(
                display as Record<string, unknown>,
            )) {
                if (
                    typeof urlVal === "string" &&
                    urlVal.trim() &&
                    !seenOriginalUrls.has(urlVal)
                ) {
                    seenOriginalUrls.add(urlVal)
                    const revMatch = urlVal.match(
                        /\.(\d+)\.(?:400\.)?(?:jpe?g|png|gif|webp)$/i,
                    )
                    images.push({
                        role,
                        url: buildProxiedImageUrl(urlVal),
                        original_url: urlVal,
                        source_field: `selected_images.${role}.display.${language}`,
                        source_name: "Open Food Facts",
                        source_url: sourceUrl,
                        attribution: "Open Food Facts contributors",
                        license_name: "CC BY-SA",
                        language,
                        retrieved_at: retrievedAt,
                        source_revision: lastModified,
                        image_revision: revMatch ? revMatch[1] : null,
                        dataset_version_id: datasetVersionId,
                    })
                }
            }
        }
    }

    // 3. Fallback direct image fields
    const directFields: [string, string][] = [
        ["image_front_url", "front"],
        ["image_ingredients_url", "ingredients"],
        ["image_nutrition_url", "nutrition"],
        ["image_packaging_url", "packaging"],
        ["image_url", "front"],
    ]

    for (const [field, role] of directFields) {
        const val = raw[field]
        if (
            typeof val === "string" &&
            val.trim() &&
            !seenOriginalUrls.has(val)
        ) {
            seenOriginalUrls.add(val)
            images.push({
                role,
                url: buildProxiedImageUrl(val),
                original_url: val,
                source_field: field,
                source_name: "Open Food Facts",
                source_url: sourceUrl,
                attribution: "Open Food Facts contributors",
                license_name: "CC BY-SA",
                language: typeof raw.lang === "string" ? raw.lang : null,
                retrieved_at: retrievedAt,
                source_revision: lastModified,
                image_revision: null,
                dataset_version_id: datasetVersionId,
            })
        }
    }

    // Sort so front images come first, followed by ingredients, nutrition, and packaging
    const roleOrder: Record<string, number> = {
        front: 1,
        ingredients: 2,
        nutrition: 3,
        packaging: 4,
    }

    return images.sort(
        (a, b) => (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99),
    )
}

function rawFromProductProjection(
    product: ProductProjection,
): Record<string, unknown> {
    const raw: Record<string, unknown> = {
        code: product.identity.barcode,
        product_name: product.identity.preferred_name?.value,
        product_name_en: product.identity.preferred_name?.value,
        brands: (product.identity.brands ?? []).join(", "),
        quantity: product.identity.quantity,
        lang: product.source.record_language,
        categories_tags: (product.categories ?? []).map(
            (c) => `en:${c.replace(/\s+/g, "-")}`,
        ),
        labels_tags: (product.labels ?? []).map(
            (l) => `en:${l.replace(/\s+/g, "-")}`,
        ),
        countries_tags: (product.countries ?? []).map(
            (c) => `en:${c.replace(/\s+/g, "-")}`,
        ),
        origins_tags: (product.environment?.origins ?? []).map(
            (o) => `en:${o.replace(/\s+/g, "-")}`,
        ),
        manufacturing_places: (
            product.environment?.manufacturing_places ?? []
        ).join(", "),
        creator: product.source.creator,
        last_modified_datetime: product.source.last_modified_at,
        completeness: product.source.completeness,
        data_quality_warnings_tags: (
            product.source.data_quality_warnings ?? []
        ).map((w) => `en:${w.replace(/\s+/g, "-")}`),
    }

    if (product.front_image) {
        raw.selected_images = {
            front: {
                display: {
                    [product.front_image.language || "en"]:
                        product.front_image.url,
                },
            },
        }
    }

    const ingredients = product.ingredients ?? []
    if (ingredients.length > 0) {
        for (const ing of ingredients) {
            if (ing.language) {
                raw[`ingredients_text_${ing.language}`] = ing.value
            }
        }
        raw.ingredients_text = ingredients[0]?.value
        if (!raw.ingredients_text_en && ingredients[0]?.language === "en") {
            raw.ingredients_text_en = ingredients[0].value
        }
    }

    const names = product.identity.names ?? []
    if (names.length > 0) {
        for (const name of names) {
            if (name.language) {
                raw[`product_name_${name.language}`] = name.value
            }
        }
    }

    const packagingTexts = product.packaging?.texts ?? []
    if (packagingTexts.length > 0) {
        raw.packaging_text = packagingTexts[0]?.value
        raw.packaging_text_en = packagingTexts[0]?.value
    }

    const components = product.packaging?.components ?? []
    if (components.length > 0) {
        raw.packagings = components.map((c) => ({
            shape: c.shape ? `en:${c.shape}` : null,
            material: c.material ? `en:${c.material}` : null,
            recycling: c.recycling ? `en:${c.recycling}` : null,
            quantity_per_unit: c.quantity_per_unit,
            weight_measured: c.weight_measured,
            number_of_units: c.number_of_units,
        }))
    }

    const nutriments: Record<string, unknown> = {}
    for (const row of product.nutrition?.rows ?? []) {
        if (row.per_100g !== undefined && row.per_100g !== null) {
            nutriments[`${row.nutrient}_100g`] = row.per_100g
        }
        if (row.per_serving !== undefined && row.per_serving !== null) {
            nutriments[`${row.nutrient}_serving`] = row.per_serving
        }
        if (row.unit) {
            nutriments[`${row.nutrient}_unit`] = row.unit
        }
    }
    if (product.assessments?.nutri_score) {
        raw.nutriscore_grade = product.assessments.nutri_score.grade
        raw.nutriscore_score = product.assessments.nutri_score.score
        raw.nutriscore_version = product.assessments.nutri_score.version
        if (product.assessments.nutri_score.score !== undefined) {
            nutriments["nutrition-score-fr_100g"] =
                product.assessments.nutri_score.score
        }
    }
    if (product.assessments?.nova) {
        raw.nova_group = product.assessments.nova.group
        nutriments["nova-group_100g"] = product.assessments.nova.group
    }
    if (product.assessments?.green_score) {
        raw.ecoscore_grade = product.assessments.green_score.grade
        raw.environmental_score_grade = product.assessments.green_score.grade
        raw.ecoscore_score = product.assessments.green_score.score
        raw.environmental_score_score = product.assessments.green_score.score
        raw.environmental_score_version =
            product.assessments.green_score.version
    }
    raw.nutriments = nutriments
    raw.nutrition_data_per = product.nutrition?.basis
    raw.serving_size = product.nutrition?.serving_size

    return raw
}

/**
 * Adapts raw ProductLookupResponse or ProductProjectionResponse into a normalized PackageMatchCandidateResponse
 */
export function adaptProductLookup(
    response: ProductProjectionResponse | ProductLookupResponse,
): AdaptedProductResult {
    const { data, meta } = response
    const raw: Record<string, unknown> =
        "product" in data && data.product
            ? rawFromProductProjection(data.product)
            : "source_record" in data
              ? data.source_record || {}
              : {}
    const rawBarcode =
        meta.lookup.barcode || (typeof raw.code === "string" ? raw.code : "")
    const normalizedIdentifier = normalizeIdentifier(rawBarcode)
    const scheme = getIdentifierScheme(normalizedIdentifier.length) || "EAN_13"

    const retrievedAt = meta.dataset.retrieved_at
    const datasetVersionId = meta.dataset.version
    const sourceName = meta.source.name || "Open Food Facts"
    const productUrl =
        meta.source.product_url ||
        `https://world.openfoodfacts.org/product/${normalizedIdentifier}`
    const lastModified =
        typeof raw.last_modified_t === "string"
            ? raw.last_modified_t
            : typeof raw.last_modified_t === "number"
              ? String(raw.last_modified_t)
              : null

    // Identity Evidence: identifier, name(s), brand(s), quantity
    const identityEvidence: PackageMatchEvidenceResponse[] = [
        {
            field: "identifier",
            value: normalizedIdentifier,
            source_field: "code",
            source_name: sourceName,
            source_url: productUrl,
            language: null,
            observed_at: null,
            retrieved_at: retrievedAt,
            source_revision: lastModified,
            dataset_version_id: datasetVersionId,
        },
    ]

    // Product Name (prefer English / default / localized)
    const primaryLang = typeof raw.lang === "string" ? raw.lang : null
    const addedNames = new Set<string>()

    if (typeof raw.product_name === "string" && raw.product_name.trim()) {
        identityEvidence.push({
            field: "name",
            value: raw.product_name.trim(),
            source_field: "product_name",
            source_name: sourceName,
            source_url: productUrl,
            language: primaryLang,
            observed_at: null,
            retrieved_at: retrievedAt,
            source_revision: lastModified,
            dataset_version_id: datasetVersionId,
        })
        addedNames.add(raw.product_name.trim())
    }

    if (
        typeof raw.product_name_en === "string" &&
        raw.product_name_en.trim() &&
        !addedNames.has(raw.product_name_en.trim())
    ) {
        identityEvidence.push({
            field: "name",
            value: raw.product_name_en.trim(),
            source_field: "product_name_en",
            source_name: sourceName,
            source_url: productUrl,
            language: "en",
            observed_at: null,
            retrieved_at: retrievedAt,
            source_revision: lastModified,
            dataset_version_id: datasetVersionId,
        })
        addedNames.add(raw.product_name_en.trim())
    }

    // Brands (split comma-separated string or array)
    let brandsArray: string[] = []
    if (typeof raw.brands === "string" && raw.brands.trim()) {
        brandsArray = raw.brands
            .split(",")
            .map((b) => b.trim())
            .filter(Boolean)
    } else if (Array.isArray(raw.brands_tags)) {
        brandsArray = (raw.brands_tags as string[])
            .map((b) =>
                b
                    .replace(/^[a-z]{2}:/, "")
                    .replace(/-/g, " ")
                    .trim(),
            )
            .filter(Boolean)
    }

    if (brandsArray.length > 0) {
        identityEvidence.push({
            field: "brands",
            value: brandsArray,
            source_field: "brands",
            source_name: sourceName,
            source_url: productUrl,
            language: null,
            observed_at: null,
            retrieved_at: retrievedAt,
            source_revision: lastModified,
            dataset_version_id: datasetVersionId,
        })
    }

    // Quantity
    if (typeof raw.quantity === "string" && raw.quantity.trim()) {
        identityEvidence.push({
            field: "quantity",
            value: raw.quantity.trim(),
            source_field: "quantity",
            source_name: sourceName,
            source_url: productUrl,
            language: null,
            observed_at: null,
            retrieved_at: retrievedAt,
            source_revision: lastModified,
            dataset_version_id: datasetVersionId,
        })
    }

    // Label Evidence: ingredients, allergens, traces, additives, nutrition, origin, etc.
    const labelEvidence: PackageMatchEvidenceResponse[] = []

    // Multilingual Ingredients Text
    const addedIngredientTexts = new Set<string>()
    if (
        typeof raw.ingredients_text === "string" &&
        raw.ingredients_text.trim()
    ) {
        labelEvidence.push({
            field: "ingredient_text",
            value: raw.ingredients_text.trim(),
            source_field: "ingredients_text",
            source_name: sourceName,
            source_url: productUrl,
            language: primaryLang || "und",
            observed_at: null,
            retrieved_at: retrievedAt,
            source_revision: lastModified,
            dataset_version_id: datasetVersionId,
        })
        addedIngredientTexts.add(raw.ingredients_text.trim())
    }

    // Localized ingredients_text_<lang>
    for (const [key, val] of Object.entries(raw)) {
        if (
            key.startsWith("ingredients_text_") &&
            !key.includes("debug") &&
            !key.includes("ocr") &&
            !key.includes("with_allergens") &&
            !key.includes("imported") &&
            typeof val === "string" &&
            val.trim()
        ) {
            const lang = key.replace(/^ingredients_text_/, "")
            if (lang && !addedIngredientTexts.has(val.trim())) {
                addedIngredientTexts.add(val.trim())
                labelEvidence.push({
                    field: "ingredient_text",
                    value: val.trim(),
                    source_field: key,
                    source_name: sourceName,
                    source_url: productUrl,
                    language: lang,
                    observed_at: null,
                    retrieved_at: retrievedAt,
                    source_revision: lastModified,
                    dataset_version_id: datasetVersionId,
                })
            }
        }
    }

    // Allergen Tags
    if (Array.isArray(raw.allergens_tags) && raw.allergens_tags.length > 0) {
        labelEvidence.push({
            field: "allergen_tags",
            value: raw.allergens_tags,
            source_field: "allergens_tags",
            source_name: sourceName,
            source_url: productUrl,
            language: null,
            observed_at: null,
            retrieved_at: retrievedAt,
            source_revision: lastModified,
            dataset_version_id: datasetVersionId,
        })
    }

    // Trace Tags
    if (Array.isArray(raw.traces_tags) && raw.traces_tags.length > 0) {
        labelEvidence.push({
            field: "trace_tags",
            value: raw.traces_tags,
            source_field: "traces_tags",
            source_name: sourceName,
            source_url: productUrl,
            language: null,
            observed_at: null,
            retrieved_at: retrievedAt,
            source_revision: lastModified,
            dataset_version_id: datasetVersionId,
        })
    }

    // Additives Tags
    if (Array.isArray(raw.additives_tags) && raw.additives_tags.length > 0) {
        labelEvidence.push({
            field: "additive_tags",
            value: raw.additives_tags,
            source_field: "additives_tags",
            source_name: sourceName,
            source_url: productUrl,
            language: null,
            observed_at: null,
            retrieved_at: retrievedAt,
            source_revision: lastModified,
            dataset_version_id: datasetVersionId,
        })
    }

    // Nutrition matrix from nutriments dictionary
    if (
        raw.nutriments &&
        typeof raw.nutriments === "object" &&
        !Array.isArray(raw.nutriments) &&
        Object.keys(raw.nutriments).length > 0
    ) {
        labelEvidence.push({
            field: "nutrition",
            value: raw.nutriments,
            source_field: "nutriments",
            source_name: sourceName,
            source_url: productUrl,
            language: null,
            observed_at: null,
            retrieved_at: retrievedAt,
            source_revision: lastModified,
            dataset_version_id: datasetVersionId,
        })
    }

    if (raw.nutrition_data_per) {
        labelEvidence.push({
            field: "nutrition",
            value: raw.nutrition_data_per,
            source_field: "nutrition_data_per",
            source_name: sourceName,
            source_url: productUrl,
            language: null,
            observed_at: null,
            retrieved_at: retrievedAt,
            source_revision: lastModified,
            dataset_version_id: datasetVersionId,
        })
    }

    // Countries Sold
    if (Array.isArray(raw.countries_tags) && raw.countries_tags.length > 0) {
        labelEvidence.push({
            field: "countries_sold",
            value: raw.countries_tags,
            source_field: "countries_tags",
            source_name: sourceName,
            source_url: productUrl,
            language: null,
            observed_at: null,
            retrieved_at: retrievedAt,
            source_revision: lastModified,
            dataset_version_id: datasetVersionId,
        })
    } else if (typeof raw.countries === "string" && raw.countries.trim()) {
        labelEvidence.push({
            field: "countries_sold",
            value: raw.countries.split(",").map((c) => c.trim()),
            source_field: "countries",
            source_name: sourceName,
            source_url: productUrl,
            language: null,
            observed_at: null,
            retrieved_at: retrievedAt,
            source_revision: lastModified,
            dataset_version_id: datasetVersionId,
        })
    }

    // Packaging Languages
    if (Array.isArray(raw.languages_tags) && raw.languages_tags.length > 0) {
        labelEvidence.push({
            field: "packaging_languages",
            value: raw.languages_tags,
            source_field: "languages_tags",
            source_name: sourceName,
            source_url: productUrl,
            language: null,
            observed_at: null,
            retrieved_at: retrievedAt,
            source_revision: lastModified,
            dataset_version_id: datasetVersionId,
        })
    }

    // Manufacturing Places
    if (
        typeof raw.manufacturing_places === "string" &&
        raw.manufacturing_places.trim()
    ) {
        labelEvidence.push({
            field: "manufacturing_places",
            value: raw.manufacturing_places.trim(),
            source_field: "manufacturing_places",
            source_name: sourceName,
            source_url: productUrl,
            language: primaryLang,
            observed_at: null,
            retrieved_at: retrievedAt,
            source_revision: lastModified,
            dataset_version_id: datasetVersionId,
        })
    }

    // Storage / Conservation Conditions
    const storageVal =
        raw.conservation_conditions ||
        raw.conservation_conditions_en ||
        raw.storage_conditions
    if (typeof storageVal === "string" && storageVal.trim()) {
        labelEvidence.push({
            field: "storage_instructions",
            value: storageVal.trim(),
            source_field: "conservation_conditions",
            source_name: sourceName,
            source_url: productUrl,
            language: primaryLang,
            observed_at: null,
            retrieved_at: retrievedAt,
            source_revision: lastModified,
            dataset_version_id: datasetVersionId,
        })
    }

    // Halal Label Claim
    if (Array.isArray(raw.labels_tags)) {
        const hasHalalClaim = (raw.labels_tags as string[]).some(
            (l) => typeof l === "string" && l.toLowerCase() === "en:halal",
        )
        if (hasHalalClaim) {
            labelEvidence.push({
                field: "halal_label_claim",
                value: ["en:halal"],
                source_field: "labels_tags",
                source_name: sourceName,
                source_url: productUrl,
                language: null,
                observed_at: null,
                retrieved_at: retrievedAt,
                source_revision: lastModified,
                dataset_version_id: datasetVersionId,
            })
        }
    }

    // Reference Images
    const referenceImages = extractReferenceImages(
        raw,
        normalizedIdentifier,
        productUrl,
        retrievedAt,
        datasetVersionId,
    )

    // Source Metadata
    const source: PackageMatchSourceResponse = {
        name: sourceName,
        source_type: "COMMUNITY_DATABASE",
        base_url: "https://world.openfoodfacts.org",
        record_url: productUrl,
        attribution: "Open Food Facts contributors",
        database_license: "ODbL",
        contents_license: "Database Contents License",
        image_license: "CC BY-SA",
        terms_version: null,
    }

    // Dataset Version
    const datasetVersion: ExternalDatasetVersionResponse = {
        id: datasetVersionId,
        source_url: productUrl,
        retrieved_at: retrievedAt,
        activated_at: null,
        sha256: "",
    }

    const candidate: PackageMatchCandidateResponse = {
        source_kind: "OPEN_FOOD_FACTS",
        package_variant_id: null,
        product_id: null,
        external_record_id: normalizedIdentifier,
        source,
        identity_evidence: identityEvidence,
        label_evidence: labelEvidence,
        reference_images: referenceImages,
        retrieved_at: retrievedAt,
        source_revision: lastModified,
        dataset_version: datasetVersion,
        allergen_assessment: {
            status: "NOT_ASSESSED",
            reason: "Raw product record snapshot (unassessed by rules engine)",
            evidence_coverage: "PARTIAL",
            concepts: [],
            findings: [],
            source_signals: [],
        },
        halal_ingredient_assessment: {
            status: "NOT_ASSESSED",
            reason: "Raw product record snapshot (unassessed by rules engine)",
            outcome: "NOT_ASSESSED",
            evidence_coverage: "PARTIAL",
            checked_evidence: [],
            findings: [],
        },
    }

    const offView = extractOpenFoodFactsView(
        raw,
        normalizedIdentifier,
        scheme,
        referenceImages,
        productUrl,
    )

    return {
        candidate,
        offView,
        normalizedIdentifier,
        scheme,
        rawRecord: raw,
        meta,
    }
}

/**
 * Parses all rich Open Food Facts fields into a typed view object for UI visualization.
 */
export function extractOpenFoodFactsView(
    raw: Record<string, unknown>,
    barcode: string,
    scheme: IdentifierScheme,
    referenceImages: PackageMatchReferenceImageResponse[],
    productUrl: string,
): OpenFoodFactsProductView {
    const barcodePath = formatBarcodeImagePath(barcode)

    // Names & Brands
    const productName =
        (typeof raw.product_name === "string" && raw.product_name.trim()) ||
        (typeof raw.product_name_en === "string" &&
            raw.product_name_en.trim()) ||
        "Unlabeled Product"
    const genericName =
        typeof raw.generic_name === "string" && raw.generic_name.trim()
            ? raw.generic_name.trim()
            : typeof raw.generic_name_en === "string" &&
                raw.generic_name_en.trim()
              ? raw.generic_name_en.trim()
              : null

    let brands: string[] = []
    if (typeof raw.brands === "string" && raw.brands.trim()) {
        brands = raw.brands
            .split(",")
            .map((b) => b.trim())
            .filter(Boolean)
    } else if (Array.isArray(raw.brands_tags)) {
        brands = (raw.brands_tags as string[])
            .map((b) =>
                b
                    .replace(/^[a-z]{2}:/, "")
                    .replace(/-/g, " ")
                    .trim(),
            )
            .filter(Boolean)
    }

    // Categories
    let categories: string[] = []
    if (typeof raw.categories === "string" && raw.categories.trim()) {
        categories = raw.categories
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean)
    } else if (Array.isArray(raw.categories_tags)) {
        categories = (raw.categories_tags as string[])
            .map((c) =>
                c
                    .replace(/^[a-z]{2}:/, "")
                    .replace(/-/g, " ")
                    .trim(),
            )
            .filter(Boolean)
    }

    // Labels
    let labels: string[] = []
    if (typeof raw.labels === "string" && raw.labels.trim()) {
        labels = raw.labels
            .split(",")
            .map((l) => l.trim())
            .filter(Boolean)
    } else if (Array.isArray(raw.labels_tags)) {
        labels = (raw.labels_tags as string[])
            .map((l) =>
                l
                    .replace(/^[a-z]{2}:/, "")
                    .replace(/-/g, " ")
                    .trim(),
            )
            .filter(Boolean)
    }

    // Stores
    let stores: string[] = []
    if (typeof raw.stores === "string" && raw.stores.trim()) {
        stores = raw.stores
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
    } else if (Array.isArray(raw.stores_tags)) {
        stores = (raw.stores_tags as string[])
            .map((s) =>
                s
                    .replace(/^[a-z]{2}:/, "")
                    .replace(/-/g, " ")
                    .trim(),
            )
            .filter(Boolean)
    }

    // EMB Codes
    let embCodes: string[] = []
    if (Array.isArray(raw.emb_codes_tags)) {
        embCodes = (raw.emb_codes_tags as string[])
            .map((e) => e.replace(/^[a-z]{2}:/, "").trim())
            .filter(Boolean)
    } else if (typeof raw.emb_codes === "string" && raw.emb_codes.trim()) {
        embCodes = raw.emb_codes
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean)
    }

    // Countries Sold
    let countriesSold: string[] = []
    if (Array.isArray(raw.countries_tags)) {
        countriesSold = (raw.countries_tags as string[])
            .map((c) =>
                c
                    .replace(/^[a-z]{2}:/, "")
                    .replace(/_/g, " ")
                    .trim(),
            )
            .filter(Boolean)
    } else if (typeof raw.countries === "string" && raw.countries.trim()) {
        countriesSold = raw.countries
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean)
    }

    // Scores
    let nutriscoreGrade: OpenFoodFactsProductView["nutriscoreGrade"] = null
    if (typeof raw.nutriscore_grade === "string") {
        const grade = raw.nutriscore_grade.toLowerCase()
        if (["a", "b", "c", "d", "e", "unknown"].includes(grade)) {
            nutriscoreGrade =
                grade as OpenFoodFactsProductView["nutriscoreGrade"]
        }
    }

    const rawNutriScore =
        typeof raw.nutriscore_score === "number" ? raw.nutriscore_score : null
    const nutriscoreScore =
        nutriscoreGrade && ["a", "b", "c", "d", "e"].includes(nutriscoreGrade)
            ? rawNutriScore
            : null
    const nutriscoreVersion =
        typeof raw.nutriscore_version === "string"
            ? raw.nutriscore_version
            : null

    let novaGroup: OpenFoodFactsProductView["novaGroup"] = null
    const nutrimentsRecord =
        raw.nutriments && typeof raw.nutriments === "object"
            ? (raw.nutriments as Record<string, unknown>)
            : null
    const rawNova =
        raw.nova_group ??
        nutrimentsRecord?.["nova-group_100g"] ??
        nutrimentsRecord?.["nova_group_100g"] ??
        nutrimentsRecord?.["nova-group"] ??
        nutrimentsRecord?.["nova_group"]

    if (typeof rawNova === "number" && [1, 2, 3, 4].includes(rawNova)) {
        novaGroup = rawNova as 1 | 2 | 3 | 4
    }

    let ecoscoreGrade: OpenFoodFactsProductView["ecoscoreGrade"] = null
    const rawEco = raw.ecoscore_grade || raw.environmental_score_grade
    if (typeof rawEco === "string") {
        const grade = rawEco.toLowerCase()
        if (["a", "b", "c", "d", "e", "unknown"].includes(grade)) {
            ecoscoreGrade = grade as OpenFoodFactsProductView["ecoscoreGrade"]
        }
    }
    const rawEcoScore =
        typeof raw.ecoscore_score === "number"
            ? raw.ecoscore_score
            : typeof raw.environmental_score_score === "number"
              ? raw.environmental_score_score
              : null
    const ecoscoreScore =
        ecoscoreGrade && ["a", "b", "c", "d", "e"].includes(ecoscoreGrade)
            ? rawEcoScore
            : null

    // Nutrient Levels
    const rawLevels = (raw.nutrient_levels || {}) as Record<string, string>
    const nutriments = (raw.nutriments || {}) as Record<string, unknown>

    const computeLevelFrom100g = (
        val: unknown,
        low: number,
        high: number,
    ): NutrientLevels["fat"] => {
        const num =
            typeof val === "number"
                ? val
                : typeof val === "string"
                  ? Number.parseFloat(val)
                  : Number.NaN
        if (Number.isNaN(num)) return null
        if (num <= low) return "low"
        if (num <= high) return "moderate"
        return "high"
    }

    const getLevel = (
        key: string,
        nutrientKey: string,
        low: number,
        high: number,
    ): NutrientLevels["fat"] => {
        const val = rawLevels[key]
        if (val && ["low", "moderate", "high"].includes(val)) {
            return val as NutrientLevels["fat"]
        }
        const val100g =
            nutriments[`${nutrientKey}_100g`] ??
            nutriments[`${nutrientKey}-100g`] ??
            nutriments[nutrientKey]
        return computeLevelFrom100g(val100g, low, high)
    }

    const nutrientLevels: NutrientLevels = {
        fat: getLevel("fat", "fat", 3.0, 17.5),
        saturatedFat:
            getLevel("saturated-fat", "saturated_fat", 1.5, 5.0) ??
            getLevel("saturated-fat", "saturated-fat", 1.5, 5.0),
        sugars: getLevel("sugars", "sugars", 5.0, 22.5),
        salt: getLevel("salt", "salt", 0.3, 1.5),
    }

    // Ingredients Analysis (Palm oil, Vegan, Vegetarian)
    const analysisTags = Array.isArray(raw.ingredients_analysis_tags)
        ? (raw.ingredients_analysis_tags as string[])
        : []

    const ingredientsAnalysis: IngredientsAnalysis = {
        palmOil: analysisTags.some(
            (t) => t.includes("palm-oil") && !t.includes("palm-oil-free"),
        )
            ? "yes"
            : analysisTags.includes("en:palm-oil-free")
              ? "no"
              : analysisTags.some((t) => t.includes("may-contain-palm-oil"))
                ? "maybe"
                : "unknown",
        vegan: analysisTags.includes("en:vegan")
            ? "yes"
            : analysisTags.includes("en:non-vegan")
              ? "no"
              : analysisTags.some((t) => t.includes("maybe-vegan"))
                ? "maybe"
                : "unknown",
        vegetarian: analysisTags.includes("en:vegetarian")
            ? "yes"
            : analysisTags.includes("en:non-vegetarian")
              ? "no"
              : analysisTags.some((t) => t.includes("maybe-vegetarian"))
                ? "maybe"
                : "unknown",
    }

    // Packagings components
    const packagings: PackagingComponent[] = []
    if (Array.isArray(raw.packagings)) {
        for (const item of raw.packagings as Record<string, unknown>[]) {
            if (!item || typeof item !== "object") continue
            packagings.push({
                shape:
                    typeof item.shape === "string"
                        ? item.shape
                              .replace(/^[a-z]{2}:/, "")
                              .replace(/-/g, " ")
                        : null,
                material:
                    typeof item.material === "string"
                        ? item.material
                              .replace(/^[a-z]{2}:/, "")
                              .replace(/-/g, " ")
                        : null,
                recycling:
                    typeof item.recycling === "string"
                        ? item.recycling
                              .replace(/^[a-z]{2}:/, "")
                              .replace(/-/g, " ")
                        : null,
                quantityPerUnit:
                    typeof item.quantity_per_unit === "string"
                        ? item.quantity_per_unit
                        : null,
                weightMeasured:
                    typeof item.weight_measured === "number"
                        ? item.weight_measured
                        : typeof item.weight_measured === "string"
                          ? Number.parseFloat(item.weight_measured)
                          : null,
                foodContact:
                    typeof item.food_contact === "number"
                        ? item.food_contact
                        : null,
                numberOfUnits:
                    typeof item.number_of_units === "number"
                        ? item.number_of_units
                        : null,
            })
        }
    }

    // All Images
    const allImages: ProductPhoto[] = []
    const seenPhotoUrls = new Set<string>()

    // Include role-selected reference images first
    for (const ref of referenceImages) {
        if (!seenPhotoUrls.has(ref.original_url)) {
            seenPhotoUrls.add(ref.original_url)
            allImages.push({
                id: ref.role + "_" + (ref.language || "und"),
                url: ref.url,
                originalUrl: ref.original_url,
                role: ref.role,
                uploader: "Open Food Facts",
            })
        }
    }

    // Also include raw uploaded contributor images from raw.images
    const rawImages = raw.images
    if (
        rawImages &&
        typeof rawImages === "object" &&
        !Array.isArray(rawImages)
    ) {
        for (const [key, details] of Object.entries(
            rawImages as Record<string, unknown>,
        )) {
            if (/^\d+$/.test(key) && details && typeof details === "object") {
                const d = details as Record<string, unknown>
                const originalUrl = `https://images.openfoodfacts.org/images/products/${barcodePath}/${key}.400.jpg`
                if (!seenPhotoUrls.has(originalUrl)) {
                    seenPhotoUrls.add(originalUrl)
                    allImages.push({
                        id: key,
                        url: buildProxiedImageUrl(originalUrl),
                        originalUrl,
                        role: "user_upload",
                        uploader:
                            typeof d.uploader === "string" ? d.uploader : null,
                        uploadedAt:
                            typeof d.uploaded_t === "number" ||
                            typeof d.uploaded_t === "string"
                                ? new Date(
                                      Number(d.uploaded_t) * 1000,
                                  ).toLocaleDateString()
                                : null,
                    })
                }
            }
        }
    }

    return {
        barcode,
        scheme,
        productName,
        genericName,
        brands,
        quantity: typeof raw.quantity === "string" ? raw.quantity : null,
        categories,
        labels,
        stores,
        origins: typeof raw.origins === "string" ? raw.origins : null,
        manufacturingPlaces:
            typeof raw.manufacturing_places === "string"
                ? raw.manufacturing_places
                : null,
        embCodes,
        countriesSold,
        packagingText:
            typeof raw.packaging === "string"
                ? raw.packaging
                : typeof raw.packaging_text === "string"
                  ? raw.packaging_text
                  : typeof raw.packaging_text_en === "string"
                    ? raw.packaging_text_en
                    : null,
        customerService:
            typeof raw.customer_service === "string"
                ? raw.customer_service
                : null,
        link: typeof raw.link === "string" ? raw.link : productUrl,

        nutriscoreGrade,
        nutriscoreScore,
        nutriscoreVersion,
        novaGroup,
        novaGroupsMarkers:
            raw.nova_groups_markers &&
            typeof raw.nova_groups_markers === "object"
                ? (raw.nova_groups_markers as Record<string, unknown>)
                : undefined,
        ecoscoreGrade,
        ecoscoreScore,
        nutrientLevels,

        ingredientsAnalysis,
        packagings,

        completeness:
            typeof raw.completeness === "number" ? raw.completeness : null,
        statesTags: Array.isArray(raw.states_tags)
            ? (raw.states_tags as string[])
            : [],
        dataQualityWarnings: Array.isArray(raw.data_quality_warnings_tags)
            ? (raw.data_quality_warnings_tags as string[])
            : [],
        creator: typeof raw.creator === "string" ? raw.creator : null,
        lastModified: raw.last_modified_t
            ? new Date(Number(raw.last_modified_t) * 1000).toLocaleDateString()
            : null,

        allImages,
    }
}
