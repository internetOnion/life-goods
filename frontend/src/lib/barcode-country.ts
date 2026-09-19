import { normalizeIdentifier } from "./identifier"

type PrefixRange = {
    first: number
    last: number
    country: string
}

// These are GS1 allocation prefixes, not manufacturing-origin evidence.
// Keep the mapping explicit so an unknown or restricted prefix stays unknown.
const prefixRanges: readonly PrefixRange[] = [
    { first: 300, last: 379, country: "France" },
    { first: 380, last: 380, country: "Bulgaria" },
    { first: 383, last: 383, country: "Slovenia" },
    { first: 385, last: 385, country: "Croatia" },
    { first: 400, last: 440, country: "Germany" },
    { first: 450, last: 459, country: "Japan" },
    { first: 490, last: 499, country: "Japan" },
    { first: 500, last: 509, country: "United Kingdom" },
    { first: 520, last: 520, country: "Greece" },
    { first: 529, last: 529, country: "Cyprus" },
    { first: 539, last: 539, country: "Ireland" },
    { first: 540, last: 549, country: "Belgium / Luxembourg" },
    { first: 560, last: 560, country: "Portugal" },
    { first: 570, last: 579, country: "Denmark" },
    { first: 590, last: 590, country: "Poland" },
    { first: 594, last: 594, country: "Romania" },
    { first: 599, last: 599, country: "Hungary" },
    { first: 600, last: 601, country: "South Africa" },
    { first: 640, last: 649, country: "Finland" },
    { first: 690, last: 699, country: "China" },
    { first: 700, last: 709, country: "Norway" },
    { first: 729, last: 729, country: "Israel" },
    { first: 730, last: 739, country: "Sweden" },
    { first: 740, last: 746, country: "Central America" },
    { first: 750, last: 750, country: "Mexico" },
    { first: 754, last: 755, country: "Canada" },
    { first: 760, last: 769, country: "Switzerland / Liechtenstein" },
    { first: 770, last: 771, country: "Colombia" },
    { first: 773, last: 773, country: "Uruguay" },
    { first: 775, last: 775, country: "Peru" },
    { first: 778, last: 779, country: "Argentina" },
    { first: 780, last: 780, country: "Chile" },
    { first: 784, last: 784, country: "Paraguay" },
    { first: 786, last: 786, country: "Ecuador" },
    { first: 789, last: 790, country: "Brazil" },
    { first: 800, last: 839, country: "Italy" },
    { first: 840, last: 849, country: "Spain" },
    { first: 858, last: 858, country: "Slovakia" },
    { first: 859, last: 859, country: "Czech Republic" },
    { first: 860, last: 860, country: "Serbia" },
    { first: 865, last: 865, country: "Mongolia" },
    { first: 868, last: 869, country: "Türkiye" },
    { first: 870, last: 879, country: "Netherlands" },
    { first: 880, last: 880, country: "South Korea" },
    { first: 884, last: 884, country: "Cambodia" },
    { first: 885, last: 885, country: "Thailand" },
    { first: 888, last: 888, country: "Singapore" },
    { first: 890, last: 890, country: "India" },
    { first: 893, last: 893, country: "Vietnam" },
    { first: 896, last: 896, country: "Pakistan" },
    { first: 899, last: 899, country: "Indonesia" },
    { first: 900, last: 919, country: "Austria" },
    { first: 930, last: 939, country: "Australia" },
    { first: 940, last: 949, country: "New Zealand" },
    { first: 955, last: 955, country: "Malaysia" },
    { first: 958, last: 958, country: "Macau" },
]

function gs1Prefix(identifier: string): number | null {
    const normalized = normalizeIdentifier(identifier)
    if (normalized.length === 13 && /^\d+$/.test(normalized)) {
        return Number(normalized.slice(0, 3))
    }

    if (normalized.length === 14 && /^\d+$/.test(normalized)) {
        return Number(normalized.slice(1, 4))
    }

    return null
}

/**
 * Returns the country or region of the GS1 organisation that allocated a
 * Barcode prefix. This does not identify where the Product was manufactured.
 */
export function getBarcodeCountry(identifier: string): string | null {
    const prefix = gs1Prefix(identifier)
    if (prefix === null) return null

    return (
        prefixRanges.find(
            (range) => prefix >= range.first && prefix <= range.last,
        )?.country ?? null
    )
}
