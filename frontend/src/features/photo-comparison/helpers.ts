import type { AppLocale } from "@/i18n/locale"

import { translateCompare } from "./translations"
import type { FieldState, NutritionColumn } from "./types"

export const NUTRIENT_NAMES: Record<AppLocale, Record<string, string>> = {
    en: {
        energy: "Energy",
        fat: "Total Fat",
        saturated_fat: "Saturated Fat",
        trans_fat: "Trans Fat",
        unsaturated_fat: "Unsaturated Fat",
        monounsaturated_fat: "Monounsaturated Fat",
        polyunsaturated_fat: "Polyunsaturated Fat",
        calories_from_fat: "Calories from Fat",
        cholesterol: "Cholesterol",
        carbohydrate: "Total Carbohydrates",
        sugars: "Sugars",
        added_sugars: "Added Sugars",
        fiber: "Dietary Fiber",
        protein: "Protein",
        salt: "Salt",
        sodium: "Sodium",
        potassium: "Potassium",
        calcium: "Calcium",
        iron: "Iron",
        vitamin_a: "Vitamin A",
        vitamin_b1: "Vitamin B1",
        vitamin_b2: "Vitamin B2",
        vitamin_b5: "Vitamin B5",
        vitamin_b6: "Vitamin B6",
        vitamin_b12: "Vitamin B12",
        vitamin_c: "Vitamin C",
        vitamin_d: "Vitamin D",
        niacin: "Niacin",
        folic_acid: "Folic Acid",
        vitamin_e: "Vitamin E",
        vitamin_k: "Vitamin K",
        magnesium: "Magnesium",
        phosphorus: "Phosphorus",
        zinc: "Zinc",
        copper: "Copper",
        manganese: "Manganese",
        selenium: "Selenium",
        iodine: "Iodine",
        starch: "Starch",
        caffeine: "Caffeine",
    },
    km: {
        energy: "ថាមពល",
        fat: "ខ្លាញ់សរុប",
        saturated_fat: "ខ្លាញ់ឆ្អែត",
        trans_fat: "ខ្លាញ់ត្រង់ស៍",
        unsaturated_fat: "ខ្លាញ់មិនឆ្អែត",
        monounsaturated_fat: "ខ្លាញ់មិនឆ្អែតតែមួយ",
        polyunsaturated_fat: "ខ្លាញ់មិនឆ្អែតច្រើន",
        calories_from_fat: "កាឡូរីពីខ្លាញ់",
        cholesterol: "កូឡេស្តេរ៉ុល",
        carbohydrate: "កាបូអ៊ីដ្រាតសរុប",
        sugars: "ស្ករ",
        added_sugars: "ស្ករបន្ថែម",
        fiber: "ជាតិសរសៃអាហារ",
        protein: "ប្រូតេអ៊ីន",
        salt: "អំបិល",
        sodium: "សូដ្យូម",
        potassium: "ប៉ូតាស្យូម",
        calcium: "កាល់ស្យូម",
        iron: "ជាតិដែក",
        vitamin_a: "វីតាមីន A",
        vitamin_b1: "វីតាមីន B1",
        vitamin_b2: "វីតាមីន B2",
        vitamin_b5: "វីតាមីន B5",
        vitamin_b6: "វីតាមីន B6",
        vitamin_b12: "វីតាមីន B12",
        vitamin_c: "វីតាមីន C",
        vitamin_d: "វីតាមីន D",
        niacin: "នីអាស៊ីន",
        folic_acid: "អាស៊ីតហ្វូលិក",
        vitamin_e: "វីតាមីន E",
        vitamin_k: "វីតាមីន K",
        magnesium: "ម៉ាញ៉េស្យូម",
        phosphorus: "ផូស្វ័រ",
        zinc: "ស័ង្កសី",
        copper: "ទង់ដែង",
        manganese: "ម៉ង់ហ្គាណែស",
        selenium: "សេលេញ៉ូម",
        iodine: "អ៊ីយ៉ូត",
        starch: "ម្សៅ",
        caffeine: "កាហ្វេអ៊ីន",
    },
}

const NON_LATIN_SCRIPT =
    /[\p{Script=Han}\p{Script=Thai}\p{Script=Khmer}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Arabic}\p{Script=Lao}\p{Script=Myanmar}]/u
const SEGMENT_SPLIT = /[/|／•·]/
const DECORATION = /[*†‡]+|\([^)]*\)|（[^）]*）/g
const ENGLISH_NUTRIENT_WORD =
    /fat|acid|vitamin|sugar|carb|protein|sodium|energy|calor|fib|chol|salt|mineral|potassium|calcium|iron/i

/**
 * Multilingual package labels ("Asid Lemak Tepu / Saturated Fat / 饱和脂肪")
 * are reduced to their English/Latin segment so the table never shows a
 * language the user did not choose. Returns the input when no Latin segment exists.
 */
