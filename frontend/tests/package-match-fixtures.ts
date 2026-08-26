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
    }
}

function readCandidate(fileName: string): OpenFoodFactsCandidate {
    return JSON.parse(
        readFileSync(path.join(fixtureDirectory, fileName), "utf8"),
    ) as OpenFoodFactsCandidate
}
