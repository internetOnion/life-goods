import type { PackageMatchesResponse } from "../../api/generated"

export type {
    PackageMatchCandidateResponse,
    PackageMatchesResponse,
} from "../../api/generated"

export type PackageMatchLookup = (
    identifier: string,
) => Promise<PackageMatchesResponse>