export function pickLatinSegment(label: string): string {
    const segments = label
        .replace(DECORATION, " ")
        .split(SEGMENT_SPLIT)
        .map((part) => part.replace(/\s+/g, " ").trim())
        .filter(Boolean)
    const latin = segments.filter((part) => !NON_LATIN_SCRIPT.test(part))
    if (latin.length === 0) {
        return (
            label.replace(DECORATION, " ").replace(/\s+/g, " ").trim() || label
        )
    }
    return (
        latin.find((part) => ENGLISH_NUTRIENT_WORD.test(part)) ??
        latin[latin.length - 1] ??
        label
    )
}

/** Strip decorations and secondary-language segments from a printed unit ("kcal/千卡*" → "kcal"). */
export function cleanUnitText(unit?: string | null): string {
    if (!unit) return ""
    return pickLatinSegment(unit)
}

export function displayValue(
    value: string | number | null | undefined,
    unit = "",
): string {
    if (value === null || value === undefined || value === "") {
        return "—"
    }
    const cleanUnit = cleanUnitText(unit)
    return `${String(value)}${cleanUnit ? ` ${cleanUnit}` : ""}`
}

export function formatNormalizedValue(
    value?: string | number | null,
    unit?: string | null,
    locale: AppLocale = "en",
): string {
    if (value === null || value === undefined || value === "") {
        return "—"
    }
    const num =
        typeof value === "number"
            ? value
            : Number.parseFloat(String(value).replace(/,/g, ""))
    if (Number.isNaN(num)) {
        return displayValue(value, unit || "")
    }
    const formatted = new Intl.NumberFormat(
        locale === "km" ? "km-KH" : "en-US",
        {
            maximumFractionDigits: 2,
        },
    ).format(num)
    return unit ? `${formatted} ${unit}` : formatted
}

export function formatNutrientName(
    nutrient: string,
    fallbackLabel?: string | null,
    locale: AppLocale = "en",
): string {
    let cleanKey = nutrient
    if (cleanKey.includes(":")) {
        const parts = cleanKey.split(":")
        cleanKey = parts[parts.length - 1] || cleanKey
    }
    cleanKey = cleanKey
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_")

    const match = NUTRIENT_NAMES[locale][cleanKey]
    if (match) {
        return match
    }

    const fallback = pickLatinSegment(
        fallbackLabel || nutrient.replace(/_/g, " "),
    )
    return locale === "en"
        ? fallback.replace(/\b\w/g, (c) => c.toUpperCase())
        : fallback
}

const BASIS_RANK: Record<string, number> = {
    per_100g: 0,
    per_100ml: 1,
    per_serving: 2,
    per_package: 3,
    unknown: 4,
}

function hasAmountRows(column: NutritionColumn): boolean {
    return (column.fields ?? []).some(
        (field) => field.row_kind !== "percentage",
    )
}

/**
 * Auto-select the nutrition column to compare on so the shopper never has to
 * pick between printed package headers. Prefers per 100 g/ml, then per serving,
 * then per package; skips "% Daily Value"-style columns (basis "other" or
 * percentage-only) when any real amount column exists. Falls back to the first
 * column so a choice is always made when columns exist.
 */
export function pickDefaultColumnId(
    columns?: NutritionColumn[] | null,
): string | null {
    if (!columns || columns.length === 0) return null
    const withAmounts = columns.filter(hasAmountRows)
    const candidates = columns.filter(
        (column) =>
            column.basis !== "other" &&
            (withAmounts.length === 0 || hasAmountRows(column)),
    )
    const pool = candidates.length > 0 ? candidates : columns
    const ranked = pool
        .map((column, index) => ({
            column,
            index,
            rank: BASIS_RANK[column.basis ?? "unknown"] ?? BASIS_RANK.unknown!,
        }))
        .sort((a, b) => a.rank - b.rank || a.index - b.index)
    return ranked[0]?.column.column_id ?? null
}

export function getMissingCellText(
    state?: FieldState | null,
    locale: AppLocale = "en",
): string {
    if (
        state === "unreadable" ||
        state === "ambiguous" ||
        state === "conflicting"
    ) {
        return translateCompare(locale, "couldNotRead")
    }
    return translateCompare(locale, "notFoundPhotos")
}

export function displayBasisLabel(
    basis?: string | null,
    locale: AppLocale = "en",
): string {
    switch (basis) {
        case "per_package":
            return translateCompare(locale, "perPackage")
        case "per_serving":
            return translateCompare(locale, "perServing")
        case "per_100g":
            return translateCompare(locale, "per100g")
        case "per_100ml":
            return translateCompare(locale, "per100ml")
        default:
            return translateCompare(locale, "notSpecified")
    }
}

