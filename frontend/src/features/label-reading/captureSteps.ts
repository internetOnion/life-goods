import type { LabelReadingTranslationKey } from "./translations"

/** Capture roles match the backend `photo_roles` values (SPEC section 29.3). */
export type CaptureStepId = "front" | "back" | "side"
export type CapturePhotoRole = "package_front" | "package_back" | "package_side"

export interface CaptureStep {
    id: CaptureStepId
    role: CapturePhotoRole
    titleKey: LabelReadingTranslationKey
    tipKey: LabelReadingTranslationKey
    optional: boolean
    /** Frame shape inside the camera aperture. */
    frameClassName: string
}

export const CAPTURE_STEPS: readonly CaptureStep[] = [
    {
        id: "front",
        role: "package_front",
        titleKey: "stepFrontTitle",
        tipKey: "stepFrontTip",
        optional: false,
        frameClassName: "aspect-[3/4] max-w-[15rem]",
    },
    {
        id: "back",
        role: "package_back",
        titleKey: "stepBackTitle",
        tipKey: "stepBackTip",
        optional: false,
        frameClassName: "aspect-[3/4] max-w-[15rem]",
    },
    {
        id: "side",
        role: "package_side",
        titleKey: "stepSideTitle",
        tipKey: "stepSideTip",
        optional: true,
        frameClassName: "aspect-[9/16] max-w-[11rem]",
    },
]

export function captureStep(id: CaptureStepId): CaptureStep {
    const step = CAPTURE_STEPS.find((candidate) => candidate.id === id)
    if (!step) throw new RangeError(`Unknown capture step: ${id}`)
    return step
}

/**
 * The first step after `from` that has no photo, or null. With `wrap`, earlier
 * steps are considered too, so any empty step is found.
 */
export function nextEmptyStep(
    taken: ReadonlySet<CaptureStepId>,
    from?: CaptureStepId,
    { wrap = true }: { wrap?: boolean } = {},
): CaptureStepId | null {
    const start = from ? CAPTURE_STEPS.findIndex((s) => s.id === from) + 1 : 0
    const count = wrap ? CAPTURE_STEPS.length : CAPTURE_STEPS.length - start
    for (let offset = 0; offset < count; offset++) {
        const step = CAPTURE_STEPS[(start + offset) % CAPTURE_STEPS.length]
        if (step && !taken.has(step.id)) return step.id
    }
    return null
}

const EXTENSIONS: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/heic": "heic",
    "image/heif": "heif",
}

/**
 * Rename a photo to `photo-{n}.{ext}` before upload. Library filenames are
 * arbitrary and could carry a Barcode or other identifier (SPEC section 29.2).
 */
export function neutralPhotoFile(file: File, index: number): File {
    const fromName = /\.([a-z0-9]{2,5})$/i.exec(file.name)?.[1]?.toLowerCase()
    const extension = EXTENSIONS[file.type] ?? fromName ?? "jpg"
    return new File([file], `photo-${index + 1}.${extension}`, {
        type: file.type,
        lastModified: 0,
    })
}
