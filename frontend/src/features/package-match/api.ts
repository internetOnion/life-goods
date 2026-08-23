import { getPackageMatches } from '../../api/generated'
import type { PackageMatchLookup } from './types'


export const lookupPackageMatches: PackageMatchLookup = async (identifier) => {
  const { data } = await getPackageMatches({
    query: { identifier },
    throwOnError: true,
  })
  return data
}
