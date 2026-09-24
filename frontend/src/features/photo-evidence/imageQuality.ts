/**
 * On-device photo quality hints for label capture (SPEC section 29.1).
 *
 * The result is advisory: it may suggest a retake but never blocks submission.
 * Thresholds are initial estimates for a ~320 px grayscale copy and should be
 * calibrated against real label photos.
 */

export type PhotoQualityIssue = "dark" | "blurry" | "glare"

export interface PhotoQualityMetrics {
    /** Mean luminance, 0 (black) to 255 (white). */
    meanLuminance: number
    /** Variance of the 4-neighbour Laplacian; low values mean little edge detail. */
    sharpness: number
    /** Share of pixels at or near full white, 0 to 1. */
    clippedShare: number
}

export interface PhotoQuality {
    metrics: PhotoQualityMetrics
    issues: PhotoQualityIssue[]
}

export const QUALITY_SAMPLE_WIDTH = 320
export const DARK_MEAN_LUMINANCE = 55
export const BLURRY_SHARPNESS = 60
export const GLARE_CLIPPED_SHARE = 0.08
const CLIPPED_LUMINANCE = 250

/** Luminance of RGBA pixels (Rec. 601 weights), one value per pixel. */
export function toGrayscale(rgba: Uint8ClampedArray): Float32Array {
    const gray = new Float32Array(rgba.length / 4)
    for (let pixel = 0, offset = 0; pixel < gray.length; pixel++, offset += 4) {
        gray[pixel] =
            0.299 * (rgba[offset] ?? 0) +
            0.587 * (rgba[offset + 1] ?? 0) +
            0.114 * (rgba[offset + 2] ?? 0)
    }
    return gray
}

export function measurePhotoQuality(
    rgba: Uint8ClampedArray,
    width: number,
    height: number,
): PhotoQualityMetrics {
    if (width <= 0 || height <= 0 || rgba.length < width * height * 4) {
        throw new RangeError("Pixel data does not match the given dimensions")
    }
    const gray = toGrayscale(rgba)
    let sum = 0
    let clipped = 0
    for (const value of gray) {
        sum += value
        if (value >= CLIPPED_LUMINANCE) clipped += 1
    }

    let laplacianSum = 0
    let laplacianSquares = 0
    let samples = 0
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const index = y * width + x
            const at = (offset: number) => gray[index + offset] ?? 0
            const laplacian =
                at(-1) + at(1) + at(-width) + at(width) - 4 * at(0)
            laplacianSum += laplacian
            laplacianSquares += laplacian * laplacian
            samples += 1
        }
    }
    const laplacianMean = samples ? laplacianSum / samples : 0
    const sharpness = samples
        ? laplacianSquares / samples - laplacianMean * laplacianMean
        : 0

    return {
        meanLuminance: sum / gray.length,
        sharpness,
        clippedShare: clipped / gray.length,
    }
}

export function assessPhotoQuality(metrics: PhotoQualityMetrics): PhotoQuality {
    const issues: PhotoQualityIssue[] = []
    if (metrics.meanLuminance < DARK_MEAN_LUMINANCE) issues.push("dark")
    if (metrics.sharpness < BLURRY_SHARPNESS) issues.push("blurry")
    if (metrics.clippedShare > GLARE_CLIPPED_SHARE) issues.push("glare")
    return { metrics, issues }
}

/**
 * Decode a downscaled copy of a photo and assess it. Resolves null when the browser
 * cannot decode the photo (for example HEIC outside Safari); no check is shown then.
 */
export async function checkPhotoQuality(
    photo: Blob,
): Promise<PhotoQuality | null> {
    if (typeof createImageBitmap !== "function") return null
    let bitmap: ImageBitmap | null = null
    try {
        bitmap = await createImageBitmap(photo, {
            resizeWidth: QUALITY_SAMPLE_WIDTH,
            resizeQuality: "medium",
        })
        const canvas = document.createElement("canvas")
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const context = canvas.getContext("2d", { willReadFrequently: true })
        if (!context) return null
        context.drawImage(bitmap, 0, 0)
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
        return assessPhotoQuality(
            measurePhotoQuality(data, canvas.width, canvas.height),
        )
    } catch {
        return null
    } finally {
        bitmap?.close()
    }
}
