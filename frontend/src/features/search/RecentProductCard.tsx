import type { ScanHistoryItem } from "@/lib/history"

import { ProductListItem } from "./ProductListItem"

type RecentProductCardProps = {
    item: ScanHistoryItem
}

export function RecentProductCard({ item }: RecentProductCardProps) {
    return (
        <ProductListItem
            product={{
                barcode: item.identifier,
                name: item.name,
                genericName: item.genericName,
                brand: item.brand,
            }}
            to={`/products/${item.identifier}`}
        />
    )
}
