import {
    createLabelReading,
    renderLabelReadingKhmer,
    type KhmerRenderedBlock,
    type KhmerRenderingBlockInput,
    type LabelReading,
    type PhotoRole,
} from "@/api/generated"
import { apiError } from "@/features/photo-evidence/api"

export type { KhmerRenderedBlock, LabelReading, PhotoRole }

/** Backend bounds for one Khmer Rendering request (SPEC §29.4). */
export const MAX_RENDERING_BLOCKS = 24
export const MAX_RENDERING_BLOCK_LENGTH = 2000
export const MAX_RENDERING_TOTAL_LENGTH = 8000

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

/**
 * Readable Printed Text worth rendering, in reading order, within the backend
 * bounds. Blocks that do not fit are simply not rendered; their printed text
 * still shows. Only block IDs, text, and language are sent.
 */
export function khmerRenderingBlocks(
    reading: LabelReading,
): KhmerRenderingBlockInput[] {
    const candidates = [
        ...(reading.ingredients ?? []),
        ...(reading.allergen_statements ?? []),
        ...(reading.printed_facts ?? []),
    ]
    const blocks: KhmerRenderingBlockInput[] = []
    let total = 0
    for (const block of candidates) {
        const text = block.original_script?.trim()
        if (block.state !== "readable" || !text) continue
        if (text.length > MAX_RENDERING_BLOCK_LENGTH) continue
        if (total + text.length > MAX_RENDERING_TOTAL_LENGTH) continue
        if (blocks.length >= MAX_RENDERING_BLOCKS) break
        blocks.push({
            block_id: block.block_id,
            text,
            language: block.language || "und",
        })
        total += text.length
    }
    return blocks
}

/** Machine-generated Khmer Rendering of Printed Text; not stored, not verified. */
export async function renderKhmerText(
    blocks: KhmerRenderingBlockInput[],
    options?: { signal?: AbortSignal },
): Promise<KhmerRenderedBlock[]> {
    const response = await renderLabelReadingKhmer({
        body: { schema_version: 1, blocks },
        signal: options?.signal,
    })

    if (response.error) {
        throw apiError(response.error, "The Khmer Rendering request failed.")
    }
    if (!response.data) {
        throw new Error("The Khmer Rendering request failed.")
    }
    return response.data.blocks
}
