import type {
    LifegoodsPackageSearchContractsPackageSearchResponse as PackageSearchResponse,
    LifegoodsPackageSearchContractsPackageSearchResultResponse as PackageSearchResultResponse,
    PackageSearchEvidenceResponse,
} from "@/api/generated"

import type { PackageSearchLookup } from "./types"

const datasetVersion = {
    id: "dataset-demo-search",
    source_url: "https://static.openfoodfacts.org/data/export.jsonl.gz",
    retrieved_at: "2026-08-27T08:00:00Z",
    activated_at: "2026-08-27T09:00:00Z",
    sha256: "demo".padEnd(64, "0"),
}

const products: PackageSearchResultResponse[] = [
    demoProduct({
        identifier: "4006381333931",
        name: "Dark Chocolate",
        brand: "Example Foods",
        quantity: "100 g",
        manufacturingPlace: "Cambodia",
    }),
    demoProduct({
        identifier: "8850000000003",
        name: "Coconut Milk",
        brand: "Mekong Pantry",
        quantity: "250 ml",
        manufacturingPlace: "Cambodia",
    }),
    demoProduct({
        identifier: "737628064502",
        name: "Original Cola",
        brand: "Demo Beverage Company",
        quantity: "330 ml",
        manufacturingPlace: "Cambodia",
    }),
]

export const lookupDemoPackageSearch: PackageSearchLookup = (query, offset) => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    const matches = products.filter((product) => {
        const names = product.names
            .map((name) => stringValue(name.value))
            .join(" ")
        const brands = stringList(product.brands?.value).join(" ")
        return `${names} ${brands}`
            .toLocaleLowerCase()
            .includes(normalizedQuery)
    })
    const page = matches.slice(offset, offset + 12)
    return Promise.resolve({
        normalized_query: query.trim(),
        dataset_version: datasetVersion,
        results: page,
        next_offset: offset + page.length < matches.length ? offset + 12 : null,
    } satisfies PackageSearchResponse)
}

function demoProduct({
    identifier,
    name,
    brand,
    quantity,
    manufacturingPlace,
}: {
    identifier: string
    name: string
    brand: string
    quantity: string
    manufacturingPlace: string
}): PackageSearchResultResponse {
    return {
        source_kind: "OPEN_FOOD_FACTS",
        identifier,
        names: [evidence(name, "product_name", "en", identifier)],
        brands: evidence([brand], "brands", null, identifier),
        quantity: evidence(quantity, "quantity", null, identifier),
        manufacturing_place: evidence(
            manufacturingPlace,
            "manufacturing_places",
            null,
            identifier,
        ),
        reference_image: null,
    }
}

function evidence(
    value: unknown,
    sourceField: string,
    language: string | null,
    identifier: string,
): PackageSearchEvidenceResponse {
    return {
        value,
        source_field: sourceField,
        language,
        source_name: "Open Food Facts",
        source_url: `https://world.openfoodfacts.org/product/${identifier}`,
        retrieved_at: datasetVersion.retrieved_at,
        source_revision: "demo",
        dataset_version_id: datasetVersion.id,
    }
}

function stringValue(value: unknown) {
    return typeof value === "string" ? value : ""
}

function stringList(value: unknown) {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : []
}
