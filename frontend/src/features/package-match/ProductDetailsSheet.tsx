import {
    BarcodeIcon,
    FactoryIcon,
    ForkKnifeIcon,
    ImageSquareIcon,
    InfoIcon,
    LeafIcon,
    XIcon,
} from "@phosphor-icons/react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"

type ProductDetailsSheetData = {
    name?: string
    brand?: string
    origin?: string
    category?: string
    quantity?: string
    ingredients?: string
    allergens?: string
    manufacturer?: string
    energy?: string
    protein?: string
    fat?: string
    carbohydrates?: string
    sugars?: string
}

export type ProductDetailsSheetProps = {
    identifier: string
    open: boolean
    onClose: () => void
    placeholderData?: ProductDetailsSheetData
}

const unavailable = "—"

export function ProductDetailsSheet({
    identifier,
    open,
    onClose,
    placeholderData,
}: ProductDetailsSheetProps) {
    const { t } = useTranslation()
    const data = placeholderData ?? {}
    const display = (value?: string) => value?.trim() || unavailable

    return (
        <Sheet
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) onClose()
            }}
        >
            <SheetContent
                aria-describedby="product-details-description"
                aria-labelledby="product-details-title"
                className="gap-0"
            >
                <SheetHeader>
                    <SheetTitle id="product-details-title">
                        {t("productDetailsTitle")}
                    </SheetTitle>
                    <SheetDescription id="product-details-description">
                        {t("productDetailsDescription")}
                    </SheetDescription>
                    <SheetClose asChild>
                        <Button
                            className="text-foreground absolute top-3 right-3"
                            variant="ghost"
                            size="icon"
                            aria-label={t("productDetailsClose")}
                        >
                            <XIcon aria-hidden="true" size={22} />
                        </Button>
                    </SheetClose>
                </SheetHeader>

                <div
                    className="min-h-0 overflow-y-auto overscroll-contain px-[max(1rem,env(safe-area-inset-left))] pt-5 pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(2rem_+_env(safe-area-inset-bottom))]"
                    aria-label={t("productDetailsScrollRegion")}
                    tabIndex={0}
                >
                    <section
                        className="grid grid-cols-[6.25rem_minmax(0,1fr)] items-start gap-4 pb-5 max-[23.5rem]:grid-cols-[5.8rem_minmax(0,1fr)] max-[23.5rem]:gap-3"
                        aria-label={t("productDetailsIdentity")}
                    >
                        <div
                            className="border-border bg-coconut-brown-soft text-coconut-brown grid aspect-[4/5] content-center justify-items-center gap-2 rounded-2xl border p-3 text-center text-xs leading-relaxed"
                            role="img"
                            aria-label={t("productDetailsImageAlt")}
                        >
                            <ImageSquareIcon
                                aria-hidden="true"
                                size={40}
                                weight="light"
                            />
                            <span>{t("productDetailsImagePlaceholder")}</span>
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-2xl leading-snug font-semibold wrap-anywhere">
                                {display(data.name)}
                            </h3>
                            <div
                                className="mt-3 flex flex-wrap gap-2"
                                aria-label={t("productDetailsTags")}
                            >
                                <Badge>{display(data.category)}</Badge>
                                <Badge>{display(data.quantity)}</Badge>
                            </div>
                            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                                {t("productDetailsPlaceholderNote")}
                            </p>
                        </div>
                    </section>

                    <SheetPanel
                        icon={<InfoIcon aria-hidden="true" size={20} />}
                        title={t("productDetailsInformation")}
                    >
                        <dl className="grid grid-cols-2 gap-3">
                            <FactRow
                                label={t("productDetailsBrand")}
                                value={display(data.brand)}
                            />
                            <FactRow
                                label={t("productDetailsOrigin")}
                                value={display(data.origin)}
                            />
                            <FactRow
                                label={t("productDetailsBarcode")}
                                value={display(identifier)}
                            />
                            <FactRow
                                label={t("productDetailsCategory")}
                                value={display(data.category)}
                            />
                        </dl>
                    </SheetPanel>

                    <SheetPanel
                        icon={<ForkKnifeIcon aria-hidden="true" size={20} />}
                        title={t("productDetailsNutrition")}
                        trailing={t("productDetailsPer100")}
                    >
                        <dl className="grid gap-2">
                            <FactRow
                                label={t("productDetailsEnergy")}
                                value={display(data.energy)}
                            />
                            <FactRow
                                label={t("productDetailsProtein")}
                                value={display(data.protein)}
                            />
                            <FactRow
                                label={t("productDetailsFat")}
                                value={display(data.fat)}
                            />
                            <FactRow
                                label={t("productDetailsCarbohydrates")}
                                value={display(data.carbohydrates)}
                            />
                            <FactRow
                                label={t("productDetailsSugars")}
                                value={display(data.sugars)}
                            />
                        </dl>
                    </SheetPanel>

                    <SheetPanel
                        icon={<LeafIcon aria-hidden="true" size={20} />}
                        title={t("productDetailsIngredients")}
                    >
                        <p className="min-h-6 leading-relaxed whitespace-pre-wrap">
                            {display(data.ingredients)}
                        </p>
                    </SheetPanel>
                    <SheetPanel
                        icon={<InfoIcon aria-hidden="true" size={20} />}
                        title={t("productDetailsAllergens")}
                    >
                        <p className="min-h-6 leading-relaxed whitespace-pre-wrap">
                            {display(data.allergens)}
                        </p>
                    </SheetPanel>
                    <SheetPanel
                        icon={<FactoryIcon aria-hidden="true" size={20} />}
                        title={t("productDetailsManufacturer")}
                    >
                        <p className="min-h-6 leading-relaxed whitespace-pre-wrap">
                            {display(data.manufacturer)}
                        </p>
                    </SheetPanel>

                    <p className="text-muted-foreground mt-4 flex items-start gap-2 py-1 text-sm leading-relaxed">
                        <BarcodeIcon
                            aria-hidden="true"
                            className="text-primary mt-1 shrink-0"
                            size={18}
                        />
                        <span>{t("productDetailsSourceNotice")}</span>
                    </p>
                </div>
            </SheetContent>
        </Sheet>
    )
}

function SheetPanel({
    children,
    icon,
    title,
    trailing,
}: {
    children: React.ReactNode
    icon: React.ReactNode
    title: string
    trailing?: string
}) {
    return (
        <section className="bg-muted/60 mt-3 rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="text-primary shrink-0">{icon}</span>
                    <h3 className="text-base leading-snug font-semibold">
                        {title}
                    </h3>
                </div>
                {trailing ? (
                    <span className="text-muted-foreground shrink-0 text-xs leading-relaxed">
                        {trailing}
                    </span>
                ) : null}
            </div>
            {children}
        </section>
    )
}

function FactRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <dt className="text-muted-foreground text-xs leading-relaxed">
                {label}
            </dt>
            <dd className="mt-1 text-sm leading-relaxed wrap-anywhere">
                {value}
            </dd>
        </div>
    )
}
