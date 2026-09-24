import { ArrowRight, Barcode } from "@phosphor-icons/react"

import { GlassButton as Button } from "@/components/ui/button"

import { useLabelReadingTranslation } from "./translations"

export interface ProductPageOfferProps {
    barcode: string
    onOpen: () => void
    onDismiss: () => void
}

/**
 * Offered when a Barcode decoded on the device from a label photo has a Source
 * Record (SPEC section 29.2). Opening the Product page discards the photos.
 */
export function ProductPageOffer({
    barcode,
    onOpen,
    onDismiss,
}: ProductPageOfferProps) {
    const { t } = useLabelReadingTranslation()
    return (
        <section
            aria-labelledby="product-page-offer-title"
            data-testid="product-page-offer"
            className="border-primary-200 bg-primary-50/70 mt-4 rounded-2xl border p-4"
        >
            <div className="flex items-start gap-3">
                <span className="bg-primary-100 text-primary-800 grid size-9 shrink-0 place-items-center rounded-xl">
                    <Barcode size={19} weight="bold" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <h2
                        id="product-page-offer-title"
                        className="text-sm font-extrabold text-neutral-950"
                    >
                        {t("offerTitle")}
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-700 sm:text-sm">
                        {t("offerBody", { barcode })}
                    </p>
                </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 sm:pl-12">
                <Button
                    type="button"
                    onClick={onOpen}
                    className="bg-primary-600 hover:bg-primary-700 h-11 gap-1.5 rounded-xl px-4 text-sm font-extrabold text-white"
                >
                    <span>{t("openProductPage")}</span>
                    <ArrowRight size={16} weight="bold" aria-hidden="true" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onDismiss}
                    className="h-11 rounded-xl px-4 text-sm font-bold text-neutral-700 hover:bg-white/70"
                >
                    {t("keepReadingLabel")}
                </Button>
            </div>
        </section>
    )
}
