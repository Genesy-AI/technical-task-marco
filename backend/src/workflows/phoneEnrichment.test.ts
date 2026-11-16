import { describe, expect, it } from 'vitest'
import { decideFinalStatus, ProviderAttempt } from './phoneEnrichment'

const a = (providerId: ProviderAttempt['providerId'], outcome: ProviderAttempt['outcome']): ProviderAttempt => ({
  providerId,
  outcome,
})

describe('decideFinalStatus', () => {
  it('is FOUND when any provider found a phone', () => {
    expect(decideFinalStatus([a('orionConnect', 'ERROR'), a('astraDialer', 'FOUND')])).toBe('FOUND')
  })

  it('is NOT_FOUND when at least one provider answered without data', () => {
    expect(
      decideFinalStatus([a('orionConnect', 'ERROR'), a('astraDialer', 'NO_DATA'), a('nimbusLookup', 'ERROR')])
    ).toBe('NOT_FOUND')
  })

  it('is FAILED when every called provider errored, ignoring skipped ones', () => {
    expect(
      decideFinalStatus([a('orionConnect', 'SKIPPED'), a('astraDialer', 'ERROR'), a('nimbusLookup', 'ERROR')])
    ).toBe('FAILED')
  })

  it('is NOT_FOUND when every provider was skipped (nothing failed, we just lack inputs)', () => {
    expect(decideFinalStatus([a('orionConnect', 'SKIPPED'), a('astraDialer', 'SKIPPED')])).toBe('NOT_FOUND')
  })

  it('is NOT_FOUND for no attempts', () => {
    expect(decideFinalStatus([])).toBe('NOT_FOUND')
  })
})
