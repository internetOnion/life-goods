import {
    CaretLeft,
    CaretRight,
    MagnifyingGlassMinus,
    MagnifyingGlassPlus,
    X,
} from "@phosphor-icons/react"
import { useEffect, useState } from "react"

import { GlassButton as Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { ProductPhoto } from "./types"

interface PhotoInspectionModalProps {
    isOpen: boolean
    onClose: () => void
    photos: ProductPhoto[]
    initialIndex: number
    title?: string
    productTitle?: string
}

export function PhotoInspectionModal({
    isOpen,
    onClose,
    photos,
    initialIndex,
    title,
    productTitle,
}: PhotoInspectionModalProps) {
    const displayTitle = title || productTitle || "Product"
    const [currentIndex, setCurrentIndex] = useState(initialIndex)
    const [isZoomed, setIsZoomed] = useState(false)

    useEffect(() => {
        setCurrentIndex(Math.max(0, Math.min(initialIndex, photos.length - 1)))
        setIsZoomed(false)
    }, [initialIndex, photos.length, isOpen])

    useEffect(() => {
        if (!isOpen) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose()
            } else if (e.key === "ArrowLeft") {
                setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev))
            } else if (e.key === "ArrowRight") {
                setCurrentIndex((prev) =>
                    prev < photos.length - 1 ? prev + 1 : prev,
                )
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [isOpen, onClose, photos.length])

    if (!isOpen || photos.length === 0) return null

    const currentPhoto = photos[currentIndex]
    if (!currentPhoto) return null

    const hasPrev = currentIndex > 0
    const hasNext = currentIndex < photos.length - 1

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={`${displayTitle} photo inspection`}
            className="fixed inset-0 z-50 flex flex-col justify-between bg-neutral-50/95 p-4 text-neutral-950 backdrop-blur-md select-none sm:p-6"
        >
            {/* Header bar */}
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3 text-neutral-950">
                <div className="min-w-0 pr-4">
                    <h3 className="truncate text-sm font-bold sm:text-base">
                        {displayTitle}
                    </h3>
                    <p className="font-mono text-xs text-neutral-500">
                        Photo {currentIndex + 1} of {photos.length}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="subtle"
                        size="sm"
                        onClick={() => setIsZoomed((prev) => !prev)}
                        className="h-8 gap-1.5 border-neutral-300 bg-white text-xs font-semibold text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950"
                        title={isZoomed ? "Fit to screen" : "Zoom in"}
                        aria-label={isZoomed ? "Fit to screen" : "Zoom in"}
                    >
                        {isZoomed ? (
                            <>
                                <MagnifyingGlassMinus size={15} weight="bold" />
                                <span className="hidden sm:inline">Fit</span>
                            </>
                        ) : (
                            <>
                                <MagnifyingGlassPlus size={15} weight="bold" />
                                <span className="hidden sm:inline">Zoom</span>
                            </>
                        )}
                    </Button>

                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={onClose}
                        className="size-8 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                        title="Close preview (Esc)"
                        aria-label="Close preview"
                    >
                        <X size={18} weight="bold" />
                    </Button>
                </div>
            </div>

            {/* Photo viewport */}
            <div className="relative flex flex-1 items-center justify-center overflow-auto rounded-2xl border border-neutral-200 bg-neutral-100 py-3 sm:py-4">
                <div
                    className={cn(
                        "relative flex items-center justify-center overflow-auto rounded-2xl bg-neutral-950/95 p-2 transition-transform duration-150 sm:p-4",
                        isZoomed
                            ? "min-h-full min-w-full cursor-zoom-out"
                            : "size-full cursor-zoom-in",
                    )}
                    onClick={() => setIsZoomed((prev) => !prev)}
                >
                    <img
                        src={currentPhoto.url}
                        alt={`${displayTitle} photo ${currentIndex + 1}`}
                        className={cn(
                            "rounded-lg object-contain shadow-2xl",
                            isZoomed
                                ? "max-h-none max-w-none scale-150"
                                : "max-h-[70vh] max-w-full",
                        )}
                    />
                </div>

                {/* Left/Right navigation arrows */}
                {hasPrev && (
                    <Button
                        type="button"
                        variant="subtle"
                        size="icon-sm"
                        onClick={(e) => {
                            e.stopPropagation()
                            setCurrentIndex((prev) => prev - 1)
                        }}
                        className="absolute left-2 z-10 size-10 rounded-full border border-white/30 bg-neutral-950/80 text-white hover:bg-neutral-800 sm:left-4"
                        title="Previous photo (Left arrow)"
                        aria-label="Previous photo"
                    >
                        <CaretLeft size={20} weight="bold" />
                    </Button>
                )}

                {hasNext && (
                    <Button
                        type="button"
                        variant="subtle"
                        size="icon-sm"
                        onClick={(e) => {
                            e.stopPropagation()
                            setCurrentIndex((prev) => prev + 1)
                        }}
                        className="absolute right-2 z-10 size-10 rounded-full border border-white/30 bg-neutral-950/80 text-white hover:bg-neutral-800 sm:right-4"
                        title="Next photo (Right arrow)"
                        aria-label="Next photo"
                    >
                        <CaretRight size={20} weight="bold" />
                    </Button>
                )}
            </div>

            {/* Thumbnails strip */}
            {photos.length > 1 && (
                <div className="flex justify-center gap-2 overflow-x-auto border-t border-neutral-200 pt-3">
                    {photos.map((photo, index) => (
                        <Button
                            key={photo.localId}
                            data-glass-thumbnail=""
                            aria-pressed={index === currentIndex}
                            type="button"
                            variant="ghost"
                            onClick={() => {
                                setCurrentIndex(index)
                                setIsZoomed(false)
                            }}
                            className={cn(
                                "size-12 shrink-0 overflow-hidden rounded-lg border-2 p-0 transition-all hover:bg-transparent",
                                index === currentIndex
                                    ? "border-primary-400 ring-primary-400/30 scale-105 ring-2"
                                    : "border-neutral-300 opacity-60 hover:opacity-90",
                            )}
                            title={`Jump to photo ${index + 1}`}
                            aria-label={`Jump to photo ${index + 1}`}
                        >
                            <img
                                src={photo.url}
                                alt={`Thumbnail ${index + 1}`}
                                className="size-full object-cover"
                            />
                        </Button>
                    ))}
                </div>
            )}
        </div>
    )
}
