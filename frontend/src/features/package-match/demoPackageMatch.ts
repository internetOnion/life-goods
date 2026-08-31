import type {
    IdentifierScheme,
    PackageMatchCandidateResponse,
    PackageMatchEvidenceResponse,
    PackageMatchesResponse,
} from "../../api/generated"
import completeCandidateFixture from "../../../../evaluation/fixtures/package_matches/off_complete.json"
import type { PackageMatchLookup } from "./types"

const completeCandidate: PackageMatchCandidateResponse = {
    ...(completeCandidateFixture as unknown as PackageMatchCandidateResponse),
    source_kind: "OPEN_FOOD_FACTS",
}

const schemesByLength: Record<number, IdentifierScheme> = {
    8: "GTIN_8",
    12: "UPC_A",
    13: "EAN_13",
    14: "GTIN_14",
}

export const lookupDemoPackageMatches: PackageMatchLookup = (identifier) =>
    Promise.resolve(createDemoPackageMatchesResponse(identifier))

function createDemoPackageMatchesResponse(
    identifier: string,
): PackageMatchesResponse {
    const sourceUrl = `https://world.openfoodfacts.org/product/${identifier}`
    const candidate = structuredClone(completeCandidate)

    candidate.external_record_id = identifier
    candidate.identity_evidence = rewriteEvidence(
        candidate.identity_evidence,
        sourceUrl,
        identifier,
    )
    candidate.label_evidence = rewriteEvidence(
        candidate.label_evidence,
        sourceUrl,
        identifier,
    )
    candidate.identity_evidence = [
        ...(candidate.identity_evidence ?? []),
        {
            field: "category",
            value: "Chocolate confectionery",
            source_field: "categories_en",
            source_name: "Open Food Facts",
            source_url: sourceUrl,
            language: "en",
            observed_at: null,
            retrieved_at: "2026-08-24T10:00:00Z",
            dataset_version_id: "dataset-2026-08-27",
        },
    ]
    candidate.label_evidence = (candidate.label_evidence ?? []).map((item) =>
        item.field === "nutrition"
            ? {
                  ...item,
                  value: {
                      energy_kcal_100g: 550,
                      energy_kcal_100g_unit: "kcal",
                      fat_100g: 35,
                      fat_100g_unit: "g",
                      sugars_100g: 23.4,
                      sugars_100g_unit: "g",
                      proteins_100g: 7.5,
                      proteins_100g_unit: "g",
                      energy_kcal_serving: 275,
                      energy_kcal_serving_unit: "kcal",
                      fat_serving: 17.5,
                      fat_serving_unit: "g",
                      sugars_serving: 11.7,
                      sugars_serving_unit: "g",
                      proteins_serving: 3.8,
                      proteins_serving_unit: "g",
                  },
              }
            : item,
    )
    candidate.reference_images = (candidate.reference_images ?? []).map(
        (image) => ({ ...image, source_url: sourceUrl }),
    )
    if (candidate.source) candidate.source.record_url = sourceUrl

    return {
        normalized_identifier: identifier,
        scheme: schemeForIdentifier(identifier),
        candidates: [candidate],
        open_food_facts: {
            status: "AVAILABLE",
            dataset_version: candidate.dataset_version
                ? structuredClone(candidate.dataset_version)
                : null,
            error_code: null,
        },
    }
}

function rewriteEvidence(
    evidence: PackageMatchEvidenceResponse[] | undefined,
    sourceUrl: string,
    identifier: string,
) {
    return (evidence ?? []).map((item) => ({
        ...item,
        source_url: sourceUrl,
        value: item.field === "identifier" ? identifier : item.value,
    }))
}

function schemeForIdentifier(identifier: string): IdentifierScheme {
    const scheme = schemesByLength[identifier.length]
    if (!scheme) {
        throw new Error("Demo Package Match received an unsupported identifier")
    }
    return scheme
}
