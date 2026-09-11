import {
    ArrowClockwise,
    Camera,
    Trash,
    UploadSimple,
    WarningCircle,
    X,
} from "@phosphor-icons/react"
import { type RefObject, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import {
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

interface ProductPhotoPanelProps {
    product: ProductSideState
    highlightedPhotoId: string | null
    previewRefs: RefObject<Record<string, HTMLElement | null>>
    onTitleChange: (title: string) => void
    onAddFiles: (files: File[]) => void
    onRemovePhoto: (index: number) => void
    onReplacePhoto: (index: number, file: File) => void
    onClearPhotos: () => void
    onExtract: () => void
    onSelectColumn: (columnId: string | null) => void
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
    onExtract,
    onSelectColumn,
    onFocusEvidence,
    onInspectPhoto,
}: ProductPhotoPanelProps) {
    const [isDragging, setIsDragging] = useState(false)

    const extraction = product.extraction
    const selectedColumnId =
        product.selectedColumnId ||
        (extraction?.nutrition_columns.length === 1
            ? (extraction.nutrition_columns[0]?.column_id ?? null)
            : null)
    const packageQuantity = extraction?.package_quantity

    const extractButtonLabel = product.loading
        ? "Reading photos…"
        : product.extraction
          ? "Re-extract"
          : product.error
            ? "Retry extraction"
            : "Extract visible facts"

    return (
        <Card
            className="overflow-hidden rounded-2xl border-neutral-200/90 bg-white shadow-xs"
            aria-labelledby={`panel-heading-${product.id}`}
        >
            <header className="flex flex-col gap-3 border-b border-neutral-200/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="flex items-center gap-3">
                    <span className="bg-primary-100 text-primary-900 flex size-9 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold select-none">
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
                                            ? "Product A"
                                            : "Product B",
                                    )
                                }
                            }}
                            aria-label={`${product.title} display name`}
                            className="h-9 w-full max-w-[220px] rounded-lg font-bold text-neutral-900 sm:w-52"
                        />
                        <p className="mt-1 text-xs text-neutral-500">
                            {product.photos.length} of 6 photos selected
                        </p>
                    </div>
                </div>
            </header>

            <div className="p-4 sm:p-5">
                {/* Dropzone */}
                <label
                    htmlFor={`upload-photos-${product.id}`}
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
                        "relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all select-none",
                        isDragging
                            ? "border-primary-500 bg-primary-50/50 ring-primary-500/20 ring-2"
                            : "hover:border-primary-400 border-neutral-300 bg-neutral-50/70 hover:bg-neutral-100/70",
                    )}
                >
                    <div className="bg-primary-100/80 text-primary-800 flex size-11 items-center justify-center rounded-xl">
                        <UploadSimple size={22} weight="bold" />
                    </div>
                    <strong className="mt-2.5 text-sm font-bold text-neutral-900">
                        Add label photos
                    </strong>
                    <span className="mt-1 text-xs text-neutral-500">
                        Choose one or more JPEG/PNG files
                    </span>
                    <Input
                        id={`upload-photos-${product.id}`}
                        type="file"
                        accept="image/jpeg,image/png"
                        multiple
                        className="sr-only"
                        onChange={(e) => {
                            if (e.target.files?.length) {
                                onAddFiles(Array.from(e.target.files))
                            }
                            e.target.value = ""
                        }}
                    />
                </label>

                {/* Mobile Camera Option */}
                <div className="mt-2.5 flex items-center justify-center">
                    <label
                        htmlFor={`camera-photos-${product.id}`}
                        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 shadow-2xs select-none hover:bg-neutral-50 hover:text-neutral-900"
                    >
                        <Camera size={15} weight="bold" />
                        <span>Take photo with camera</span>
                        <Input
                            id={`camera-photos-${product.id}`}
                            type="file"
                            accept="image/jpeg,image/png"
                            capture="environment"
                            className="sr-only"
                            onChange={(e) => {
                                if (e.target.files?.length) {
                                    onAddFiles(Array.from(e.target.files))
                                }
                                e.target.value = ""
                            }}
                        />
                    </label>
                </div>

                {/* Previews grid */}
                {product.photos.length > 0 && (
                    <div
                        className="mt-4 grid grid-cols-3 gap-2.5"
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
                                )}
                            >
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => onInspectPhoto?.(index)}
                                    className="size-full cursor-zoom-in rounded-none p-0 text-left hover:bg-transparent focus:outline-hidden"
                                    title="Click to inspect full photo"
                                    aria-label={`Inspect ${product.title} photo ${index + 1}`}
                                >
                                    <img
                                        src={photo.url}
                                        alt={`${product.title} photo ${index + 1}`}
                                        className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                                    />
                                </Button>
                                <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-md bg-neutral-950/80 px-2 py-0.5 font-mono text-[10px] font-bold text-white select-none">
                                    Photo {index + 1}
                                </span>
                                <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-90 transition-opacity group-hover:opacity-100">
                                    <label
                                        htmlFor={`replace-file-${product.id}-${index}`}
                                        className="hover:bg-primary-600 flex size-7 cursor-pointer items-center justify-center rounded-lg bg-neutral-950/80 text-white transition-colors"
                                        title={`Replace photo ${index + 1}`}
                                        aria-label={`Replace photo ${index + 1}`}
                                    >
                                        <ArrowClockwise
                                            size={14}
                                            weight="bold"
                                        />
                                        <Input
                                            id={`replace-file-${product.id}-${index}`}
                                            type="file"
                                            accept="image/jpeg,image/png"
                                            className="sr-only"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0]
                                                if (file) {
                                                    onReplacePhoto(index, file)
                                                }
                                                e.target.value = ""
                                            }}
                                        />
                                    </label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => onRemovePhoto(index)}
                                        className="hover:bg-error-600 size-7 rounded-lg bg-neutral-950/80 text-white hover:text-white"
                                        title={`Remove photo ${index + 1}`}
                                        aria-label={`Remove photo ${index + 1}`}
                                    >
                                        <X size={14} weight="bold" />
                                    </Button>
                                </div>
                            </figure>
                        ))}
                    </div>
                )}

                {/* Panel Actions */}
                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                    <Button
                        type="button"
                        variant="default"
                        disabled={
                            product.photos.length === 0 || product.loading
                        }
                        onClick={onExtract}
                        className="font-bold shadow-xs"
                    >
                        {extractButtonLabel}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        disabled={product.photos.length === 0}
                        onClick={onClearPhotos}
                        className="gap-1.5 text-neutral-600 hover:text-neutral-900"
                    >
                        <Trash size={15} />
                        <span>Clear photos</span>
                    </Button>
                </div>

                {/* Status indicator */}
                <div
                    className={cn(
                        "mt-3 text-xs leading-relaxed",
                        product.error &&
                            "border-error-200 bg-error-50 text-error-800 rounded-xl border p-3 font-medium",
                        product.loading && "text-primary-700 font-medium",
                        product.extraction &&
                            !product.error &&
                            "text-success-700 font-medium",
                        !product.extraction &&
                            !product.loading &&
                            !product.error &&
                            "text-neutral-500",
                    )}
                    role={product.error ? "alert" : "status"}
                >
                    {product.error ? (
                        product.error
                    ) : product.loading ? (
                        "Reading photos…"
                    ) : product.extraction ? (
                        <div className="flex flex-col gap-1">
                            <span className="text-success-800 font-bold">
                                {product.extraction.outcome === "complete"
                                    ? "Extraction completed"
                                    : "Extraction finished"}
                            </span>
                            <details className="mt-1 cursor-pointer text-neutral-500">
                                <summary className="text-[11px] font-medium text-neutral-500 select-none hover:text-neutral-700">
                                    Technical metadata
                                </summary>
                                <div className="mt-1 space-y-0.5 font-mono text-[11px] text-neutral-500">
                                    <div>
                                        Model:{" "}
                                        {product.extraction.model || "Gemini"}
                                    </div>
                                    <div>
                                        Provider:{" "}
                                        {product.extraction.provider ||
                                            "google"}
                                    </div>
                                    <div>
                                        Config:{" "}
                                        {product.extraction
                                            .configuration_version || "1.0.0"}
                                    </div>
                                </div>
                            </details>
                        </div>
                    ) : (
                        "Add photos to begin"
                    )}
                </div>

                {/* Extraction Results */}
                {extraction && (
                    <div className="mt-6 border-t border-neutral-200/80 pt-5">
                        {/* What the photos show */}
                        <section>
                            <div className="flex items-baseline justify-between gap-3">
                                <h3 className="text-sm font-bold text-neutral-900">
                                    What the photos show
                                </h3>
                            </div>

                            <dl className="mt-3.5 divide-y divide-neutral-100 rounded-xl border border-neutral-200/70 bg-neutral-50/50 text-xs">
                                {(extraction.identity?.name?.value_text ||
                                    extraction.identity?.brand?.value_text) && (
                                    <div className="flex flex-col gap-1.5 p-3 sm:grid sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-center sm:gap-3">
                                        <dt className="font-bold text-neutral-500">
                                            Detected product
                                        </dt>
                                        <dd className="font-medium text-neutral-900">
                                            <span className="font-bold">
                                                {[
                                                    extraction.identity.brand
                                                        ?.value_text,
                                                    extraction.identity.name
                                                        ?.value_text,
                                                ]
                                                    .filter(Boolean)
                                                    .join(" ")}
                                            </span>
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
                                                    variant="ghost"
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
                                                            )
                                                        }
                                                    }}
                                                    className="text-primary-700 hover:text-primary-900 ml-2 h-auto p-0 font-mono text-[11px] underline hover:bg-transparent"
                                                >
                                                    Use as title
                                                </Button>
                                            )}
                                        </dd>
                                    </div>
                                )}
                                <div className="flex flex-col gap-1.5 p-3 sm:grid sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-center sm:gap-3">
                                    <dt className="font-bold text-neutral-500">
                                        Package weight
                                    </dt>
                                    <dd className="font-medium text-neutral-900">
                                        {packageQuantity &&
                                        packageQuantity.state === "readable" ? (
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
                                            <span className="text-neutral-500 italic">
                                                Not found in these photos
                                            </span>
                                        )}
                                    </dd>
                                </div>
                                <div className="flex flex-col gap-1.5 p-3 sm:grid sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-center sm:gap-3">
                                    <dt className="font-bold text-neutral-500">
                                        Preparation
                                    </dt>
                                    <dd className="font-medium text-neutral-900">
                                        {extraction.nutrition_columns.length >
                                        0 ? (
                                            extraction.nutrition_columns
                                                .map((col) =>
                                                    formatPreparationLabel(
                                                        col.preparation_state,
                                                    ),
                                                )
                                                .join(" · ")
                                        ) : (
                                            <span className="text-neutral-500 italic">
                                                Not specified
                                            </span>
                                        )}
                                    </dd>
                                </div>
                                <div className="flex flex-col gap-1.5 p-3 sm:grid sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-center sm:gap-3">
                                    <dt className="font-bold text-neutral-500">
                                        Evidence images
                                    </dt>
                                    <dd className="flex flex-wrap gap-1.5">
                                        {extraction.images.map(
                                            (img, imgIndex) => (
                                                <Button
                                                    key={img.image_id}
                                                    type="button"
                                                    variant="subtle"
                                                    size="sm"
                                                    onClick={() =>
                                                        onFocusEvidence(
                                                            img.image_id,
                                                        )
                                                    }
                                                    className="border-info-200/70 bg-info-50 text-info-700 hover:bg-info-100 hover:text-info-900 h-6 gap-1 rounded-full border px-2.5 font-mono text-[11px]"
                                                >
                                                    <Camera size={12} />
                                                    <span>
                                                        View photo{" "}
                                                        {imgIndex + 1}
                                                    </span>
                                                </Button>
                                            ),
                                        )}
                                    </dd>
                                </div>
                            </dl>
                        </section>

                        {/* Nutrition columns */}
                        {extraction.nutrition_columns.length > 0 && (
                            <section className="mt-6 border-t border-neutral-200/80 pt-5">
                                <div className="flex items-baseline justify-between gap-3">
                                    <h3 className="text-sm font-bold text-neutral-900">
                                        Nutrition columns
                                    </h3>
                                    <span className="font-mono text-xs text-neutral-500">
                                        {extraction.nutrition_columns.length > 1
                                            ? "Select one for comparison"
                                            : "Sole column selected"}
                                    </span>
                                </div>

                                <div className="mt-3.5 space-y-3.5">
                                    {extraction.nutrition_columns.map(
                                        (column) => (
                                            <NutritionColumnCard
                                                key={column.column_id}
                                                column={column}
                                                product={product}
                                                isSelected={
                                                    selectedColumnId ===
                                                    column.column_id
                                                }
                                                onSelectColumn={onSelectColumn}
                                                onFocusEvidence={
                                                    onFocusEvidence
                                                }
                                            />
                                        ),
                                    )}
                                </div>
                            </section>
                        )}

                        {/* Retake reasons */}
                        {extraction.retake_reasons &&
                            extraction.retake_reasons.length > 0 && (
                                <div className="border-warning-200 bg-warning-50 text-warning-900 mt-5 rounded-2xl border p-4 text-xs">
                                    <div className="text-warning-950 flex items-center gap-2 font-bold">
                                        <WarningCircle
                                            size={16}
                                            weight="bold"
                                        />
                                        <span>Useful next photo</span>
                                    </div>
                                    <ul className="text-warning-800 mt-2 list-disc space-y-1 pl-4">
                                        {extraction.retake_reasons.map(
                                            (reason, rIndex) => (
                                                <li key={rIndex}>{reason}</li>
                                            ),
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
    isSelected: boolean
    onSelectColumn: (columnId: string | null) => void
    onFocusEvidence: (imageId: string) => void
}

function NutritionColumnCard({
    column,
    product,
    isSelected,
    onSelectColumn,
    onFocusEvidence,
}: NutritionColumnCardProps) {
    const columns = product.extraction?.nutrition_columns || []
    const basisLabel = displayBasisLabel(column.basis)
    const prepLabel = formatPreparationLabel(column.preparation_state)

    return (
        <article
            className={cn(
                "rounded-xl border bg-white p-4 transition-all",
                isSelected
                    ? "border-primary-500 ring-primary-100 shadow-xs ring-2"
                    : "border-neutral-200/80 hover:border-neutral-300",
            )}
        >
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="font-bold text-neutral-900">
                        {column.label || "Nutrition column"}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">
                        {basisLabel} · {prepLabel}
                    </div>
                </div>

                {columns.length > 1 ? (
                    <Button
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                            onSelectColumn(isSelected ? null : column.column_id)
                        }
                        className="h-8 self-start text-xs font-semibold sm:self-auto"
                    >
                        {isSelected ? "Selected" : "Select column"}
                    </Button>
                ) : (
                    <span className="self-start rounded-md bg-neutral-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-neutral-600 sm:self-auto">
                        Sole column
                    </span>
                )}
            </div>

            <div className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100 text-xs">
                {column.fields.length > 0 ? (
                    column.fields.map((field) => (
                        <ObservationRow
                            key={field.field_id}
                            field={field}
                            product={product}
                            onFocusEvidence={onFocusEvidence}
                        />
                    ))
                ) : (
                    <div className="py-2 text-neutral-400 italic">
                        No visible nutrients in this column
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
    const nutrientName = formatNutrientName(field.nutrient || "", field.label)

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
                <details className="mt-0.5 text-[11px] text-neutral-400">
                    <summary className="cursor-pointer select-none hover:text-neutral-600">
                        Details
                    </summary>
                    <div className="mt-0.5 font-mono text-[10px] text-neutral-500">
                        {formatStateLabel(field.state)} ·{" "}
                        {formatStateLabel(field.row_kind)} ·{" "}
                        {formatStateLabel(field.qualifier)}
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
                        title={`View photo ${photoNumber}`}
                    >
                        <Camera size={11} />
                        <span>View photo {photoNumber}</span>
                    </Button>
                )
            })}
        </div>
    )
}
