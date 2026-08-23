import type { PackageMatchesResponse } from '../../api/generated'

export type { PackageMatchesResponse } from '../../api/generated'

export type PackageMatchLookup = (identifier: string) => Promise<PackageMatchesResponse>
