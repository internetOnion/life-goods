import { useState } from "react"
import { ArrowRightIcon, PackageIcon } from "@phosphor-icons/react"
import { Link } from "react-router"

import { buildProxiedImageUrl } from "@/lib/image"
import { useSearchTranslation } from "./translations"

export type ProductListItemData = {
    barcode: string
    name?: string | null
    genericName?: string | null
    brand?: string | null
    thumbnail?: { url: string } | null
}

type ProductListItemProps = {
    product: ProductListItemData
    to: string
    state?: unknown
}

function clean(value?: string | null) {
    const trimmed = value?.trim()
    return trimmed && trimmed !== "Unlabeled Product" ? trimmed : null
}

export function ProductListItem({ product, to, state }: ProductListItemProps) {
    const { t } = useSearchTranslation()
    const [imageFailed, setImageFailed] = useState(false)
    const name = clean(product.name)
    const genericName = clean(product.genericName)
    const brand = clean(product.brand)
    const primaryValue =
        name || genericName || brand || t("sourceDataUnavailable")
    const ariaLabel = name
        ? t("viewNamedProduct", { name })
        : genericName
          ? t("viewNamedProductWithBarcode", {
                name: genericName,
                barcode: product.barcode,
            })
          : brand
            ? t("viewNamedProductWithBarcode", {
                  name: brand,
                  barcode: product.barcode,
              })
            : t("viewProduct", { barcode: product.barcode })

    return (
        <Link
            to={to}
            state={state}
            className="group focus-visible:ring-primary-500 grid min-h-20 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2.5 py-2 text-left no-underline transition-[background-color,box-shadow] duration-150 hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset active:bg-neutral-100 motion-reduce:transition-none sm:px-3"
            aria-label={ariaLabel}
        >
            <span className="bg-primary-50 text-primary-700 ring-primary-200 flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-inset">
                {product.thumbnail?.url && !imageFailed ? (
                    <img
                        src={buildProxiedImageUrl(product.thumbnail.url)}
                        alt=""
                        loading="lazy"
                        className="size-full object-contain"
                        onError={() => setImageFailed(true)}
                    />
                ) : (
                    <span
                        className="flex size-full items-center justify-center"
                        aria-hidden="true"
                        title={t("imageUnavailable")}
                    >
                        <PackageIcon
                            size={24}
                            weight="duotone"
                            aria-hidden="true"
                        />
                    </span>
                )}
            </span>

            <span className="min-w-0">
                <h3 className="type-supporting min-w-0 truncate font-semibold text-neutral-950">
                    {primaryValue}
                </h3>
                {name && genericName ? (
                    <span className="type-caption mt-0.5 block min-w-0 truncate text-neutral-600">
                        <span className="font-semibold text-neutral-500">
                            {t("productType")}
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
