import { describe, expect, it } from 'vitest'
import { isPhoneEnrichmentActive, phoneEnrichmentBadge, summarizeEnrichPhoneResponse } from './phoneEnrichment'

describe('isPhoneEnrichmentActive', () => {
  const lead = (phoneEnrichmentStatus: string | null) => ({ phoneEnrichmentStatus })

  it('is true while any lead is PENDING or IN_PROGRESS', () => {
    expect(isPhoneEnrichmentActive([lead(null), lead('PENDING')])).toBe(true)
    expect(isPhoneEnrichmentActive([lead('FOUND'), lead('IN_PROGRESS')])).toBe(true)
  })

  it('is false when every lead is idle or finished, or there is no data', () => {
    expect(isPhoneEnrichmentActive([lead(null), lead('FOUND'), lead('NOT_FOUND'), lead('FAILED')])).toBe(false)
    expect(isPhoneEnrichmentActive([])).toBe(false)
    expect(isPhoneEnrichmentActive(undefined)).toBe(false)
  })
})

describe('phoneEnrichmentBadge', () => {
  it('returns null for never-enriched leads', () => {
    expect(phoneEnrichmentBadge(null, null)).toBeNull()
  })

  it('shows the provider being tried while in progress', () => {
    expect(phoneEnrichmentBadge('IN_PROGRESS', 'astraDialer')).toMatchObject({
      label: 'Searching · Astra',
      tone: 'blue',
      inProgress: true,
    })
    expect(phoneEnrichmentBadge('PENDING', null)).toMatchObject({ label: 'Queued', inProgress: true })
  })

  it('shows which provider found the phone', () => {
    expect(phoneEnrichmentBadge('FOUND', 'nimbusLookup')).toMatchObject({ label: 'Found · Nimbus', tone: 'green' })
  })

  it('maps terminal failures to distinct badges', () => {
    expect(phoneEnrichmentBadge('NOT_FOUND', null)).toMatchObject({ label: 'No data found', tone: 'amber' })
    expect(phoneEnrichmentBadge('FAILED', null)).toMatchObject({ label: 'Failed', tone: 'red' })
  })

  it('falls back gracefully for unknown statuses and providers', () => {
    expect(phoneEnrichmentBadge('WEIRD', null)).toMatchObject({ label: 'WEIRD', tone: 'gray' })
    expect(phoneEnrichmentBadge('FOUND', 'newProvider')).toMatchObject({ label: 'Found · newProvider' })
  })
})

describe('summarizeEnrichPhoneResponse', () => {
  const ref = (leadId: number, leadName: string) => ({ leadId, leadName })

  it('summarizes started, already running, skipped and errors', () => {
    expect(
      summarizeEnrichPhoneResponse({
        started: [ref(1, 'Ada'), ref(2, 'Bob')],
        alreadyRunning: [ref(3, 'Cy')],
        skipped: [ref(4, 'Di')],
        errors: [{ ...ref(5, 'Ed'), error: 'x' }],
      })
    ).toEqual({
      success: 'Phone enrichment started for 2 leads',
      info: 'Already running for Cy; skipped Di (already have a phone)',
      error: 'Could not start phone enrichment for Ed. Please try again.',
    })
  })

  it('uses the singular and omits empty sections', () => {
    expect(
      summarizeEnrichPhoneResponse({ started: [ref(1, 'Ada')], alreadyRunning: [], skipped: [], errors: [] })
    ).toEqual({ success: 'Phone enrichment started for 1 lead' })
  })
})
