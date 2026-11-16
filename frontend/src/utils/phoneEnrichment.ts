import type { LeadsEnrichPhoneOutput } from '../api/types/leads/enrichPhone'

/** Mirrors backend/src/workflows/phoneEnrichment.ts. */
export const ACTIVE_PHONE_ENRICHMENT_STATUSES: ReadonlySet<string> = new Set(['PENDING', 'IN_PROGRESS'])

/** Poll interval while any lead is being enriched; polling stops when none are. */
export const PHONE_ENRICHMENT_POLL_MS = 2000

const PROVIDER_LABELS: Readonly<Record<string, string>> = {
  orionConnect: 'Orion',
  astraDialer: 'Astra',
  nimbusLookup: 'Nimbus',
}

export const providerLabel = (provider: string | null | undefined): string | null =>
  provider ? (PROVIDER_LABELS[provider] ?? provider) : null

export function isPhoneEnrichmentActive(
  leads: ReadonlyArray<{ phoneEnrichmentStatus: string | null }> | undefined
): boolean {
  return Boolean(leads?.some((l) => l.phoneEnrichmentStatus && ACTIVE_PHONE_ENRICHMENT_STATUSES.has(l.phoneEnrichmentStatus)))
}

export type BadgeTone = 'gray' | 'blue' | 'green' | 'amber' | 'red'

export interface PhoneEnrichmentBadge {
  label: string
  tone: BadgeTone
  /** Tooltip with the longer explanation. */
  title: string
  inProgress: boolean
}

/** Badge for a lead's phone enrichment status; null when the lead was never enriched. */
export function phoneEnrichmentBadge(
  status: string | null,
  provider: string | null
): PhoneEnrichmentBadge | null {
  const name = providerLabel(provider)
  switch (status) {
    case null:
      return null
    case 'PENDING':
      return { label: 'Queued', tone: 'gray', title: 'Waiting to start phone enrichment', inProgress: true }
    case 'IN_PROGRESS':
      return {
        label: name ? `Searching · ${name}` : 'Searching',
        tone: 'blue',
        title: name ? `Asking ${name} for a phone number` : 'Looking for a phone number',
        inProgress: true,
      }
    case 'FOUND':
      return {
        label: name ? `Found · ${name}` : 'Found',
        tone: 'green',
        title: name ? `Phone found by ${name}` : 'Phone found',
        inProgress: false,
      }
    case 'NOT_FOUND':
      return { label: 'No data found', tone: 'amber', title: 'No provider had a phone for this lead', inProgress: false }
    case 'FAILED':
      return {
        label: 'Failed',
        tone: 'red',
        title: 'Providers could not be reached. Try Enrich Phone again later.',
        inProgress: false,
      }
    default:
      return { label: status, tone: 'gray', title: status, inProgress: false }
  }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const names = (refs: Array<{ leadName: string }>) => refs.map((r) => r.leadName).join(', ')

export interface EnrichPhoneToasts {
  success?: string
  info?: string
  error?: string
}

/** Turns the POST /leads/enrich-phone response into user-facing toast messages. */
export function summarizeEnrichPhoneResponse(data: LeadsEnrichPhoneOutput): EnrichPhoneToasts {
  const toasts: EnrichPhoneToasts = {}
  if (data.started.length > 0) {
    toasts.success = `Phone enrichment started for ${plural(data.started.length, 'lead')}`
  }
  const info: string[] = []
  if (data.alreadyRunning.length > 0) info.push(`already running for ${names(data.alreadyRunning)}`)
  if (data.skipped.length > 0) info.push(`skipped ${names(data.skipped)} (already have a phone)`)
  if (info.length > 0) {
    const text = info.join('; ')
    toasts.info = text.charAt(0).toUpperCase() + text.slice(1)
  }
  if (data.errors.length > 0) {
    toasts.error = `Could not start phone enrichment for ${names(data.errors)}. Please try again.`
  }
  return toasts
}
