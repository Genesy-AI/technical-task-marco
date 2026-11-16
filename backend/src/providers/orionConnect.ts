import { companyDomainFromEmail } from './emailDomain'
import { isRecord, postJson, toPhoneString } from './http'
import { PhoneLookupInput, PhoneProvider, ProviderResponseError } from './types'

export interface OrionConnectConfig {
  baseUrl: string
  apiKey: string
  timeoutMs: number
}

const fullName = (input: PhoneLookupInput) => `${input.firstName} ${input.lastName}`.trim()

/**
 * Orion Connect: best data, slow (~4.2s), intermittent 500s.
 * Request `{ fullName, companyWebsite }`, header `x-auth-me`, response `{ phone: string | null }`.
 * We have no companyWebsite field, so it is derived from a business email domain (ADR-003).
 */
export function createOrionConnect(config: OrionConnectConfig): PhoneProvider {
  return {
    id: 'orionConnect',
    canHandle: (input) => Boolean(fullName(input)) && companyDomainFromEmail(input.email) !== null,
    async findPhone(input) {
      const body = await postJson(
        `${config.baseUrl}/orionConnect`,
        { fullName: fullName(input), companyWebsite: companyDomainFromEmail(input.email) },
        { providerId: 'orionConnect', headers: { 'x-auth-me': config.apiKey }, timeoutMs: config.timeoutMs }
      )
      if (!isRecord(body)) throw new ProviderResponseError('orionConnect', 'body is not an object')

      const phone = toPhoneString(body.phone, 'orionConnect', 'phone')
      return phone ? { phone, countryCode: null } : null
    },
  }
}
