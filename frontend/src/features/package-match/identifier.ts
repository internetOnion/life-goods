export type IdentifierValidation =
  | { valid: true; value: string }
  | {
      valid: false
      reason: 'required' | 'characters' | 'length' | 'checkDigit'
    }

const supportedLengths = new Set([8, 12, 13, 14])

export function validateIdentifier(entered: string): IdentifierValidation {
  const stripped = entered.trim()
  if (!stripped) return { valid: false, reason: 'required' }

  const normalized = stripped.replaceAll(' ', '').replaceAll('-', '')
  if (!/^\d+$/.test(normalized)) return { valid: false, reason: 'characters' }
  if (!supportedLengths.has(normalized.length)) return { valid: false, reason: 'length' }

  const body = normalized.slice(0, -1)
  const weightedSum = [...body]
    .reverse()
    .reduce((sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 3 : 1), 0)
  const expectedCheckDigit = (10 - (weightedSum % 10)) % 10
  if (Number(normalized.at(-1)) !== expectedCheckDigit) {
    return { valid: false, reason: 'checkDigit' }
  }

  return { valid: true, value: normalized }
}
