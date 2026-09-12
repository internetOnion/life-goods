import type { ProductLookupResponse } from "@/features/product/types"
import { unavailableAllergenAnalysis } from "@/features/product/defaults"
import type { ProductSummary } from "@/api/generated"

const OPEN_FOOD_FACTS_SEARCH_URL =
    "https://world.openfoodfacts.org/api/v2/search"
const OPEN_FOOD_FACTS_SOURCE = "Open Food Facts"
const OPEN_FOOD_FACTS_BASE_URL = "https://world.openfoodfacts.org"
const SEARCH_FIELDS =
    "code,product_name,product_name_en,brands,quantity,manufacturing_places,manufacturing_places_tags,image_url,lang"

type RemoteProduct = {
    code: string
    product_name?: string
    product_name_en?: string
    brands?: string
    quantity?: string
    manufacturing_places?: string
    manufacturing_places_tags?: string[]
    image_url?: string
    lang?: string
}

type CachedRemoteProduct = {
    record: Record<string, unknown>
    retrievedAt: string
}

const cachedProducts = new Map<string, CachedRemoteProduct>()

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function textValue(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function remoteProduct(value: unknown): RemoteProduct | null {
    if (!isRecord(value)) return null
    const code = textValue(value.code)
    if (!code || !/^\d+$/.test(code)) return null

    const manufacturingPlaces = Array.isArray(value.manufacturing_places_tags)
        ? value.manufacturing_places_tags.filter(
              (place): place is string => typeof place === "string",
          )
        : undefined

    return {
        code,
        product_name: textValue(value.product_name),
        product_name_en: textValue(value.product_name_en),
        brands: textValue(value.brands),
        quantity: textValue(value.quantity),
        manufacturing_places: textValue(value.manufacturing_places),
        manufacturing_places_tags: manufacturingPlaces?.length
            ? manufacturingPlaces
            : undefined,
        image_url: textValue(value.image_url),
        lang: textValue(value.lang),
    }
}

function normalizedTerms(value: string): string[] {
    return (
        value
            .normalize("NFKC")
            .toLocaleLowerCase()
            .match(/[\p{L}\p{M}\p{N}]+/gu) ?? []
    )
}

function brandFilterForQuery(query: string): "nutella" | "coca-cola" | null {
    const terms = normalizedTerms(query)
    if (terms.includes("nutella")) return "nutella"
    if (terms.includes("coca") || terms.includes("cola")) return "coca-cola"
    return null
}

export function canUseOpenFoodFactsBrandSearch(query: string): boolean {
    return brandFilterForQuery(query) !== null
}

function displayTag(value: string): string {
    return value.replace(/^[a-z]{2,3}:/i, "").replace(/[-_]+/g, " ")
}

function splitBrands(value: string | undefined): string[] {
    if (!value) return []
    return [
        ...new Set(
            value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
        ),
    ]
}

function manufacturingPlaces(product: RemoteProduct): string[] {
    const places = product.manufacturing_places
        ?.split(",")
        .map((place) => place.trim())
        .filter(Boolean)
    if (places?.length) return [...new Set(places)]

    return [
        ...new Set(
            product.manufacturing_places_tags
                ?.map(displayTag)
                .filter(Boolean) ?? [],
        ),
    ]
}

function selectName(product: RemoteProduct) {
    const englishName = textValue(product.product_name_en)
    const name = englishName ?? textValue(product.product_name)
    if (!name) return null
    return {
        value: name,
        language: englishName ? "en" : (product.lang ?? null),
        source_field: englishName ? "product_name_en" : "product_name",
    }
}

function toSummary(product: RemoteProduct): ProductSummary {
    const imageUrl = textValue(product.image_url)
    return {
        barcode: product.code,
        name: selectName(product),
        brands: splitBrands(product.brands),
        manufacturing_places: manufacturingPlaces(product),
        quantity: product.quantity ?? null,
        thumbnail: imageUrl
            ? {
                  url: imageUrl,
                  language: product.lang ?? null,
                  source_field: "image_url",
              }
            : null,
        source: {
            name: OPEN_FOOD_FACTS_SOURCE,
            product_url: `${OPEN_FOOD_FACTS_BASE_URL}/product/${product.code}`,
        },
    }
}

export async function searchOpenFoodFactsBrand(
    query: string,
    cursor: string | null = null,
): Promise<{ results: ProductSummary[]; nextCursor: string | null }> {
    const brand = brandFilterForQuery(query)
    if (!brand) return { results: [], nextCursor: null }

    const url = new URL(OPEN_FOOD_FACTS_SEARCH_URL)
    url.searchParams.set("brands_tags", brand)
    const page = cursor?.startsWith("off-page:")
        ? Number(cursor.slice("off-page:".length))
        : 1
    url.searchParams.set(
        "page",
        String(Number.isInteger(page) && page > 0 ? page : 1),
    )
    url.searchParams.set("page_size", "20")
    url.searchParams.set("sort_by", "product_name")
    url.searchParams.set("fields", SEARCH_FIELDS)

    const response = await fetch(url, {
        headers: { Accept: "application/json" },
    })
    if (!response.ok) {
        throw new Error(`Open Food Facts search failed (${response.status})`)
    }

    const payload: unknown = await response.json()
    const products =
        isRecord(payload) && Array.isArray(payload.products)
            ? payload.products
                  .map(remoteProduct)
                  .filter(
                      (product): product is RemoteProduct => product !== null,
                  )
            : []
    const retrievedAt = new Date().toISOString()

    for (const product of products) {
        cachedProducts.set(product.code, {
            retrievedAt,
            record: { ...product },
        })
    }

    return {
        results: products.map(toSummary),
        nextCursor:
            isRecord(payload) &&
            typeof payload.count === "number" &&
            page * 20 < payload.count
                ? `off-page:${page + 1}`
                : null,
    }
}

export function getCachedOpenFoodFactsProduct(
    barcode: string,
): ProductLookupResponse | null {
    const cached = cachedProducts.get(barcode)
    if (!cached) return null

    return {
        data: {
            source_record: cached.record,
            allergen_analysis: unavailableAllergenAnalysis,
        },
        meta: {
            lookup: { barcode },
            source: {
                name: OPEN_FOOD_FACTS_SOURCE,
                product_url: `${OPEN_FOOD_FACTS_BASE_URL}/product/${barcode}`,
            },
            dataset: {
                version: "open-food-facts-live-search",
                retrieved_at: cached.retrievedAt,
            },
        },
    }
}
