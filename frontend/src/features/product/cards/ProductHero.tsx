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
    scheme?: string
    genericName?: string | null
    categories?: string[]
    headingRef?: React.Ref<HTMLHeadingElement>
}

export const ProductHero: React.FC<ProductHeroProps> = ({
    candidate,
    identifier,
    scheme,
    genericName,
    categories,
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
            ? quantityItem.value
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

    // Summary counts for quick stats bar
    const allergensDetected =
        candidate.allergen_assessment?.findings?.length || 0
    const halalOutcome =
        candidate.halal_ingredient_assessment?.outcome || "NOT_ASSESSED"
    const additivesItem = labelEvidence.find((e) => e.field === "additive_tags")
    const additivesCount = Array.isArray(additivesItem?.value)
        ? additivesItem.value.length
        : 0

    const handleCopyBarcode = () => {
        void navigator.clipboard.writeText(identifier)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
    }

    return (
        <div className="shadow-source-sheet space-y-5 rounded-none border border-neutral-200/90 bg-white p-5 sm:rounded-sm sm:p-6">
            <div className="flex flex-col items-start gap-5 sm:flex-row">
                {/* Product Image Viewer */}
                <div className="flex w-full shrink-0 flex-col items-center sm:w-44">
                    <div
                        className={cn(
                            "group relative flex aspect-4/3 max-h-52 w-full items-center justify-center overflow-hidden rounded-xl border border-neutral-200/80 bg-neutral-100/60 sm:aspect-square sm:max-h-none sm:w-44",
                            currentImage && !imageFailed
                                ? "cursor-pointer"
                                : "",
                        )}
                        onClick={() =>
                            currentImage && !imageFailed && setIsZoomOpen(true)
                        }
                    >
                        {currentImage && !imageFailed ? (
                            <>
                                <img
                                    src={currentImage.url}
                                    alt={productName}
                                    className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                                    onError={() => setImageFailed(true)}
                                />
                                <div className="absolute right-2 bottom-2 rounded-lg bg-black/60 p-1.5 text-white/90 opacity-0 transition-opacity group-hover:opacity-100">
                                    <ZoomIn className="h-4 w-4" />
                                </div>
                                <div className="absolute top-2 left-2">
                                    <Badge
                                        variant="subtle"
                                        className="bg-white/95 text-[10px] font-semibold tracking-wider text-neutral-800 uppercase shadow-2xs backdrop-blur-xs"
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
                        <div className="no-scrollbar -m-1 mt-2 flex max-w-full items-center gap-2 overflow-x-auto p-1">
                            {uniqueImages.map((img, idx) => {
                                const isSelected = selectedImageIndex === idx
                                return (
                                    <Button
                                        key={img.url + idx}
                                        variant="ghost"
                                        size="icon"
                                        type="button"
                                        aria-label={`Select product image ${idx + 1}`}
                                        aria-pressed={isSelected}
                                        onClick={() => {
                                            setSelectedImageIndex(idx)
                                            setImageFailed(false)
                                        }}
                                        className={`focus-visible:ring-primary-500 relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border transition-all duration-150 focus-visible:ring-2 focus-visible:outline-none sm:h-11 sm:w-11 sm:rounded-xl ${
                                            isSelected
                                                ? "border-primary-600 ring-primary-500/30 shadow-xs ring-2"
                                                : "border-neutral-200/90 opacity-60 hover:border-neutral-300 hover:opacity-100"
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
                <div className="min-w-0 flex-1 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                        {scheme && (
                            <Badge
                                variant="secondary"
                                className="font-mono text-[11px] font-semibold tracking-wider uppercase"
                            >
                                {scheme}
                            </Badge>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={handleCopyBarcode}
                            className="focus-visible:ring-primary-500 inline-flex h-auto cursor-pointer items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 font-mono text-xs font-semibold tracking-[0.04em] text-neutral-700 tabular-nums transition-colors hover:bg-neutral-200 hover:text-neutral-950 focus-visible:ring-2"
                            title="Click to copy barcode"
                        >
                            <span>{identifier}</span>
                            {isCopied ? (
                                <Check className="text-primary-700 h-3 w-3" />
                            ) : (
                                <Copy className="h-3 w-3 text-neutral-400" />
                            )}
                        </Button>
                        {quantity && (
                            <Badge
                                variant="outline"
                                className="font-mono text-xs font-medium text-neutral-700 tabular-nums"
                            >
                                {quantity}
                            </Badge>
                        )}
                    </div>

                    <h1
                        ref={headingRef}
                        tabIndex={-1}
                        className="text-[clamp(1.75rem,6vw,2.5rem)] leading-[1.12] font-extrabold tracking-[-0.03em] text-balance wrap-anywhere text-neutral-950 focus:outline-none"
                    >
                        {productName}
                    </h1>

                    {genericName && (
                        <p className="text-xs leading-relaxed font-medium text-neutral-600 italic sm:text-sm">
                            {genericName}
                        </p>
                    )}

                    {brandName && (
                        <p className="text-sm font-normal text-neutral-600">
                            Brand:{" "}
                            <span className="font-bold text-neutral-950">
                                {brandName}
                            </span>
                        </p>
                    )}

                    {categories && categories.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {categories.slice(0, 3).map((c, i) => (
                                <Badge
                                    key={i}
                                    variant="outline"
                                    className="bg-neutral-50 text-xs font-medium text-neutral-700 capitalize"
                                >
                                    {c}
                                </Badge>
                            ))}
                            {categories.length > 3 && (
                                <span className="font-mono text-xs font-medium text-neutral-400 tabular-nums">
                                    +{categories.length - 3} more
                                </span>
                            )}
                        </div>
                    )}

                    {/* Quick Factual Summary Divider Rows (Neutral) */}
                    <div className="divide-y divide-neutral-100 border-t border-b border-neutral-100 py-0.5 text-xs">
                        <div className="flex items-center justify-between py-2">
                            <span className="text-[11px] font-bold tracking-[0.06em] text-neutral-500 uppercase">
                                Allergen Findings
                            </span>
                            <span className="text-xs font-semibold text-neutral-900 sm:text-sm">
                                {allergensDetected > 0
                                    ? `${allergensDetected} detected`
                                    : "None declared"}
                            </span>
                        </div>

                        <div className="flex items-center justify-between py-2">
                            <span className="text-[11px] font-bold tracking-[0.06em] text-neutral-500 uppercase">
                                Additives (E-Nums)
                            </span>
                            <span className="text-xs font-semibold text-neutral-900 sm:text-sm">
                                {additivesCount > 0
                                    ? `${additivesCount} listed`
                                    : "0 listed"}
                            </span>
                        </div>

                        <div className="flex items-center justify-between py-2">
                            <span className="text-[11px] font-bold tracking-[0.06em] text-neutral-500 uppercase">
                                Halal Status
                            </span>
                            <span className="max-w-[240px] truncate text-xs font-semibold text-neutral-800 sm:text-sm">
                                {halalOutcome.replace(/_/g, " ")}
                            </span>
                        </div>
                    </div>
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
                            <p className="text-center text-[11px] text-neutral-400">
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
