import { normalizeIdentifier } from "./identifier"

type PrefixRange = {
    first: number
    last: number
    region: string
}

// These are GS1 allocation prefixes, not manufacturing-origin evidence.
// Reserved, restricted-circulation, and application-specific prefixes are
// intentionally omitted so they remain unavailable rather than implying a
// country or region that the Barcode does not establish.
const prefixRanges: readonly PrefixRange[] = [
    { first: 1, last: 19, region: "United States" },
    { first: 30, last: 39, region: "United States" },
    { first: 60, last: 139, region: "United States" },
    { first: 300, last: 379, region: "France" },
    { first: 380, last: 380, region: "Bulgaria" },
    { first: 383, last: 383, region: "Slovenia" },
    { first: 385, last: 385, region: "Croatia" },
    { first: 387, last: 387, region: "Bosnia and Herzegovina" },
    { first: 389, last: 389, region: "Montenegro" },
    { first: 400, last: 440, region: "Germany" },
    { first: 450, last: 459, region: "Japan" },
    { first: 460, last: 469, region: "Russia" },
    { first: 470, last: 470, region: "Kyrgyzstan" },
    { first: 471, last: 471, region: "Chinese Taipei" },
    { first: 474, last: 474, region: "Estonia" },
    { first: 475, last: 475, region: "Latvia" },
    { first: 476, last: 476, region: "Azerbaijan" },
    { first: 477, last: 477, region: "Lithuania" },
    { first: 478, last: 478, region: "Uzbekistan" },
    { first: 479, last: 479, region: "Sri Lanka" },
    { first: 480, last: 480, region: "Philippines" },
    { first: 481, last: 481, region: "Belarus" },
    { first: 482, last: 482, region: "Ukraine" },
    { first: 483, last: 483, region: "Turkmenistan" },
    { first: 484, last: 484, region: "Moldova" },
    { first: 485, last: 485, region: "Armenia" },
    { first: 486, last: 486, region: "Georgia" },
    { first: 487, last: 487, region: "Kazakhstan" },
    { first: 488, last: 488, region: "Tajikistan" },
    { first: 489, last: 489, region: "Hong Kong" },
    { first: 490, last: 499, region: "Japan" },
    { first: 500, last: 509, region: "United Kingdom" },
    { first: 520, last: 521, region: "Greece" },
    { first: 528, last: 528, region: "Lebanon" },
    { first: 529, last: 529, region: "Cyprus" },
    { first: 530, last: 530, region: "Albania" },
    { first: 531, last: 531, region: "North Macedonia" },
    { first: 535, last: 535, region: "Malta" },
    { first: 539, last: 539, region: "Ireland" },
    { first: 540, last: 549, region: "Belgium / Luxembourg" },
    { first: 560, last: 560, region: "Portugal" },
    { first: 569, last: 569, region: "Iceland" },
    { first: 570, last: 579, region: "Denmark" },
    { first: 590, last: 590, region: "Poland" },
    { first: 594, last: 594, region: "Romania" },
    { first: 599, last: 599, region: "Hungary" },
    { first: 600, last: 601, region: "South Africa" },
    { first: 603, last: 603, region: "Ghana" },
    { first: 604, last: 604, region: "Senegal" },
    { first: 605, last: 605, region: "Uganda" },
    { first: 606, last: 606, region: "Angola" },
    { first: 607, last: 607, region: "Oman" },
    { first: 608, last: 608, region: "Bahrain" },
    { first: 609, last: 609, region: "Mauritius" },
    { first: 611, last: 611, region: "Morocco" },
    { first: 613, last: 613, region: "Algeria" },
    { first: 615, last: 615, region: "Nigeria" },
    { first: 616, last: 616, region: "Kenya" },
    { first: 617, last: 617, region: "Cameroon" },
    { first: 618, last: 618, region: "Côte d'Ivoire" },
    { first: 619, last: 619, region: "Tunisia" },
    { first: 620, last: 620, region: "Tanzania" },
    { first: 621, last: 621, region: "Syria" },
    { first: 622, last: 622, region: "Egypt" },
    { first: 624, last: 624, region: "Libya" },
    { first: 625, last: 625, region: "Jordan" },
    { first: 626, last: 626, region: "Iran" },
    { first: 627, last: 627, region: "Kuwait" },
    { first: 628, last: 628, region: "Saudi Arabia" },
    { first: 629, last: 629, region: "United Arab Emirates" },
    { first: 630, last: 630, region: "Qatar" },
    { first: 631, last: 631, region: "Namibia" },
    { first: 632, last: 632, region: "Rwanda" },
    { first: 640, last: 649, region: "Finland" },
    { first: 680, last: 681, region: "China" },
    { first: 690, last: 699, region: "China" },
    { first: 700, last: 709, region: "Norway" },
    { first: 729, last: 729, region: "Israel" },
    { first: 730, last: 739, region: "Sweden" },
    { first: 740, last: 740, region: "Guatemala" },
    { first: 741, last: 741, region: "El Salvador" },
    { first: 742, last: 742, region: "Honduras" },
    { first: 743, last: 743, region: "Nicaragua" },
    { first: 744, last: 744, region: "Costa Rica" },
    { first: 745, last: 745, region: "Panama" },
    { first: 746, last: 746, region: "Dominican Republic" },
    { first: 750, last: 750, region: "Mexico" },
    { first: 754, last: 755, region: "Canada" },
    { first: 759, last: 759, region: "Venezuela" },
    { first: 760, last: 769, region: "Switzerland" },
    { first: 770, last: 771, region: "Colombia" },
    { first: 773, last: 773, region: "Uruguay" },
    { first: 775, last: 775, region: "Peru" },
    { first: 777, last: 777, region: "Bolivia" },
    { first: 778, last: 779, region: "Argentina" },
    { first: 780, last: 780, region: "Chile" },
    { first: 784, last: 784, region: "Paraguay" },
    { first: 786, last: 786, region: "Ecuador" },
    { first: 789, last: 790, region: "Brazil" },
    { first: 800, last: 839, region: "Italy" },
    { first: 840, last: 849, region: "Spain" },
    { first: 850, last: 850, region: "Cuba" },
    { first: 858, last: 858, region: "Slovakia" },
    { first: 859, last: 859, region: "Czech Republic" },
    { first: 860, last: 860, region: "Serbia" },
    { first: 865, last: 865, region: "Mongolia" },
    { first: 867, last: 867, region: "North Korea" },
    { first: 868, last: 869, region: "Türkiye" },
    { first: 870, last: 879, region: "Netherlands" },
    { first: 880, last: 881, region: "South Korea" },
    { first: 883, last: 883, region: "Myanmar" },
    { first: 884, last: 884, region: "Cambodia" },
    { first: 885, last: 885, region: "Thailand" },
    { first: 888, last: 888, region: "Singapore" },
    { first: 890, last: 890, region: "India" },
    { first: 893, last: 893, region: "Vietnam" },
    { first: 896, last: 896, region: "Pakistan" },
    { first: 899, last: 899, region: "Indonesia" },
    { first: 900, last: 919, region: "Austria" },
    { first: 930, last: 939, region: "Australia" },
    { first: 940, last: 949, region: "New Zealand" },
    { first: 955, last: 955, region: "Malaysia" },
    { first: 958, last: 958, region: "Macau" },
]

function gs1Prefix(identifier: string): number | null {
    const normalized = normalizeIdentifier(identifier)
    if (!/^\d+$/.test(normalized)) return null

    if (normalized.length === 8 || normalized.length === 13) {
        return Number(normalized.slice(0, 3))
    }

    if (normalized.length === 12) {
        // UPC-A has an implied leading zero when represented as a GTIN-13.
        return Number(`0${normalized.slice(0, 2)}`)
    }

    if (normalized.length === 14) {
        // GTIN-14 starts with an indicator digit before the underlying GTIN.
        return Number(normalized.slice(1, 4))
    }

    return null
}

/**
 * Returns the GS1 allocation region for a Barcode prefix.
 * This does not identify where the Product was manufactured.
 */
export function getGs1AllocationRegion(identifier: string): string | null {
    const prefix = gs1Prefix(identifier)
    if (prefix === null) return null

    return (
        prefixRanges.find(
            (range) => prefix >= range.first && prefix <= range.last,
        )?.region ?? null
    )
}
