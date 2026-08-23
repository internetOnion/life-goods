import { describe, expect, test } from 'vitest'

import { validateIdentifier } from '../src/features/package-match/identifier'


describe('barcode validation', () => {
  test.each([
    ['9638 5074', '96385074'],
    ['0-12345-67890-5', '012345678905'],
    ['4 006381 333931', '4006381333931'],
    ['1 0012345 000017', '10012345000017'],
  ])('normalizes a supported representation', (entered, normalized) => {
    expect(validateIdentifier(entered)).toEqual({ valid: true, value: normalized })
  })

  test.each([
    ['', 'required'],
    ['1234', 'length'],
    ['40063813A3931', 'characters'],
    ['4006381333932', 'checkDigit'],
  ] as const)('rejects invalid input locally', (entered, reason) => {
    expect(validateIdentifier(entered)).toEqual({ valid: false, reason })
  })
})
