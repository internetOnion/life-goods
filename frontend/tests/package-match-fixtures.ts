import { readFileSync } from "node:fs"
import path from "node:path"

import type {
    PackageMatchCandidateResponse,
    PackageMatchesResponse,
} from "../src/api/generated"
import type { OpenFoodFactsCandidate } from "../src/features/package-match/types"

const fixtureDirectory = path.resolve(
    process.cwd(),
    "../evaluation/fixtures/package_matches",
)

const completeFixture = readCandidate("off_complete.json")
const sparseFixture = readCandidate("off_sparse.json")
export const datasetVersion = {
    id: "dataset-2026-08-27",
    source_url: "https://static.openfoodfacts.org/data/export.jsonl.gz",
    retrieved_at: "2026-08-27T08:00:00Z",
    activated_at: "2026-08-27T09:00:00Z",
    sha256: "a".repeat(64),
}

export function completeOffCandidate(
    overrides: Partial<OpenFoodFactsCandidate> = {},
): OpenFoodFactsCandidate {
    return { ...structuredClone(completeFixture), ...overrides }
}

export function sparseOffCandidate(
    overrides: Partial<OpenFoodFactsCandidate> = {},
): OpenFoodFactsCandidate {
    return { ...structuredClone(sparseFixture), ...overrides }
}

export function packageMatches(
    candidate: PackageMatchCandidateResponse,
): PackageMatchesResponse {
    return {
        normalized_identifier: candidate.external_record_id ?? "4006381333931",
        scheme: "EAN_13",
        candidates: [candidate],
        open_food_facts: {
            status: "AVAILABLE",
            dataset_version: datasetVersion,
            error_code: null,
        },
    }
}

export function packageMatchesResponse(
    candidates: PackageMatchCandidateResponse[] = [],
    normalizedIdentifier = "4006381333931",
): PackageMatchesResponse {
    return {
        normalized_identifier: normalizedIdentifier,
        scheme: "EAN_13",
        candidates,
        open_food_facts: {
            status: candidates.length > 0 ? "AVAILABLE" : "NOT_FOUND",
            dataset_version: candidates.length > 0 ? datasetVersion : null,
            error_code: null,
        },
    }
}

function readCandidate(fileName: string): OpenFoodFactsCandidate {
    return JSON.parse(
        readFileSync(path.join(fixtureDirectory, fileName), "utf8"),
    ) as OpenFoodFactsCandidate
}
