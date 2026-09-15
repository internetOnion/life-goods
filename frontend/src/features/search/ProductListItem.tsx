import { ArrowRightIcon, InfoIcon, PackageIcon } from "@phosphor-icons/react"
import { Link } from "react-router"

export type ProductListItemData = {
    barcode: string
    name?: string | null
    genericName?: string | null
    brand?: string | null
}

type ProductListItemProps = {
    product: ProductListItemData
    to: string
    state?: unknown
}

type ProductNameUnavailableNoticeProps = {
    missingCount: number
    totalCount: number
}

function clean(value?: string | null) {
    const trimmed = value?.trim()
    return trimmed && trimmed !== "Unlabeled Product" ? trimmed : null
}

export function ProductNameUnavailableNotice({
    missingCount,
    totalCount,
}: ProductNameUnavailableNoticeProps) {
    if (missingCount === 0 || totalCount === 0) return null

    return (
        <div
            className="bg-primary-50 text-primary-950 type-supporting mt-3 flex items-start gap-2.5 rounded-xl px-3.5 py-3 font-medium"
            role="status"
        >
            <InfoIcon
                className="text-primary-700 mt-0.5 shrink-0"
                size={18}
                weight="bold"
                aria-hidden="true"
            />
            <span>
                Product name: <strong>Source Data Unavailable</strong> for{" "}
                {missingCount} of {totalCount} Source Records. Open a Product{" "}
                below to read the available source details.
            </span>
        </div>
    )
}

export function ProductListItem({ product, to, state }: ProductListItemProps) {
    const name = clean(product.name)
    const genericName = clean(product.genericName)
    const brand = clean(product.brand)
    const primaryValue =
        name || genericName || brand || "Source Data Unavailable"

    return (
        <Link
            to={to}
            state={state}
            className="group focus-visible:ring-primary-500 grid min-h-20 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-4 py-4 text-left no-underline transition-[background-color,box-shadow] duration-150 hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset active:bg-neutral-100 motion-reduce:transition-none sm:px-5"
            aria-label={
                name
                    ? "View " + name
                    : genericName
                      ? "View " + genericName + " Product " + product.barcode
                      : brand
                        ? "View " + brand + " Product " + product.barcode
                        : "View Product " + product.barcode
            }
        >
            <span className="bg-primary-50 text-primary-700 ring-primary-200 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset">
                <PackageIcon size={21} weight="duotone" aria-hidden="true" />
            </span>

            <span className="min-w-0">
                <h3 className="type-row-title min-w-0 wrap-anywhere text-neutral-950">
                    {primaryValue}
                </h3>
                {name && genericName ? (
                    <span className="type-supporting mt-1 block min-w-0 wrap-anywhere text-neutral-600">
                        <span className="font-semibold text-neutral-500">
                            Product type
                        </span>{" "}
                        {genericName}
                    </span>
                ) : null}
            </span>

            <ArrowRightIcon
                className="text-primary-700 col-start-3 row-start-1 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 motion-reduce:transition-none"
                size={20}
                weight="bold"
                aria-hidden="true"
            />
        </Link>
    )
}