export function formatPreparationLabel(
    prep?: string | null,
    locale: AppLocale = "en",
): string {
    switch (prep) {
        case "dry":
            return translateCompare(locale, "dry")
        case "as_sold":
            return translateCompare(locale, "asSold")
        case "as_prepared":
        case "prepared":
            return translateCompare(locale, "asPrepared")
        default:
            return translateCompare(locale, "preparationNotStated")
    }
}

export function formatBasisAndPrep(
    basis?: string | null,
    prep?: string | null,
    locale: AppLocale = "en",
): string {
    const b = displayBasisLabel(basis, locale)
    const p = formatPreparationLabel(prep, locale)
    return `${b} · ${p}`
}

export function formatActionableError(
    message: string,
    code?: import("@/api/generated").PhotoComparisonErrorCode,
    locale: AppLocale = "en",
): string {
    switch (code) {
        case "unsupported_image_format":
            return translateCompare(locale, "invalidPhotoRequest")
        // The bytes, not the format, were the problem: an empty or truncated upload.
        case "request_invalid":
            return translateCompare(locale, "photoUnreadableOnDevice")
        case "size_limit_exceeded":
            return translateCompare(locale, "photoRequestTooLarge")
        case "rate_limit_exceeded":
        case "capacity_limit_exceeded":
            return translateCompare(locale, "providerCapacity")
        case "provider_output_invalid":
            return translateCompare(locale, "providerOutputInvalid")
        case "provider_timeout":
            return translateCompare(locale, "providerTimeout")
        case "provider_unavailable":
            return translateCompare(locale, "providerUnavailable")
        case "internal_error":
            return translateCompare(locale, "requestFailed")
    }

    const lower = message.toLowerCase()
    if (lower.includes("timeout") || lower.includes("timed out")) {
        return translateCompare(locale, "providerTimeout")
    }
    if (lower.includes("unavailable")) {
        return translateCompare(locale, "providerUnavailable")
    }
    if (lower.includes("rate limit") || lower.includes("capacity")) {
        return translateCompare(locale, "providerCapacity")
    }
    return translateCompare(locale, "requestFailed")
}

export function formatStateLabel(
    value: string | null | undefined,
    locale: AppLocale = "en",
): string {
    if (!value) return translateCompare(locale, "stateUnknown")
    return value.replaceAll("_", " ")
}

export const MAX_PHOTO_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MiB

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
    "image/jpeg",
    "image/jpg",
    "image/pjpeg",
    "image/png",
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "image/heif-sequence",
])
const SUPPORTED_IMAGE_EXTENSIONS = new Set([
    "jpg",
    "jpeg",
    "png",
    "heic",
    "heif",
])
const HEIC_EXTENSIONS = new Set(["heic", "heif"])

/** Accept string shared by every photo file input in Compare Products. */
export const PHOTO_INPUT_ACCEPT =
    "image/jpeg,image/png,image/heic,image/heif,.heic,.heif"

function fileExtension(file: File): string {
    const dot = file.name.lastIndexOf(".")
    return dot === -1 ? "" : file.name.slice(dot + 1).toLowerCase()
}

/**
 * Some pickers (notably iOS share sheets and drag-and-drop) hand over a `File` with an
 * empty `type`; fall back to the extension so those photos are not rejected client-side.
 * The backend still validates the actual bytes.
 */
export function isSupportedImageFile(file: File): boolean {
    const type = file.type.toLowerCase()
    if (type) return SUPPORTED_IMAGE_MIME_TYPES.has(type)
    return SUPPORTED_IMAGE_EXTENSIONS.has(fileExtension(file))
}

export function isAcceptedPhotoFile(file: File): boolean {
    return isSupportedImageFile(file) && file.size <= MAX_PHOTO_FILE_SIZE_BYTES
}

/** HEIC/HEIF previews only render in Safari; other browsers fire `<img onError>`. */
export function isHeicFile(file: File): boolean {
    const type = file.type.toLowerCase()
    if (type)
        return type.startsWith("image/heic") || type.startsWith("image/heif")
    return HEIC_EXTENSIONS.has(fileExtension(file))
}

/**
 * A picked `File` is only a handle to device storage, so reading it can still fail after
 * the picker succeeds — most often an iCloud-optimized photo that is not downloaded yet.
 * Touching the first byte surfaces that here rather than as an empty or truncated upload
 * the backend can only reject.
 */
export async function isReadablePhotoFile(file: File): Promise<boolean> {
    if (file.size === 0) return false
    const head = file.slice(0, 1)
    // Never reject a photo just because the environment lacks Blob.arrayBuffer;
    // the backend still validates the bytes.
    if (typeof head.arrayBuffer !== "function") return true
    try {
        return (await head.arrayBuffer()).byteLength === 1
    } catch {
        return false
    }
}
