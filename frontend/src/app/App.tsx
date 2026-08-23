import { ManualIdentifierJourney } from '../features/package-match/ManualIdentifierJourney'
import type { PackageMatchLookup } from '../features/package-match/types'


type AppProps = {
  lookup: PackageMatchLookup
}

export function App({ lookup }: AppProps) {
  return <ManualIdentifierJourney lookup={lookup} />
}
