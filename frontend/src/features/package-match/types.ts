import type {
    PackageMatchCandidateResponse,
    PackageMatchesResponse,
} from "../../api/generated"

export type {
    PackageMatchCandidateResponse,
    PackageMatchesResponse,
} from "../../api/generated"

export type PackageMatchLookup = (
    identifier: string,
) => Promise<PackageMatchesResponse>

export type OpenFoodFactsCandidate = PackageMatchCandidateResponse & {
    source_kind: "OPEN_FOOD_FACTS"
}

export function isOpenFoodFactsCandidate(
    candidate: PackageMatchCandidateResponse,
): candidate is OpenFoodFactsCandidate {
    return candidate.source_kind === "OPEN_FOOD_FACTS"
}
