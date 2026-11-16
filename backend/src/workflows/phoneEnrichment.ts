/**
 * Phone enrichment domain: statuses, provider order and result types.
 * Pure (no I/O, type-only imports) so it is safe to import from the workflow sandbox,
 * activities and the HTTP route alike.
 */
import type { PhoneProviderId } from '../providers/types'

export const PhoneEnrichmentStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  FOUND: 'FOUND',
  NOT_FOUND: 'NOT_FOUND',
  FAILED: 'FAILED',
} as const
export type PhoneEnrichmentStatus = (typeof PhoneEnrichmentStatus)[keyof typeof PhoneEnrichmentStatus]

/** PENDING/IN_PROGRESS: a workflow may own the lead, so the route must not overwrite its status. */
export const isActivePhoneEnrichmentStatus = (status: string | null): boolean =>
  status === PhoneEnrichmentStatus.PENDING || status === PhoneEnrichmentStatus.IN_PROGRESS

/** Fallback chain: best data first (Orion), then fastest (Astra), then newest (Nimbus). */
export const PHONE_PROVIDER_ORDER: readonly PhoneProviderId[] = ['orionConnect', 'astraDialer', 'nimbusLookup']

/** What a provider activity returns. Errors are thrown (and retried by Temporal), not returned. */
export type ProviderActivityResult =
  | { outcome: 'FOUND'; phone: string; countryCode: string | null }
  | { outcome: 'NO_DATA' }
  | { outcome: 'SKIPPED' }

export interface ProviderAttempt {
  providerId: PhoneProviderId
  outcome: 'FOUND' | 'NO_DATA' | 'SKIPPED' | 'ERROR'
  error?: string
}

export interface EnrichPhoneResult {
  status: typeof PhoneEnrichmentStatus.FOUND | typeof PhoneEnrichmentStatus.NOT_FOUND | typeof PhoneEnrichmentStatus.FAILED
  providerId: PhoneProviderId | null
  phone: string | null
  attempts: ProviderAttempt[]
}

/**
 * Final status once the chain is exhausted (or stopped early):
 * FOUND if any provider found a phone; FAILED only if every provider we actually called errored
 * (we cannot claim "no data" when nobody answered); otherwise NOT_FOUND. Skipped providers don't count.
 */
export function decideFinalStatus(attempts: readonly ProviderAttempt[]): EnrichPhoneResult['status'] {
  if (attempts.some((a) => a.outcome === 'FOUND')) return PhoneEnrichmentStatus.FOUND
  const called = attempts.filter((a) => a.outcome !== 'SKIPPED')
  if (called.length > 0 && called.every((a) => a.outcome === 'ERROR')) return PhoneEnrichmentStatus.FAILED
  return PhoneEnrichmentStatus.NOT_FOUND
}
