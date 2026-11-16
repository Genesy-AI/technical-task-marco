import { describe, it, expect } from 'vitest'
import { ISO_ALPHA2_CODES, normalizeCountryCode } from './countryCode'

describe('normalizeCountryCode', () => {
  it('contains all 249 ISO 3166-1 alpha-2 codes', () => {
    expect(ISO_ALPHA2_CODES.size).toBe(249)
  })

  it('accepts valid codes and normalizes to uppercase', () => {
    expect(normalizeCountryCode('ES')).toEqual({ code: 'ES', invalid: false })
    expect(normalizeCountryCode('es')).toEqual({ code: 'ES', invalid: false })
    expect(normalizeCountryCode('  us ')).toEqual({ code: 'US', invalid: false })
  })

  it('maps UK to GB', () => {
    expect(normalizeCountryCode('UK')).toEqual({ code: 'GB', invalid: false })
    expect(normalizeCountryCode('uk')).toEqual({ code: 'GB', invalid: false })
  })

  it('treats empty values as valid and null (field is optional)', () => {
    expect(normalizeCountryCode(undefined)).toEqual({ code: null, invalid: false })
    expect(normalizeCountryCode(null)).toEqual({ code: null, invalid: false })
    expect(normalizeCountryCode('')).toEqual({ code: null, invalid: false })
    expect(normalizeCountryCode('   ')).toEqual({ code: null, invalid: false })
  })

  it('rejects invalid codes', () => {
    for (const value of ['XXX', '12', 'XX', 'E', 'ESP', 'Spain', 'EU']) {
      expect(normalizeCountryCode(value)).toEqual({ code: null, invalid: true })
    }
  })

  it('rejects non-string values', () => {
    expect(normalizeCountryCode(12)).toEqual({ code: null, invalid: true })
    expect(normalizeCountryCode({})).toEqual({ code: null, invalid: true })
  })
})
