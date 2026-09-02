import { Check, Copy, Package, ZoomIn } from "lucide-react"
import React, { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type {
    PackageMatchCandidateResponse,
    PackageMatchReferenceImageResponse,
} from "@/features/product/types"

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
                        className={`group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-neutral-200/80 bg-neutral-100/60 sm:w-44 ${
                            currentImage && !imageFailed ? "cursor-pointer" : ""
                        }`}
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
                            <div className="flex flex-col items-center justify-center p-4 text-neutral-400">
                                <Package className="h-10 w-10 stroke-[1.5]" />
                                <span className="mt-1 text-[11px] font-medium">
                                    No Image
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Thumbnail list if multiple images */}
                    {uniqueImages.length > 1 && (
                        <div className="mt-2.5 flex max-w-full gap-1.5 overflow-x-auto pb-1">
                            {uniqueImages.map((img, idx) => (
                                <Button
                                    key={img.url + idx}
                                    variant="ghost"
                                    size="icon"
                                    type="button"
                                    onClick={() => {
                                        setSelectedImageIndex(idx)
                                        setImageFailed(false)
                                    }}
                                    className={`h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-lg border p-0 transition-all ${
                                        selectedImageIndex === idx
                                            ? "border-primary-600 ring-primary-500/25 ring-2"
                                            : "border-neutral-200 opacity-60 hover:opacity-100"
                                    }`}
                                >
                                    <img
                                        src={img.url}
                                        alt=""
                                        className="h-full w-full bg-neutral-50 object-contain p-0.5"
                                    />
                                </Button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Product Details Header */}
                <div className="min-w-0 flex-1 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                        {scheme && (
                            <Badge
                                variant="secondary"
                                className="font-mono text-[11px]"
                            >
                                {scheme}
                            </Badge>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={handleCopyBarcode}
                            className="focus-visible:ring-primary-500 inline-flex h-auto cursor-pointer items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 font-mono text-[11px] tracking-[0.04em] text-neutral-600 tabular-nums transition-colors hover:bg-neutral-200 hover:text-neutral-950 focus-visible:ring-2"
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
                                className="text-[11px] font-medium text-neutral-600"
                            >
                                {quantity}
                            </Badge>
                        )}
                    </div>

                    <h1
                        ref={headingRef}
                        tabIndex={-1}
                        className="text-2xl leading-[1.18] font-extrabold tracking-[-0.035em] wrap-anywhere text-neutral-950 focus:outline-none sm:text-3xl"
                    >
                        {productName}
                    </h1>

                    {genericName && (
                        <p className="text-xs font-medium text-neutral-500 italic">
                            {genericName}
                        </p>
                    )}

                    {brandName && (
                        <p className="text-sm font-medium text-neutral-600">
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
                                    className="bg-neutral-50 text-[10px] text-neutral-600 capitalize"
                                >
                                    {c}
                                </Badge>
                            ))}
                            {categories.length > 3 && (
                                <span className="text-[10px] text-neutral-400">
                                    +{categories.length - 3} more
                                </span>
                            )}
                        </div>
                    )}

                    {/* Quick Factual Summary Divider Rows (Neutral) */}
                    <div className="divide-y divide-neutral-100 border-t border-b border-neutral-100 py-0.5 text-xs">
                        <div className="flex items-center justify-between py-2">
                            <span className="font-medium text-neutral-500">
                                Allergen Findings
                            </span>
                            <span className="font-semibold text-neutral-900">
                                {allergensDetected > 0
                                    ? `${allergensDetected} detected`
                                    : "None declared"}
                            </span>
                        </div>

                        <div className="flex items-center justify-between py-2">
                            <span className="font-medium text-neutral-500">
                                Additives (E-Nums)
                            </span>
                            <span className="font-semibold text-neutral-900">
                                {additivesCount > 0
                                    ? `${additivesCount} listed`
                                    : "0 listed"}
                            </span>
                        </div>

                        <div className="flex items-center justify-between py-2">
                            <span className="font-medium text-neutral-500">
                                Halal Status
                            </span>
                            <span className="max-w-[240px] truncate text-[11px] font-semibold text-neutral-800">
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
