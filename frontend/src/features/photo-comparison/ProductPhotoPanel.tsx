import {
    ArrowClockwise,
    ArrowCounterClockwise,
    CaretDown,
    Camera,
    Image,
    Info,
    Trash,
    UploadSimple,
    WarningCircle,
    X,
} from "@phosphor-icons/react"
import { type RefObject, useRef, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { GlassButton as Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import {
    PHOTO_INPUT_ACCEPT,
    displayBasisLabel,
    displayValue,
    formatNutrientName,
    formatPreparationLabel,
    formatStateLabel,
} from "./helpers"
import type {
    EvidencePointer,
    FieldObservation,
    NutritionColumn,
    ProductSideState,
} from "./types"
import { MAX_PHOTOS_PER_PRODUCT } from "./types"
import { useCompareTranslation } from "./translations"

interface ProductPhotoPanelProps {
    product: ProductSideState
    highlightedPhotoId: string | null
    previewRefs: RefObject<Record<string, HTMLElement | null>>
    onTitleChange: (
        title: string,
        source?: ProductSideState["titleSource"],
    ) => void
    onAddFiles: (files: File[]) => void
    onRemovePhoto: (index: number) => void
    onReplacePhoto: (index: number, file: File) => void
    onClearPhotos: () => void
    onOpenCamera?: () => void
    onOpenLibrary?: () => void
    onExtract?: () => void
    onRetry?: () => void
    onPhotoPreviewError?: (index: number) => void
    onFocusEvidence: (imageId: string) => void
    onInspectPhoto?: (index: number) => void
}

export function ProductPhotoPanel({
    product,
    highlightedPhotoId,
    previewRefs,
    onTitleChange,
    onAddFiles,
    onRemovePhoto,
    onReplacePhoto,
    onClearPhotos,
    onOpenCamera = () => undefined,
    onOpenLibrary = () => undefined,
    onExtract,
    onRetry,
    onPhotoPreviewError,
    onFocusEvidence,
    onInspectPhoto,
}: ProductPhotoPanelProps) {
    const { locale, t } = useCompareTranslation()
    const [isDragging, setIsDragging] = useState(false)
    const replaceInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

    const extraction = product.extraction
    const selectedColumnId =
        product.selectedColumnId ||
        ((extraction?.nutrition_columns?.length ?? 0) === 1
            ? (extraction?.nutrition_columns?.[0]?.column_id ?? null)
            : null)
    const packageQuantity = extraction?.package_quantity
    const nutritionColumns = extraction?.nutrition_columns ?? []
    const detectedName = [
        extraction?.identity?.brand?.value_text,
        extraction?.identity?.name?.value_text,
    ]
        .filter(Boolean)
        .join(" ")
    const detectedSummary = [
        detectedName || null,
        packageQuantity && packageQuantity.state === "readable"
            ? displayValue(
                  packageQuantity.value_text,
                  packageQuantity.unit_text || "",
              )
            : t("notFoundPhotos"),
        `${extraction?.images.length ?? 0} ${t("photos").toLocaleLowerCase()}`,
    ]
        .filter(Boolean)
        .join(" · ")
    const selectedColumn =
        nutritionColumns.find(
            (column) => column.column_id === selectedColumnId,
        ) ??
        nutritionColumns[0] ??
        null

    const extractButtonLabel = product.loading
        ? t("readingPhotos")
        : product.extraction
          ? t("reextract")
          : product.error
            ? t("retryExtraction")
            : t("extractVisibleFacts")

    return (
        <Card
            className="overflow-hidden rounded-2xl border-neutral-200/90 bg-white shadow-xs"
            aria-labelledby={`panel-heading-${product.id}`}
        >
            <header className="flex flex-col gap-3 border-b border-neutral-200/80 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <span className="bg-primary-100 text-primary-900 flex size-8 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold select-none">
                        {product.number}
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2
                            id={`panel-heading-${product.id}`}
                            className="sr-only"
                        >
                            {product.title}
                        </h2>
                        <Input
                            value={product.title}
                            onChange={(e) => onTitleChange(e.target.value)}
                            onBlur={() => {
                                if (!product.title.trim()) {
                                    onTitleChange(
                                        product.number === "1"
                                            ? t("productA")
                                            : t("productB"),
                                        "default",
                                    )
                                }
                            }}
                            aria-label={t("productDisplayName", {
                                product: product.title,
                            })}
                            className="h-8 w-full max-w-[200px] rounded-lg text-sm font-bold text-neutral-900 sm:w-48"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2 border-t border-neutral-200/80 pt-2 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
                    <span className="text-[11px] font-semibold tracking-wide text-neutral-600 uppercase">
                        {t("photos")}
                    </span>
                    <p className="shrink-0 text-xs font-medium text-neutral-600">
                        {t("selectedCount", {
                            count: product.photos.length,
                            total: MAX_PHOTOS_PER_PRODUCT,
                        })}
                    </p>
                </div>
            </header>

            <div className="p-3 sm:p-4">
                {product.photos.length === 0 ? (
                    <div className="flex flex-col gap-2">
                        <div
                            onDragOver={(e) => {
                                e.preventDefault()
                                setIsDragging(true)
                            }}
                            onDragLeave={(e) => {
                                e.preventDefault()
                                setIsDragging(false)
                            }}
                            onDrop={(e) => {
                                e.preventDefault()
                                setIsDragging(false)
                                if (e.dataTransfer.files?.length) {
                                    onAddFiles(Array.from(e.dataTransfer.files))
                                }
                            }}
                            className={cn(
                                "relative flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/50 p-4 text-center text-neutral-950 transition-all select-none sm:p-6",
                                isDragging
                                    ? "border-primary-500 ring-primary-200 ring-2"
                                    : "hover:border-primary-300",
                            )}
                        >
                            <div className="bg-primary-100 text-primary-800 flex size-14 items-center justify-center rounded-2xl">
                                <Camera size={27} weight="bold" />
                            </div>
                            <h3 className="mt-4 text-lg font-extrabold sm:text-xl">
                                {t("addNutritionPhoto")}
                            </h3>
                            <p className="mt-2 max-w-md text-sm leading-relaxed text-neutral-600">
                                {t("clearPhotoHint")}
                            </p>
                            <Button
                                type="button"
                                onClick={onOpenCamera}
                                className="bg-primary-600 hover:bg-primary-700 active:bg-primary-800 mt-5 h-12 gap-2 rounded-xl px-5 font-extrabold text-white"
                            >
                                <Camera size={18} weight="bold" />
                                <span>{t("takePhoto")}</span>
                            </Button>
                        </div>

                        <div className="flex flex-col items-center justify-between gap-2 border-t border-neutral-200/80 pt-3 text-center sm:flex-row sm:text-left">
                            <span className="text-xs text-neutral-500">
                                {t("fileRequirements", {
                                    count: MAX_PHOTOS_PER_PRODUCT,
                                })}
                            </span>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onOpenLibrary}
                                className="h-11 gap-2 rounded-xl px-4 font-bold text-neutral-800"
                            >
                                <UploadSimple size={17} weight="bold" />
                                <span>{t("chooseLibrary")}</span>
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div>
                        {/* Compact add photo actions when photos already exist */}
                        {product.photos.length < MAX_PHOTOS_PER_PRODUCT && (
                            <div className="mb-3">
                                <p className="mb-2 text-xs leading-relaxed text-neutral-500">
                                    {t("optionalPhotos")}
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={onOpenCamera}
                                        className="h-10 gap-1.5 rounded-xl px-3 text-xs font-bold"
                                    >
                                        <Camera size={15} weight="bold" />
                                        <span>{t("addAnotherPhoto")}</span>
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={onOpenLibrary}
                                        className="h-10 gap-1.5 rounded-xl px-3 text-xs font-bold text-neutral-600"
                                    >
                                        <UploadSimple size={15} weight="bold" />
                                        <span>{t("addFromLibrary")}</span>
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Previews grid */}
                {product.photos.length > 0 && (
                    <div
                        className="mt-3 grid grid-cols-3 gap-2.5"
                        data-previews={product.id}
                    >
                        {product.photos.map((photo, index) => (
                            <figure
                                key={photo.localId}
                                ref={(el) => {
                                    if (previewRefs.current) {
                                        previewRefs.current[photo.localId] = el
                                    }
                                }}
                                className={cn(
                                    "group relative aspect-square overflow-hidden rounded-xl bg-neutral-900 transition-all duration-300",
                                    highlightedPhotoId === photo.localId &&
                                        "ring-primary-400 scale-[1.03] ring-4 ring-offset-2",
                                    photo.previewError &&
                                        "bg-error-50 ring-error-200 ring-1 ring-inset",
                                )}
                            >
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => onInspectPhoto?.(index)}
                                    className="size-full cursor-zoom-in rounded-none p-0 text-left hover:bg-transparent focus:outline-hidden"
                                    title={t("inspectPhoto", {
                                        product: product.title,
                                        number: index + 1,
                                    })}
                                    aria-label={t("inspectPhoto", {
                                        product: product.title,
                                        number: index + 1,
                                    })}
                                    disabled={
                                        photo.previewError ||
                                        photo.previewUnsupported
                                    }
                                >
                                    {photo.previewUnsupported ? (
                                        <span
                                            role="img"
                                            aria-label={t(
                                                "photoPreviewUnsupported",
                                            )}
                                            className="flex size-full flex-col items-center justify-center gap-2 p-3 text-center text-xs font-bold text-neutral-100"
                                        >
                                            <Image
                                                size={24}
                                                weight="bold"
                                                aria-hidden="true"
                                            />
                                            <span>
                                                {t("photoPreviewUnsupported")}
                                            </span>
                                        </span>
                                    ) : photo.previewError ? (
                                        <span
                                            role="img"
                                            aria-label={t(
                                                "photoPreviewUnavailable",
                                            )}
                                            className="text-error-800 flex size-full flex-col items-center justify-center gap-2 p-3 text-center text-xs font-bold"
                                        >
                                            <WarningCircle
                                                size={24}
                                                weight="bold"
                                                aria-hidden="true"
                                            />
                                            <span>
                                                {t("photoPreviewUnavailable")}
                                            </span>
                                        </span>
                                    ) : (
                                        <img
                                            src={photo.url}
                                            alt={`${product.title} photo ${index + 1}`}
                                            onError={() =>
                                                onPhotoPreviewError?.(index)
                                            }
                                            className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                                        />
                                    )}
                                </Button>
                                <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-md bg-neutral-950/80 px-2 py-0.5 font-mono text-[10px] font-bold text-white select-none">
                                    {t("photoNumber", { number: index + 1 })}
                                </span>
                                <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-90 transition-opacity group-hover:opacity-100">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() =>
                                            replaceInputRefs.current[
                                                photo.localId
                                            ]?.click()
                                        }
                                        className="hover:bg-primary-600 size-8 rounded-xl bg-neutral-950/80 text-white hover:text-white"
                                        title={t("replacePhoto", {
                                            number: index + 1,
                                        })}
                                        aria-label={t("replacePhoto", {
                                            number: index + 1,
                                        })}
                                    >
                                        <ArrowClockwise
                                            size={14}
                                            weight="bold"
                                        />
                                    </Button>
                                    <Input
                                        ref={(element) => {
                                            replaceInputRefs.current[
                                                photo.localId
                                            ] = element
                                        }}
                                        id={`replace-file-${product.id}-${index}`}
                                        type="file"
                                        accept={PHOTO_INPUT_ACCEPT}
                                        tabIndex={-1}
                                        className="sr-only"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (file) {
                                                onReplacePhoto(index, file)
                                            }
                                            e.target.value = ""
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => onRemovePhoto(index)}
                                        className="hover:bg-error-600 size-7 rounded-xl bg-neutral-950/80 text-white hover:text-white"
                                        title={t("removePhoto", {
                                            number: index + 1,
                                        })}
                                        aria-label={t("removePhoto", {
                                            number: index + 1,
                                        })}
                                    >
                                        <X size={14} weight="bold" />
                                    </Button>
                                </div>
                            </figure>
                        ))}
                    </div>
                )}

                {/* Panel Actions */}
                <div className="mt-3 flex flex-wrap items-center gap-2.5">
                    {onExtract && (
                        <Button
                            type="button"
                            variant="default"
                            disabled={
                                product.photos.length === 0 ||
                                product.loading ||
                                product.photos.some(
                                    (photo) => photo.previewError,
                                )
                            }
                            onClick={onExtract}
                            className="font-bold shadow-xs"
                        >
                            {extractButtonLabel}
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="ghost"
                        disabled={product.photos.length === 0}
                        onClick={onClearPhotos}
                        className="gap-1.5 text-neutral-600 hover:text-neutral-900"
                    >
                        <Trash size={15} />
                        <span>{t("clearPhotos")}</span>
                    </Button>
                </div>

                {/* Status indicator */}
                {product.error && (
                    <Alert
                        variant="destructive"
                        role="alert"
                        className="border-error-200 bg-error-50 text-error-900 mt-3"
                    >
                        <WarningCircle
                            size={20}
                            weight="bold"
                            className="text-error-700"
                            aria-hidden="true"
                        />
                        <AlertTitle className="text-sm font-extrabold">
                            {product.retry
                                ? t("labelReadingErrorTitle")
                                : t("photoErrorTitle")}
                        </AlertTitle>
                        <AlertDescription className="text-error-900/90">
                            <p>{product.error}</p>
                            {product.retry ? (
                                <>
                                    <p className="mt-1.5">
                                        {t("retryPhotoGuidance")}
                                    </p>
                                    {onRetry ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={onRetry}
                                            className="border-error-200 text-error-900 hover:bg-error-50 mt-3 h-10 gap-1.5 bg-white px-3 text-xs font-bold"
                                        >
                                            <ArrowCounterClockwise
                                                size={15}
                                                weight="bold"
                                                aria-hidden="true"
                                            />
                                            <span>
                                                {t("retryReadingProduct", {
                                                    product: product.title,
                                                })}
                                            </span>
                                        </Button>
                                    ) : null}
                                </>
                            ) : null}
                        </AlertDescription>
                    </Alert>
                )}
                {!product.error && (
                    <div
                        className={cn(
                            "mt-3 text-xs leading-relaxed",
                            product.loading && "text-primary-700 font-medium",
                            product.extraction &&
                                !product.error &&
                                (product.extraction.outcome ===
                                "retake_required"
                                    ? "border-warning-300 bg-warning-50 text-warning-900 rounded-xl border p-3"
                                    : product.extraction.outcome === "partial"
                                      ? "border-warning-200 bg-warning-50/70 text-warning-900 rounded-xl border p-3"
                                      : "text-success-700 font-medium"),
                            !product.extraction &&
                                !product.loading &&
                                !product.error &&
                                (product.photos.length > 0
                                    ? "font-medium text-neutral-700"
                                    : "text-neutral-500"),
                        )}
                        role="status"
                    >
                        {product.loading ? (
                            t("readingPhotos")
                        ) : product.extraction ? (
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 font-bold">
                                    {product.extraction.outcome ===
                                    "complete" ? (
                                        <span className="text-success-800">
                                            {t("ready")}
                                        </span>
                                    ) : product.extraction.outcome ===
                                      "partial" ? (
                                        <>
                                            <Info
                                                size={15}
                                                weight="bold"
                                                className="text-warning-700 shrink-0"
                                            />
                                            <span className="text-warning-900">
                                                {t("someUnreadable")}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <WarningCircle
                                                size={15}
                                                weight="bold"
                                                className="text-warning-700 shrink-0"
                                            />
                                            <span className="text-warning-950">
                                                {t("retakePhoto")}
                                            </span>
                                        </>
                                    )}
                                </div>
                                {product.extraction.outcome ===
                                    "retake_required" && (
                                    <p className="text-warning-800 text-xs">
                                        {t("retakeGuidance")}
                                    </p>
                                )}
                                {product.extraction.outcome === "partial" && (
                                    <p className="text-warning-800 text-xs">
                                        {t("partialGuidance")}
                                    </p>
                                )}
                                <details className="mt-1 cursor-pointer text-neutral-500">
                                    <summary className="text-[11px] font-medium text-neutral-500 select-none hover:text-neutral-700">
                                        {t("technicalMetadata")}
                                    </summary>
                                    <div className="mt-1 space-y-0.5 font-mono text-[11px] text-neutral-500">
                                        <div>
                                            {t("model")}:{" "}
                                            {product.extraction.model ||
                                                t("configuredModel")}
                                        </div>
                                        <div>
                                            {t("provider")}:{" "}
                                            {product.extraction.provider ||
                                                "google"}
                                        </div>
                                        <div>
                                            {t("configuration")}:{" "}
                                            {product.extraction
                                                .configuration_version ||
                                                "1.0.0"}
                                        </div>
                                    </div>
                                </details>
                            </div>
                        ) : product.photos.length > 0 ? (
                            t("photosReady")
                        ) : (
                            t("addPhotoToBegin")
                        )}
                    </div>
                )}

                {/* Extraction Results */}
                {extraction && (
                    <div className="mt-5 border-t border-neutral-200/80 pt-5">
                        {/* Detected details */}
                        <details className="group">
                            <summary className="focus-visible:ring-primary-500 flex cursor-pointer list-none items-start justify-between gap-3 rounded-lg select-none focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden [&::marker]:hidden">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-neutral-900">
                                        {t("detectedDetails")}
                                    </p>
                                    <p className="mt-0.5 text-xs leading-relaxed wrap-anywhere text-neutral-600">
                                        {detectedSummary}
                                    </p>
                                </div>
                                <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2.5 text-xs font-semibold text-neutral-800 group-hover:border-neutral-400">
                                    <span className="group-open:hidden">
                                        {t("showDetails")}
                                    </span>
                                    <span className="hidden group-open:inline">
                                        {t("hideDetails")}
                                    </span>
                                    <CaretDown
                                        size={14}
                                        weight="bold"
                                        aria-hidden="true"
                                        className="transition-transform duration-150 group-open:rotate-180"
                                    />
                                </span>
                            </summary>

                            <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200/90 bg-white">
                                {(extraction.identity?.name?.value_text ||
                                    extraction.identity?.brand?.value_text) && (
                                    <div className="border-b border-neutral-200/90 px-4 py-3.5">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                                <p className="text-caption font-bold tracking-wider text-neutral-600 uppercase">
                                                    {t("detectedProduct")}
                                                </p>
                                                <p className="mt-1 text-base leading-tight font-extrabold wrap-anywhere text-neutral-950">
                                                    {extraction.identity.brand
                                                        ?.value_text ? (
                                                        <span
                                                            lang={
                                                                extraction
                                                                    .identity
                                                                    .brand
                                                                    .language ||
                                                                "und"
                                                            }
                                                        >
                                                            {
                                                                extraction
                                                                    .identity
                                                                    .brand
                                                                    .value_text
                                                            }
                                                        </span>
                                                    ) : null}
                                                    {extraction.identity.brand
                                                        ?.value_text &&
                                                    extraction.identity.name
                                                        ?.value_text
                                                        ? " "
                                                        : null}
                                                    {extraction.identity.name
                                                        ?.value_text ? (
                                                        <span
                                                            lang={
                                                                extraction
                                                                    .identity
                                                                    .name
                                                                    .language ||
                                                                "und"
                                                            }
                                                        >
                                                            {
                                                                extraction
                                                                    .identity
                                                                    .name
                                                                    .value_text
                                                            }
                                                        </span>
                                                    ) : null}
                                                </p>
                                            </div>
                                            {product.title !==
                                                [
                                                    extraction.identity.brand
                                                        ?.value_text,
                                                    extraction.identity.name
                                                        ?.value_text,
                                                ]
                                                    .filter(Boolean)
                                                    .join(" ") && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        const brand =
                                                            extraction.identity
                                                                ?.brand
                                                                ?.value_text
                                                        const name =
                                                            extraction.identity
                                                                ?.name
                                                                ?.value_text
                                                        const detected = [
                                                            brand,
                                                            name,
                                                        ]
                                                            .filter(Boolean)
                                                            .join(" ")
                                                        if (detected) {
                                                            onTitleChange(
                                                                detected,
                                                                "photo_evidence",
                                                            )
                                                        }
                                                    }}
                                                    className="text-caption shrink-0 font-mono"
                                                >
                                                    {t("useAsTitle")}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <dl className="grid sm:grid-cols-2">
                                    <div className="border-b border-neutral-200/90 px-4 py-3.5 sm:border-r sm:border-b-0">
                                        <dt className="text-caption font-bold tracking-wider text-neutral-600 uppercase">
                                            {t("packageWeight")}
                                        </dt>
                                        <dd className="mt-1 text-sm font-semibold wrap-anywhere text-neutral-900">
                                            {packageQuantity &&
                                            packageQuantity.state ===
                                                "readable" ? (
                                                <>
                                                    <span>
                                                        {displayValue(
                                                            packageQuantity.value_text,
                                                            packageQuantity.unit_text ||
                                                                "",
                                                        )}
                                                    </span>
                                                    {packageQuantity?.evidence
                                                        ?.length ? (
                                                        <EvidencePointers
                                                            evidence={
                                                                packageQuantity.evidence
                                                            }
                                                            product={product}
                                                            onFocus={
                                                                onFocusEvidence
                                                            }
                                                        />
                                                    ) : null}
                                                </>
                                            ) : (
                                                <span className="font-medium text-neutral-600 italic">
                                                    {t("notFoundPhotos")}
                                                </span>
                                            )}
                                        </dd>
                                    </div>
                                    <div className="px-4 py-3.5">
                                        <dt className="text-caption font-bold tracking-wider text-neutral-600 uppercase">
                                            {t("preparation")}
                                        </dt>
                                        <dd className="mt-1 text-sm font-semibold wrap-anywhere text-neutral-900">
                                            {selectedColumn ? (
                                                formatPreparationLabel(
                                                    selectedColumn.preparation_state,
                                                    locale,
                                                )
                                            ) : (
                                                <span className="font-medium text-neutral-600 italic">
                                                    {t("notSpecified")}
                                                </span>
                                            )}
                                        </dd>
                                    </div>
                                </dl>
                                <div className="flex flex-col gap-2 border-t border-neutral-200/90 bg-neutral-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-caption font-bold tracking-wider text-neutral-600 uppercase">
                                        {t("evidenceImages")}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {extraction.images.map(
                                            (img, imgIndex) => (
                                                <Button
                                                    key={img.image_id}
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        onFocusEvidence(
                                                            img.image_id,
                                                        )
                                                    }
                                                    className="text-caption h-10 gap-1.5 font-mono"
                                                >
                                                    <Camera
                                                        size={14}
                                                        weight="bold"
                                                    />
                                                    <span>
                                                        {t("viewPhoto", {
                                                            number:
                                                                imgIndex + 1,
                                                        })}
                                                    </span>
                                                </Button>
                                            ),
                                        )}
                                    </div>
                                </div>
                            </div>
                        </details>

                        {/* Nutrition basis (auto-selected, never the printed header) */}
                        {selectedColumn ? (
                            <section className="mt-4 border-t border-neutral-200/80 pt-4">
                                <p className="text-xs text-neutral-500">
                                    {t("usingBasis", {
                                        basis: displayBasisLabel(
                                            selectedColumn.basis,
                                            locale,
                                        ),
                                        preparation: formatPreparationLabel(
                                            selectedColumn.preparation_state,
                                            locale,
                                        ),
                                    })}
                                </p>
                                <div className="mt-3">
                                    <NutritionColumnCard
                                        column={selectedColumn}
                                        product={product}
                                        onFocusEvidence={onFocusEvidence}
                                    />
                                </div>
                            </section>
                        ) : null}

                        {/* Retake reasons */}
                        {extraction.retake_reasons &&
                            extraction.retake_reasons.length > 0 && (
                                <div className="border-warning-200 bg-warning-50 text-warning-900 mt-4 rounded-xl border p-3 text-xs">
                                    <div className="text-warning-950 flex items-center gap-2 font-bold">
                                        <WarningCircle
                                            size={16}
                                            weight="bold"
                                        />
                                        <span>{t("retakeSuggestions")}</span>
                                    </div>
                                    <ul className="text-warning-800 mt-2 list-disc space-y-1 pl-4">
                                        {locale === "km" ? (
                                            <li>{t("providerNote")}</li>
                                        ) : (
                                            extraction.retake_reasons.map(
                                                (reason, rIndex) => (
                                                    <li key={rIndex}>
                                                        {reason}
                                                    </li>
                                                ),
                                            )
                                        )}
                                    </ul>
                                </div>
                            )}
                    </div>
                )}
            </div>
        </Card>
    )
}

interface NutritionColumnCardProps {
    column: NutritionColumn
    product: ProductSideState
    onFocusEvidence: (imageId: string) => void
}

function NutritionColumnCard({
    column,
    product,
    onFocusEvidence,
}: NutritionColumnCardProps) {
    const { locale, t } = useCompareTranslation()
    const basisLabel = displayBasisLabel(column.basis, locale)
    const prepLabel = formatPreparationLabel(column.preparation_state, locale)

    return (
        <article className="rounded-lg border border-neutral-200/80 bg-white p-3">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="font-bold text-neutral-900">
                        {basisLabel}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">
                        {prepLabel}
                    </div>
                </div>
            </div>

            <div className="scrollbar-subtle mt-3 max-h-48 divide-y divide-neutral-100 overflow-y-auto border-t border-neutral-100 pr-1 text-xs">
                {(column.fields?.length ?? 0) > 0 ? (
                    (column.fields ?? []).map((field) => (
                        <ObservationRow
                            key={field.field_id}
                            field={field}
                            product={product}
                            onFocusEvidence={onFocusEvidence}
                        />
                    ))
                ) : (
                    <div className="py-2 text-neutral-600 italic">
                        {t("noVisibleColumn")}
                    </div>
                )}
            </div>
        </article>
    )
}

function ObservationRow({
    field,
    product,
    onFocusEvidence,
}: {
    field: FieldObservation
    product: ProductSideState
    onFocusEvidence: (imageId: string) => void
}) {
    const { locale, t } = useCompareTranslation()
    const nutrientName = formatNutrientName(
        field.nutrient || "",
        field.label,
        locale,
    )

    return (
        <div className="flex items-start justify-between gap-4 py-2.5">
            <div className="min-w-0 flex-1">
                <div className="font-semibold text-neutral-900">
                    <span>{nutrientName}</span>
                </div>
                {field.original_script &&
                    field.original_script !== nutrientName && (
                        <div
                            className="font-sans text-xs text-neutral-600"
                            lang={field.language || "und"}
                        >
                            {field.original_script}
                        </div>
                    )}
                {field.state === "conflicting" && (
                    <div className="text-warning-700 mt-1 text-[11px] font-medium">
                        <span>{t("conflictingValues")} </span>
                        <span>
                            {displayValue(
                                field.value_text,
                                field.unit_text || "",
                            )}
                        </span>
                        {field.alternatives?.map((alt, i) => (
                            <span key={i}>
                                {" "}
                                vs{" "}
                                {displayValue(
                                    alt.value_text,
                                    alt.unit_text || "",
                                )}
                            </span>
                        ))}
                    </div>
                )}
                <details className="mt-0.5 text-[11px] text-neutral-600">
                    <summary className="cursor-pointer select-none hover:text-neutral-600">
                        {t("details")}
                    </summary>
                    <div className="mt-0.5 font-mono text-[10px] text-neutral-500">
                        {formatStateLabel(field.state, locale)} ·{" "}
                        {formatStateLabel(field.row_kind, locale)} ·{" "}
                        {formatStateLabel(field.qualifier, locale)}
                    </div>
                </details>
                {field.evidence && field.evidence.length > 0 && (
                    <EvidencePointers
                        evidence={field.evidence}
                        product={product}
                        onFocus={onFocusEvidence}
                    />
                )}
            </div>

            <div className="shrink-0 text-right font-mono text-xs font-bold text-neutral-900 tabular-nums">
                {displayValue(field.value_text, field.unit_text || "")}
            </div>
        </div>
    )
}

function EvidencePointers({
    evidence,
    product,
    onFocus,
}: {
    evidence: EvidencePointer[]
    product: ProductSideState
    onFocus: (imageId: string) => void
}) {
    const { t } = useCompareTranslation()
    return (
        <div className="mt-1 flex flex-wrap gap-1">
            {evidence.map((ptr) => {
                const photoIndex = product.extraction?.images?.findIndex(
                    (img) => img.image_id === ptr.image_id,
                )
                const photoNumber =
                    photoIndex !== undefined && photoIndex >= 0
                        ? photoIndex + 1
                        : 1

                return (
                    <Button
                        key={ptr.image_id}
                        type="button"
                        variant="subtle"
                        size="sm"
                        onClick={() => onFocus(ptr.image_id)}
                        className="border-info-200/70 bg-info-50 text-info-700 hover:bg-info-100 hover:text-info-900 h-5 gap-1 rounded-full border px-2 font-mono text-[10px]"
                        title={t("viewPhoto", { number: photoNumber })}
                        aria-label={t("viewPhoto", { number: photoNumber })}
                    >
                        <Camera size={11} />
                        <span>{t("viewPhoto", { number: photoNumber })}</span>
                    </Button>
                )
            })}
        </div>
    )
}
