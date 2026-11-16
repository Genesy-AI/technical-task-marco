import { ActivityFailure, proxyActivities, RetryPolicy } from '@temporalio/workflow'
import { PROVIDER_TIMEOUTS_MS } from '../providers/timeouts'
import type { PhoneLookupInput, PhoneProviderId } from '../providers/types'
import type * as activities from './activities'
import {
  decideFinalStatus,
  EnrichPhoneResult,
  PHONE_PROVIDER_ORDER,
  PhoneEnrichmentStatus,
  ProviderActivityResult,
  ProviderAttempt,
} from './phoneEnrichment'

/**
 * Provider calls: 3 attempts with exponential backoff (1s, 2s). Combined with the per-provider
 * startToCloseTimeout, the worst case per provider is 3 x timeout + 3s (Orion ~33s, Astra ~18s,
 * Nimbus ~21s, ~72s total) while the typical case is 1-5s. Non-retryable failures (4xx, bad shape)
 * skip the remaining attempts.
 */
const providerRetry: RetryPolicy = {
  maximumAttempts: 3,
  initialInterval: '1 second',
  backoffCoefficient: 2,
}

const proxyFor = (id: PhoneProviderId) =>
  proxyActivities<typeof activities>({
    startToCloseTimeout: PROVIDER_TIMEOUTS_MS[id].activity,
    retry: providerRetry,
  })

const finders: Record<PhoneProviderId, (input: PhoneLookupInput) => Promise<ProviderActivityResult>> = {
  orionConnect: proxyFor('orionConnect').findPhoneOrionConnect,
  astraDialer: proxyFor('astraDialer').findPhoneAstraDialer,
  nimbusLookup: proxyFor('nimbusLookup').findPhoneNimbusLookup,
}

/** Local SQLite writes: fast, so a short timeout with a few quick retries. */
const db = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 seconds',
  retry: { maximumAttempts: 3, initialInterval: '500 milliseconds', backoffCoefficient: 2 },
})

/**
 * Finds a lead's phone via the fallback chain Orion -> Astra -> Nimbus, stopping at the first hit.
 * Idempotency is enforced by the caller's workflowId (`enrich-phone-<leadId>`).
 * Deterministic: all I/O happens in activities; progress is persisted after every step.
 */
export async function enrichPhoneWorkflow(leadId: number): Promise<EnrichPhoneResult> {
  try {
    const input = await db.loadLeadForPhoneEnrichment(leadId)
    const attempts: ProviderAttempt[] = []

    for (const providerId of PHONE_PROVIDER_ORDER) {
      await db.updatePhoneEnrichment(leadId, { status: PhoneEnrichmentStatus.IN_PROGRESS, provider: providerId })
      try {
        const result = await finders[providerId](input)
        attempts.push({ providerId, outcome: result.outcome })
        if (result.outcome === 'FOUND') {
          await db.updatePhoneEnrichment(leadId, {
            status: PhoneEnrichmentStatus.FOUND,
            provider: providerId,
            phone: result.phone,
          })
          return { status: PhoneEnrichmentStatus.FOUND, providerId, phone: result.phone, attempts }
        }
      } catch (err) {
        // Retries exhausted or non-retryable: record it and fall back to the next provider.
        if (!(err instanceof ActivityFailure)) throw err
        attempts.push({ providerId, outcome: 'ERROR', error: err.cause?.message ?? err.message })
      }
    }

    const status = decideFinalStatus(attempts)
    await db.updatePhoneEnrichment(leadId, { status, provider: null })
    return { status, providerId: null, phone: null, attempts }
  } catch (err) {
    // Unexpected failure (e.g. DB unavailable after retries): best effort so the UI never stays stuck in progress.
    await db.updatePhoneEnrichment(leadId, { status: PhoneEnrichmentStatus.FAILED, provider: null }).catch(() => undefined)
    throw err
  }
}
