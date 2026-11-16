import { normalizeCountryCode } from '../validation/countryCode'
import { isRecord, postJson, toPhoneString } from './http'
import { PhoneProvider, ProviderResponseError } from './types'

export interface NimbusLookupConfig {
  baseUrl: string
  apiKey: string
  timeoutMs: number
}

/**
 * Nimbus Lookup: new provider (~2.3-2.5s, occasional 500s).
 * Request `{ email, jobTitle }` (both required, 400 otherwise), auth via query param `api`.
 * The README documents `{ number, countryCode }`, but the live API returns
 * `{ phoneNmbr: number, countryCode: "ES" }`, so we read `phoneNmbr` and accept `number` as a fallback.
 */
export function createNimbusLookup(config: NimbusLookupConfig): PhoneProvider {
  return {
    id: 'nimbusLookup',
    canHandle: (input) => Boolean(input.email?.trim()) && Boolean(input.jobTitle?.trim()),
    async findPhone(input) {
      const url = `${config.baseUrl}/numbusLookup?api=${encodeURIComponent(config.apiKey)}`
      const body = await postJson(
        url,
        { email: input.email.trim(), jobTitle: input.jobTitle?.trim() },
        { providerId: 'nimbusLookup', timeoutMs: config.timeoutMs }
      )
      if (!isRecord(body)) throw new ProviderResponseError('nimbusLookup', 'body is not an object')

      const raw = body.phoneNmbr ?? body.number
      const phone = toPhoneString(raw, 'nimbusLookup', 'phoneNmbr')
      if (!phone) return null

      // An invalid country code should not cost us a found phone: store null instead (same rule as ADR-001).
      return { phone, countryCode: normalizeCountryCode(body.countryCode).code }
    },
  }
}
