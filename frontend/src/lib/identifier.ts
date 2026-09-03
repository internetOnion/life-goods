export type IdentifierScheme = "GTIN_8" | "UPC_A" | "EAN_13" | "GTIN_14"

export type IdentifierValidation =
    | {
          valid: true
          value: string
          scheme: IdentifierScheme
      }
    | {
          valid: false
          reason: "required" | "characters" | "length" | "checkDigit"
          message: string
      }

export function normalizeIdentifier(raw: string): string {
    return raw.replace(/[\s\-._]/g, "").trim()
}

export function calculateCheckDigit(payload: string): number {
    let sum = 0
    const reversed = payload.split("").reverse()
    for (let i = 0; i < reversed.length; i++) {
        const char = reversed[i]
        if (!char) continue
        const digit = Number.parseInt(char, 10)
        const weight = i % 2 === 0 ? 3 : 1
        sum += digit * weight
    }
    return (10 - (sum % 10)) % 10
}

export function getIdentifierScheme(length: number): IdentifierScheme | null {
    switch (length) {
        case 8:
            return "GTIN_8"
        case 12:
            return "UPC_A"
        case 13:
            return "EAN_13"
        case 14:
            return "GTIN_14"
        default:
            return null
    }
}

export function validateIdentifier(input: string): IdentifierValidation {
    const normalized = normalizeIdentifier(input)

    if (!normalized) {
        return {
            valid: false,
            reason: "required",
            message: "Please enter a barcode number.",
        }
    }

    if (!/^\d+$/.test(normalized)) {
        return {
            valid: false,
            reason: "characters",
            message: "Barcode can only contain numbers, spaces, and hyphens.",
        }
    }

    const scheme = getIdentifierScheme(normalized.length)
    if (!scheme) {
        return {
            valid: false,
            reason: "length",
            message: `Barcode has ${normalized.length} digits. Expected 8 (GTIN-8), 12 (UPC-A), 13 (EAN-13), or 14 (GTIN-14) digits.`,
        }
    }

    const payload = normalized.slice(0, -1)
    const expectedCheckDigit = calculateCheckDigit(payload)
    const actualCheckDigit = Number.parseInt(normalized.slice(-1), 10)

    if (expectedCheckDigit !== actualCheckDigit) {
        return {
            valid: false,
            reason: "checkDigit",
            message: `Invalid check digit. The last digit should be ${expectedCheckDigit} instead of ${actualCheckDigit}.`,
        }
    }

    return {
        valid: true,
        value: normalized,
        scheme,
    }
}
