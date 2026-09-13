import { PackageImagePlaceholder } from "@/components/illustrations"
import { buildProxiedImageUrl } from "@/features/product/adapter"
import type { ScanHistoryItem } from "@/lib/history"
import { useState } from "react"
import { Link } from "react-router"

type RecentProductCardProps = {
    item: ScanHistoryItem
}

function valueOrNotAvailable(value?: string) {
    return value?.trim() || "N/A"
}

export function RecentProductCard({ item }: RecentProductCardProps) {
    const [imageFailed, setImageFailed] = useState(false)
    const name = valueOrNotAvailable(item.name)
    const imageUrl = item.imageUrl
        ? buildProxiedImageUrl(item.imageUrl)
        : undefined

    return (
        <Link
            to={`/products/${item.identifier}`}
            className="group focus-visible:ring-primary-500 shadow-source-sheet hover:border-primary-400 focus-visible:border-primary-400 flex min-h-32 w-full items-start gap-3 rounded-2xl border border-neutral-200/80 bg-white p-3 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:bg-[#f2f1ea] hover:shadow-[0_8px_20px_-16px_rgba(19,21,25,0.55)] focus-visible:-translate-y-0.5 focus-visible:bg-[#f2f1ea] focus-visible:shadow-[0_8px_20px_-16px_rgba(19,21,25,0.55)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.99]"
            aria-label={`View ${name}`}
        >
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-neutral-50 ring-1 ring-neutral-100 sm:size-[5.5rem]">
                {imageUrl && !imageFailed ? (
                    <img
                        src={imageUrl}
                        alt={`${name} product image`}
                        className="size-full object-contain p-1"
                        onError={() => setImageFailed(true)}
                    />
                ) : (
                    <PackageImagePlaceholder
                        className="size-full p-1"
                        label="Source Image Unavailable"
                    />
                )}
            </div>

            <div className="min-w-0 flex-1">
                <h3 className="text-sm leading-snug font-extrabold wrap-anywhere text-neutral-900 sm:text-base">
                    {name}
                </h3>
                <dl className="mt-2 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs leading-snug">
                    <dt className="font-bold text-neutral-500">Company</dt>
                    <dd className="m-0 font-semibold wrap-anywhere text-neutral-700">
                        {valueOrNotAvailable(item.brand)}
                    </dd>
                    <dt className="font-bold text-neutral-500">Made in</dt>
                    <dd className="m-0 font-semibold wrap-anywhere text-neutral-700 capitalize">
                        {valueOrNotAvailable(item.manufacturingPlace)}
                    </dd>
                    <dt className="font-bold text-neutral-500">Barcode</dt>
                    <dd className="m-0 font-mono wrap-anywhere text-neutral-600">
                        {item.identifier}
                    </dd>
                </dl>
            </div>

            <span
                className="text-primary-600 self-center text-2xl leading-none font-bold transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
            >
                &gt;
            </span>
        </Link>
    )
}
