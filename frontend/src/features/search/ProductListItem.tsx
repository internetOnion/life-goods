import { ArrowRightIcon, InfoIcon, PackageIcon } from "@phosphor-icons/react"
import { Link } from "react-router"

import { getBarcodeCountry } from "@/lib/barcode-country"

export type ProductListItemData = {
    barcode: string
    name?: string | null
    genericName?: string | null
    brand?: string | null
    quantity?: string | null
    manufacturingPlace?: string | null
    packaging?: string | null
    labels?: string[] | null
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
    return trimmed || null
}

function cleanList(values?: string[] | null) {
    return [
        ...new Set(
            values?.map((value) => clean(value)).filter(Boolean) as string[],
        ),
    ]
}

export function ProductNameUnavailableNotice({
    missingCount,
    totalCount,
}: ProductNameUnavailableNoticeProps) {
    if (missingCount === 0 || totalCount === 0) return null

    return (
        <div
            className="bg-primary-50 text-primary-950 mt-3 flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm leading-relaxed font-semibold"
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
                {missingCount} of {totalCount} Source Records. Compare the{" "}
                available Product details below.
            </span>
        </div>
    )
}

export function ProductListItem({ product, to, state }: ProductListItemProps) {
    const name = clean(product.name)
    const genericName = clean(product.genericName)
    const brand = clean(product.brand)
    const quantity = clean(product.quantity)
    const manufacturingPlace = clean(product.manufacturingPlace)
    const packaging = clean(product.packaging)
    const labels = cleanList(product.labels)
    const barcodeCountry = getBarcodeCountry(product.barcode)
    const hasName = Boolean(name)
    const hasGenericName = Boolean(genericName)
    const hasBrand = Boolean(brand)
    const brandIsPrimary = !hasName && !hasGenericName && hasBrand
    const barcodeIsPrimary = !hasName && !hasGenericName && !hasBrand
    const hasPackDetails = Boolean(quantity || packaging || labels.length)
    const showBarcode = !barcodeIsPrimary
    const primaryValue = name || genericName || brand
    const hasSourceDetails = Boolean(
        (hasBrand && !brandIsPrimary) ||
        manufacturingPlace ||
        barcodeCountry ||
        showBarcode,
    )

    return (
        <Link
            to={to}
            state={state}
            className="group focus-visible:ring-primary-500 grid min-h-20 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-4 py-4 text-left no-underline transition-[background-color,box-shadow] duration-150 hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset active:bg-neutral-100 motion-reduce:transition-none sm:px-5 md:min-h-[5.5rem] md:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,0.9fr)_auto] md:items-center md:gap-x-5"
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
            <span className="bg-primary-50 text-primary-700 ring-primary-200 row-span-3 mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset md:col-start-1 md:row-span-1 md:size-11">
                <PackageIcon size={21} weight="duotone" aria-hidden="true" />
            </span>

            <span className="col-start-2 row-start-1 min-w-0 md:col-start-2 md:row-start-1">
                <h3
                    className={
                        primaryValue
                            ? "min-w-0 text-base leading-snug font-extrabold tracking-[-0.02em] wrap-anywhere text-neutral-950 sm:text-lg"
                            : "min-w-0 font-mono text-sm leading-snug font-bold tracking-[0.02em] wrap-anywhere text-neutral-950 tabular-nums sm:text-base"
                    }
                >
                    {primaryValue ? (
                        primaryValue
                    ) : (
                        <>
                            <span className="text-caption font-sans font-bold tracking-normal text-neutral-500 uppercase">
                                Barcode
                            </span>{" "}
                            {product.barcode}
                        </>
                    )}
                </h3>
                {name && genericName ? (
                    <span className="mt-1 block min-w-0 text-xs leading-snug font-semibold wrap-anywhere text-neutral-600">
                        <span className="font-bold text-neutral-500">
                            Product type
                        </span>{" "}
                        {genericName}
                    </span>
                ) : null}
            </span>

            <span className="col-span-2 col-start-2 row-start-2 min-w-0 md:col-span-1 md:col-start-3 md:row-start-1">
                {hasPackDetails ? (
                    <span className="block min-w-0">
                        <span className="text-caption block font-bold tracking-[0.06em] text-neutral-500 uppercase">
                            Product details
                        </span>
                        <span className="mt-1.5 flex min-w-0 flex-wrap gap-1.5 text-xs leading-snug font-semibold text-neutral-800">
                            {quantity ? (
                                <span className="rounded-md bg-neutral-100 px-1.5 py-1">
                                    <span className="text-neutral-500">
                                        Size
                                    </span>{" "}
                                    {quantity}
                                </span>
                            ) : null}
                            {packaging ? (
                                <span className="rounded-md bg-neutral-100 px-1.5 py-1 wrap-anywhere">
                                    <span className="text-neutral-500">
                                        Pack
                                    </span>{" "}
                                    {packaging}
                                </span>
                            ) : null}
                            {labels.slice(0, 2).map((label) => (
                                <span
                                    className="bg-primary-50 text-primary-900 rounded-md px-1.5 py-1 wrap-anywhere"
                                    key={label}
                                >
                                    {label}
                                </span>
                            ))}
                            {labels.length > 2 ? (
                                <span className="px-1.5 py-1 text-neutral-500">
                                    +{labels.length - 2} labels
                                </span>
                            ) : null}
                        </span>
                    </span>
                ) : null}
            </span>

            <span className="col-span-2 col-start-2 row-start-3 min-w-0 text-xs leading-snug font-semibold text-neutral-700 md:col-span-1 md:col-start-4 md:row-start-1">
                {hasSourceDetails ? (
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                        {hasBrand && !brandIsPrimary ? (
                            <span className="min-w-0 wrap-anywhere">
                                <span className="font-bold text-neutral-500">
                                    Company
                                </span>{" "}
                                {brand}
                            </span>
                        ) : null}
                        {manufacturingPlace ? (
                            <span className="min-w-0 wrap-anywhere">
                                <span className="font-bold text-neutral-500">
                                    Made in
                                </span>{" "}
                                {manufacturingPlace}
                            </span>
                        ) : barcodeCountry ? (
                            <span className="min-w-0 wrap-anywhere">
                                <span className="font-bold text-neutral-500">
                                    Barcode country
                                </span>{" "}
                                {barcodeCountry}
                            </span>
                        ) : null}
                        {showBarcode ? (
                            <span className="font-mono tracking-[0.04em] wrap-anywhere text-neutral-500 tabular-nums">
                                <span className="font-sans font-bold tracking-normal text-neutral-500 uppercase">
                                    Barcode
                                </span>{" "}
                                {product.barcode}
                            </span>
                        ) : null}
                    </span>
                ) : null}
            </span>

            <ArrowRightIcon
                className="text-primary-700 col-start-3 row-start-1 shrink-0 self-start transition-transform duration-150 group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 motion-reduce:transition-none md:col-start-5 md:row-start-1 md:self-center"
                size={20}
                weight="bold"
                aria-hidden="true"
            />
        </Link>
    )
}
