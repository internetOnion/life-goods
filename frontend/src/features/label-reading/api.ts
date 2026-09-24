import {
    createLabelReading,
    type LabelReading,
    type PhotoRole,
} from "@/api/generated"
import { apiError } from "@/features/photo-evidence/api"

export type { LabelReading, PhotoRole }

/**
 * Read one Product's label (SPEC §29.3). The request carries only the photos
 * and their capture roles: no Product identifier and never a Barcode.
 */
export async function readLabelPhotos(
    photos: File[],
    roles: PhotoRole[],
    options?: { signal?: AbortSignal },
): Promise<LabelReading> {
    const response = await createLabelReading({
        body: { photos, photo_roles: roles },
        signal: options?.signal,
    })

    if (response.error) {
        throw apiError(response.error, "The label-reading request failed.")
    }
    if (!response.data) {
        throw new Error("The label-reading request failed.")
    }
    return response.data
}
