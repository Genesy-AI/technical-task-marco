import { describe, expect, it, vi } from 'vitest'

// The route module imports Prisma and the workflow; only the pure helpers are under test here.
vi.mock('../db/prisma', () => ({ prisma: {} }))

import { enrichPhoneWorkflowId, parseLeadIds } from './enrichPhone'

describe('parseLeadIds', () => {
  it('accepts positive integers (and numeric strings) and dedupes them', () => {
    expect(parseLeadIds([3, 1, 3, '2'])).toEqual([3, 1, 2])
  })

  it.each([undefined, null, 'x', [], {}, [0], [-1], [1.5], ['abc'], [1, null]])('rejects %j', (input) => {
    expect(parseLeadIds(input)).toBeNull()
  })
})

describe('enrichPhoneWorkflowId', () => {
  it('is stable per lead (idempotency key)', () => {
    expect(enrichPhoneWorkflowId(42)).toBe('enrich-phone-42')
  })
})
