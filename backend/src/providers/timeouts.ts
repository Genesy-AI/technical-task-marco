import type { PhoneProviderId } from './types'

/**
 * Single source of truth for provider timeouts, shared by the adapters (HTTP abort) and the
 * workflow (activity startToCloseTimeout). Pure constants so the workflow sandbox can import it.
 *
 * Sized from measured latency (2026-11-16): Orion ~4.2s, Astra 0.2-1.2s, Nimbus ~2.3-2.5s.
 * Roughly 2x headroom; the HTTP request aborts 1s before the activity times out so a slow
 * attempt really stops instead of leaking while Temporal retries it.
 */
export const PROVIDER_TIMEOUTS_MS: Readonly<Record<PhoneProviderId, { request: number; activity: number }>> = {
  orionConnect: { request: 9_000, activity: 10_000 },
  astraDialer: { request: 4_000, activity: 5_000 },
  nimbusLookup: { request: 5_000, activity: 6_000 },
}
