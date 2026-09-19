import { Check, Copy, ZoomIn } from "lucide-react"
import React, { useState } from "react"

import { PackageImagePlaceholder } from "@/components/illustrations"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type {
    PackageMatchCandidateResponse,
    PackageMatchReferenceImageResponse,
} from "@/features/product/types"
import type { ProductProjection, TranslatableTextItem } from "@/api/generated"
import { translateConcernLabel } from "@/features/concerns/translations"
import { getBarcodeCountry } from "@/lib/barcode-country"
import { cn } from "@/lib/utils"
import type { ConcernMatch } from "@/features/concerns/matching"

import { TranslatedField } from "../TranslatedField"
import { getTranslatedFieldText } from "../translation-utils"
import { translateTaxonomyValue, useProductTranslation } from "../translations"

interface ProductHeroProps {
    candidate: PackageMatchCandidateResponse
    identifier: string
    genericName?: string | null
    projection?: ProductProjection | null
    categoryItems?: TranslatableTextItem[]
    headingRef?: React.Ref<HTMLHeadingElement>
    selectedConcernMatches?: ConcernMatch[]
}

export const ProductHero: React.FC<ProductHeroProps> = ({
    candidate,
    identifier,
    genericName,
    projection,
    categoryItems = [],
    headingRef,
    selectedConcernMatches = [],
}) => {
    const { locale, t } = useProductTranslation()
    const [selectedImageIndex, setSelectedImageIndex] = useState(0)
    const [isZoomOpen, setIsZoomOpen] = useState(false)
    const [isCopied, setIsCopied] = useState(false)
    const [imageFailed, setImageFailed] = useState(false)
    const identityEvidence = candidate.identity_evidence || []
    const labelEvidence = candidate.label_evidence || []
    const images = candidate.reference_images || []

    // Extract name: prefer English or first available name
    const nameItem =
        identityEvidence.find(
            (e) => e.field === "name" && (e.language === "en" || !e.language),
        ) || identityEvidence.find((e) => e.field === "name")
    const productName = (nameItem?.value as string) || t("unlabeledProduct")
    const displayProductName = projection
        ? getTranslatedFieldText(
              projection.identity.name,
              locale,
              productName,
          ) || t("sourceDataUnavailable")
        : productName
    const displayGenericName = projection
        ? getTranslatedFieldText(
              projection.identity.generic_name,
              locale,
              genericName,
          )
        : genericName
    const barcodeCountry = getBarcodeCountry(identifier)

    const getImageRoleLabel = (role?: string | null) => {
        switch (role) {
            case "front":
                return t("frontImage")
            case "ingredients":
                return t("ingredientsImage")
            case "nutrition":
                return t("nutritionImage")
            case "packaging":
                return t("packagingImage")
            default:
                return t("productImage")
        }
    }

    // Extract brand
    const brandItem = identityEvidence.find((e) => e.field === "brands")
    let brandName = ""
    if (brandItem?.value) {
        if (Array.isArray(brandItem.value)) {
            brandName = brandItem.value.filter(Boolean).join(", ")
        } else if (typeof brandItem.value === "string") {
            brandName = brandItem.value
        }
    }

    // Extract quantity
    const quantityItem = identityEvidence.find((e) => e.field === "quantity")
    const quantity =
        typeof quantityItem?.value === "string"
            ? quantityItem.value.trim() || null
            : typeof quantityItem?.value === "number"
              ? String(quantityItem.value)
              : null

    // Deduplicate and prioritize images (Front, Ingredients, Nutrition)
    const sortedImages = [...images].sort((a, b) => {
        const roleOrder: Record<string, number> = {
            front: 1,
            ingredients: 2,
            nutrition: 3,
            packaging: 4,
        }
        return (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99)
    })

    // Filter unique URLs
    const uniqueImages: PackageMatchReferenceImageResponse[] = []
    const seenUrls = new Set<string>()
    for (const img of sortedImages) {
        if (!seenUrls.has(img.url)) {
            seenUrls.add(img.url)
            uniqueImages.push(img)
        }
    }

    const currentImage = uniqueImages[selectedImageIndex] || uniqueImages[0]
    const canZoomImage = Boolean(currentImage && !imageFailed)

    // Summary counts for quick stats bar
    const additivesItem = labelEvidence.find((e) => e.field === "additive_tags")
    const additivesCount = Array.isArray(additivesItem?.value)
        ? additivesItem.value.length
        : 0
    const halalClaimItem = labelEvidence.find(
        (e) => e.field === "halal_label_claim",
    )
    const hasHalalClaim = Array.isArray(halalClaimItem?.value)
        ? halalClaimItem.value.length > 0
        : typeof halalClaimItem?.value === "string"
          ? halalClaimItem.value.trim().length > 0
          : Boolean(halalClaimItem?.value)
    const hasLabelHighlights = additivesCount > 0 || hasHalalClaim
    const matchedConcernLabels = [
        ...new Set(
            selectedConcernMatches
                .filter((match) => match.hasCompactMatch)
                .map((match) =>
                    translateConcernLabel(
                        locale,
                        match.concernId,
                        match.concernLabel,
                    ),
                ),
        ),
    ]

    const handleCopyBarcode = () => {
        void navigator.clipboard.writeText(identifier)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
    }

    return (
        <div
            data-glass-surface=""
            className="glass-surface overflow-hidden rounded-2xl p-3 sm:p-6"
        >
            <div className="grid items-start gap-6">
                {/* Product Image Viewer */}
                <div className="mx-auto flex w-full max-w-[18rem] min-w-0 flex-col items-center">
                    <div
                        className={cn(
                            "group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-neutral-200/80 bg-neutral-50",
                            canZoomImage
                                ? "focus-visible:ring-primary-500 cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                                : "",
                        )}
                        role={canZoomImage ? "button" : undefined}
                        tabIndex={canZoomImage ? 0 : undefined}
                        aria-label={
                            canZoomImage
                                ? t("viewProductImage", {
                                      name: displayProductName,
                                      role: getImageRoleLabel(
                                          currentImage?.role,
                                      ),
                                  })
                                : undefined
                        }
                        onClick={() => canZoomImage && setIsZoomOpen(true)}
                        onKeyDown={(event) => {
                            if (
                                canZoomImage &&
                                (event.key === "Enter" || event.key === " ")
                            ) {
                                event.preventDefault()
                                setIsZoomOpen(true)
                            }
                        }}
                    >
                        {currentImage && !imageFailed ? (
                            <>
                                <img
                                    src={currentImage.url}
                                    alt={displayProductName}
                                    className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-[1.02]"
                                    onError={() => setImageFailed(true)}
                                />
                                <div className="absolute right-3 bottom-3 rounded-lg bg-neutral-950/75 p-2 text-white/90 opacity-0 shadow-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                                    <ZoomIn className="h-4 w-4" />
                                </div>
                                <div className="absolute top-3 left-3">
                                    <Badge
                                        variant="subtle"
                                        className="text-micro border-neutral-200/80 bg-white/95 font-semibold tracking-wider text-neutral-800 uppercase shadow-sm backdrop-blur-xs"
                                    >
                                        {getImageRoleLabel(currentImage.role)}
                                    </Badge>
                                </div>
                            </>
                        ) : (
                            <PackageImagePlaceholder
                                label={t("sourceImageUnavailable")}
                            />
                        )}
                    </div>

                    {/* Thumbnail list if multiple images */}
                    {uniqueImages.length > 1 && (
                        <div className="no-scrollbar -m-1 mt-3 flex max-w-full items-center gap-2 overflow-x-auto p-1">
                            {uniqueImages.map((img, idx) => {
                                const isSelected = selectedImageIndex === idx
                                return (
                                    <Button
                                        key={img.url + idx}
                                        variant="ghost"
                                        size="icon"
                                        type="button"
                                        aria-label={t("selectProductImage", {
                                            role: getImageRoleLabel(img.role),
                                        })}
                                        aria-pressed={isSelected}
                                        onClick={() => {
                                            setSelectedImageIndex(idx)
                                            setImageFailed(false)
                                        }}
                                        className={`focus-visible:ring-primary-500 relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-xl border transition-all duration-150 focus-visible:ring-2 focus-visible:outline-none ${
                                            isSelected
                                                ? "border-primary-600 ring-primary-500/30 shadow-xs ring-2"
                                                : "border-neutral-200/90 opacity-65 hover:border-neutral-300 hover:opacity-100"
                                        }`}
                                    >
                                        <img
                                            src={img.url}
                                            alt=""
                                            className="h-full w-full bg-neutral-50 object-contain p-0.5"
                                        />
                                    </Button>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Product Details Header */}
                <div className="w-full min-w-0 space-y-4">
                    <h1
                        ref={headingRef}
                        tabIndex={-1}
                        className="text-display-product max-w-[18ch] leading-[1.12] font-extrabold tracking-[-0.03em] text-balance wrap-anywhere text-neutral-950 focus:outline-none"
                    >
                        {projection ? (
                            <TranslatedField
                                field={projection.identity.name}
                                fallback={productName}
                                textClassName="text-display-product leading-[1.12] font-extrabold tracking-[-0.03em] text-balance"
                            />
                        ) : (
                            displayProductName
                        )}
                    </h1>

                    {matchedConcernLabels.length > 0 && (
                        <div
                            role="status"
                            aria-label={`${t("selectedAllergensFound")}: ${matchedConcernLabels.join(", ")}`}
                            className="border-warning-200 bg-warning-50 text-warning-950 rounded-xl border p-3 text-sm font-semibold"
                        >
                            <p className="text-caption mb-1 font-medium">
                                {t("selectedAllergensFound")}
                            </p>
                            <p>{matchedConcernLabels.join(", ")}</p>
                        </div>
                    )}

                    {displayGenericName && (
                        <TranslatedField
                            field={projection?.identity.generic_name}
                            fallback={displayGenericName}
                            className="max-w-prose text-sm leading-relaxed font-medium text-neutral-600 italic"
                        />
                    )}

                    {categoryItems.length > 0 && (
                        <div className="min-w-0 space-y-2">
                            <span className="text-caption block font-bold tracking-[0.08em] text-neutral-500 uppercase">
                                {t("categories")}
                            </span>
                            <div className="flex min-w-0 flex-wrap gap-2">
                                {categoryItems.map((item) => (
                                    <div
                                        key={item.key}
                                        className="max-w-full min-w-0 rounded-xl border border-neutral-200/80 bg-neutral-50 px-2.5 py-2"
                                    >
                                        <TranslatedField
                                            field={item}
                                            textClassName="text-xs font-semibold text-neutral-800"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {brandName && (
                        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-neutral-600">
                            <span className="text-caption font-bold tracking-[0.08em] text-neutral-500 uppercase">
                                {t("brand")}
                            </span>
                            <span className="font-bold text-neutral-950">
                                {brandName}
                            </span>
                        </p>
                    )}

                    {/* Quick Factual Summary Divider Rows (Neutral) */}
                    <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200/80 bg-white p-2 text-xs">
                        <div className="grid min-h-12 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 py-1">
                            <span className="text-caption min-w-0 font-bold tracking-[0.06em] text-neutral-500 uppercase">
                                {t("barcode")}
                            </span>
                            <Button
                                variant="ghost"
                                appearance="glass"
                                glassTone="neutral"
                                size="sm"
                                type="button"
                                onClick={handleCopyBarcode}
                                aria-label={
                                    isCopied
                                        ? t("barcodeCopied")
                                        : t("copyBarcode")
                                }
                                className="focus-visible:ring-primary-500 inline-flex h-auto min-h-11 w-full min-w-0 cursor-pointer items-center justify-end gap-2 rounded-full px-1.5 py-0.5 text-right font-mono text-xs font-semibold tracking-[0.04em] whitespace-normal text-neutral-900 tabular-nums transition-colors focus-visible:ring-2 sm:text-sm"
                                title={t("copyBarcodeTitle")}
                            >
                                <span className="min-w-0 wrap-anywhere">
                                    {identifier}
                                </span>
                                {isCopied ? (
                                    <Check className="text-primary-700 h-3 w-3 shrink-0" />
                                ) : (
                                    <Copy className="h-3 w-3 shrink-0 text-neutral-500" />
                                )}
                            </Button>
                        </div>

                        <div className="grid min-h-12 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 py-1">
                            <span className="text-caption min-w-0 font-bold tracking-[0.06em] text-neutral-500 uppercase">
                                {t("quantity")}
                            </span>
                            <span className="min-w-0 text-right font-mono text-xs font-semibold text-neutral-900 tabular-nums sm:text-sm">
                                {quantity || t("sourceDataUnavailable")}
                            </span>
                        </div>

                        <div className="grid min-h-12 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 py-1">
                            <span className="text-caption min-w-0 font-bold tracking-[0.06em] text-neutral-500 uppercase">
                                {t("barcodeCountry")}
                            </span>
                            <span className="min-w-0 text-right text-xs font-semibold wrap-anywhere text-neutral-900 sm:text-sm">
                                {barcodeCountry
                                    ? translateTaxonomyValue(
                                          locale,
                                          barcodeCountry,
                                      )
                                    : t("sourceDataUnavailable")}
                            </span>
                        </div>
                    </div>

                    {hasLabelHighlights && (
                        <div
                            aria-label={t("productLabelHighlights")}
                            className="grid grid-cols-[6rem_minmax(0,1fr)] items-start justify-end gap-3 pt-4"
                        >
                            <span className="text-caption min-w-0 pt-1 font-bold tracking-[0.06em] text-neutral-500 uppercase">
                                {t("onTheLabel")}
                            </span>
                            <div className="flex min-w-0 flex-wrap justify-end gap-2">
                                {hasHalalClaim && (
                                    <Badge
                                        variant="outline"
                                        className="border-info-200 bg-info-50 text-info-800 text-sm font-semibold"
                                    >
                                        {t("halal")}
                                    </Badge>
                                )}

                                {additivesCount > 0 && (
                                    <Badge
                                        variant="outline"
                                        className="border-info-200 bg-info-50 text-info-800 text-sm font-semibold"
                                    >
                                        {t("additive")}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Image Zoom Dialog */}
            {currentImage && (
                <Dialog open={isZoomOpen} onOpenChange={setIsZoomOpen}>
                    <DialogContent
                        closeLabel={t("close")}
                        closeClassName="size-12"
                        className="max-w-2xl border-neutral-800 bg-neutral-950 p-4 text-white"
                    >
                        <DialogTitle className="text-sm font-semibold text-neutral-200">
                            {displayProductName} —{" "}
                            {getImageRoleLabel(currentImage.role)}
                        </DialogTitle>
                        <div className="relative flex aspect-square w-full items-center justify-center p-2 sm:aspect-[4/3]">
                            <img
                                src={currentImage.url}
                                alt={displayProductName}
                                className="max-h-full max-w-full rounded-xl object-contain"
                            />
                        </div>
                        {currentImage.attribution && (
                            <p className="text-caption text-center text-neutral-600">
                                {t("photoAttribution")}:{" "}
                                {currentImage.attribution} (
                                {currentImage.license_name || "CC BY-SA"})
                            </p>
                        )}
                    </DialogContent>
                </Dialog>
            )}
        </div>
    )
}
