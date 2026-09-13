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
import { cn } from "@/lib/utils"

interface ProductHeroProps {
    candidate: PackageMatchCandidateResponse
    identifier: string
    genericName?: string | null
    manufacturingPlace?: string | null
    headingRef?: React.Ref<HTMLHeadingElement>
}

export const ProductHero: React.FC<ProductHeroProps> = ({
    candidate,
    identifier,
    genericName,
    manufacturingPlace,
    headingRef,
}) => {
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
    const productName = (nameItem?.value as string) || "Unlabeled Product"

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

    const handleCopyBarcode = () => {
        void navigator.clipboard.writeText(identifier)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
    }

    return (
        <div className="shadow-source-sheet overflow-hidden rounded-2xl border border-neutral-200/90 bg-white p-3 sm:p-6">
            <div className="grid items-start gap-6 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-6">
                {/* Product Image Viewer */}
                <div className="flex w-full min-w-0 flex-col items-center sm:w-auto">
                    <div
                        className={cn(
                            "group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-neutral-200/80 bg-neutral-50/80",
                            canZoomImage
                                ? "focus-visible:ring-primary-500 cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                                : "",
                        )}
                        role={canZoomImage ? "button" : undefined}
                        tabIndex={canZoomImage ? 0 : undefined}
                        aria-label={
                            canZoomImage
                                ? `View ${productName} ${currentImage?.role || "product"} image`
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
                                    alt={productName}
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
                                        {currentImage.role}
                                    </Badge>
                                </div>
                            </>
                        ) : (
                            <PackageImagePlaceholder />
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
                                        aria-label={`Select ${img.role} product image`}
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
                <div className="w-full min-w-0 space-y-4 sm:pt-1">
                    <h1
                        ref={headingRef}
                        tabIndex={-1}
                        className="text-display-product max-w-[18ch] leading-[1.12] font-extrabold tracking-[-0.03em] text-balance wrap-anywhere text-neutral-950 focus:outline-none"
                    >
                        {productName}
                    </h1>

                    {genericName && (
                        <p className="max-w-prose text-sm leading-relaxed font-medium text-neutral-600 italic">
                            {genericName}
                        </p>
                    )}

                    {brandName && (
                        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-neutral-600">
                            <span className="text-caption font-bold tracking-[0.08em] text-neutral-500 uppercase">
                                Brand
                            </span>
                            <span className="font-bold text-neutral-950">
                                {brandName}
                            </span>
                        </p>
                    )}

                    {/* Quick Factual Summary Divider Rows (Neutral) */}
                    <div className="divide-y divide-neutral-100 border-t border-b border-neutral-200/80 text-xs">
                        <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3 py-3">
                            <span className="text-caption min-w-0 font-bold tracking-[0.06em] text-neutral-500 uppercase">
                                Barcode
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                onClick={handleCopyBarcode}
                                aria-label={
                                    isCopied ? "Barcode copied" : "Copy barcode"
                                }
                                className="focus-visible:ring-primary-500 inline-flex h-auto min-h-8 w-full min-w-0 cursor-pointer items-center justify-end gap-1.5 rounded-md px-1.5 py-1 text-right font-mono text-xs font-semibold tracking-[0.04em] text-neutral-900 tabular-nums transition-colors hover:bg-neutral-100 focus-visible:ring-2 sm:text-sm"
                                title="Copy Barcode"
                            >
                                <span className="min-w-0 wrap-anywhere">
                                    {identifier}
                                </span>
                                {isCopied ? (
                                    <Check className="text-primary-700 h-3 w-3 shrink-0" />
                                ) : (
                                    <Copy className="h-3 w-3 shrink-0 text-neutral-400" />
                                )}
                            </Button>
                        </div>

                        <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3 py-3">
                            <span className="text-caption min-w-0 font-bold tracking-[0.06em] text-neutral-500 uppercase">
                                Quantity
                            </span>
                            <span className="min-w-0 text-right font-mono text-xs font-semibold text-neutral-900 tabular-nums sm:text-sm">
                                {quantity || "N/A"}
                            </span>
                        </div>

                        <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3 py-3">
                            <span className="text-caption min-w-0 font-bold tracking-[0.06em] text-neutral-500 uppercase">
                                Made in
                            </span>
                            <span className="min-w-0 text-right text-xs font-semibold wrap-anywhere text-neutral-900 sm:text-sm">
                                {manufacturingPlace?.trim() || "N/A"}
                            </span>
                        </div>
                    </div>

                    {hasLabelHighlights && (
                        <div
                            aria-label="Product label highlights"
                            className="grid grid-cols-[6rem_minmax(0,1fr)] items-start justify-end gap-3 border-t border-neutral-100 pt-4"
                        >
                            <span className="text-caption min-w-0 pt-1 font-bold tracking-[0.06em] text-neutral-500 uppercase">
                                On the label
                            </span>
                            <div className="flex min-w-0 flex-wrap justify-end gap-2">
                                {hasHalalClaim && (
                                    <span className="border-info-200 bg-info-50 text-info-800 rounded-full border px-3 py-1 text-sm font-semibold">
                                        Halal
                                    </span>
                                )}

                                {additivesCount > 0 && (
                                    <span className="border-info-200 bg-info-50 text-info-800 rounded-full border px-3 py-1 text-sm font-semibold">
                                        Additive
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Image Zoom Dialog */}
            {currentImage && (
                <Dialog open={isZoomOpen} onOpenChange={setIsZoomOpen}>
                    <DialogContent className="max-w-2xl border-neutral-800 bg-neutral-950 p-4 text-white">
                        <DialogTitle className="text-sm font-semibold text-neutral-200">
                            {productName} — {currentImage.role.toUpperCase()}
                        </DialogTitle>
                        <div className="relative flex aspect-square w-full items-center justify-center p-2 sm:aspect-[4/3]">
                            <img
                                src={currentImage.url}
                                alt={productName}
                                className="max-h-full max-w-full rounded-xl object-contain"
                            />
                        </div>
                        {currentImage.attribution && (
                            <p className="text-caption text-center text-neutral-400">
                                Photo attribution: {currentImage.attribution} (
                                {currentImage.license_name || "CC BY-SA"})
                            </p>
                        )}
                    </DialogContent>
                </Dialog>
            )}
        </div>
    )
}
