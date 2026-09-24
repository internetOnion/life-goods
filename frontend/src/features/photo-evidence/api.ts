import {
    comparePhotoComparison,
    extractPhotoComparison,
    type ComparisonResponse,
    type Extraction,
    type PhotoComparisonErrorCode,
    type PhotoComparisonErrorResponse,
} from "@/api/generated"
import type { ComparisonRequest } from "./types"

export class PhotoComparisonApiError extends Error {
    readonly code: PhotoComparisonErrorCode

    constructor(code: PhotoComparisonErrorCode, message: string) {
        super(message)
        this.name = "PhotoComparisonApiError"
        this.code = code
    }
}

export function apiError(
    responseError: unknown,
    fallbackMessage: string,
): PhotoComparisonApiError {
    const detail = (responseError as PhotoComparisonErrorResponse | undefined)
        ?.error

    return new PhotoComparisonApiError(
        detail?.code ?? "internal_error",
        detail?.message || fallbackMessage,
    )
}

export async function extractProductPhotos(
    productId: string,
    photos: File[],
    options?: { signal?: AbortSignal },
): Promise<Extraction> {
    const response = await extractPhotoComparison({
        body: {
            product_id: productId,
            photos,
        },
        signal: options?.signal,
    })

    if (response.error) {
        throw apiError(response.error, "The extraction request failed.")
    }

    if (!response.data) {
        throw new Error("The extraction request failed.")
    }

    return response.data
}

export async function compareProducts(
    payload: ComparisonRequest,
    options?: { signal?: AbortSignal },
): Promise<ComparisonResponse> {
    const response = await comparePhotoComparison({
        body: {
            left: payload.left,
            right: payload.right,
            left_column_id: payload.left_column_id ?? undefined,
            right_column_id: payload.right_column_id ?? undefined,
            schema_version: payload.schema_version,
        },
        signal: options?.signal,
    })

    if (response.error) {
        throw apiError(response.error, "The comparison request failed.")
    }

    if (!response.data) {
        throw new Error("The comparison request failed.")
    }

    return response.data
}
