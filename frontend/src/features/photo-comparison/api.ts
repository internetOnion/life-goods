import type {
    ComparisonRequest,
    ComparisonResponse,
    Extraction,
    PhotoComparisonErrorResponse,
} from "./types"

const BASE_URL = import.meta.env.VITE_PHOTO_COMPARISON_API_URL
    ? String(import.meta.env.VITE_PHOTO_COMPARISON_API_URL).replace(/\/+$/, "")
    : ""

const EXTRACTION_PATH = `${BASE_URL}/api/experimental/photo-comparison/extractions`
const COMPARISON_PATH = `${BASE_URL}/api/experimental/photo-comparison/comparisons`

export async function extractProductPhotos(
    productId: string,
    photos: File[],
): Promise<Extraction> {
    const formData = new FormData()
    formData.append("product_id", productId)
    for (const photo of photos) {
        formData.append("photos", photo, photo.name)
    }

    const response = await fetch(EXTRACTION_PATH, {
        method: "POST",
        body: formData,
    })

    const body = (await response.json()) as unknown
    if (!response.ok) {
        const errorDetail = (body as PhotoComparisonErrorResponse | undefined)
            ?.error
        const message = errorDetail?.message || "The extraction request failed."
        throw new Error(message)
    }

    return body as Extraction
}

export async function compareProducts(
    payload: ComparisonRequest,
): Promise<ComparisonResponse> {
    const response = await fetch(COMPARISON_PATH, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    })

    const body = (await response.json()) as unknown
    if (!response.ok) {
        const errorDetail = (body as PhotoComparisonErrorResponse | undefined)
            ?.error
        const message = errorDetail?.message || "The comparison request failed."
        throw new Error(message)
    }

    return body as ComparisonResponse
}
